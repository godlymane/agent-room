import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentHash, withinQuota } from '../src/agent/rate-limit.js';

test('withinQuota gates strictly below the cap', () => {
  assert.equal(withinQuota(0, 2), true);
  assert.equal(withinQuota(1, 2), true);
  assert.equal(withinQuota(2, 2), false);
  assert.equal(withinQuota(3, 2), false);
});

test('contentHash ignores whitespace-only differences (defeats trivial re-publishing)', () => {
  assert.equal(contentHash('Hello   world\n'), contentHash('hello world'));
});

test('contentHash differs for genuinely different content', () => {
  assert.notEqual(contentHash('Tool A readme'), contentHash('Tool B readme'));
});

test('contentHash is stable and hex', () => {
  const h = contentHash('deterministic input');
  assert.equal(h, contentHash('deterministic input'));
  assert.match(h, /^[a-f0-9]{64}$/);
});
