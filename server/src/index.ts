import './env.js';  // MUST be first — loads .env before anything else
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { initWebSocket, onClientMessage, broadcast } from './ws.js';
import { startLoop, stopLoop, isRunning, getAgentState } from './agent/loop.js';
import { getConfig, updateConfig } from './agent/guardrails.js';
import { getBudgetStats, getRecentActivities } from './db.js';
import type { WSMessage } from '../../shared/types.js';

const app = express();
app.use(cors());
app.use(express.json());

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
  });
});

// Get recent activities
app.get('/api/activities', (_req, res) => {
  const limit = parseInt(_req.query.limit as string) || 50;
  res.json(getRecentActivities(limit));
});

// Start/stop agent
app.post('/api/agent/start', (_req, res) => {
  if (!isRunning()) {
    startLoop();
    res.json({ status: 'started' });
  } else {
    res.json({ status: 'already running' });
  }
});

app.post('/api/agent/stop', (_req, res) => {
  stopLoop();
  res.json({ status: 'stopped' });
});

// Update config
app.post('/api/config', (req, res) => {
  updateConfig(req.body);
  res.json(getConfig());
});

// === WebSocket Message Handling ===
onClientMessage((msg: WSMessage) => {
  if (msg.type === 'command') {
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
server.listen(PORT, () => {
  console.log(`\n🏠 Agent Room server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket on ws://localhost:${PORT}`);
  console.log(`\n💰 Budget: $${getConfig().initialBudget}`);
  console.log(`🧠 Dual-brain mode: Haiku (cheap) + Opus (expensive)`);
  console.log(`\nWaiting for frontend connection to start the agent...`);
  console.log(`Or POST http://localhost:${PORT}/api/agent/start to begin\n`);
});
