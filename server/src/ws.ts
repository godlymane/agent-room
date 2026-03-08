import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { WSMessage } from '../../shared/types.js';

let wss: WebSocketServer;
const clients = new Set<WebSocket>();

export function initWebSocket(server: Server) {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`[WS] Client connected (${clients.size} total)`);

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`[WS] Client disconnected (${clients.size} total)`);
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as WSMessage;
        if (msg.type === 'command' || msg.type === 'approval_response') {
          onMessage(msg);
        }
      } catch {}
    });
  });
}

let messageHandler: ((msg: WSMessage) => void) | null = null;

export function onClientMessage(handler: (msg: WSMessage) => void) {
  messageHandler = handler;
}

function onMessage(msg: WSMessage) {
  if (messageHandler) messageHandler(msg);
}

export function broadcast(msg: WSMessage) {
  const data = JSON.stringify(msg);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}
