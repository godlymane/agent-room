import { useEffect, useRef, useCallback, useState } from 'react';
import type { WSMessage, AgentState, Budget, Activity, ApprovalRequest } from '../../../shared/types';

interface BrowserFrame {
  image: string; // base64 JPEG
  url: string;
  title: string;
  timestamp: number;
}

interface WSState {
  connected: boolean;
  agent: AgentState | null;
  budget: Budget | null;
  activities: Activity[];
  pendingApproval: ApprovalRequest | null;
  browserFrame: BrowserFrame | null;
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<WSState>({
    connected: false,
    agent: null,
    budget: null,
    activities: [],
    pendingApproval: null,
    browserFrame: null,
  });

  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.hostname}:3001`);
    wsRef.current = ws;

    ws.onopen = () => {
      setState(s => ({ ...s, connected: true }));
    };

    ws.onclose = () => {
      setState(s => ({ ...s, connected: false }));
      // Reconnect after 2s
      setTimeout(() => {
        wsRef.current = new WebSocket(`ws://${window.location.hostname}:3001`);
      }, 2000);
    };

    ws.onmessage = (event) => {
      const msg: WSMessage = JSON.parse(event.data);

      switch (msg.type) {
        case 'state_update':
          setState(s => ({ ...s, agent: msg.data }));
          break;
        case 'budget_update':
          setState(s => ({ ...s, budget: msg.data }));
          break;
        case 'activity': {
          const act = msg.data;
          // Parse browser frame screenshots
          if (act.message && act.message.includes('__BROWSER_FRAME__')) {
            const match = act.message.match(/__BROWSER_FRAME__(.+?)__URL__(.+?)__TITLE__(.+)/);
            if (match) {
              setState(s => ({
                ...s,
                browserFrame: {
                  image: match[1],
                  url: match[2],
                  title: match[3],
                  timestamp: Date.now(),
                },
                // Don't add raw frame data to activity log
              }));
              break;
            }
          }
          setState(s => ({
            ...s,
            activities: [...s.activities.slice(-200), act],
          }));
          break;
        }
        case 'approval_request':
          setState(s => ({ ...s, pendingApproval: msg.data }));
          break;
      }
    };

    // Fetch initial state
    fetch('/api/state')
      .then(r => r.json())
      .then(data => {
        setState(s => ({
          ...s,
          agent: data.agent,
          budget: data.budget,
        }));
      })
      .catch(() => {});

    fetch('/api/activities')
      .then(r => r.json())
      .then(acts => {
        setState(s => ({ ...s, activities: acts }));
      })
      .catch(() => {});

    return () => { ws.close(); };
  }, []);

  const send = useCallback((msg: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const startAgent = useCallback(() => {
    fetch('/api/agent/start', { method: 'POST' });
  }, []);

  const stopAgent = useCallback(() => {
    fetch('/api/agent/stop', { method: 'POST' });
  }, []);

  const respondApproval = useCallback((id: string, approved: boolean) => {
    send({ type: 'approval_response', data: { id, approved } });
    setState(s => ({ ...s, pendingApproval: null }));
  }, [send]);

  return { ...state, send, startAgent, stopAgent, respondApproval };
}
