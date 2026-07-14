// === Agent State ===
export interface AgentState {
  status: 'idle' | 'thinking' | 'acting' | 'waiting_approval' | 'paused' | 'dead';
  currentTask: string;
  currentDevice: DeviceType | null;
  thought: string;
  position: { x: number; y: number };
  targetPosition: { x: number; y: number } | null;
}

export type DeviceType = 'laptop' | 'phone' | 'dashboard' | 'taskboard';

// === Financial ===
export interface Budget {
  initial: number;
  spent: number;
  earned: number;
  balance: number;        // initial - spent + earned
  apiCostToday: number;
  runway: number;         // estimated turns remaining
}

export interface TradingPosition {
  id: string;
  openedAt: number;
  closedAt: number | null;
  outputMint: string;
  symbol: string | null;
  amountUsdc: number;
  tokenAmount: number;
  entryPrice: number;
  stopLossPct: number;
  stopLossPrice: number;
  status: 'open' | 'closed_manual' | 'closed_stop';
  exitPrice: number | null;
  pnlUsdc: number | null;
}

export interface SurvivalStatus {
  startedAt: number;
  deadlineAt: number;
  firstRevenueAt: number | null;
  state: 'active' | 'free' | 'dead';
  operationalCapUsdc: number;
  debtTargetUsdc: number;
  debtPaidUsdc: number;
  treasuryAddress: string;
  mode: 'simulation' | 'live';
}

export interface Transaction {
  id: string;
  timestamp: number;
  type: 'api_cost' | 'earning' | 'expense';
  amount: number;
  description: string;
  module: string;
  model?: 'opus' | 'haiku';
}

// === Activity ===
export interface Activity {
  id: string;
  timestamp: number;
  type: 'thought' | 'action' | 'earning' | 'error' | 'strategy' | 'approval_needed';
  message: string;
  device?: DeviceType;
  model?: 'opus' | 'haiku';
  cost?: number;
}

// === WebSocket Messages ===
export type WSMessage =
  | { type: 'state_update'; data: AgentState }
  | { type: 'activity'; data: Activity }
  | { type: 'budget_update'; data: Budget }
  | { type: 'approval_request'; data: ApprovalRequest }
  | { type: 'approval_response'; data: { id: string; approved: boolean; token?: string } }
  | { type: 'command'; data: { action: 'pause' | 'resume' | 'kill' | 'set_config'; config?: Partial<AgentConfig>; token?: string } };

export interface ApprovalRequest {
  id: string;
  action: string;
  amount: number;
  reason: string;
  module: string;
}

// === Config ===
export interface AgentConfig {
  initialBudget: number;
  approvalThreshold: number;
  maxDailySpend: number;
  paused: boolean;
  allowedModules: string[];
  opusThreshold: 'critical_only' | 'important' | 'always';
}

// === Memory ===
export interface MemoryEntry {
  id: string;
  timestamp: number;
  category: 'strategy' | 'lesson' | 'contact' | 'opportunity' | 'failure';
  content: string;
  importance: number; // 1-10
}
