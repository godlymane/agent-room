import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closeProceedsUsdc } from '../src/modules/solana-trading.js';

// Regression guard for the accounting bug: a close must credit principal + P&L, so the budget
// isn't silently drained by trades that merely broke even.

test('break-even close returns the full principal', () => {
  assert.equal(closeProceedsUsdc(25, 0), 25);
});

test('profitable close returns principal + profit', () => {
  assert.equal(closeProceedsUsdc(25, 7.5), 32.5);
});

test('losing close returns the reduced proceeds, never negative', () => {
  assert.equal(closeProceedsUsdc(25, -10), 15);
});

test('a total loss floors at zero, not a negative earning', () => {
  assert.equal(closeProceedsUsdc(25, -40), 0);
});
