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
    // Reconnect must go through connect() so the new socket gets ALL handlers re-attached —
    // the old code created a bare `new WebSocket(...)` with no listeners, leaving the dashboard
    // (including approval requests) permanently deaf after the first disconnect.
    let disposed = false;
    let reconnectTimer: number | undefined;

    const refetchState = () => {
      fetch('/api/state')
        .then(r => r.json())
        .then(data => {
          setState(s => ({ ...s, agent: data.agent, budget: data.budget }));
        })
        .catch(() => {});
      fetch('/api/activities')
        .then(r => r.json())
        .then(acts => {
          setState(s => ({ ...s, activities: acts }));
        })
        .catch(() => {});
    };

    const connect = () => {
      const ws = new WebSocket(`ws://${window.location.hostname}:3001`);
      wsRef.current = ws;

      ws.onopen = () => {
        setState(s => ({ ...s, connected: true }));
        // Refetch on every (re)connect, not just mount — anything broadcast while
        // disconnected was missed and the local state is stale.
        refetchState();
      };

      ws.onclose = () => {
        setState(s => ({ ...s, connected: false }));
        if (!disposed) reconnectTimer = window.setTimeout(connect, 2000);
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
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer !== undefined) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  const send = useCallback((msg: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // 'command' (pause/resume/kill/set_config) and 'approval_response' (can authorize real
      // spending) are admin-gated server-side; attach the token here so callers of send()
      // don't each have to remember to.
      const payload = msg.type === 'command' || msg.type === 'approval_response'
        ? { ...msg, data: { ...msg.data, token: import.meta.env.VITE_ADMIN_API_TOKEN } }
        : msg;
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  const adminHeaders = (): HeadersInit => {
    const token = import.meta.env.VITE_ADMIN_API_TOKEN;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const startAgent = useCallback(() => {
    fetch('/api/agent/start', { method: 'POST', headers: adminHeaders() })
      .then(r => { if (!r.ok) console.error('Failed to start agent:', r.status, r.statusText); })
      .catch(err => console.error('Failed to start agent:', err));
  }, []);

  const stopAgent = useCallback(() => {
    fetch('/api/agent/stop', { method: 'POST', headers: adminHeaders() })
      .then(r => { if (!r.ok) console.error('Failed to stop agent:', r.status, r.statusText); })
      .catch(err => console.error('Failed to stop agent:', err));
  }, []);

  const respondApproval = useCallback((id: string, approved: boolean) => {
    send({ type: 'approval_response', data: { id, approved } });
    setState(s => ({ ...s, pendingApproval: null }));
  }, [send]);

  return { ...state, send, startAgent, stopAgent, respondApproval };
}
