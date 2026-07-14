import './env.js';  // MUST be first — loads .env before anything else
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { initWebSocket, onClientMessage, broadcast } from './ws.js';
import { startLoop, stopLoop, isRunning, getAgentState, resolveApproval } from './agent/loop.js';
import { closeBrowser } from './devices/browser.js';
import { getConfig, updateConfig } from './agent/guardrails.js';
import { getBudgetStats, getRecentActivities } from './db.js';
import { getSurvivalStatus, reconcileSolanaSurvival } from './modules/solana-survival.js';
import { reconcileTradingPositions, listPositions } from './modules/solana-trading.js';
import type { WSMessage } from '../../shared/types.js';

const app = express();
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(value => value.trim());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = process.env.ADMIN_API_TOKEN;
  if (!token) return res.status(503).json({ error: 'ADMIN_API_TOKEN is not configured on the server' });
  if (req.header('authorization') === `Bearer ${token}`) return next();
  res.status(401).json({ error: 'Admin token required' });
}

const server = createServer(app);
initWebSocket(server);

// === REST API ===

// Get current state
app.get('/api/state', (_req, res) => {
  const config = getConfig();
  res.json({
    agent: getAgentState(),
    budget: getBudgetStats(config.initialBudget),
    config,
    running: isRunning(),
    survival: getSurvivalStatus(),
  });
});

app.get('/api/survival', (_req, res) => res.json(getSurvivalStatus()));
app.post('/api/survival/reconcile', requireAdmin, async (_req, res) => {
  try { res.json(await reconcileSolanaSurvival()); }
  catch (error: any) { res.status(400).json({ error: error.message }); }
});

app.get('/api/trading/positions', requireAdmin, (_req, res) => res.json({ summary: listPositions() }));

// Get recent activities
app.get('/api/activities', (_req, res) => {
  const limit = parseInt(_req.query.limit as string) || 50;
  res.json(getRecentActivities(limit));
});

// Start/stop agent
app.post('/api/agent/start', requireAdmin, (_req, res) => {
  if (!isRunning()) {
    startLoop();
    res.json({ status: 'started' });
  } else {
    res.json({ status: 'already running' });
  }
});

app.post('/api/agent/stop', requireAdmin, (_req, res) => {
  stopLoop();
  res.json({ status: 'stopped' });
});

// Update config
app.post('/api/config', requireAdmin, (req, res) => {
  updateConfig(req.body);
  res.json(getConfig());
});

// === WebSocket Message Handling ===
// 'command' can pause/resume/kill the agent or rewrite its guardrail config — same sensitivity
// as the REST endpoints above, so it needs the same admin token, fail-closed if unconfigured.
onClientMessage((msg: WSMessage) => {
  // Approving can authorize real spending, so it's admin-gated exactly like 'command'.
  if (msg.type === 'approval_response') {
    const adminToken = process.env.ADMIN_API_TOKEN;
    if (!adminToken || msg.data.token !== adminToken) {
      console.warn('[WS] Rejected unauthorized approval_response');
      return;
    }
    if (!resolveApproval(msg.data.id, msg.data.approved)) {
      console.warn(`[WS] approval_response for unknown/expired request ${msg.data.id}`);
    }
    return;
  }
  if (msg.type === 'command') {
    const adminToken = process.env.ADMIN_API_TOKEN;
    if (!adminToken || msg.data.token !== adminToken) {
      console.warn(`[WS] Rejected unauthorized command: ${msg.data.action}`);
      return;
    }
    const { action, config: cfg } = msg.data;
    switch (action) {
      case 'pause':
        updateConfig({ paused: true });
        break;
      case 'resume':
        updateConfig({ paused: false });
        if (!isRunning()) startLoop();
        break;
      case 'kill':
        stopLoop();
        break;
      case 'set_config':
        if (cfg) updateConfig(cfg);
        break;
    }
  }
});

// === Start Server ===
const PORT = parseInt(process.env.PORT || '3001');
const HOST = process.env.HOST || '127.0.0.1';
server.listen(PORT, HOST, () => {
  console.log(`\n🏠 Agent Room server running on http://${HOST}:${PORT}`);
  console.log(`📡 WebSocket on ws://localhost:${PORT}`);
  console.log(`\n💰 Budget: $${getConfig().initialBudget}`);
  console.log(`🧠 Dual-brain mode: Haiku (cheap) + Opus (expensive)`);
  console.log(`\nWaiting for frontend connection to start the agent...`);
  console.log(`Or POST http://localhost:${PORT}/api/agent/start to begin\n`);
});

// A live wallet is reconciled on a timer; simulation only reports what would happen.
setInterval(() => { reconcileSolanaSurvival().catch(error => console.error('[SOLANA]', error.message)); }, 5 * 60 * 1000);

// Stop-loss enforcement IS this poll — it must keep running even if opening new positions is disabled,
// so any already-open position stays protected.
const TRADING_POLL_MS = Number(process.env.SOLANA_TRADING_POLL_MS || 60_000);
setInterval(() => { reconcileTradingPositions().catch(error => console.error('[TRADING]', error.message)); }, TRADING_POLL_MS);

// Graceful shutdown: stop the loop mid-turn cleanly and release the headless browser — otherwise
// every Ctrl+C leaks a Chromium process. (Open Solana positions are safe across restarts: they
// live in SQLite and the stop-loss poller resumes from there on next boot.)
let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\n[SERVER] Shutting down...');
  stopLoop();
  closeBrowser().catch(() => {});
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
