// Convergence discipline borrowed from nicepkg/auto-company: brainstorm once, validate once,
// then BUILD — "pure discussion forbidden" once there's a pick. Since every turn here costs real
// budget (API-based runs) or context (local-model runs), we don't spend a separate turn per
// auto-company "cycle" — the candidate is pre-vetted against playbook.PRINCIPLES at catalog time,
// and this module's only job is to PIN one idea until it's actually shipped, so the agent can't
// thrash between candidates mid-build. Persisted in the config table so it survives loop restarts.

import { getSetting, setSetting, getMemoriesByCategory } from '../db.js';
import { pickIdea, principlesBlock, type ProductIdea } from './playbook.js';

interface CouncilState {
  idea: ProductIdea;
  startedAt: number;
}

const STATE_KEY = 'council_state';

function loadState(): CouncilState | null {
  const raw = getSetting(STATE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CouncilState;
  } catch {
    return null;
  }
}

// Titles the agent has already shipped — it marks these itself via save_memory, see the
// "DONE: <title> | ..." convention in getPhaseBlock's step list below.
function shippedTitles(): string[] {
  return getMemoriesByCategory('strategy', 50)
    .map(m => m.content)
    .filter(c => c.startsWith('DONE:'))
    .map(c => c.slice('DONE:'.length).split('|')[0].trim());
}

export function getPhaseBlock(): string {
  const done = shippedTitles();
  let state = loadState();
  if (!state || done.includes(state.idea.title)) {
    state = { idea: pickIdea(done), startedAt: Date.now() };
    setSetting(STATE_KEY, JSON.stringify(state));
  }

  const { idea } = state;
  const channelSteps =
    idea.channel === 'gumroad'
      ? `2. write_code / write_file to draft it, saving every file it needs including a README.md.\n3. gumroad_create_product to list it for sale (fair price for a small digital pack, $3-$12).\n4. devto_publish_article introducing it, linking the exact Gumroad URL step 3 returned.`
      : idea.channel === 'devto'
        ? `2. Write the article body yourself (no code needed) and devto_publish_article it directly.`
        : `2. write_code to draft it, then write_file to save every file it needs, INCLUDING a README.md.\n3. github_publish_repo — wait for the result; copy the exact URL it returns, never guess it.\n4. Only once step 3 actually succeeded: devto_publish_article about it, linking the exact repo URL step 3 returned.`;

  return `CURRENT PICK (already vetted against these principles — do not re-debate or switch ideas, just build):
${principlesBlock()}

IDEA: "${idea.title}" — ${idea.pitch}
Channel: ${idea.channel}

STEPS FOR THIS IDEA:
1. recall_memories to confirm this hasn't already been shipped.
${channelSteps}
5. save_memory with category "strategy" and content starting EXACTLY with "DONE: ${idea.title} | " followed by the real URLs you got back — this is what unlocks the next idea. Never write "DONE" before the tools above actually returned success.`;
}
