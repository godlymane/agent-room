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
`);

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

export default db;
