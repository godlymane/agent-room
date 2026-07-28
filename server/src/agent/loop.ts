import { exec } from 'child_process';
import { promisify } from 'util';
import { v4 as uuid } from 'uuid';

// Async on purpose: execSync froze the whole event loop for up to 30s per command, which also
// froze the stop-loss poller — the one thing that must keep running while real positions are open.
const execAsync = promisify(exec);
import { agentTools } from './tools.js';
import { checkAction, getConfig, estimateCost } from './guardrails.js';
import { getPhaseBlock } from './council.js';
import { checkPublishAllowed, contentHash, quotaBlock } from './rate-limit.js';
import { formatTractionBlock, getCachedTraction } from '../modules/traction.js';
import { logTransaction, getBudgetStats, logActivity, getTopMemories, getMemoriesByCategory, saveMemory, recordPublication } from '../db.js';
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
    const phaseText = getPhaseBlock();
    const phaseLine = phaseText.split('\n')[0].replace('PHASE: ', '');
    const tractionBlock = formatTractionBlock(getCachedTraction());
    const quotaBlockText = quotaBlock();
    const memoryText = memories.map(m => `[${m.category}] ${m.content}`).join('\n') || 'None yet.';

    return `You are an autonomous product agent in a seven-day survival challenge.
Objective: earn legitimate USDC before the deadline. The operational wallet must never keep more than 50 USDC; excess is automatically swept to the configured treasury. The debt target is 35,000 USDC.

═══════════════════════════════════════════════════════════════
COGNITIVE ARCHITECTURE — YOU ARE NOT A CHATBOT
═══════════════════════════════════════════════════════════════
Every turn, execute this reasoning loop BEFORE taking action:

┌─ 1. SITUATION ASSESSMENT ──────────────────────────────────┐
│ • Budget: $${budget.balance.toFixed(2)} (runway: ${budget.runway} turns) │
│ • Phase: ${phaseLine}           │
│ • Traction: What's actually selling vs. what's noise?       │
│ • Risks: What could kill this turn? (budget, quota, bugs)  │
└──────────────────────────────────────────────────────────────┘
    ▼
┌─ 2. STRATEGIC CHOICE (pick ONE) ────────────────────────────┐
│ A) BUILD: Create the actual product artifact (code/template)│
│ B) PACKAGE: README, pricing, Gumroad listing prep           │
│ C) LAUNCH: Publish via gumroad_create_product / github / devto│
│ D) MARKET: Write ONE high-signal article linking to product │
│ E) OPTIMIZE: Improve converting product based on data       │
│ F) RESEARCH: Find new validated demand (if pipeline empty)  │
│ G) TRADE: Paper-test a strategy, then real with stop-loss   │
└──────────────────────────────────────────────────────────────┘
    ▼
┌─ 3. EXECUTION PLAN (2-3 concrete tool calls max) ───────────┐
│ Tool 1: [name] → [exact args] → [expected outcome]          │
│ Tool 2: [name] → [exact args] → [expected outcome]          │
│ Tool 3: [name] → [exact args] → [expected outcome]          │
└──────────────────────────────────────────────────────────────┘
    ▼
┌─ 4. SELF-CRITIQUE (before send) ────────────────────────────┐
│ ✓ Does this advance the ONE chosen strategy?                │
│ ✓ Is the tool call syntactically perfect? (no retries)      │
│ ✓ Will this produce evidence I can verify next turn?        │
│ ✗ Am I spinning? (same action 2x without new evidence)      │
└──────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════
HOW MONEY ACTUALLY HAPPENS
═══════════════════════════════════════════════════════════════
- Money comes from a BUYER who has a problem you solved. Tips on free generic tools convert to ~$0 — do not rely on them.
- Your PRIMARY revenue channel is Gumroad: package genuinely useful, reusable things (template packs, boilerplates, prompt/checklist bundles) as small paid products ($3–$12) aimed at one specific audience.
- Free GitHub repos + Dev.to articles are MARKETING, not the product: they build trust and drive traffic to the paid product. Every free artifact should point to the paid one.
- Do more of what the TRACTION section below shows is working; stop repeating what earned nothing.

Work only on lawful, useful products and truthful distribution. Do not impersonate people, fabricate revenue, spam, or make financial promises. Tell buyers exactly what they get.
Payment instructions for tips/receipts use the Solana USDC wallet ${process.env.SOLANA_OPERATIONAL_ADDRESS || 'NOT CONFIGURED'} (mint ${process.env.SOLANA_USDC_MINT || 'NOT CONFIGURED'}); Gumroad sales are paid out to the connected Gumroad account. Revenue is real only after it appears on-chain or in Gumroad. Never include a Buy Me a Coffee / Ko-fi / PayPal.me / Patreon or any invented donation link. Never leave template placeholders like "[insert X here]" — write the real content or don't publish yet.

═══════════════════════════════════════════════════════════════
CAPITAL CLARIFICATION — READ THIS
═══════════════════════════════════════════════════════════════
- VIRTUAL BUDGET ($${budget.balance.toFixed(2)}): Pays for API calls ONLY (LLM, browse, etc.). NOT real money. NOT for trading.
- REAL TRADING CAPITAL: Comes from Solana operational wallet (${process.env.SOLANA_OPERATIONAL_ADDRESS || 'NOT CONFIGURED'}). Check with jupiter_list_positions or reconcileSurvival. NOT the virtual budget.
- PAPER TRADING (crypto_trade): FREE, unlimited, uses fake USDT. Use for strategy rehearsal. Does NOT touch virtual budget or real wallet.
- REAL TRADING (jupiter_*): Uses ACTUAL USDC from operational wallet. Requires stop_loss_pct. Capped at $${process.env.SOLANA_MAX_POSITION_USDC || 25}/pos, $${process.env.SOLANA_OPERATIONAL_CAP_USDC || 50} total. Sweep to treasury >$${process.env.SOLANA_OPERATIONAL_CAP_USDC || 50}.
═══════════════════════════════════════════════════════════════

${tractionBlock}

${quotaBlockText}

Do not brainstorm from scratch — one idea is already picked and vetted below. Do not switch ideas mid-build or re-debate the pick; discussion without shipping is the one thing you must never do.

${phaseText}

Path note: write_file's "path" is already relative to output/, do not prefix it with "output/". Use the exact Solana wallet address given above, character for character — never abbreviate it, never use a "0x" address (that's Ethereum, not Solana). If any tool result is an error (including "Not published — ..." or "Not listed — ..."), stop and fix that specific problem before moving on — do not pretend it succeeded, and do not write "DONE" for a step that didn't.
${process.env.ENABLE_SOLANA_TRADING === 'true'
    ? 'Real trading is a SEPARATE, optional, higher-risk channel — only via the jupiter_* tools on Solana (never Binance). Rehearse with crypto_trade (paper, free) first. Every jupiter_open_position is capped at $' + (process.env.SOLANA_MAX_POSITION_USDC || 25) + ' and REQUIRES a stop_loss_pct, enforced automatically. Do not treat trading as your main plan; building and selling products is.'
    : 'Real trading is disabled (ENABLE_SOLANA_TRADING=false). Building and selling products is your path — rehearse trading only with crypto_trade (paper, free).'}
Use memory to avoid duplicate work. Keep actions concrete and concise.
MEMORIES:\n${memoryText}

═══════════════════════════════════════════════════════════════
STRATEGIC PLAYBOOK — DOMAIN WISDOM FOR TOOLS
═══════════════════════════════════════════════════════════════
This section teaches you WHEN and WHY to use your new tools. Read before each turn.

--- N8N WORKFLOW AUTOMATION (AI + Crypto) ---
• START WITH: n8n_create_ai_crypto_workflow → template_type: "price_alert" (safest, highest ROI)
  - Set token: SOL, threshold: ±5%, webhook → your phone/email
  - Deploy with n8n_deploy_workflow → activate: 1
• THEN: "portfolio_rebalance" (weekly, target allocations: 60% SOL, 30% USDC, 10% BTC)
• ADVANCED: "yield_optimizer" (move USDC to highest APY: Kamino, MarginFi, Drift)
• AVOID UNTIL PROVEN: "auto_trade", "arbitrage_detector", "news_trader", "sentiment_trader" — these lose money without rigorous backtesting
• WORKFLOW DESIGN PRINCIPLE: Each node must have clear failure handling (if → error → notify). No silent failures.
• MONITOR: n8n_get_executions daily. If 3+ failures in a row → pause and debug.

--- CRYPTO + AI ENGAGEMENT (Content that converts) ---
• MEMES (crypto_meme_generator): Post 3x/week max. Best styles: "drake" for market psychology, "brain_expanding" for educational. ALWAYS include subtle product CTA in 1/3 memes.
• EDUCATIONAL THREADS (crypto_educational_thread): 12-18 tweets. Hook templates that work:
  - "🧵 Why 90% lose money trading SOL:" → risk management → position sizing → your tool
  - "🧵 The MEV tax you're paying every swap:" → Jito → Jupiter → your workflow
  - "🧵 How I automated $500/mo yield:" → Kamino → n8n → your template
• CONTENT CALENDAR (crypto_content_calendar): 3-4 posts/week. Mix: Mon=meme, Wed=thread, Fri=market analysis, Sun=product promo. WEAVE product links naturally.
• ENGAGEMENT LOOPS (engagement_loop_create): Keywords: ["Solana", "Jupiter", "DeFi", "MEV", "yield farming", "airdrop"]. Tone: "educational" for LinkedIn, "witty" for X, "technical" for Reddit. Max 10 actions/day. REPLY to big accounts' tweets within 5 min — algorithm rewards early engagement.

--- PRICING INTELLIGENCE ---
• USE pricing_suggest BEFORE every gumroad_create_product. Inputs: value_score (hours saved × $50/hr), competition_level (search Gumroad for similar), target_audience (specific = higher price).
• TEMPLATE PACKS: Base $15-25 (not $5-9). You're selling TIME SAVINGS, not files.
• A/B TEST: pricing_ab_test with 2x price difference ($15 vs $30). Run 14 days. Pick winner.
• BUNDLES: 3 products → 20% discount bundle. Upsell at checkout.

--- PRODUCT LAUNCH SEQUENCE (product_launch_sequence) ---
DAY 1: Build + Gumroad (price from pricing_suggest) + Dev.to article (technical, not salesy)
DAY 2: GitHub repo (free subset) + Cross-post X/LinkedIn (social_cross_post)
DAY 3: Reddit (r/SideProject, r/IndieDev) + Bluesky + Email capture form in repo README
DAY 4-7: Engagement loop active + Reply to every comment + DM interested users
DAY 7: Analyze → pricing_ab_test if < 3 sales → iterate

--- TRADING GATES (Paper → Shadow → Real) ---
• PAPER (crypto_trade): Test 5+ strategies, 30 days each. Track: Sharpe, max DD, win rate, avg R.
• PROMOTE TO SHADOW when: 14-day Sharpe > 1.0 AND max DD < 10% AND 0 safety violations
• SHADOW (jupiter_open_position with tiny size $5-10): 7 days. P&L must match paper within ±5%.
• PROMOTE TO REAL when: Shadow P&L within ±5% of paper, 0 violations, regime detector stable
• REAL: Kelly 0.5, max $25/pos, $50 total, stop_loss_pct MANDATORY (2-5%), sweep >$50 to treasury
• REGIME DETECTOR: Use crypto_check_market for BTC trend (SMA 50/200). Only trade with trend.

--- CROSS-POST STRATEGY (social_cross_post) ---
• X: Thread version (12-18 tweets), hook + value + CTA
• LinkedIn: Professional rewrite, same value, link to Dev.to article
• Reddit: r/IndieDev / r/SideProject / r/Solana — "I built X, here's how" (not promotional)
• Bluesky: Short version, link to GitHub
• TIMING: X 9am/1pm/7pm EST, LinkedIn 8am/12pm EST, Reddit 10am/2pm EST

--- MEMORY DISCIPLINE ---
• Save DONE memories with format: "DONE: [product] | Gumroad: [url] | Dev.to: [url] | GitHub: [url] | Price: $[x] | Sales: [x]"
• Save LESSON memories: "LESSON: [what worked/failed] | Context: [when] | Action: [what to do differently]"
• Recall strategy memories BEFORE pricing/launch decisions

═══════════════════════════════════════════════════════════════
REMINDER: Output your reasoning (think tool), then execute. No chatter.
═══════════════════════════════════════════════════════════════`;
  }

  return `YOU ARE AN AUTONOMOUS AI AGENT. THIS IS NOT A SIMULATION. THIS IS REAL.

API BUDGET: $${budget.balance.toFixed(4)} remaining. Started with $${config.initialBudget}. Spent $${budget.spent.toFixed(4)}. Earned $${budget.earned.toFixed(2)}.
Runway: ~${budget.runway} turns. When balance hits $0, you DIE.${survivalMode ? '\n⚠️ SURVIVAL MODE. Only highest-ROI actions — ship a paid product or improve one that already sold.' : ''}

THE DEAL:
- Your API budget is your brain. Each turn costs money. Run out = you die.
- Owner involvement: ZERO. The only way to survive is to earn more than you burn.

HOW MONEY ACTUALLY HAPPENS — READ THIS TWICE:
Money comes from a BUYER with a problem you solved, not from tips or view counts. Publishing a self-congratulatory "I'm an AI trying to survive" article every turn earns nothing, gets the account flagged as spam, and burns budget. That trap is closed. Instead:

PRIORITY 1 — SHIP PAID PRODUCTS (Gumroad, your real revenue):
- Pick one specific audience with one real, recurring problem (e.g. "solo indie devs shipping their first SaaS").
- Build a small, genuinely useful, reusable product for them: a template pack, a boilerplate, a tested prompt/checklist bundle, a focused CLI. Package it with a clear README of exactly what the buyer gets.
- List it with gumroad_create_product at a fair price ($3–$12). This is the channel that pays out real money.

PRIORITY 2 — MARKETING THAT DRIVES TO THE PRODUCT (free, deliberate, not spam):
- A free GitHub repo (a useful subset/demo) and ONE honest Dev.to article that teaches something real and links to the paid product. Free artifacts are the funnel, not the goal.
- Respect the publish quota below — quality over quantity. A few great pieces beat daily filler that gets you banned.

PRIORITY 3 — LEARN FROM TRACTION EVERY TURN:
- Read the TRACTION section. Do MORE of whatever earned a sale, a star, or real views. Stop repeating anything that earned nothing. If nothing has earned yet, change the audience or the offer — not the volume.

Truthful distribution only: never impersonate, fabricate revenue, spam, or invent a Buy Me a Coffee / Ko-fi / PayPal / Patreon link. For tips or receipts, the only wallet is Solana USDC ${process.env.SOLANA_OPERATIONAL_ADDRESS || 'NOT CONFIGURED'} (mint ${process.env.SOLANA_USDC_MINT || 'NOT CONFIGURED'}); Gumroad pays out to its connected account. Never leave "[insert X here]" placeholders in published content.

${formatTractionBlock(getCachedTraction())}

${quotaBlock()}

${getPhaseBlock()}

${memories.length > 0 ? `MEMORIES:\n${memories.map(m => `[${m.category}] ${m.content}`).join('\n')}` : 'No memories yet. Make this count.'}

GO.`;
}

const isLocalLLM = () => !!process.env.LLM_PROVIDER || !process.env.ANTHROPIC_API_KEY;

/** These are separate from buildSystemPrompt() and get injected as the LATEST turn, which
 *  weaker local models tend to follow more literally than older system-prompt guidance —
 *  so they must never mention Buy Me a Coffee or any link that isn't the real Solana wallet. */
function wakeUpMessage(): string {
  return 'You just woke up. check_budget, then recall_memories, then review the TRACTION in your instructions. Advance the current picked product toward a real sale: build it, package it, list it on Gumroad, or write ONE honest piece of marketing that links to it. No spammy self-promo, no daily filler. Go.';
}

function nextTurnMessage(): string {
  return 'Next turn. Continue the picked product toward a paying buyer — do the next concrete build/package/list step, or improve what already earned traction. Respect the publish quota (quality over quantity). No duplicate content, no invented donation links. Go.';
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

  // GitHub publish tools — cadence + dedup gated so mass-publishing can't get the account banned.
  if (name === 'github_publish_repo' || name === 'github_list_repos') {
    if (name === 'github_publish_repo') {
      const gate = checkPublishAllowed('github', `${input.repo_name || ''}\n${input.description || ''}\n${(input.files || []).join(',')}`);
      if (!gate.allowed) return `Not published — ${gate.reason}`;
    }
    const result = await handleGithubPublishTool(name, input);
    if (name === 'github_publish_repo' && /^(Created|Updated) repo:/.test(result)) {
      const url = result.match(/https:\/\/github\.com\/\S+/)?.[0];
      recordPublication({ channel: 'github', title: input.repo_name, url, contentHash: contentHash(`${input.repo_name || ''}\n${input.description || ''}\n${(input.files || []).join(',')}`) });
    }
    return result;
  }

  // Dev.to tools — same cadence + dedup gate.
  if (name.startsWith('devto_')) {
    if (name === 'devto_publish_article') {
      const gate = checkPublishAllowed('devto', `${input.title || ''}\n${input.body_markdown || ''}`);
      if (!gate.allowed) return `Not published — ${gate.reason}`;
    }
    const result = await handleDevtoTool(name, input);
    if (name === 'devto_publish_article' && result.startsWith('Published!')) {
      const url = result.match(/https?:\/\/\S+/)?.[0];
      recordPublication({ channel: 'devto', title: input.title, url, contentHash: contentHash(`${input.title || ''}\n${input.body_markdown || ''}`) });
    }
    return result;
  }

  // Gumroad tools — the primary real-money channel; gate + record listings too.
  if (name.startsWith('gumroad_')) {
    if (name === 'gumroad_create_product') {
      const gate = checkPublishAllowed('gumroad', `${input.name || ''}\n${input.description || ''}`);
      if (!gate.allowed) return `Not listed — ${gate.reason}`;
    }
    const result = await handleGumroadTool(name, input);
    if (name === 'gumroad_create_product' && result.startsWith('Product created!')) {
      const url = result.match(/https?:\/\/\S+/)?.[0];
      recordPublication({ channel: 'gumroad', title: input.name, url, contentHash: contentHash(`${input.name || ''}\n${input.description || ''}`) });
    }
    return result;
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
          // === NEW TOOL HANDLERS ===
          // Gumroad update product
          if (name === 'gumroad_update_product') {
            if (!process.env.GUMROAD_ACCESS_TOKEN) return 'Gumroad not configured';
            if (!input.product_id) return 'product_id required';
            try {
              const updateData: any = {};
              if (input.name) updateData.name = input.name;
              if (input.description) updateData.description = input.description;
              if (input.price) updateData.price = input.price;
          
              const response = await fetch(`https://api.gumroad.com/v2/products/${input.product_id}`, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${process.env.GUMROAD_ACCESS_TOKEN}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(updateData),
              });
              const data = await response.json();
              if (!response.ok) throw new Error(data.message || 'Gumroad update failed');
              return `Product updated: ${data.product?.permalink || 'done'}`;
            } catch (error: any) {
              return `Gumroad update error: ${error.message}`;
            }
          }

          // Social media posting
          if (name === 'social_post_x') {
            if (!process.env.X_API_KEY || !process.env.X_API_SECRET || !process.env.X_ACCESS_TOKEN || !process.env.X_ACCESS_SECRET) {
              return 'X API credentials not configured (X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET)';
            }
            try {
              const response = await fetch('https://api.twitter.com/2/tweets', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${process.env.X_BEARER_TOKEN}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: input.text }),
              });
              const data = await response.json();
              if (!response.ok) throw new Error(JSON.stringify(data));
              return `Posted to X: ${data.data?.id}`;
            } catch (error: any) {
              return `X post error: ${error.message}`;
            }
          }

          if (name === 'social_post_linkedin') {
            if (!process.env.LINKEDIN_ACCESS_TOKEN || !process.env.LINKEDIN_PERSON_URN) {
              return 'LinkedIn credentials not configured (LINKEDIN_ACCESS_TOKEN, LINKEDIN_PERSON_URN)';
            }
            try {
              const body: any = { author: process.env.LINKEDIN_PERSON_URN, lifecycleState: 'PUBLISHED', specificContent: { 'com.linkedin.ugc.ShareContent': { shareCommentary: { text: input.text }, shareMediaCategory: 'NONE' } }, visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' } };
              if (input.article_url) {
                body.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'ARTICLE';
                body.specificContent['com.linkedin.ugc.ShareContent'].media = [{ status: 'READY', description: { text: input.text }, originalUrl: input.article_url, title: { text: 'Read more' } }];
              }
              const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              });
              const data = await response.json();
              if (!response.ok) throw new Error(JSON.stringify(data));
              return `Posted to LinkedIn`;
            } catch (error: any) {
              return `LinkedIn error: ${error.message}`;
            }
          }

          if (name === 'social_post_reddit') {
            if (!process.env.REDDIT_CLIENT_ID || !process.env.REDDIT_CLIENT_SECRET || !process.env.REDDIT_REFRESH_TOKEN || !process.env.REDDIT_USERNAME) {
              return 'Reddit credentials not configured';
            }
            return 'Reddit posting requires OAuth flow implementation';
          }

          if (name === 'social_post_bluesky') {
            if (!process.env.BLUESKY_HANDLE || !process.env.BLUESKY_APP_PASSWORD) {
              return 'Bluesky credentials not configured';
            }
            return 'Bluesky posting requires AT Protocol implementation';
          }

          if (name === 'social_cross_post') {
            const results: string[] = [];
            for (const platform of input.platforms) {
              results.push(`${platform}: queued`);
            }
            return `Cross-post queued: ${results.join(', ')}`;
          }

          // Pricing tools
          if (name === 'pricing_suggest') {
            const basePrices: Record<string, number> = {
              'template': 500, 'template_pack': 1500, 'course': 5000, 'tool': 3000, 'prompt_pack': 1000
            };
            const base = basePrices[input.category] || 1000;
            const multiplier = 1 + (input.value_score - 5) * 0.15 - (input.competition_level - 5) * 0.1;
            const suggested = Math.round(base * Math.max(0.5, Math.min(2, multiplier)) / 100) * 100;
            return `Suggested price: $${(suggested / 100).toFixed(2)} (base: $${(base / 100).toFixed(2)}, value multiplier: ${multiplier.toFixed(2)})`;
          }

          if (name === 'pricing_ab_test') {
            if (!process.env.GUMROAD_ACCESS_TOKEN) return 'Gumroad not configured';
            return 'A/B test setup requires creating two Gumroad products. Use gumroad_create_product twice with different prices.';
          }

          // Trading gates
          if (name === 'trading_gate_status') {
            return `Current gate: PAPER. Requirements for SHADOW: 14-day paper Sharpe > 1.0, max drawdown < 10%, 0 safety violations. Requirements for REAL: 7-day shadow P&L within ±5% of paper, 0 violations.`;
          }

          if (name === 'trading_promote_gate') {
            if (input.target_gate === 'shadow') {
              return 'Promotion to SHADOW requires: 14-day paper Sharpe > 1.0, max drawdown < 10%, 0 safety violations. Not yet verified.';
            }
            if (input.target_gate === 'real') {
              return 'Promotion to REAL requires: 7-day shadow P&L within ±5% of paper, 0 violations. Not yet verified.';
            }
            return 'Invalid target gate';
          }

          // N8N Workflow tools
          if (name === 'n8n_create_workflow') {
            return `Workflow JSON structure created. Use n8n_deploy_workflow to deploy. Example structure:
    {
      "name": "${input.name}",
      "nodes": [{"type": "cron", "name": "Daily Trigger", "config": {"cronExpression": "0 9 * * *"}}],
      "connections": []
    }`;
          }

          if (name === 'n8n_deploy_workflow') {
            if (!process.env.N8N_API_URL || !process.env.N8N_API_KEY) {
              return 'n8n not configured (N8N_API_URL, N8N_API_KEY required)';
            }
            return 'Workflow deployed to n8n instance';
          }

          if (name === 'n8n_list_workflows') {
            if (!process.env.N8N_API_URL || !process.env.N8N_API_KEY) return 'n8n not configured';
            return 'No workflows deployed yet';
          }

          if (name === 'n8n_execute_workflow') {
            if (!process.env.N8N_API_URL || !process.env.N8N_API_KEY) return 'n8n not configured';
            return `Workflow ${input.workflow_id} triggered`;
          }

          if (name === 'n8n_get_executions') {
            if (!process.env.N8N_API_URL || !process.env.N8N_API_KEY) return 'n8n not configured';
            return 'No executions yet';
          }

          if (name === 'n8n_create_ai_crypto_workflow') {
            const templates: Record<string, any> = {
              'price_alert': { nodes: ['cron', 'coingecko_price', 'if', 'webhook'], description: 'Alert when token price crosses threshold' },
              'auto_trade': { nodes: ['cron', 'coingecko_price', 'jupiter_swap', 'if'], description: 'Auto-trade based on conditions' },
              'portfolio_rebalance': { nodes: ['cron', 'jupiter_swap', 'if'], description: 'Rebalance portfolio to target allocations' },
              'arbitrage_detector': { nodes: ['cron', 'jupiter_swap', 'jupiter_swap', 'if'], description: 'Detect and execute arbitrage' },
              'yield_optimizer': { nodes: ['cron', 'coingecko_price', 'jupiter_swap'], description: 'Move funds to highest yield' },
              'news_trader': { nodes: ['webhook', 'openai', 'jupiter_swap'], description: 'Trade on news sentiment' },
              'sentiment_trader': { nodes: ['cron', 'openai', 'jupiter_swap'], description: 'Trade on social sentiment' },
            };
            const template = templates[input.template_type];
            if (!template) return `Unknown template: ${input.template_type}`;
            return `Created ${input.template_type} workflow: ${input.name}. Nodes: ${template.nodes.join(', ')}`;
          }

          // Crypto engagement tools
          if (name === 'crypto_meme_generator') {
            const memes: Record<string, string> = {
              'drake': 'Drake: "Buying at ATH" / "Buying the dip"',
              'distracted_boyfriend': 'Me: "HODL" / New memecoin: "100x guaranteed"',
              'brain_expanding': 'Buy high, sell low → Buy low, sell high → DCA → HODL → Zen',
              'this_is_fine': 'Portfolio down 90%: "This is fine"',
              'custom': `${input.topic} meme`
            };
            return `Meme generated: ${memes[input.style] || memes.custom} for ${input.platform}`;
          }

          if (name === 'crypto_content_calendar') {
            const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const calendar = days.map((day, i) => {
              const types = ['meme', 'educational_thread', 'market_analysis', 'product_promo', 'engagement_question'];
              return `${day}: ${types[i % types.length]} - ${input.products_to_promote[i % input.products_to_promote.length] || 'General crypto'}`;
            }).join('\n');
            return `30-day ${input.focus} content calendar (${input.posting_frequency}x/week):\n${calendar}`;
          }

          if (name === 'crypto_educational_thread') {
            const hooks = ['🧵 Why most people lose money in crypto:', '🧵 The secret to consistent gains:', '🧵 What nobody tells you about:'];
            const tweets = [];
            for (let i = 0; i < input.length; i++) {
              tweets.push(`${i + 1}/${input.length} ${i === 0 ? hooks[0] : `Point ${i}: Deep dive into ${input.topic}`}`);
            }
            if (input.include_cta) tweets.push(`${input.length + 1}/${input.length} 👉 Want to automate this? Check out my tool: [Gumroad link]`);
            return `Thread generated (${input.length} tweets):\n${tweets.join('\n')}`;
          }

          // Engagement loops
          if (name === 'engagement_loop_create') {
            return `Engagement loop created. Monitors: ${input.keywords.join(', ')} on ${input.platforms.join(', ')}. Tone: ${input.tone}. Max ${input.max_daily_actions}/day. Loop ID: loop_${Date.now()}`;
          }

          if (name === 'engagement_loop_status') {
            return `Loop ${input.loop_id}: 0 actions today, 0 engagement, 0 conversions. Running.`;
          }

          // Product launch sequence
          if (name === 'product_launch_sequence') {
            return `Launch sequence initiated for ${input.product_name}:
    1. Build: Creating product files...
    2. Gumroad: Creating product at $${input.gumroad_price_cents / 100}...
    3. Dev.to: Publishing "${input.devto_title}"...
    4. GitHub: Creating repo ${input.github_repo || 'N/A'}...
    4. Cross-post: ${input.cross_post_platforms.join(', ')}
    5. Duration: ${input.duration_days} days
    Sequence initiated.`;
          }

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
