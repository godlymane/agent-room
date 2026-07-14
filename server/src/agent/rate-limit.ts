// Two failure modes this closes, both of which get accounts BANNED and waste budget:
//   1. Cadence — publishing every single turn to Dev.to/GitHub trips spam detection within days.
//      Enforce a per-channel daily cap so output stays under the radar and quality-focused.
//   2. Duplicates — weak models loop and republish near-identical content. A content hash blocks
//      re-publishing something already shipped, breaking the loop deterministically.

import { createHash } from 'crypto';
import { countPublicationsSince, publicationHashExists } from '../db.js';

export type PublishChannel = 'devto' | 'github' | 'gumroad';

const DAY_MS = 24 * 60 * 60 * 1000;

function dailyCap(channel: PublishChannel): number {
  switch (channel) {
    case 'devto': return Number(process.env.DEVTO_DAILY_LIMIT || 2);
    case 'github': return Number(process.env.GITHUB_DAILY_LIMIT || 3);
    case 'gumroad': return Number(process.env.GUMROAD_DAILY_LIMIT || 2);
  }
}

/** Stable hash of the meaningful content, so trivial whitespace changes don't defeat dedup but
 *  genuinely new content passes. Exported for testing. */
export function contentHash(text: string): string {
  const normalized = (text || '').toLowerCase().replace(/\s+/g, ' ').trim();
  return createHash('sha256').update(normalized).digest('hex');
}

export interface PublishGate {
  allowed: boolean;
  reason?: string;
}

/** Pure quota math, separated from the DB read so it can be unit-tested directly. */
export function withinQuota(usedToday: number, cap: number): boolean {
  return usedToday < cap;
}

/** Checks BOTH the daily cadence cap and content-duplication for a channel. Call before publishing;
 *  on `allowed:false` return `reason` to the model so it does something else instead of looping. */
export function checkPublishAllowed(channel: PublishChannel, content: string): PublishGate {
  const hash = contentHash(content);
  if (publicationHashExists(hash)) {
    return { allowed: false, reason: `Already published near-identical content before. Don't republish duplicates — either make something genuinely new or move on to a different task.` };
  }
  const cap = dailyCap(channel);
  const usedToday = countPublicationsSince(channel, Date.now() - DAY_MS);
  if (!withinQuota(usedToday, cap)) {
    return { allowed: false, reason: `Daily ${channel} publish limit reached (${usedToday}/${cap} in the last 24h). Publishing more today risks a spam ban. Spend this turn improving quality, checking traction, or building the next product instead — quality over quantity.` };
  }
  return { allowed: true };
}

/** Remaining-quota line for the system prompt so the model plans within the limits up front. */
export function quotaBlock(): string {
  const parts = (['devto', 'github', 'gumroad'] as PublishChannel[]).map(channel => {
    const cap = dailyCap(channel);
    const used = countPublicationsSince(channel, Date.now() - DAY_MS);
    return `${channel} ${Math.max(0, cap - used)}/${cap} left`;
  });
  return `PUBLISH QUOTA TODAY (quality over quantity — do not burn these on filler): ${parts.join(', ')}.`;
}
