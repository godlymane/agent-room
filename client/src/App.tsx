import { useEffect, useRef, useState } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { drawRoom } from './canvas/Room';
import type { Activity } from '../../shared/types';

export default function App() {
  const { connected, agent, budget, activities, pendingApproval, browserFrame, startAgent, stopAgent, respondApproval } = useWebSocket();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);

  // Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTime = performance.now();
    let raf: number;

    function render(now: number) {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      drawRoom(ctx!, canvas!, agent, dt);
      raf = requestAnimationFrame(render);
    }
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [agent]);

  // Auto-scroll activity log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [activities]);

  const handleStart = () => {
    setStarted(true);
    startAgent();
  };

  const activityColor = (type: Activity['type']) => {
    switch (type) {
      case 'thought': return '#ffd700';
      case 'action': return '#4fc3f7';
      case 'earning': return '#00ff88';
      case 'error': return '#ff5252';
      case 'strategy': return '#ab47bc';
      case 'approval_needed': return '#ff9800';
      default: return '#888';
    }
  };

  const activityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'thought': return '💭';
      case 'action': return '⚡';
      case 'earning': return '💰';
      case 'error': return '❌';
      case 'strategy': return '🎯';
      case 'approval_needed': return '⚠️';
      default: return '•';
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.title}>AGENT ROOM</h1>
          <span style={{ ...styles.status, color: connected ? '#00ff88' : '#ff5252' }}>
            {connected ? '● CONNECTED' : '○ DISCONNECTED'}
          </span>
        </div>
        <div style={styles.headerRight}>
          {!started ? (
            <button style={styles.startBtn} onClick={handleStart}>▶ WAKE UP AGENT</button>
          ) : (
            <button style={styles.killBtn} onClick={stopAgent}>⏹ KILL SWITCH</button>
          )}
        </div>
      </header>

      <div style={styles.main}>
        {/* Left: 2D Room + Browser View */}
        <div style={styles.leftColumn}>
          <div style={styles.roomPanel}>
            <canvas
              ref={canvasRef}
              width={700}
              height={500}
              style={styles.canvas}
            />
          </div>

          {/* Live Browser View */}
          {browserFrame && (
            <div style={styles.browserPanel}>
              <div style={styles.browserBar}>
                <span style={styles.browserDot} />
                <span style={styles.browserDot} />
                <span style={styles.browserDot} />
                <span style={styles.browserUrl}>{browserFrame.url}</span>
              </div>
              <img
                src={`data:image/jpeg;base64,${browserFrame.image}`}
                alt={browserFrame.title}
                style={styles.browserImg}
              />
            </div>
          )}
        </div>

        {/* Right: Info Panels */}
        <div style={styles.rightPanel}>
          {/* Budget */}
          <div style={styles.panel}>
            <h3 style={styles.panelTitle}>💰 BUDGET</h3>
            {budget ? (
              <div style={styles.budgetGrid}>
                <div style={styles.budgetItem}>
                  <span style={styles.budgetLabel}>Balance</span>
                  <span style={{ ...styles.budgetValue, color: budget.balance > 1 ? '#00ff88' : '#ff5252' }}>
                    ${budget.balance.toFixed(4)}
                  </span>
                </div>
                <div style={styles.budgetItem}>
                  <span style={styles.budgetLabel}>Earned</span>
                  <span style={{ ...styles.budgetValue, color: '#00ff88' }}>${budget.earned.toFixed(2)}</span>
                </div>
                <div style={styles.budgetItem}>
                  <span style={styles.budgetLabel}>Spent</span>
                  <span style={{ ...styles.budgetValue, color: '#ff7043' }}>${budget.spent.toFixed(4)}</span>
                </div>
                <div style={styles.budgetItem}>
                  <span style={styles.budgetLabel}>Runway</span>
                  <span style={{ ...styles.budgetValue, color: budget.runway > 100 ? '#4fc3f7' : '#ff5252' }}>
                    ~{budget.runway} turns
                  </span>
                </div>
                {/* Budget bar */}
                <div style={styles.budgetBar}>
                  <div style={{
                    ...styles.budgetBarFill,
                    width: `${Math.max(0, Math.min(100, (budget.balance / budget.initial) * 100))}%`,
                    backgroundColor: budget.balance / budget.initial > 0.3 ? '#00ff88' : '#ff5252',
                  }} />
                </div>
              </div>
            ) : (
              <p style={styles.dimText}>Loading...</p>
            )}
          </div>

          {/* Agent Status */}
          <div style={styles.panel}>
            <h3 style={styles.panelTitle}>🤖 AGENT</h3>
            {agent ? (
              <div>
                <div style={styles.statusRow}>
                  <span style={styles.budgetLabel}>Status</span>
                  <span style={{
                    fontWeight: 'bold',
                    color: agent.status === 'acting' ? '#00ff88'
                      : agent.status === 'thinking' ? '#ffd700'
                      : agent.status === 'dead' ? '#ff0000'
                      : '#4fc3f7',
                  }}>
                    {agent.status.toUpperCase()}
                  </span>
                </div>
                <div style={styles.statusRow}>
                  <span style={styles.budgetLabel}>Task</span>
                  <span style={styles.taskText}>{agent.currentTask}</span>
                </div>
                {agent.currentDevice && (
                  <div style={styles.statusRow}>
                    <span style={styles.budgetLabel}>Device</span>
                    <span>{agent.currentDevice}</span>
                  </div>
                )}
              </div>
            ) : (
              <p style={styles.dimText}>Agent sleeping...</p>
            )}
          </div>

          {/* Approval Dialog */}
          {pendingApproval && (
            <div style={styles.approvalPanel}>
              <h3 style={{ ...styles.panelTitle, color: '#ff9800' }}>⚠️ APPROVAL NEEDED</h3>
              <p style={{ margin: '8px 0' }}>{pendingApproval.action}</p>
              {pendingApproval.amount > 0 && (
                <p style={{ color: '#ff7043' }}>Amount: ${pendingApproval.amount}</p>
              )}
              <p style={styles.dimText}>{pendingApproval.reason}</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button
                  style={{ ...styles.startBtn, flex: 1 }}
                  onClick={() => respondApproval(pendingApproval.id, true)}
                >
                  ✅ APPROVE
                </button>
                <button
                  style={{ ...styles.killBtn, flex: 1 }}
                  onClick={() => respondApproval(pendingApproval.id, false)}
                >
                  ❌ DENY
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Activity Log */}
      <div style={styles.logPanel}>
        <h3 style={styles.logTitle}>ACTIVITY LOG</h3>
        <div ref={logRef} style={styles.logScroll}>
          {activities.length === 0 && (
            <p style={styles.dimText}>No activity yet. Wake up the agent to begin.</p>
          )}
          {activities.map((act, i) => (
            <div key={act.id || i} style={styles.logEntry}>
              <span style={styles.logTime}>
                {new Date(act.timestamp).toLocaleTimeString()}
              </span>
              <span style={{ marginRight: 6 }}>{activityIcon(act.type)}</span>
              <span style={{ color: activityColor(act.type) }}>
                {act.message}
              </span>
              {act.model && (
                <span style={styles.modelBadge}>{act.model}</span>
              )}
              {act.cost !== undefined && act.cost > 0 && (
                <span style={styles.costBadge}>-${act.cost.toFixed(4)}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: '#0a0a0f',
    color: '#e0e0e0',
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 20px',
    borderBottom: '1px solid #1e1e3a',
    background: '#0f0f18',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 16 },
  headerRight: { display: 'flex', gap: 10 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#00ff88', letterSpacing: 3 },
  status: { fontSize: 11 },
  startBtn: {
    background: '#00ff8830',
    color: '#00ff88',
    border: '1px solid #00ff88',
    padding: '8px 20px',
    borderRadius: 6,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: 'bold',
  },
  killBtn: {
    background: '#ff525230',
    color: '#ff5252',
    border: '1px solid #ff5252',
    padding: '8px 20px',
    borderRadius: 6,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: 'bold',
  },
  main: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    minHeight: 0,
  },
  leftColumn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
    borderRight: '1px solid #1e1e3a',
  },
  roomPanel: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  browserPanel: {
    margin: '0 10px 10px',
    border: '1px solid #1e1e3a',
    borderRadius: 8,
    overflow: 'hidden',
    background: '#111',
  },
  browserBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    background: '#1a1a2e',
    borderBottom: '1px solid #1e1e3a',
  },
  browserDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#333',
  } as React.CSSProperties,
  browserUrl: {
    fontSize: 9,
    color: '#666',
    marginLeft: 8,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  } as React.CSSProperties,
  browserImg: {
    width: '100%',
    display: 'block',
  },
  canvas: {
    width: '100%',
    maxWidth: 700,
    height: 'auto',
    aspectRatio: '7 / 5',
    borderRadius: 8,
    border: '1px solid #1e1e3a',
  },
  rightPanel: {
    width: 300,
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    overflow: 'auto',
  },
  panel: {
    padding: '14px 16px',
    borderBottom: '1px solid #1e1e3a',
  },
  panelTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#888',
    letterSpacing: 2,
    marginBottom: 10,
  },
  budgetGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  budgetItem: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 12,
  },
  budgetLabel: {
    color: '#666680',
    fontSize: 11,
  },
  budgetValue: {
    fontWeight: 'bold',
    fontSize: 13,
  },
  budgetBar: {
    height: 4,
    background: '#1e1e3a',
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  budgetBarFill: {
    height: '100%',
    borderRadius: 2,
    transition: 'width 0.5s',
  },
  statusRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 11,
    marginBottom: 4,
  },
  taskText: {
    fontSize: 10,
    color: '#aaa',
    maxWidth: 180,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  dimText: {
    color: '#444',
    fontSize: 11,
  },
  approvalPanel: {
    padding: '14px 16px',
    borderBottom: '2px solid #ff9800',
    background: '#1a1200',
  },
  logPanel: {
    height: 200,
    borderTop: '1px solid #1e1e3a',
    background: '#0c0c14',
    display: 'flex',
    flexDirection: 'column',
  },
  logTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#555',
    letterSpacing: 2,
    padding: '8px 16px 4px',
  },
  logScroll: {
    flex: 1,
    overflow: 'auto',
    padding: '4px 16px',
    fontSize: 11,
  },
  logEntry: {
    padding: '3px 0',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    borderBottom: '1px solid #111',
  },
  logTime: {
    color: '#444',
    fontSize: 9,
    minWidth: 65,
    flexShrink: 0,
  },
  modelBadge: {
    fontSize: 8,
    padding: '1px 4px',
    borderRadius: 3,
    background: '#1e1e3a',
    color: '#4fc3f7',
    marginLeft: 'auto',
    flexShrink: 0,
  },
  costBadge: {
    fontSize: 8,
    padding: '1px 4px',
    borderRadius: 3,
    background: '#2a1a1a',
    color: '#ff7043',
    flexShrink: 0,
  },
};
