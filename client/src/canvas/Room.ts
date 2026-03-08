import type { AgentState, DeviceType } from '../../../shared/types';

const ROOM_W = 700;
const ROOM_H = 500;

const COLORS = {
  bg: '#12121a',
  floor: '#1a1a2e',
  wall: '#16213e',
  wallAccent: '#0f3460',
  grid: '#1e1e3a',
  agent: '#00ff88',
  agentGlow: 'rgba(0, 255, 136, 0.3)',
  laptop: '#4fc3f7',
  phone: '#ab47bc',
  dashboard: '#ff7043',
  taskboard: '#66bb6a',
  text: '#e0e0e0',
  textDim: '#666680',
  thoughtBg: 'rgba(0, 0, 0, 0.8)',
  thoughtBorder: '#00ff88',
};

interface Device {
  type: DeviceType;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  icon: string;
  color: string;
}

const DEVICES: Device[] = [
  { type: 'laptop', x: 120, y: 180, w: 120, h: 80, label: 'LAPTOP', icon: '💻', color: COLORS.laptop },
  { type: 'phone', x: 460, y: 180, w: 80, h: 100, label: 'PHONE', icon: '📱', color: COLORS.phone },
  { type: 'dashboard', x: 270, y: 40, w: 160, h: 90, label: 'DASHBOARD', icon: '📊', color: COLORS.dashboard },
  { type: 'taskboard', x: 80, y: 350, w: 130, h: 80, label: 'TASKS', icon: '📋', color: COLORS.taskboard },
];

// Agent animation state
let animX = 350;
let animY = 300;
let bobOffset = 0;
let pulsePhase = 0;
let particlePhase = 0;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(t, 1);
}

export function drawRoom(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  agentState: AgentState | null,
  dt: number
) {
  const scaleX = canvas.width / ROOM_W;
  const scaleY = canvas.height / ROOM_H;
  const scale = Math.min(scaleX, scaleY);

  ctx.save();
  ctx.scale(scale, scale);

  // === Background ===
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, ROOM_W, ROOM_H);

  // Floor grid
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 0.5;
  for (let x = 0; x < ROOM_W; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, ROOM_H);
    ctx.stroke();
  }
  for (let y = 0; y < ROOM_H; y += 30) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(ROOM_W, y);
    ctx.stroke();
  }

  // Walls
  ctx.fillStyle = COLORS.wall;
  ctx.fillRect(0, 0, ROOM_W, 20);
  ctx.fillRect(0, 0, 20, ROOM_H);
  ctx.fillRect(ROOM_W - 20, 0, 20, ROOM_H);
  ctx.fillRect(0, ROOM_H - 20, ROOM_W, 20);

  // Wall accent line
  ctx.strokeStyle = COLORS.wallAccent;
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, ROOM_W - 40, ROOM_H - 40);

  // === Devices ===
  for (const dev of DEVICES) {
    const isActive = agentState?.currentDevice === dev.type;

    // Glow when active
    if (isActive) {
      ctx.shadowColor = dev.color;
      ctx.shadowBlur = 20;
    }

    // Device body
    ctx.fillStyle = isActive ? dev.color + '40' : '#1a1a2e';
    ctx.strokeStyle = isActive ? dev.color : dev.color + '60';
    ctx.lineWidth = isActive ? 2 : 1;
    ctx.beginPath();
    ctx.roundRect(dev.x, dev.y, dev.w, dev.h, 8);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;

    // Icon
    ctx.font = `${dev.w * 0.3}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText(dev.icon, dev.x + dev.w / 2, dev.y + dev.h / 2 + 5);

    // Label
    ctx.font = '10px monospace';
    ctx.fillStyle = isActive ? dev.color : COLORS.textDim;
    ctx.fillText(dev.label, dev.x + dev.w / 2, dev.y + dev.h + 15);
  }

  // === Agent ===
  if (agentState) {
    // Smooth movement
    const targetX = agentState.targetPosition?.x ?? agentState.position.x;
    const targetY = agentState.targetPosition?.y ?? agentState.position.y;
    animX = lerp(animX, targetX, dt * 3);
    animY = lerp(animY, targetY, dt * 3);

    // Animation phases
    bobOffset = Math.sin(Date.now() / 400) * 3;
    pulsePhase = (Math.sin(Date.now() / 600) + 1) / 2;
    particlePhase += dt;

    const ax = animX;
    const ay = animY + bobOffset;

    // Glow
    const glowRadius = 25 + pulsePhase * 10;
    const gradient = ctx.createRadialGradient(ax, ay, 5, ax, ay, glowRadius);
    gradient.addColorStop(0, COLORS.agentGlow);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(ax, ay, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // Status ring
    const statusColors: Record<string, string> = {
      thinking: '#ffd700',
      acting: '#00ff88',
      idle: '#4fc3f7',
      paused: '#ff5252',
      dead: '#ff0000',
      waiting_approval: '#ff9800',
    };
    const ringColor = statusColors[agentState.status] || '#ffffff';

    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ax, ay, 18, 0, Math.PI * 2);
    ctx.stroke();

    // Agent body
    ctx.fillStyle = COLORS.agent;
    ctx.beginPath();
    ctx.arc(ax, ay, 12, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#0a0a0f';
    const eyeDir = agentState.targetPosition
      ? Math.atan2(targetY - ay, targetX - ax)
      : 0;
    ctx.beginPath();
    ctx.arc(ax - 4 + Math.cos(eyeDir) * 2, ay - 2, 2.5, 0, Math.PI * 2);
    ctx.arc(ax + 4 + Math.cos(eyeDir) * 2, ay - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Status label
    ctx.font = '9px monospace';
    ctx.fillStyle = ringColor;
    ctx.textAlign = 'center';
    ctx.fillText(agentState.status.toUpperCase(), ax, ay + 30);

    // Thought bubble
    if (agentState.thought) {
      const text = agentState.thought.slice(0, 60);
      const bubbleW = Math.min(text.length * 6 + 20, 280);
      const bubbleH = 35;
      const bx = Math.min(Math.max(ax - bubbleW / 2, 30), ROOM_W - bubbleW - 30);
      const by = ay - 60;

      // Bubble
      ctx.fillStyle = COLORS.thoughtBg;
      ctx.strokeStyle = COLORS.thoughtBorder;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(bx, by, bubbleW, bubbleH, 6);
      ctx.fill();
      ctx.stroke();

      // Tail
      ctx.beginPath();
      ctx.moveTo(ax - 5, by + bubbleH);
      ctx.lineTo(ax, by + bubbleH + 8);
      ctx.lineTo(ax + 5, by + bubbleH);
      ctx.fillStyle = COLORS.thoughtBg;
      ctx.fill();

      // Text
      ctx.font = '10px monospace';
      ctx.fillStyle = COLORS.text;
      ctx.textAlign = 'left';
      ctx.fillText(text, bx + 10, by + 22);
    }
  }

  // === Room label ===
  ctx.font = '11px monospace';
  ctx.fillStyle = COLORS.textDim;
  ctx.textAlign = 'right';
  ctx.fillText('AGENT ROOM v1.0', ROOM_W - 30, ROOM_H - 8);

  ctx.restore();
}
