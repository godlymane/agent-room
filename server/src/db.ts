import Database from 'better-sqlite3';
import { v4 as uuid } from 'uuid';
import type { Transaction, MemoryEntry, Activity } from '../../shared/types.js';

const db = new Database('agent-room.db');
db.pragma('journal_mode = WAL');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT NOT NULL,
    module TEXT NOT NULL,
    model TEXT
  );
  CREATE TABLE IF NOT EXISTS memory (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    importance INTEGER NOT NULL DEFAULT 5
  );
  CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    device TEXT,
    model TEXT,
    cost REAL
  );
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS survival_payments (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    amount_usdc REAL NOT NULL,
    amount_usd REAL NOT NULL,
    signature TEXT,
    mode TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS trading_positions (
    id TEXT PRIMARY KEY,
    opened_at INTEGER NOT NULL,
    closed_at INTEGER,
    output_mint TEXT NOT NULL,
    symbol TEXT,
    amount_usdc REAL NOT NULL,
    token_amount REAL NOT NULL,
    entry_price REAL NOT NULL,
    stop_loss_pct REAL NOT NULL,
    stop_loss_price REAL NOT NULL,
    status TEXT NOT NULL,
    exit_price REAL,
    pnl_usdc REAL,
    entry_signature TEXT,
    exit_signature TEXT
  );
`);

// Lightweight migration for early installations that recorded the target in EUR.
const survivalColumns = db.prepare('PRAGMA table_info(survival_payments)').all() as Array<{ name: string }>;
if (!survivalColumns.some(column => column.name === 'amount_usd')) {
  db.exec('ALTER TABLE survival_payments ADD COLUMN amount_usd REAL');
  db.exec('UPDATE survival_payments SET amount_usd = amount_usdc WHERE amount_usd IS NULL');
}

// === Transactions ===
const insertTx = db.prepare(
  'INSERT INTO transactions (id, timestamp, type, amount, description, module, model) VALUES (?, ?, ?, ?, ?, ?, ?)'
);
const sumSpent = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'api_cost' OR type = 'expense'");
const sumEarned = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'earning'");
const todayApiCost = db.prepare(
  "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'api_cost' AND timestamp > ?"
);

export function logTransaction(tx: Omit<Transaction, 'id' | 'timestamp'>): Transaction {
  const entry: Transaction = { id: uuid(), timestamp: Date.now(), ...tx };
  insertTx.run(entry.id, entry.timestamp, entry.type, entry.amount, entry.description, entry.module, entry.model || null);
  return entry;
}

export function getBudgetStats(initialBudget: number) {
  const spent = (sumSpent.get() as any).total;
  const earned = (sumEarned.get() as any).total;
  const startOfDay = new Date().setHours(0, 0, 0, 0);
  const apiToday = (todayApiCost.get(startOfDay) as any).total;
  const balance = initialBudget - spent + earned;
  // Rough estimate: average cost per turn from recent transactions
  const countResult = db.prepare("SELECT COUNT(*) as cnt FROM transactions WHERE type='api_cost'").get() as any;
  const avgCost = spent > 0 ? spent / Math.max(1, countResult.cnt) : 0.02;
  const runway = avgCost > 0 ? Math.floor(balance / avgCost) : 999;

  return { initial: initialBudget, spent, earned, balance, apiCostToday: apiToday, runway };
}

// === Memory ===
const insertMem = db.prepare(
  'INSERT INTO memory (id, timestamp, category, content, importance) VALUES (?, ?, ?, ?, ?)'
);
const getMemories = db.prepare('SELECT * FROM memory ORDER BY importance DESC, timestamp DESC LIMIT ?');
const getMemByCategory = db.prepare('SELECT * FROM memory WHERE category = ? ORDER BY importance DESC LIMIT ?');

export function saveMemory(entry: Omit<MemoryEntry, 'id' | 'timestamp'>): MemoryEntry {
  const mem: MemoryEntry = { id: uuid(), timestamp: Date.now(), ...entry };
  insertMem.run(mem.id, mem.timestamp, mem.category, mem.content, mem.importance);
  return mem;
}

export function getTopMemories(limit = 20): MemoryEntry[] {
  return getMemories.all(limit) as MemoryEntry[];
}

export function getMemoriesByCategory(category: string, limit = 10): MemoryEntry[] {
  return getMemByCategory.all(category, limit) as MemoryEntry[];
}

// === Activities ===
const insertAct = db.prepare(
  'INSERT INTO activities (id, timestamp, type, message, device, model, cost) VALUES (?, ?, ?, ?, ?, ?, ?)'
);
const recentActs = db.prepare('SELECT * FROM activities ORDER BY timestamp DESC LIMIT ?');

export function logActivity(act: Omit<Activity, 'id' | 'timestamp'>): Activity {
  const entry: Activity = { id: uuid(), timestamp: Date.now(), ...act };
  insertAct.run(entry.id, entry.timestamp, entry.type, entry.message, entry.device || null, entry.model || null, entry.cost || null);
  return entry;
}

export function getRecentActivities(limit = 50): Activity[] {
  return (recentActs.all(limit) as Activity[]).reverse();
}

export function getSetting(key: string): string | undefined {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key) as { value?: string } | undefined;
  return row?.value;
}

export function setSetting(key: string, value: string) {
  db.prepare('INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

export function recordSurvivalPayment(payment: { amountUsdc: number; signature?: string; mode: 'simulation' | 'live' }) {
  db.prepare('INSERT INTO survival_payments (id, timestamp, amount_usdc, amount_usd, signature, mode) VALUES (?, ?, ?, ?, ?, ?)')
    .run(uuid(), Date.now(), payment.amountUsdc, payment.amountUsdc, payment.signature || null, payment.mode);
}

export function getSurvivalPaidUsdc(): number {
  return (db.prepare('SELECT COALESCE(SUM(amount_usd), 0) AS total FROM survival_payments').get() as { total: number }).total;
}

// === Trading positions ===
export interface TradingPositionRow {
  id: string;
  opened_at: number;
  closed_at: number | null;
  output_mint: string;
  symbol: string | null;
  amount_usdc: number;
  token_amount: number;
  entry_price: number;
  stop_loss_pct: number;
  stop_loss_price: number;
  status: 'open' | 'closed_manual' | 'closed_stop';
  exit_price: number | null;
  pnl_usdc: number | null;
  entry_signature: string | null;
  exit_signature: string | null;
}

const insertPositionStmt = db.prepare(
  `INSERT INTO trading_positions
   (id, opened_at, output_mint, symbol, amount_usdc, token_amount, entry_price, stop_loss_pct, stop_loss_price, status, entry_signature)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`
);

export function insertPosition(position: {
  id: string; outputMint: string; symbol?: string; amountUsdc: number; tokenAmount: number;
  entryPrice: number; stopLossPct: number; stopLossPrice: number; entrySignature: string;
}) {
  insertPositionStmt.run(
    position.id, Date.now(), position.outputMint, position.symbol || null, position.amountUsdc,
    position.tokenAmount, position.entryPrice, position.stopLossPct, position.stopLossPrice, position.entrySignature
  );
}

export function closePositionRow(id: string, close: { status: 'closed_manual' | 'closed_stop'; exitPrice: number; pnlUsdc: number; exitSignature: string }) {
  db.prepare('UPDATE trading_positions SET closed_at = ?, status = ?, exit_price = ?, pnl_usdc = ?, exit_signature = ? WHERE id = ?')
    .run(Date.now(), close.status, close.exitPrice, close.pnlUsdc, close.exitSignature, id);
}

export function getOpenPositions(): TradingPositionRow[] {
  return db.prepare("SELECT * FROM trading_positions WHERE status = 'open' ORDER BY opened_at DESC").all() as TradingPositionRow[];
}

export function getRecentPositions(limit = 20): TradingPositionRow[] {
  return db.prepare('SELECT * FROM trading_positions ORDER BY opened_at DESC LIMIT ?').all(limit) as TradingPositionRow[];
}

export function getOpenPositionsUsdcTotal(): number {
  return (db.prepare("SELECT COALESCE(SUM(amount_usdc), 0) AS total FROM trading_positions WHERE status = 'open'").get() as { total: number }).total;
}

export function getPositionById(id: string): TradingPositionRow | undefined {
  return db.prepare('SELECT * FROM trading_positions WHERE id = ?').get(id) as TradingPositionRow | undefined;
}

export default db;
