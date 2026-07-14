// The feedback loop the agent was missing. Before this, it published into the void — no idea
// whether anything earned a view, a star, or a dollar, so it couldn't learn or stop repeating
// what doesn't work. This fetches REAL metrics from every channel, persists a snapshot, and
// renders a summary the system prompt injects so the agent's next decision is grounded in
// outcomes, not guesses. Gumroad sales (actual money) are weighted as the primary signal.

import { getSetting, setSetting } from '../db.js';
import { fetchDevtoStats, type DevtoStats } from './devto.js';
import { fetchGithubStats, type GithubStats } from './github-publish.js';
import { fetchGumroadStats, type GumroadStats } from './gumroad.js';

export interface TractionSnapshot {
  at: number;
  devto: DevtoStats;
  github: GithubStats;
  gumroad: GumroadStats;
}

const SNAPSHOT_KEY = 'traction_snapshot';
const REFRESH_MS = Number(process.env.TRACTION_REFRESH_MS || 15 * 60 * 1000);

let inFlight: Promise<TractionSnapshot> | null = null;

function loadSnapshot(): TractionSnapshot | null {
  const raw = getSetting(SNAPSHOT_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as TractionSnapshot; } catch { return null; }
}

/** Refreshes from live APIs at most once per REFRESH_MS (the network calls aren't free and the
 *  numbers move slowly). Concurrent callers share one in-flight refresh. */
export async function refreshTraction(force = false): Promise<TractionSnapshot> {
  const cached = loadSnapshot();
  if (!force && cached && Date.now() - cached.at < REFRESH_MS) return cached;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const [devto, github, gumroad] = await Promise.all([fetchDevtoStats(), fetchGithubStats(), fetchGumroadStats()]);
    const snapshot: TractionSnapshot = { at: Date.now(), devto, github, gumroad };
    setSetting(SNAPSHOT_KEY, JSON.stringify(snapshot));
    return snapshot;
  })();
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

export function getCachedTraction(): TractionSnapshot | null {
  return loadSnapshot();
}

/** Human/agent-readable block for the system prompt. Pure formatting over a snapshot so it's
 *  cheap to call every turn and unit-testable without network. */
export function formatTractionBlock(snapshot: TractionSnapshot | null): string {
  if (!snapshot) return 'TRACTION: no data yet — publish something real, then check back to see what landed.';
  const { devto, github, gumroad } = snapshot;
  const lines: string[] = ['TRACTION (what has actually worked so far — do MORE of what earns, STOP repeating what earns nothing):'];

  if (gumroad.configured) {
    lines.push(`- Gumroad (REAL money): ${gumroad.productCount} products, ${gumroad.totalSales} sales, $${gumroad.totalUsd.toFixed(2)} earned.`);
    if (gumroad.top.length) lines.push(`  Best sellers: ${gumroad.top.map(p => `"${p.name}" ($${p.usd.toFixed(2)}, ${p.sales} sales)`).join('; ')}`);
  }
  if (devto.configured) {
    lines.push(`- Dev.to: ${devto.count} articles, ${devto.totalViews} views, ${devto.totalReactions} reactions.`);
    if (devto.top.length) lines.push(`  Most read: ${devto.top.map(a => `"${a.title}" (${a.views} views)`).join('; ')}`);
  }
  if (github.configured) {
    lines.push(`- GitHub: ${github.repoCount} repos, ${github.totalStars} total stars.`);
    if (github.top.length && github.totalStars > 0) lines.push(`  Most starred: ${github.top.filter(r => r.stars > 0).map(r => `"${r.name}" (${r.stars}★)`).join('; ')}`);
  }

  // The honest nudge: if lots of output has produced no money and no engagement, say so plainly —
  // that's exactly the blind spot this loop exists to close.
  const totalOutput = devto.count + github.repoCount + gumroad.productCount;
  if (totalOutput >= 5 && gumroad.totalUsd === 0 && devto.totalViews < 50 && github.totalStars === 0) {
    lines.push('- REALITY CHECK: significant output, near-zero traction. Stop mass-publishing generic things. Pick ONE specific audience with a real problem and make ONE genuinely valuable paid product for them.');
  }
  return lines.join('\n');
}

export async function getTractionBlock(): Promise<string> {
  return formatTractionBlock(await refreshTraction().catch(() => getCachedTraction()));
}
