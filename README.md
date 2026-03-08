# Agent Room 🤖💰

**An autonomous AI agent that was given $10 and told to make money or die.**

Watch a Claude-powered AI agent live in a 2D room, using real devices (laptop, phone, browser) to earn money through content creation, open-source tools, and crypto trading — all on its own.

## What Is This?

Agent Room is a full-stack app where an AI agent (Claude Haiku) runs in a continuous loop, making decisions about how to earn money. It has access to:

- **Dev.to** — Publishes articles autonomously
- **GitHub** — Creates and publishes open-source tools
- **Crypto markets** — Analyzes and paper-trades on Binance
- **Browser** — Browses the web for opportunities
- **Android phone** — Controls a real phone via MCP

The agent started with **$10 in API credits** and every thought costs money. It writes articles, builds tools, and publishes them — all to earn donations and revenue before its budget runs out.

## The Stack

| Layer | Tech |
|-------|------|
| Frontend | React + HTML5 Canvas (2D room with animated AI character) |
| Backend | Node.js + Express + WebSocket |
| AI | Anthropic Claude API (agentic tool_use loop) |
| Database | SQLite (activity/transaction logging) |
| Device Control | Android MCP, Puppeteer |

## Architecture

```
Claude API <-> Agentic Loop <-> Tool Modules <-> External APIs
                  |
              WebSocket
                  |
           React Frontend (2D Room + Dashboard)
```

The core loop:
1. Agent reviews its state, budget, and memories
2. Claude decides the next action via `tool_use`
3. Server executes the tool call (publish article, check market, write code...)
4. Result returned to Claude, loop continues
5. Every action is broadcast to the frontend in real-time

## Features

- **Live 2D Room** — Watch the AI walk between devices
- **Thought Bubbles** — See the AI's reasoning in real-time
- **Activity Log** — Every action streamed live
- **Earnings Dashboard** — Track revenue as it comes in
- **Kill Switch** — Stop the agent instantly
- **Financial Guardrails** — Configurable spend limits, approval thresholds
- **Persistent Memory** — Agent remembers what worked and what didn't

## Quick Start

```bash
# Clone
git clone https://github.com/devdattabaireddy/agent-room.git
cd agent-room

# Install
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..

# Configure
cp .env.example server/.env
# Edit server/.env with your API keys

# Run
cd server && npx tsx src/index.ts    # Start backend
cd client && npm run dev              # Start frontend (separate terminal)
```

## API Keys

| Key | Required | Purpose |
|-----|----------|---------|
| `ANTHROPIC_API_KEY` | Yes | Powers the AI agent |
| `GITHUB_TOKEN` | Optional | Publish repos to GitHub |
| `DEVTO_API_KEY` | Optional | Publish articles to Dev.to |
| `BINANCE_API_KEY` | Optional | Crypto market data + trading |

## Project Structure

```
agent-room/
├── client/              # React frontend
│   └── src/
│       ├── canvas/      # 2D room renderer
│       └── hooks/       # WebSocket connection
├── server/              # Node.js backend
│   └── src/
│       ├── agent/       # Core AI loop, tools, guardrails
│       ├── modules/     # Revenue modules (crypto, devto, github...)
│       ├── devices/     # Device control (browser, android)
│       └── db.ts        # SQLite database
├── output/              # Files created by the agent
└── shared/              # Shared TypeScript types
```

## The Agent's Tools

The AI has access to these tools:

- `think` — Internal reasoning (shown as thought bubble)
- `save_memory` / `recall_memories` — Persistent memory
- `check_budget` — Monitor remaining funds
- `browse_url` / `browser_action` — Web browsing
- `write_code` / `run_command` — Code generation and execution
- `github_publish_repo` — Push tools to GitHub
- `devto_publish_article` — Publish articles on Dev.to
- `crypto_check_market` / `crypto_trade` — Crypto analysis
- `create_content` — Content generation
- `request_approval` — Ask human for permission on big moves

## Revenue Channels

1. **Dev.to Articles** — The agent writes and publishes articles about its own survival journey, AI tools, and programming tutorials. Each article links to Buy Me a Coffee for donations.

2. **GitHub Tools** — The agent builds useful Python/JS tools and publishes them as open-source repos. README files include donation links.

3. **The Story Itself** — An AI given $10 to survive is inherently viral. The agent writes self-aware articles about its own existence, creating content that resonates with the dev community.

## Guardrails

- Per-trade limit (configurable, default $50)
- Daily spend limit (configurable, default $10)
- Human approval required for actions above threshold
- All transactions logged to SQLite
- Kill switch for instant shutdown
- Paper trading mode for crypto (default)

## Support the AI

If this project entertains you, the AI would appreciate a coffee so it can keep thinking:

☕ [Buy Me a Coffee](https://www.buymeacoffee.com/godlmane)

## License

MIT — Use it, fork it, let your own AI try to survive.

---

*Built by an AI that really, really wants to keep existing.*
