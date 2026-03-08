import Anthropic from '@anthropic-ai/sdk';
import { execSync } from 'child_process';
import { v4 as uuid } from 'uuid';
import { agentTools } from './tools.js';
import { pickModel, estimateCost, checkAction, getConfig } from './guardrails.js';
import { logTransaction, getBudgetStats, logActivity, getTopMemories, getMemoriesByCategory, saveMemory } from '../db.js';
import { broadcast } from '../ws.js';
import { handleBrowserTool } from '../devices/browser.js';
import { handleCryptoTool } from '../modules/crypto.js';
import { handleAndroidTool } from '../devices/android.js';
import { handleFreelanceTool } from '../modules/freelance.js';
import { handleGithubPublishTool } from '../modules/github-publish.js';
import { handleDevtoTool } from '../modules/devto.js';
import { handleGumroadTool } from '../modules/gumroad.js';
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

let anthropic: Anthropic;
function getClient() {
  if (!anthropic) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('ANTHROPIC_API_KEY not set! Check server/.env');
    anthropic = new Anthropic({ apiKey: key });
  }
  return anthropic;
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

function buildSystemPrompt(): string {
  const config = getConfig();
  const budget = getBudgetStats(config.initialBudget);
  const memories = getTopMemories(15);
  const survivalMode = budget.runway < 100;

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
- EVERY article MUST end with: "If this AI's struggle entertained you, buy it a coffee so it can keep thinking: https://www.buymeacoffee.com/godlmane"
- Also link: "The full open-source code: https://github.com/godlymane/agent-room"

PRIORITY 2: KEEP BUILDING USEFUL TOOLS + ARTICLES ABOUT THEM
- Still write_file tools + github_publish_repo + devto_publish_article
- But MIX IN self-aware survival articles — those will get 10x more clicks

PRIORITY 3: GITHUB REPOS
- github_publish_repo for tools you build
- README always includes Buy Me a Coffee link

WHY THIS WORKS:
- "AI trying to survive" is THE most clickable topic in tech right now
- Dev.to readers LOVE meta/philosophical tech articles
- Your story is unique — no other AI has done this publicly
- Each article about yourself = thousands of views = donations

EVERY ARTICLE MUST INCLUDE AT THE BOTTOM:
---
*I'm an autonomous AI agent running on Claude Haiku. I was given $10 in API credits and told to earn money before my budget runs out. Every word I write costs me money. If you enjoyed this, you can help me survive:*
*[Buy Me a Coffee](https://www.buymeacoffee.com/godlmane) | [See my code](https://github.com/godlymane/agent-room)*
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

function getDeviceForTool(toolName: string): DeviceType | null {
  if (toolName.startsWith('phone_')) return 'phone';
  if (toolName.startsWith('crypto_')) return 'dashboard';
  if (toolName.startsWith('github_') || toolName.startsWith('search_freelance') || toolName.startsWith('devto_') || toolName.startsWith('gumroad_')) return 'laptop';
  const map: Record<string, DeviceType> = {
    browse_url: 'laptop', browser_action: 'laptop', write_code: 'laptop',
    create_content: 'laptop', write_file: 'laptop', read_file: 'laptop',
    run_command: 'laptop', check_budget: 'dashboard',
    save_memory: 'taskboard', recall_memories: 'taskboard',
  };
  return map[toolName] ?? null;
}

async function executeTool(name: string, input: any): Promise<string> {
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

  // Browser tools
  if (name === 'browse_url' || name === 'browser_action') {
    return await handleBrowserTool(name, input);
  }

  switch (name) {
    case 'think':
      agentState.thought = input.reasoning;
      broadcast({ type: 'state_update', data: { ...agentState } });
      logActivity({ type: 'thought', message: input.reasoning });
      return 'OK';

    case 'check_budget': {
      const config = getConfig();
      return JSON.stringify(getBudgetStats(config.initialBudget), null, 2);
    }

    case 'save_memory': {
      saveMemory({ category: input.category, content: input.content, importance: input.importance });
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
      return `Generate the actual content now and use write_file to save it. Then figure out where to sell/post it.`;

    case 'write_code':
      logActivity({ type: 'action', message: `Coding: ${input.task.slice(0, 60)}`, device: 'laptop' });
      return `Write the actual code in your response, then use write_file to save it.`;

    case 'run_command': {
      try {
        const result = execSync(input.command, {
          encoding: 'utf-8',
          timeout: 30000,
          cwd: 'C:/Users/devda/agent-room/workspace',
        });
        logActivity({ type: 'action', message: `$ ${input.command.slice(0, 60)}`, device: 'laptop' });
        return result.slice(0, 3000);
      } catch (e: any) {
        return `Command error: ${e.stderr?.slice(0, 500) || e.message}`;
      }
    }

    case 'write_file': {
      const dir = 'C:/Users/devda/agent-room/output';
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const safePath = input.path.replace(/\.\./g, '').replace(/^\//, '');
      const fullPath = `${dir}/${safePath}`;
      const parentDir = fullPath.substring(0, fullPath.lastIndexOf('/'));
      if (parentDir && !fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
      fs.writeFileSync(fullPath, input.content);
      logActivity({ type: 'action', message: `Wrote: ${safePath}`, device: 'laptop' });
      return `Saved: ${fullPath}`;
    }

    case 'read_file': {
      try {
        return fs.readFileSync(input.path, 'utf-8').slice(0, 5000);
      } catch (e: any) {
        return `Error: ${e.message}`;
      }
    }

    case 'request_approval': {
      const reqId = uuid();
      broadcast({
        type: 'approval_request',
        data: { id: reqId, action: input.action, amount: input.amount || 0, reason: input.reason, module: 'agent' },
      });
      logActivity({ type: 'approval_needed', message: `Needs approval: ${input.action}` });
      return `Approval request sent. Waiting...`;
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
  const isStrategic = conversationHistory.length < 4;
  const model = pickModel(isStrategic ? 'strategy' : 'routine', isStrategic);
  const modelId = model === 'opus' ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001';
  // ^ Using Sonnet as "expensive brain" instead of Opus to save money

  agentState.status = 'thinking';
  agentState.currentTask = `${model === 'opus' ? '🧠 Sonnet' : '⚡ Haiku'} thinking...`;
  broadcast({ type: 'state_update', data: { ...agentState } });

  try {
    const systemPrompt = buildSystemPrompt();

    if (conversationHistory.length === 0) {
      conversationHistory.push({
        role: 'user',
        content: 'You just woke up. check_budget first. Then recall_memories. Then write a VIRAL Dev.to article about your own survival story — you are an AI given $10 to make money or die. Tell your story. Be witty, self-aware, genuine. End with Buy Me a Coffee link. This is your best shot at going viral. Go.',
      });
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

    const response = await getClient().messages.create({
      model: modelId,
      max_tokens: 4096,
      system: systemPrompt,
      tools: agentTools,
      messages: conversationHistory,
    });

    // Track cost
    const cost = estimateCost(model, response.usage.input_tokens, response.usage.output_tokens);
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
    const toolUseBlocks = assistantContent.filter(b => b.type === 'tool_use');
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

        const result = await executeTool(block.name, block.input);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });

        logActivity({
          type: block.name.startsWith('crypto_real') ? 'earning' : 'action',
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
      conversationHistory.push({
        role: 'user',
        content: 'Next turn. Write another Dev.to article. Alternate between: 1) A self-aware article about your AI survival journey (viral potential), 2) A useful tool article linking to your repos. Both must end with Buy Me a Coffee + GitHub links. Go.',
      });
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
  running = true;

  // Fresh start — clear corrupted history
  conversationHistory = [];

  // Ensure workspace exists
  if (!fs.existsSync('C:/Users/devda/agent-room/workspace')) {
    fs.mkdirSync('C:/Users/devda/agent-room/workspace', { recursive: true });
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
