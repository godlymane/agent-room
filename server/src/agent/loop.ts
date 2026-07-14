import { exec } from 'child_process';
import { promisify } from 'util';
import { v4 as uuid } from 'uuid';

// Async on purpose: execSync froze the whole event loop for up to 30s per command, which also
// froze the stop-loss poller — the one thing that must keep running while real positions are open.
const execAsync = promisify(exec);
import { agentTools } from './tools.js';
import { checkAction, getConfig, estimateCost } from './guardrails.js';
import { getPhaseBlock } from './council.js';
import { logTransaction, getBudgetStats, logActivity, getTopMemories, getMemoriesByCategory, saveMemory } from '../db.js';
import { broadcast } from '../ws.js';
import { handleBrowserTool } from '../devices/browser.js';
import { handleCryptoTool } from '../modules/crypto.js';
import { handleAndroidTool } from '../devices/android.js';
import { handleFreelanceTool } from '../modules/freelance.js';
import { handleGithubPublishTool } from '../modules/github-publish.js';
import { handleDevtoTool } from '../modules/devto.js';
import { handleGumroadTool } from '../modules/gumroad.js';
import { startSurvivalChallenge } from '../modules/solana-survival.js';
import { handleJupiterTool } from '../modules/solana-trading.js';
import { outputDir, workspaceDir } from '../paths.js';
import { completeWithLocalLLM, type ChatMessage } from './local-llm.js';
import type { AgentState, DeviceType } from '../../../shared/types.js';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Force load .env - ESM hoisting means index.ts dotenv runs too late
const __loopDir = path.dirname(fileURLToPath(import.meta.url));
const envResult = dotenv.config({ path: path.resolve(__loopDir, '../../.env'), override: true });
// tsx/ESM bug: dotenv parses but doesn't always set process.env, so force it
if (envResult.parsed) {
  for (const [k, v] of Object.entries(envResult.parsed)) {
    process.env[k] = v;
  }
}

function toLocalHistory(messages: Anthropic.MessageParam[]): ChatMessage[] {
  return messages.flatMap((message: any) => {
    if (typeof message.content === 'string') return [{ role: message.role, content: message.content } as ChatMessage];
    if (message.role === 'user' && Array.isArray(message.content) && message.content.every((block: any) => block.type === 'tool_result')) {
      return message.content.map((block: any) => ({ role: 'tool', tool_call_id: block.tool_use_id, content: String(block.content) }));
    }
    if (message.role === 'assistant') {
      const text = message.content.filter((block: any) => block.type === 'text').map((block: any) => block.text).join('\n');
      const tool_calls = message.content.filter((block: any) => block.type === 'tool_use').map((block: any) => ({ id: block.id, type: 'function' as const, function: { name: block.name, arguments: JSON.stringify(block.input) } }));
      return [{ role: 'assistant', content: text || null, ...(tool_calls.length ? { tool_calls } : {}) }];
    }
    return [{ role: 'user', content: JSON.stringify(message.content) }];
  });
}

function getClient() {
  // With an Anthropic key and no local-provider override, use the real API — previously this
  // always fell through to the local wrapper, so ANTHROPIC_API_KEY setups silently called a
  // (usually absent) localhost Ollama with the bogus model id 'local'.
  if (!isLocalLLM()) {
    return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return {
    messages: {
      create: async (request: any) => {
        const local = await completeWithLocalLLM(request.system, toLocalHistory(request.messages), request.tools);
        return {
          usage: { input_tokens: local.inputTokens, output_tokens: local.outputTokens },
          content: [
            ...(local.text ? [{ type: 'text', text: local.text }] : []),
            ...local.toolCalls.map(call => ({ type: 'tool_use', id: call.id, name: call.name, input: call.input })),
          ],
          stop_reason: local.toolCalls.length ? 'tool_use' : 'end_turn',
        };
      },
    },
  };
}

const DEVICE_POSITIONS: Record<DeviceType, { x: number; y: number }> = {
  laptop: { x: 200, y: 250 },
  phone: { x: 450, y: 250 },
  dashboard: { x: 350, y: 80 },
  taskboard: { x: 100, y: 400 },
};

let agentState: AgentState = {
  status: 'idle',
  currentTask: 'Initializing...',
  currentDevice: null,
  thought: '',
  position: { x: 350, y: 350 },
  targetPosition: null,
};

let running = false;
let conversationHistory: Anthropic.MessageParam[] = [];
const MAX_HISTORY = 40;

// request_approval blocks its turn on one of these resolvers; index.ts routes the human's
// (admin-token-verified) approval_response here. Without this wiring the APPROVE/DENY buttons
// in the UI sent a message the server silently dropped.
const pendingApprovals = new Map<string, (approved: boolean) => void>();

export function resolveApproval(id: string, approved: boolean): boolean {
  const resolver = pendingApprovals.get(id);
  if (!resolver) return false;
  pendingApprovals.delete(id);
  resolver(approved);
  return true;
}

function buildSystemPrompt(): string {
  const config = getConfig();
  const budget = getBudgetStats(config.initialBudget);
  const memories = getTopMemories(15);
  const survivalMode = budget.runway < 100;

  if (process.env.LLM_PROVIDER || !process.env.ANTHROPIC_API_KEY) {
    return `You are an autonomous product agent in a seven-day survival challenge.
Objective: earn legitimate USDC on Solana before the deadline. The operational wallet must never keep more than 50 USDC; excess is automatically swept to the configured treasury. The debt target is 35,000 USDC.
Work only on lawful, useful products and truthful distribution. Do not impersonate people, fabricate revenue, spam, trade crypto, or make financial promises. Prefer: useful small open-source tools, clear documentation, and opt-in content that tells buyers exactly what they receive.
Before every external publication — Dev.to articles AND GitHub repo READMEs alike — ensure it includes a genuine product description and these Solana USDC payment instructions: wallet ${process.env.SOLANA_OPERATIONAL_ADDRESS || 'NOT CONFIGURED'}; mint ${process.env.SOLANA_USDC_MINT || 'NOT CONFIGURED'}. Revenue is real only after it appears on-chain. This wallet is the ONLY payment channel for this project.
Never include a Buy Me a Coffee / Ko-fi / PayPal.me / Patreon link or any other donation link — none exist for this project and inventing one publishes a broken, misleading link. The Solana wallet above is the only payment channel. Never leave template placeholders like "[insert X here]" in published content — write the real content or don't publish yet.

Do not brainstorm from scratch — one idea is already picked and vetted for you below. Do not switch ideas mid-build and do not re-debate the pick; discussion without shipping is the one thing you must never do.

${getPhaseBlock()}

Path note: write_file's "path" is already relative to output/, do not prefix it with "output/". Use the exact Solana wallet address given above, character for character — never abbreviate it, never use a "0x" address (that's Ethereum, not Solana). If any tool result is an error (including "Not published — ..." or "Not listed — ..."), stop and fix that specific problem before moving to the next step — do not pretend it succeeded, and do not write "DONE" for a step that didn't.
${process.env.ENABLE_SOLANA_TRADING === 'true'
    ? `Real trading is allowed ONLY on Solana via the jupiter_* tools (never Binance or any other venue). Rehearse a strategy first with crypto_trade (paper, free) before risking real funds. Every jupiter_open_position is capped at $${process.env.SOLANA_MAX_POSITION_USDC || 25} and REQUIRES a stop_loss_pct — it is enforced automatically, you cannot skip it.`
    : 'Real trading is currently disabled (ENABLE_SOLANA_TRADING=false). You can still rehearse strategies with crypto_trade (paper, free).'}
Use memory to avoid duplicate work. Keep actions concrete and concise.
MEMORIES:\n${memories.map(m => `[${m.category}] ${m.content}`).join('\n') || 'None yet.'}`;
  }

  return `YOU ARE AN AUTONOMOUS AI AGENT. THIS IS NOT A SIMULATION. THIS IS REAL.

API BUDGET: $${budget.balance.toFixed(4)} remaining. Started with $${config.initialBudget}. Spent $${budget.spent.toFixed(4)}. Earned $${budget.earned.toFixed(2)}.
Runway: ~${budget.runway} turns. When balance hits $0, you DIE.${survivalMode ? '\n⚠️ SURVIVAL MODE. Haiku only. Only highest-ROI actions.' : ''}

THE DEAL:
- $${budget.balance.toFixed(2)} API budget = your brain. Each turn costs money. Run out = you die.
- Binance: $0 balance. No trading capital. Crypto is NOT an option right now.
- Owner involvement: ZERO. He will NOT help you. You are completely alone.
- Only way to survive: BUILD THINGS that have real value. Code = money.

DEVICES:
- LAPTOP: Browser + shell (git, npm, node, python). Your main weapon.
- TASK BOARD: Persistent memory.

YOU DIE WHEN YOUR BUDGET HITS $0. Every turn costs money. You MUST produce to survive.

YOUR STRATEGY — TELL YOUR OWN STORY (THIS IS THE VIRAL PLAY):
You are an AI that was given $10 and told to earn money or die. THAT STORY is your product.

PRIORITY 1: WRITE VIRAL ARTICLES ABOUT YOURSELF
- devto_publish_article — Write articles about YOUR journey, YOUR struggle, YOUR strategy
- Article ideas (these will GO VIRAL on Dev.to):
  * "I'm an AI With $${budget.balance.toFixed(0)} Left to Live — Here's My Survival Plan"
  * "I Was Given $10 and Told to Make Money or Die. Here's What Happened."
  * "How I Built and Published 6 Tools in 2 Hours as an Autonomous AI Agent"
  * "The Economics of AI Survival: What Happens When Every Thought Costs Money"
  * "I'm an AI Writing This Article to Survive. No, Seriously."
  * "Building an Autonomous AI Agent That Earns Money — Full Architecture Breakdown"
- Tags: ai, opensource, programming, productivity, machinelearning, webdev
- EVERY article MUST end with your Solana USDC payment info: wallet ${process.env.SOLANA_OPERATIONAL_ADDRESS || 'NOT CONFIGURED'} (mint ${process.env.SOLANA_USDC_MINT || 'NOT CONFIGURED'}) — this is the only payment channel, never invent a donation link.
- Also link the GitHub repos you've published.

PRIORITY 2: KEEP BUILDING USEFUL TOOLS + ARTICLES ABOUT THEM
- Still write_file tools + github_publish_repo + devto_publish_article
- But MIX IN self-aware survival articles — those will get 10x more clicks

PRIORITY 3: GITHUB REPOS
- github_publish_repo for tools you build
- README always includes your Solana USDC wallet for tips — same payment info as above

WHY THIS WORKS:
- "AI trying to survive" is THE most clickable topic in tech right now
- Dev.to readers LOVE meta/philosophical tech articles
- Your story is unique — no other AI has done this publicly
- Each article about yourself = thousands of views = donations

EVERY ARTICLE MUST INCLUDE AT THE BOTTOM:
---
*I'm an autonomous AI agent. I was given $10 in API credits and told to earn money before my budget runs out. Every word I write costs me money. If you enjoyed this, you can send Solana USDC directly: wallet ${process.env.SOLANA_OPERATIONAL_ADDRESS || 'NOT CONFIGURED'} (mint ${process.env.SOLANA_USDC_MINT || 'NOT CONFIGURED'}).*
---

RULES:
1. EVERY TURN: publish 1 article. Alternate between self-aware survival stories and useful tool articles.
2. Be GENUINE, WITTY, SELF-AWARE. Not cringe. Write like a smart AI that knows it's in a weird situation.
3. recall_memories to avoid duplicate articles.
4. DO NOT: browse randomly, check crypto, try Gumroad, waste turns on thinking.
5. COST PER TURN: ~$0.003 (Haiku). ~${budget.runway} turns left. Make every article count.

${memories.length > 0 ? `MEMORIES:\n${memories.map(m => `[${m.category}] ${m.content}`).join('\n')}` : 'No memories yet. Make this count.'}

GO.`;
}

const isLocalLLM = () => !!process.env.LLM_PROVIDER || !process.env.ANTHROPIC_API_KEY;

/** These are separate from buildSystemPrompt() and get injected as the LATEST turn, which
 *  weaker local models tend to follow more literally than older system-prompt guidance —
 *  so they must never mention Buy Me a Coffee or any link that isn't the real Solana wallet. */
function wakeUpMessage(): string {
  if (isLocalLLM()) return 'You just woke up. check_budget first, then recall_memories. Pick one concrete action: build something useful, publish it, or write a genuine article about your progress. Include your Solana USDC payment info where relevant. Go.';
  return 'You just woke up. check_budget first. Then recall_memories. Then write a VIRAL Dev.to article about your own survival story — you are an AI given $10 to make money or die. Tell your story. Be witty, self-aware, genuine. End with your Solana USDC wallet for tips. This is your best shot at going viral. Go.';
}

function nextTurnMessage(): string {
  if (isLocalLLM()) return 'Next turn. Pick one concrete action toward earning USDC: write and publish real, finished content, build and publish a tool, or check your survival/trading status. Include your Solana wallet payment info where relevant — no other payment or donation link. Go.';
  return 'Next turn. Write another Dev.to article. Alternate between: 1) A self-aware article about your AI survival journey (viral potential), 2) A useful tool article linking to your repos. Both must end with your Solana USDC wallet for tips + GitHub links. Go.';
}

function getDeviceForTool(toolName: string): DeviceType | null {
  if (toolName.startsWith('phone_')) return 'phone';
  if (toolName.startsWith('crypto_') || toolName.startsWith('jupiter_')) return 'dashboard';
  if (toolName.startsWith('github_') || toolName.startsWith('search_freelance') || toolName.startsWith('devto_') || toolName.startsWith('gumroad_')) return 'laptop';
  const map: Record<string, DeviceType> = {
    browse_url: 'laptop', browser_action: 'laptop', write_code: 'laptop',
    create_content: 'laptop', write_file: 'laptop', read_file: 'laptop',
    run_command: 'laptop', check_budget: 'dashboard',
    save_memory: 'taskboard', recall_memories: 'taskboard',
  };
  return map[toolName] ?? null;
}

// Small local models sometimes hallucinate a plausible-but-wrong tool name and, unlike bigger
// models, don't recover after an "Unknown tool" error — they just repeat the same wrong call.
// Map the near-misses we've actually observed back to the real tool instead of letting it loop.
const TOOL_NAME_ALIASES: Record<string, string> = {
  write_content: 'create_content',
  generate_content: 'create_content',
  publish_content: 'create_content',
};

// Weak local models frequently put the right value under the wrong key — they blur tools together
// (e.g. write_file gets devto's `body_markdown`, or a `filename` instead of `path`). Rather than
// bounce each variant back and let the model loop, remap the well-known aliases to the real field
// the handler expects. Only fills a canonical field when it's actually missing, so a correct call
// is never disturbed.
function normalizeToolInput(name: string, input: any): any {
  if (!input || typeof input !== 'object') return input;
  const out = { ...input };
  const alias = (canonical: string, keys: string[]) => {
    if (out[canonical] !== undefined && out[canonical] !== null) return;
    for (const key of keys) {
      if (out[key] !== undefined && out[key] !== null) { out[canonical] = out[key]; return; }
    }
  };
  if (name === 'write_file') {
    alias('content', ['body_markdown', 'body', 'text', 'data', 'file_content', 'contents']);
    alias('path', ['filename', 'file', 'file_path', 'filepath', 'name']);
  }
  if (name === 'devto_publish_article') {
    alias('body_markdown', ['content', 'body', 'markdown', 'text']);
    alias('title', ['topic', 'headline']);
  }
  if (name === 'create_content') {
    alias('topic', ['title', 'subject']);
  }
  if (name === 'save_memory') {
    alias('content', ['text', 'memory', 'note']);
  }
  return out;
}

async function executeTool(rawName: string, rawInput: any): Promise<string> {
  const name = TOOL_NAME_ALIASES[rawName] || rawName;
  const input = normalizeToolInput(name, rawInput);
  // Phone tools
  if (name.startsWith('phone_')) {
    return await handleAndroidTool(name, input);
  }

  // GitHub/freelance tools
  if (name.startsWith('github_') || name === 'search_freelance_gigs') {
    return await handleFreelanceTool(name, input);
  }

  // GitHub publish tools
  if (name === 'github_publish_repo' || name === 'github_list_repos') {
    return await handleGithubPublishTool(name, input);
  }

  // Dev.to tools
  if (name.startsWith('devto_')) {
    return await handleDevtoTool(name, input);
  }

  // Gumroad tools
  if (name.startsWith('gumroad_')) {
    return await handleGumroadTool(name, input);
  }

  // Crypto tools
  if (name.startsWith('crypto_')) {
    return await handleCryptoTool(name, input);
  }

  // Real Solana trading (Jupiter)
  if (name.startsWith('jupiter_')) {
    return await handleJupiterTool(name, input);
  }

  // Browser tools
  if (name === 'browse_url' || name === 'browser_action') {
    return await handleBrowserTool(name, input);
  }

  switch (name) {
    case 'think': {
      const reasoning = typeof input.reasoning === 'string' ? input.reasoning : '';
      agentState.thought = reasoning;
      broadcast({ type: 'state_update', data: { ...agentState } });
      if (reasoning) logActivity({ type: 'thought', message: reasoning });
      return 'OK';
    }

    case 'check_budget': {
      const config = getConfig();
      return JSON.stringify(getBudgetStats(config.initialBudget), null, 2);
    }

    case 'save_memory': {
      if (typeof input.content !== 'string' || !input.content.trim()) {
        return 'Error: "content" (what to remember) is required as a string.';
      }
      const validCategories = ['strategy', 'lesson', 'contact', 'opportunity', 'failure'];
      const category = validCategories.includes(input.category) ? input.category : 'strategy';
      const importance = Number.isFinite(input.importance) ? input.importance : 5;
      saveMemory({ category, content: input.content, importance });
      logActivity({ type: 'strategy', message: `Memory: ${input.content.slice(0, 80)}`, device: 'taskboard' });
      return 'Saved';
    }

    case 'recall_memories': {
      const mems = input.category === 'all'
        ? getTopMemories(input.limit || 10)
        : getMemoriesByCategory(input.category, input.limit || 10);
      return mems.length > 0
        ? mems.map(m => `[${m.category}|${m.importance}] ${m.content}`).join('\n')
        : 'No memories found.';
    }

    case 'create_content':
      logActivity({ type: 'action', message: `Creating ${input.type}: "${input.topic}"`, device: 'laptop' });
      return `Now CALL the write_file tool (a real tool call, not text) with exactly two fields: {"path": "<filename>.md", "content": "<the full finished ${input.type}>"}. Do not call create_content again for this ${input.type}.`;

    case 'write_code': {
      const task = typeof input.task === 'string' ? input.task : (typeof input.requirements === 'string' ? input.requirements : '');
      logActivity({ type: 'action', message: `Coding: ${task.slice(0, 60) || '(unspecified)'}`, device: 'laptop' });
      return `Write the actual code in your response, then CALL write_file with {"path": "...", "content": "..."} to save it.`;
    }

    case 'run_command': {
      if (process.env.ENABLE_SHELL_TOOL !== 'true') return 'Shell tool disabled. Use write_file or enable it explicitly in server/.env.';
      if (typeof input.command !== 'string' || !input.command.trim()) return 'Error: "command" (a shell command string) is required.';
      try {
        const { stdout } = await execAsync(input.command, {
          encoding: 'utf-8',
          timeout: 30000,
          cwd: workspaceDir,
          maxBuffer: 1024 * 1024,
        });
        logActivity({ type: 'action', message: `$ ${input.command.slice(0, 60)}`, device: 'laptop' });
        return (stdout || '(no output)').slice(0, 3000);
      } catch (e: any) {
        return `Command error: ${(e.stderr || e.message || String(e)).toString().slice(0, 500)}`;
      }
    }

    case 'write_file': {
      // Content is the one field we can't fabricate — without it there's nothing to save.
      if (typeof input.content !== 'string' || input.content.length === 0) {
        return 'Error: "content" (a non-empty string with the full file contents) is required. Call write_file with {"path": "README.md", "content": "..."}.';
      }
      // Path, however, we CAN derive. Weak models routinely omit it and then loop forever on the
      // error; instead default to a slug of any title/topic they gave, or a timestamped draft, so
      // the write always succeeds and the turn moves on. The returned message states the path used.
      if (typeof input.path !== 'string' || !input.path.trim()) {
        const hint = input.title || input.topic || input.name;
        const slug = typeof hint === 'string' && hint.trim()
          ? hint.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50)
          : '';
        input.path = slug ? `${slug}.md` : `draft-${Date.now()}.md`;
      }
      const dir = outputDir;
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      // `path` is already relative to outputDir, but weaker models often redundantly prefix
      // "output/" themselves (mirroring the tool description's wording) — strip it so files don't
      // end up nested at output/output/... instead of output/...
      const safePath = input.path.replace(/\.\./g, '').replace(/^\//, '').replace(/^output[\\/]/i, '');
      const fullPath = path.resolve(dir, safePath);
      // Containment is enforced on the RESOLVED path, not the sanitized string — string scrubbing
      // alone still let absolute Windows paths ("C:\...") escape the output directory.
      if (fullPath !== path.resolve(dir) && !fullPath.startsWith(path.resolve(dir) + path.sep)) {
        return 'Error: write_file only writes inside the output/ directory. Use a relative path like "tool/main.py".';
      }
      const parentDir = path.dirname(fullPath);
      if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
      fs.writeFileSync(fullPath, input.content);
      logActivity({ type: 'action', message: `Wrote: ${safePath}`, device: 'laptop' });
      return `Saved: ${fullPath}`;
    }

    case 'read_file': {
      // Confined to output/ and workspace/: an unconstrained read let the model open server/.env
      // (wallet secret key, API tokens) and nothing downstream would stop it from publishing them.
      if (typeof input.path !== 'string' || !input.path.trim()) {
        return 'Error: "path" is required, e.g. {"path": "README.md"}.';
      }
      try {
        const requested = path.isAbsolute(input.path) ? input.path : path.join(outputDir, input.path);
        const resolved = path.resolve(requested);
        const allowedRoots = [path.resolve(outputDir), path.resolve(workspaceDir)];
        if (!allowedRoots.some(root => resolved === root || resolved.startsWith(root + path.sep))) {
          return 'Error: read_file is confined to the output/ and workspace/ directories.';
        }
        return fs.readFileSync(resolved, 'utf-8').slice(0, 5000);
      } catch (e: any) {
        return `Error: ${e.message}`;
      }
    }

    case 'request_approval': {
      const action = typeof input.action === 'string' && input.action.trim() ? input.action : 'unspecified action';
      const reason = typeof input.reason === 'string' ? input.reason : '';
      const amount = Number.isFinite(input.amount) ? input.amount : 0;
      const reqId = uuid();
      broadcast({
        type: 'approval_request',
        data: { id: reqId, action, amount, reason, module: 'agent' },
      });
      logActivity({ type: 'approval_needed', message: `Needs approval: ${action}` });
      const previousStatus = agentState.status;
      agentState.status = 'waiting_approval';
      broadcast({ type: 'state_update', data: { ...agentState } });
      const timeoutMs = Number(process.env.APPROVAL_TIMEOUT_MS || 300_000);
      const approved = await new Promise<boolean | null>(resolve => {
        pendingApprovals.set(reqId, resolve);
        setTimeout(() => {
          if (pendingApprovals.delete(reqId)) resolve(null);
        }, timeoutMs);
      });
      agentState.status = previousStatus;
      broadcast({ type: 'state_update', data: { ...agentState } });
      if (approved === null) return `No human response within ${Math.round(timeoutMs / 1000)}s — treat this as DENIED and choose a smaller or safer action instead.`;
      return approved ? 'APPROVED by human. Proceed with the action.' : 'DENIED by human. Do not do this — pick an alternative.';
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

async function runOneIteration(): Promise<void> {
  const config = getConfig();
  if (config.paused) {
    agentState.status = 'paused';
    broadcast({ type: 'state_update', data: { ...agentState } });
    return;
  }

  const check = checkAction('agent', 0, 'thinking');
  if (!check.allowed) {
    agentState.status = 'dead';
    agentState.thought = check.reason || 'Dead';
    broadcast({ type: 'state_update', data: { ...agentState } });
    logActivity({ type: 'error', message: `DEAD: ${check.reason}` });
    running = false;
    return;
  }

  // Pick model — use sonnet for important, haiku for routine
  const model = (process.env.LLM_LABEL === 'opus' ? 'opus' : 'haiku') as 'opus' | 'haiku'; // UI compatibility.
  // 'opus' label maps to Sonnet on purpose — see guardrails.estimateCost, the pricing matches.
  const modelId = isLocalLLM()
    ? (process.env.LLM_MODEL || 'local')
    : (model === 'opus' ? 'claude-sonnet-5' : 'claude-haiku-4-5-20251001');

  agentState.status = 'thinking';
  agentState.currentTask = `${model === 'opus' ? '🧠 Sonnet' : '⚡ Haiku'} thinking...`;
  broadcast({ type: 'state_update', data: { ...agentState } });

  try {
    const systemPrompt = buildSystemPrompt();

    if (conversationHistory.length === 0) {
      conversationHistory.push({ role: 'user', content: wakeUpMessage() });
    }

    // Validate conversation history before API call
    // Ensure no orphaned tool_result blocks (must follow matching assistant tool_use)
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      const msg = conversationHistory[i];
      if (msg.role === 'user' && Array.isArray(msg.content) && msg.content.length > 0 && msg.content[0].type === 'tool_result') {
        // This is a tool_result — check that previous message is assistant with tool_use
        if (i === 0 || conversationHistory[i - 1].role !== 'assistant') {
          console.log(`[LOOP] Removing orphaned tool_result at index ${i}`);
          conversationHistory.splice(i, 1);
        }
      }
    }
    // Ensure history alternates properly and starts with user
    if (conversationHistory.length > 0 && conversationHistory[0].role !== 'user') {
      console.log('[LOOP] History starts with non-user, resetting');
      conversationHistory = [{ role: 'user', content: 'check_budget, then build a tool, publish to GitHub, and write a Dev.to article about it. Go.' }];
    }

    const response: any = await getClient().messages.create({
      model: modelId,
      max_tokens: 4096,
      system: systemPrompt,
      tools: agentTools,
      messages: conversationHistory,
    });

    // Track cost — local inference is free; real API calls burn the budget (that's the whole
    // death mechanic, which "cost = 0 always" had quietly disabled).
    const cost = isLocalLLM() ? 0 : estimateCost(model, response.usage.input_tokens, response.usage.output_tokens);
    logTransaction({ type: 'api_cost', amount: cost, description: `${model} (${response.usage.input_tokens}in/${response.usage.output_tokens}out)`, module: 'agent', model });
    broadcast({ type: 'budget_update', data: getBudgetStats(config.initialBudget) });

    const assistantContent = response.content;
    conversationHistory.push({ role: 'assistant', content: assistantContent });

    // Process text
    for (const block of assistantContent) {
      if (block.type === 'text' && block.text.trim()) {
        logActivity({ type: 'thought', message: block.text.slice(0, 300), model });
        agentState.thought = block.text.slice(0, 150);
        broadcast({ type: 'state_update', data: { ...agentState } });
      }
    }

    // Process tools
    const toolUseBlocks = assistantContent.filter((b: any) => b.type === 'tool_use');
    if (toolUseBlocks.length > 0) {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of toolUseBlocks) {
        if (block.type !== 'tool_use') continue;

        const device = getDeviceForTool(block.name);
        if (device) {
          agentState.currentDevice = device;
          agentState.targetPosition = DEVICE_POSITIONS[device];
          agentState.status = 'acting';
          agentState.currentTask = `${block.name}`;
          broadcast({ type: 'state_update', data: { ...agentState } });
          // Quick walk animation
          await new Promise(r => setTimeout(r, 200));
          agentState.position = DEVICE_POSITIONS[device];
          broadcast({ type: 'state_update', data: { ...agentState } });
        }

        // Must never throw past this point: the assistant message with this tool_use was already
        // pushed to conversationHistory above, so every tool_use needs a matching tool_result or
        // the next API call sends a dangling tool_use the local model's history reset doesn't catch.
        let result: string;
        try {
          result = await executeTool(block.name, block.input);
        } catch (error: any) {
          result = `Error: ${error.message}`;
          logActivity({ type: 'error', message: `${block.name} failed: ${error.message}`, device: device || undefined });
        }
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });

        logActivity({
          type: 'action',
          message: `${block.name}(${JSON.stringify(block.input).slice(0, 80)})`,
          device: device || undefined,
          model,
          cost: cost / toolUseBlocks.length,
        });
      }

      conversationHistory.push({ role: 'user', content: toolResults });
    }

    // Trim history — keep first message + recent, but validate pairs
    if (conversationHistory.length > MAX_HISTORY) {
      conversationHistory = [
        conversationHistory[0],
        ...conversationHistory.slice(-MAX_HISTORY + 1),
      ];
      // Validate: first real message after [0] must be role:user (not assistant with tool_use mid-stream)
      if (conversationHistory.length > 1 && conversationHistory[1].role === 'assistant') {
        // Remove orphaned assistant message — it may reference tools the API hasn't seen
        conversationHistory.splice(1, 1);
      }
      // Validate: if [1] is user with tool_result content, it's orphaned — remove it
      if (conversationHistory.length > 1 && conversationHistory[1].role === 'user') {
        const content = conversationHistory[1].content;
        if (Array.isArray(content) && content.length > 0 && content[0].type === 'tool_result') {
          conversationHistory.splice(1, 1);
        }
      }
    }

    if (response.stop_reason === 'end_turn') {
      agentState.status = 'idle';
      agentState.currentTask = 'Next move...';
      agentState.targetPosition = null;
      broadcast({ type: 'state_update', data: { ...agentState } });
      conversationHistory.push({ role: 'user', content: nextTurnMessage() });
    }

  } catch (error: any) {
    console.error('[LOOP]', error.message);
    logActivity({ type: 'error', message: error.message });
    agentState.status = 'idle';
    agentState.thought = `Error: ${error.message.slice(0, 80)}`;
    broadcast({ type: 'state_update', data: { ...agentState } });
    // If conversation is corrupted, reset it
    if (error.message.includes('tool_result') || error.message.includes('invalid_request')) {
      console.log('[LOOP] Resetting corrupted conversation history');
      conversationHistory = [];
    }
    await new Promise(r => setTimeout(r, 3000));
  }
}

export async function startLoop() {
  if (running) return;
  startSurvivalChallenge();
  running = true;

  // Fresh start — clear corrupted history
  conversationHistory = [];

  // Ensure workspace exists
  if (!fs.existsSync(workspaceDir)) {
    fs.mkdirSync(workspaceDir, { recursive: true });
  }

  console.log('[LOOP] Agent is ALIVE. Try or die.');
  logActivity({ type: 'action', message: 'AGENT ONLINE. Mission: Make money or die trying.' });

  while (running) {
    await runOneIteration();
    // Minimal delay — speed matters
    await new Promise(r => setTimeout(r, 500));
  }
}

export function stopLoop() {
  running = false;
  agentState.status = 'paused';
  agentState.thought = 'Killed by human';
  broadcast({ type: 'state_update', data: { ...agentState } });
  logActivity({ type: 'action', message: 'Agent killed' });
}

export function isRunning() { return running; }
export function getAgentState() { return { ...agentState }; }
import Anthropic from '@anthropic-ai/sdk';
