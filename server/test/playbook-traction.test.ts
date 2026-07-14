import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickIdea, IDEAS } from '../src/agent/playbook.js';
import { rescueTextToolCall } from '../src/agent/local-llm.js';
import { formatTractionBlock } from '../src/modules/traction.js';

test('pickIdea prefers the paid (Gumroad) channel while paid ideas remain', () => {
  // No titles used yet -> must return a paid product, since that's the real-money channel.
  for (let i = 0; i < 20; i++) {
    assert.equal(pickIdea([]).channel, 'gumroad');
  }
});

test('pickIdea never repeats a shipped title while unused ideas remain', () => {
  const allButOne = IDEAS.slice(0, -1).map(i => i.title);
  const pick = pickIdea(allButOne);
  assert.equal(pick.title, IDEAS[IDEAS.length - 1].title);
});

test('rescueTextToolCall recovers a JSON-as-text tool call for a known tool', () => {
  const known = new Set(['write_file']);
  const rescued = rescueTextToolCall('{"name":"write_file","parameters":{"path":"a.md","content":"x"}}', known);
  assert.equal(rescued?.name, 'write_file');
  assert.deepEqual(rescued?.input, { path: 'a.md', content: 'x' });
});

test('rescueTextToolCall ignores prose and unknown tools', () => {
  const known = new Set(['write_file']);
  assert.equal(rescueTextToolCall('I will now write the file.', known), null);
  assert.equal(rescueTextToolCall('{"name":"rm_rf","parameters":{}}', known), null);
});

test('formatTractionBlock surfaces a reality-check when output is high but earnings are zero', () => {
  const block = formatTractionBlock({
    at: 0,
    devto: { configured: true, count: 6, totalViews: 10, totalReactions: 0, top: [] },
    github: { configured: true, repoCount: 4, totalStars: 0, top: [] },
    gumroad: { configured: true, productCount: 2, totalSales: 0, totalUsd: 0, top: [] },
  });
  assert.match(block, /REALITY CHECK/);
});

test('formatTractionBlock handles the no-data case gracefully', () => {
  assert.match(formatTractionBlock(null), /no data yet/);
});
