import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findPublishIssue } from '../src/modules/content-guard.js';

const WALLET = '49NHJ5aUPpVwjMrHzgJt7pcYPCi7cxHUXVoEhgBPrAgE';

test('clean content with the real wallet passes', () => {
  assert.equal(findPublishIssue(`Great tool. Tip in USDC: ${WALLET}`, WALLET), null);
});

test('blocks fabricated donation links', () => {
  for (const link of ['buymeacoffee.com/x', 'ko-fi.com/x', 'paypal.me/x', 'patreon.com/x']) {
    assert.notEqual(findPublishIssue(`Support me at ${link}`, WALLET), null, `should block ${link}`);
  }
});

test('blocks unfilled placeholders', () => {
  assert.notEqual(findPublishIssue('Send to [insert wallet here]', WALLET), null);
  assert.notEqual(findPublishIssue('TODO lorem ipsum dolor', WALLET), null);
});

test('blocks 0x ethereum-style addresses (project is Solana-only)', () => {
  assert.notEqual(findPublishIssue('Pay to 0xAbCd1234ef', WALLET), null);
});

test('flags a USDC payment mention that omits the real wallet', () => {
  const issue = findPublishIssue('Send me some USDC to my solana wallet address please', WALLET);
  assert.notEqual(issue, null);
});

test('does not false-positive on generic words like "support"', () => {
  assert.equal(findPublishIssue('This CLI supports Windows, macOS and Linux.', WALLET), null);
});
