import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';
import { v4 as uuid } from 'uuid';
import {
  insertPosition, closePositionRow, getOpenPositions, getRecentPositions,
  getOpenPositionsUsdcTotal, getPositionById, logActivity, logTransaction,
  type TradingPositionRow,
} from '../db.js';
import { signerFromEnv } from './solana-survival.js';
import { withWalletLock } from './solana-lock.js';

function config() {
  return {
    enabled: process.env.ENABLE_SOLANA_TRADING === 'true',
    apiKey: process.env.JUPITER_API_KEY || '',
    baseUrl: (process.env.JUPITER_BASE_URL || 'https://api.jup.ag').replace(/\/$/, ''),
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    usdcMint: process.env.SOLANA_USDC_MINT || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    maxPositionUsdc: Number(process.env.SOLANA_MAX_POSITION_USDC || 25),
    exposureCapUsdc: Number(process.env.SOLANA_OPERATIONAL_CAP_USDC || 50),
    minStopLossPct: 2,
    maxStopLossPct: 50,
    maxPriceImpactPct: 5,
    pollMs: Number(process.env.SOLANA_TRADING_POLL_MS || 60_000),
  };
}

let reconciling = false;

/** Bounded fetch — without a timeout, a stalled Jupiter request hangs whatever called it forever,
 *  including the stop-loss poller (the one thing that's supposed to keep running no matter what). */
async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const timeoutMs = Number(process.env.JUPITER_TIMEOUT_MS || 20_000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error: any) {
    if (error.name === 'AbortError') throw new Error(`Jupiter API timed out after ${timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/** GET /swap/v2/order — a quote, and (when `taker` is set) an unsigned transaction ready to sign. */
async function jupiterOrder(params: Record<string, string>) {
  const { apiKey, baseUrl } = config();
  if (!apiKey) throw new Error('JUPITER_API_KEY is not configured — get one at https://developers.jup.ag/portal');
  const query = new URLSearchParams(params).toString();
  const res = await fetchWithTimeout(`${baseUrl}/swap/v2/order?${query}`, { headers: { 'x-api-key': apiKey } });
  const data = await res.json() as any;
  if (!res.ok || data.errorCode) throw new Error(`Jupiter quote error: ${data.errorMessage || res.status}`);
  return data as { transaction: string | null; requestId: string; outAmount: string; priceImpactPct?: string; errorMessage?: string };
}

/** POST /swap/v2/execute — submits a signed transaction built from a prior /order call. */
async function jupiterExecute(signedTransaction: string, requestId: string) {
  const { apiKey, baseUrl } = config();
  const res = await fetchWithTimeout(`${baseUrl}/swap/v2/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({ signedTransaction, requestId }),
  });
  const data = await res.json() as any;
  if (!res.ok || data.status !== 'Success') throw new Error(`Jupiter execute error: ${data.error || data.status || res.status}`);
  return data as { status: string; signature: string; totalInputAmount: string; totalOutputAmount: string };
}

// Mint decimals are immutable on-chain, so one RPC lookup per mint is enough for the process
// lifetime — uncached, the 60s stop-loss poll paid 2+ redundant RPC round-trips per position.
const decimalsCache = new Map<string, number>();

// Validate before handing a mint to @solana/web3.js — an invalid/Ethereum-style address otherwise
// throws a cryptic "Non-base58 character" deep in the SDK instead of a message the agent can act on.
function isValidMint(mint: string): boolean {
  try {
    new PublicKey(mint);
    return true;
  } catch {
    return false;
  }
}

async function decimalsOf(connection: Connection, mint: string): Promise<number> {
  const cached = decimalsCache.get(mint);
  if (cached !== undefined) return cached;
  const info = await getMint(connection, new PublicKey(mint));
  decimalsCache.set(mint, info.decimals);
  return info.decimals;
}

async function signAndSend(unsignedTxBase64: string, requestId: string) {
  const signer = signerFromEnv();
  const tx = VersionedTransaction.deserialize(Buffer.from(unsignedTxBase64, 'base64'));
  tx.sign([signer]);
  const signedTransaction = Buffer.from(tx.serialize()).toString('base64');
  return jupiterExecute(signedTransaction, requestId);
}

/** Read-only: what a position of `amountUsdc` in `outputMint` would cost right now. No wallet or funds involved. */
export async function getJupiterQuote(outputMint: string, amountUsdc: number) {
  const cfg = config();
  const connection = new Connection(cfg.rpcUrl, 'confirmed');
  const usdcDecimals = await decimalsOf(connection, cfg.usdcMint);
  const outDecimals = await decimalsOf(connection, outputMint);
  const amountAtomic = BigInt(Math.floor(amountUsdc * 10 ** usdcDecimals));
  const quote = await jupiterOrder({ inputMint: cfg.usdcMint, outputMint, amount: amountAtomic.toString() });
  const tokenAmount = Number(quote.outAmount) / 10 ** outDecimals;
  return {
    price: tokenAmount > 0 ? amountUsdc / tokenAmount : 0,
    tokenAmount,
    priceImpactPct: quote.priceImpactPct ? Number(quote.priceImpactPct) : null,
  };
}

/**
 * Opens a real Solana position via Jupiter. Hard caps enforced here, not just prompted to the LLM:
 * max $ per position, max total open exposure, and a mandatory stop-loss. The stop-loss is enforced
 * by `reconcileTradingPositions` polling price and market-selling — there is no separate "protect" step
 * that can fail and leave the position unguarded, because the DB row (which the poller reads) is only
 * ever written after the buy has already confirmed on-chain.
 */
export async function openPosition(input: { outputMint: string; amountUsdc: number; stopLossPct: number; symbol?: string; reason?: string }): Promise<string> {
  const cfg = config();
  if (!cfg.enabled) return 'Real Solana trading is disabled. Set ENABLE_SOLANA_TRADING=true in server/.env to enable it.';
  if (typeof input.outputMint !== 'string' || !isValidMint(input.outputMint)) {
    return 'Rejected: output_mint must be a valid Solana token mint (base58 address). "0x..." Ethereum addresses are not valid on Solana.';
  }
  if (!Number.isFinite(input.amountUsdc) || input.amountUsdc <= 0) return 'amount_usdc must be a positive number.';
  if (input.amountUsdc > cfg.maxPositionUsdc) return `Rejected: amount_usdc ${input.amountUsdc} exceeds the max position size of $${cfg.maxPositionUsdc}.`;
  if (!Number.isFinite(input.stopLossPct) || input.stopLossPct < cfg.minStopLossPct || input.stopLossPct > cfg.maxStopLossPct) {
    return `Rejected: stop_loss_pct is required and must be between ${cfg.minStopLossPct} and ${cfg.maxStopLossPct}.`;
  }
  const operationalAddress = process.env.SOLANA_OPERATIONAL_ADDRESS;
  if (!operationalAddress) return 'SOLANA_OPERATIONAL_ADDRESS is not configured.';

  // Everything from here on reads exposure and moves the wallet, so it must be serialized
  // against the survival sweep and against any concurrent open/close on this same wallet.
  return withWalletLock(async () => {
    const openExposure = getOpenPositionsUsdcTotal();
    if (openExposure + input.amountUsdc > cfg.exposureCapUsdc) {
      return `Rejected: opening $${input.amountUsdc} would bring total open exposure to $${(openExposure + input.amountUsdc).toFixed(2)}, above the $${cfg.exposureCapUsdc} cap. Close a position first.`;
    }

    const connection = new Connection(cfg.rpcUrl, 'confirmed');
    const usdcDecimals = await decimalsOf(connection, cfg.usdcMint);
    const amountAtomic = BigInt(Math.floor(input.amountUsdc * 10 ** usdcDecimals));
    const quote = await jupiterOrder({ inputMint: cfg.usdcMint, outputMint: input.outputMint, amount: amountAtomic.toString(), taker: operationalAddress });

    const priceImpact = quote.priceImpactPct ? Number(quote.priceImpactPct) : 0;
    if (priceImpact > cfg.maxPriceImpactPct) {
      return `Rejected: price impact ${priceImpact.toFixed(2)}% exceeds the ${cfg.maxPriceImpactPct}% safety limit for this token — likely too illiquid to trade safely.`;
    }
    if (!quote.transaction) return `Jupiter could not build a transaction for this swap (${quote.errorMessage || 'unknown reason'}).`;

    const result = await signAndSend(quote.transaction, quote.requestId);

    const outDecimals = await decimalsOf(connection, input.outputMint);
    const tokenAmount = Number(result.totalOutputAmount) / 10 ** outDecimals;
    const entryPrice = tokenAmount > 0 ? input.amountUsdc / tokenAmount : 0;
    const stopLossPrice = entryPrice * (1 - input.stopLossPct / 100);

    const id = uuid();
    insertPosition({
      id, outputMint: input.outputMint, symbol: input.symbol, amountUsdc: input.amountUsdc, tokenAmount,
      entryPrice, stopLossPct: input.stopLossPct, stopLossPrice, entrySignature: result.signature,
    });
    logTransaction({ type: 'expense', amount: input.amountUsdc, description: `Opened Solana position ${input.symbol || input.outputMint}${input.reason ? `: ${input.reason}` : ''}`, module: 'solana-trading' });
    logActivity({ type: 'action', message: `Bought ${tokenAmount.toFixed(4)} ${input.symbol || input.outputMint} for $${input.amountUsdc} (stop @ $${stopLossPrice.toFixed(6)})`, device: 'dashboard' });
    return `Position opened: ${tokenAmount.toFixed(4)} ${input.symbol || input.outputMint} @ $${entryPrice.toFixed(6)}. Stop-loss $${stopLossPrice.toFixed(6)} (-${input.stopLossPct}%), monitored automatically every ${Math.round(cfg.pollMs / 1000)}s. Signature: ${result.signature}`;
  });
}

/** Sells a position back to USDC. Re-checks the position is still 'open' from inside the wallet
 *  lock right before selling, so if a concurrent caller (manual close vs. the stop-loss poller)
 *  already sold it, this is a safe no-op instead of a double sell. Returns null in that case. */
async function sellPositionToUsdc(positionId: string): Promise<{ position: TradingPositionRow; exitPrice: number; pnlUsdc: number; signature: string } | null> {
  return withWalletLock(async () => {
    const position = getPositionById(positionId);
    if (!position || position.status !== 'open') return null;

    const cfg = config();
    const connection = new Connection(cfg.rpcUrl, 'confirmed');
    const outDecimals = await decimalsOf(connection, position.output_mint);
    const usdcDecimals = await decimalsOf(connection, cfg.usdcMint);
    const amountAtomic = BigInt(Math.floor(position.token_amount * 10 ** outDecimals));
    const operationalAddress = process.env.SOLANA_OPERATIONAL_ADDRESS!;
    const quote = await jupiterOrder({ inputMint: position.output_mint, outputMint: cfg.usdcMint, amount: amountAtomic.toString(), taker: operationalAddress });
    if (!quote.transaction) throw new Error(`Could not build exit transaction: ${quote.errorMessage || 'unknown reason'}`);
    const result = await signAndSend(quote.transaction, quote.requestId);
    const exitUsdc = Number(result.totalOutputAmount) / 10 ** usdcDecimals;
    const exitPrice = position.token_amount > 0 ? exitUsdc / position.token_amount : 0;
    const pnlUsdc = exitUsdc - position.amount_usdc;
    return { position, exitPrice, pnlUsdc, signature: result.signature };
  });
}

function recordClose(position: TradingPositionRow, status: 'closed_manual' | 'closed_stop', close: { exitPrice: number; pnlUsdc: number; signature: string }) {
  closePositionRow(position.id, { status, exitPrice: close.exitPrice, pnlUsdc: close.pnlUsdc, exitSignature: close.signature });
  // The open already logged the FULL principal as an expense, so the close must credit the full
  // exit proceeds (principal + P&L), not just |P&L| — logging only the P&L left every position's
  // principal permanently "spent" in the books, silently draining the budget toward the death
  // condition even on break-even trades.
  const proceedsUsdc = position.amount_usdc + close.pnlUsdc;
  logTransaction({ type: 'earning', amount: Math.max(0, proceedsUsdc), description: `Closed Solana position ${position.symbol || position.output_mint} (${status}): proceeds $${proceedsUsdc.toFixed(2)} (P&L ${close.pnlUsdc >= 0 ? '+' : ''}$${close.pnlUsdc.toFixed(2)})`, module: 'solana-trading' });
  logActivity({ type: close.pnlUsdc >= 0 ? 'earning' : 'action', message: `Closed ${position.symbol || position.output_mint}: ${close.pnlUsdc >= 0 ? '+' : ''}$${close.pnlUsdc.toFixed(2)} (${status})`, device: 'dashboard' });
}

export async function closePosition(positionId: string): Promise<string> {
  const existing = getPositionById(positionId);
  if (!existing) return `No position found with id ${positionId}.`;
  if (existing.status !== 'open') return `Position ${positionId} is already ${existing.status}.`;
  const sold = await sellPositionToUsdc(positionId);
  if (!sold) return `Position ${positionId} was already closed — likely the stop-loss poller sold it moments before this request.`;
  recordClose(sold.position, 'closed_manual', sold);
  return `Closed ${sold.position.symbol || sold.position.output_mint}: ${sold.pnlUsdc >= 0 ? '+' : ''}$${sold.pnlUsdc.toFixed(2)} P&L. Signature: ${sold.signature}`;
}

export function listPositions(): string {
  const open = getOpenPositions();
  const recent = getRecentPositions(10).filter(p => p.status !== 'open');
  const openStr = open.length
    ? open.map(p => `  [OPEN ${p.id}] ${p.symbol || p.output_mint}: $${p.amount_usdc} @ $${p.entry_price.toFixed(6)}, stop @ $${p.stop_loss_price.toFixed(6)}`).join('\n')
    : '  No open positions';
  const closedStr = recent.length
    ? recent.map(p => `  [${p.status}] ${p.symbol || p.output_mint}: ${p.pnl_usdc! >= 0 ? '+' : ''}$${p.pnl_usdc!.toFixed(2)}`).join('\n')
    : '  No closed positions yet';
  return `Open positions:\n${openStr}\n\nRecent closed:\n${closedStr}`;
}

/** Polls open positions and market-sells any that have hit their stop-loss. This IS the stop-loss —
 *  there is no separate on-chain resting order, so this must run continuously for protection to hold. */
export async function reconcileTradingPositions(): Promise<{ checked: number; closed: number }> {
  if (reconciling) return { checked: 0, closed: 0 };
  reconciling = true;
  try {
    const open = getOpenPositions();
    let closed = 0;
    for (const position of open) {
      try {
        const cfg = config();
        const connection = new Connection(cfg.rpcUrl, 'confirmed');
        const outDecimals = await decimalsOf(connection, position.output_mint);
        const usdcDecimals = await decimalsOf(connection, cfg.usdcMint);
        const amountAtomic = BigInt(Math.floor(position.token_amount * 10 ** outDecimals));
        const quote = await jupiterOrder({ inputMint: position.output_mint, outputMint: cfg.usdcMint, amount: amountAtomic.toString() });
        const currentUsdc = Number(quote.outAmount) / 10 ** usdcDecimals;
        const currentPrice = position.token_amount > 0 ? currentUsdc / position.token_amount : 0;
        if (currentPrice <= position.stop_loss_price) {
          const sold = await sellPositionToUsdc(position.id);
          if (sold) {
            recordClose(sold.position, 'closed_stop', sold);
            closed++;
          }
        }
      } catch (error: any) {
        logActivity({ type: 'error', message: `Stop-loss check failed for ${position.symbol || position.output_mint}: ${error.message}`, device: 'dashboard' });
      }
    }
    return { checked: open.length, closed };
  } finally {
    reconciling = false;
  }
}

export async function handleJupiterTool(name: string, input: any): Promise<string> {
  switch (name) {
    case 'jupiter_get_quote': {
      if (typeof input.output_mint !== 'string' || !isValidMint(input.output_mint)) {
        return 'Rejected: output_mint must be a valid Solana token mint (base58 address).';
      }
      if (!Number.isFinite(input.amount_usdc) || input.amount_usdc <= 0) {
        return 'Rejected: amount_usdc must be a positive number.';
      }
      const quote = await getJupiterQuote(input.output_mint, input.amount_usdc);
      return `Price: $${quote.price.toFixed(6)} per token. You'd receive ~${quote.tokenAmount.toFixed(4)} tokens for $${input.amount_usdc}.${quote.priceImpactPct !== null ? ` Price impact: ${quote.priceImpactPct.toFixed(2)}%.` : ''}`;
    }
    case 'jupiter_open_position':
      return await openPosition({
        outputMint: input.output_mint,
        amountUsdc: input.amount_usdc,
        stopLossPct: input.stop_loss_pct,
        symbol: input.symbol,
        reason: input.reason,
      });
    case 'jupiter_list_positions':
      return listPositions();
    case 'jupiter_close_position':
      return await closePosition(input.position_id);
    default:
      return `Unknown jupiter tool: ${name}`;
  }
}
