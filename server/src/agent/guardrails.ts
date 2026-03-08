import { getBudgetStats } from '../db.js';
import type { AgentConfig } from '../../../shared/types.js';

let config: AgentConfig = {
  initialBudget: parseFloat(process.env.INITIAL_BUDGET || '10'),
  approvalThreshold: parseFloat(process.env.APPROVAL_THRESHOLD || '10'),
  maxDailySpend: parseFloat(process.env.MAX_DAILY_SPEND || '10'),
  paused: false,
  allowedModules: ['agent', 'crypto', 'freelance', 'content', 'web-tasks', 'browser'],
  opusThreshold: 'critical_only',  // maximize Haiku usage to save money
};

export function getConfig(): AgentConfig {
  return { ...config };
}

export function updateConfig(updates: Partial<AgentConfig>) {
  config = { ...config, ...updates };
}

export interface GuardrailCheck {
  allowed: boolean;
  reason?: string;
  needsApproval?: boolean;
}

export function checkAction(module: string, amount: number, description: string): GuardrailCheck {
  if (config.paused) {
    return { allowed: false, reason: 'Agent is paused' };
  }

  const budget = getBudgetStats(config.initialBudget);

  // Check if we're out of money
  if (budget.balance <= 0) {
    return { allowed: false, reason: `Budget exhausted. Balance: $${budget.balance.toFixed(4)}` };
  }

  // Check daily spend limit
  if (budget.apiCostToday >= config.maxDailySpend) {
    return { allowed: false, reason: `Daily spend limit reached: $${budget.apiCostToday.toFixed(2)} / $${config.maxDailySpend}` };
  }

  // Check module allowed
  if (!config.allowedModules.includes(module)) {
    return { allowed: false, reason: `Module '${module}' is disabled` };
  }

  // Check approval threshold
  if (amount > config.approvalThreshold) {
    return { allowed: false, needsApproval: true, reason: `Amount $${amount} exceeds approval threshold $${config.approvalThreshold}` };
  }

  return { allowed: true };
}

// Decide which model to use based on task importance
export function pickModel(taskType: string, isStrategic: boolean): 'opus' | 'haiku' {
  if (config.opusThreshold === 'always') return 'opus';

  const budget = getBudgetStats(config.initialBudget);

  // Survival mode: only Haiku when budget is tight (< 200 turns left)
  if (budget.runway < 200) return 'haiku';

  if (config.opusThreshold === 'critical_only') {
    // Only use Opus for strategy planning and high-value submissions
    const criticalTasks = ['strategy', 'code_submission', 'important_decision', 'company_planning'];
    return criticalTasks.includes(taskType) ? 'opus' : 'haiku';
  }

  // 'important' mode: Opus for strategic + moderately important tasks
  if (isStrategic) return 'opus';

  const importantTasks = ['code_writing', 'content_creation', 'negotiation', 'analysis'];
  return importantTasks.includes(taskType) ? 'opus' : 'haiku';
}

// Estimate API cost for a call
// "opus" brain actually uses Sonnet 4.6 ($3/$15 per MTok) to save money
// Haiku 4.5 is $0.80/$4 per MTok
export function estimateCost(model: 'opus' | 'haiku', inputTokens: number, outputTokens: number): number {
  if (model === 'opus') {
    // Sonnet 4.6 pricing (we use Sonnet as our "expensive brain")
    return (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15;
  }
  // Haiku 4.5 pricing
  return (inputTokens / 1_000_000) * 0.80 + (outputTokens / 1_000_000) * 4;
}
