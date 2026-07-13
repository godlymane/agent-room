import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { createTransferCheckedInstruction, getAccount, getAssociatedTokenAddress, getMint } from '@solana/spl-token';
import bs58 from 'bs58';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import { getSetting, getSurvivalPaidUsdc, recordSurvivalPayment, setSetting } from '../db.js';
import type { SurvivalStatus } from '../../../shared/types.js';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const treasuryAddress = process.env.SOLANA_TREASURY_ADDRESS || '49NHJ5aUPpVwjMrHzgJt7pcYPCi7cxHUXVoEhgBPrAgE';
const mode = process.env.SOLANA_MODE === 'live' ? 'live' : 'simulation';
const cap = Number(process.env.SOLANA_OPERATIONAL_CAP_USDC || 50);
const target = Number(process.env.SOLANA_DEBT_TARGET_USDC || 35000);
let reconciling = false;

export function getSurvivalStatus(): SurvivalStatus {
  const startedAt = Number(getSetting('survival_started_at') || Date.now());
  const firstRevenueAt = getSetting('survival_first_revenue_at');
  const paid = getSurvivalPaidUsdc();
  const state: SurvivalStatus['state'] = paid >= target ? 'free' : (!firstRevenueAt && Date.now() > startedAt + WEEK_MS ? 'dead' : 'active');
  return { startedAt, deadlineAt: startedAt + WEEK_MS, firstRevenueAt: firstRevenueAt ? Number(firstRevenueAt) : null, state, operationalCapUsdc: cap, debtTargetUsdc: target, debtPaidUsdc: paid, treasuryAddress, mode };
}

/** Starts the irreversible seven-day clock. Repeated calls preserve the original start. */
export function startSurvivalChallenge() {
  if (!getSetting('survival_started_at')) setSetting('survival_started_at', String(Date.now()));
  return getSurvivalStatus();
}

/** Accepts any format Phantom can give you: the base58 string from "Export Private Key",
 *  a JSON byte array (e.g. from `solana-keygen`), or a 12/24-word secret recovery phrase —
 *  derived with Phantom's default path (m/44'/501'/0'/0', account #0). */
export function signerFromEnv(): Keypair {
  const raw = process.env.SOLANA_OPERATIONAL_SECRET_KEY?.trim();
  if (!raw) throw new Error('SOLANA_OPERATIONAL_SECRET_KEY is required for live transfers');
  if (raw.startsWith('[')) {
    const bytes = JSON.parse(raw);
    if (!Array.isArray(bytes)) throw new Error('SOLANA_OPERATIONAL_SECRET_KEY must be a JSON byte array, a base58 string, or a seed phrase');
    return Keypair.fromSecretKey(Uint8Array.from(bytes));
  }
  if (raw.includes(' ')) {
    if (!bip39.validateMnemonic(raw)) throw new Error('SOLANA_OPERATIONAL_SECRET_KEY looks like a seed phrase but is not a valid BIP39 mnemonic — check for typos or extra spaces.');
    const seed = bip39.mnemonicToSeedSync(raw);
    const { key } = derivePath("m/44'/501'/0'/0'", seed.toString('hex'));
    return Keypair.fromSeed(key);
  }
  return Keypair.fromSecretKey(bs58.decode(raw));
}

/** Reconciles a USDC operational wallet. Live mode moves only the excess above the fixed cap. */
export async function reconcileSolanaSurvival() {
  if (reconciling) return { status: getSurvivalStatus(), sweptUsdc: 0, message: 'Reconciliation already running' };
  reconciling = true;
  try {
  const status = getSurvivalStatus();
  if (status.state !== 'active') return { status, sweptUsdc: 0, message: `Challenge is ${status.state}` };
  const mintAddress = process.env.SOLANA_USDC_MINT;
  if (!mintAddress) return { status, sweptUsdc: 0, message: 'USDC mint not configured' };
  const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com', 'confirmed');
  const mint = new PublicKey(mintAddress);
  const operationalAddress = process.env.SOLANA_OPERATIONAL_ADDRESS;
  if (!operationalAddress) return { status, sweptUsdc: 0, message: 'Operational Solana address not configured' };
  const owner = new PublicKey(operationalAddress);
  const sourceAta = await getAssociatedTokenAddress(mint, owner);
  const source = await getAccount(connection, sourceAta);
  const mintInfo = await getMint(connection, mint);
  const balance = Number(source.amount) / 10 ** mintInfo.decimals;
  if (balance > 0 && !getSetting('survival_first_revenue_at')) {
    setSetting('survival_first_revenue_at', String(Date.now()));
  }
  const excess = Math.max(0, balance - cap);
  if (excess <= 0) return { status, sweptUsdc: 0, message: `Operational balance ${balance.toFixed(2)} USDC is within the cap` };
  if (mode === 'simulation') return { status, sweptUsdc: excess, message: `Simulation: would sweep ${excess.toFixed(2)} USDC` };
  const signer = signerFromEnv();
  if (!signer.publicKey.equals(owner)) throw new Error('SOLANA_OPERATIONAL_ADDRESS does not match SOLANA_OPERATIONAL_SECRET_KEY');
  const feePayer = process.env.SOLANA_FEE_PAYER_SECRET_KEY ? (() => {
    const bytes = JSON.parse(process.env.SOLANA_FEE_PAYER_SECRET_KEY!);
    return Keypair.fromSecretKey(Uint8Array.from(bytes));
  })() : signer;
  const destinationAta = await getAssociatedTokenAddress(mint, new PublicKey(treasuryAddress));
  await getAccount(connection, destinationAta); // Never create an account or spend rent implicitly.
  const amount = BigInt(Math.floor(excess * 10 ** mintInfo.decimals));
  const transaction = new Transaction({ feePayer: feePayer.publicKey }).add(createTransferCheckedInstruction(sourceAta, mint, destinationAta, signer.publicKey, amount, mintInfo.decimals));
  const signature = await sendAndConfirmTransaction(connection, transaction, feePayer.publicKey.equals(signer.publicKey) ? [signer] : [signer, feePayer]);
  setSetting('survival_first_revenue_at', getSetting('survival_first_revenue_at') || String(Date.now()));
  recordSurvivalPayment({ amountUsdc: excess, signature, mode });
  return { status: getSurvivalStatus(), sweptUsdc: excess, signature, message: `Swept ${excess.toFixed(2)} USDC` };
  } finally {
    reconciling = false;
  }
}
