// Small local models sometimes fabricate donation links that were never mentioned in the
// prompt (e.g. inventing a buymeacoffee.com/whatever handle nobody registered) or leave
// unfilled template placeholders in "finished" copy. Both are worse than an empty article:
// they're live, public, and misleading. Block publishing until the LLM fixes it.

const FORBIDDEN_LINK_PATTERNS = [
  /buymeacoffee\.com/i,
  /ko-fi\.com/i,
  /paypal\.me/i,
  /patreon\.com/i,
  /cash\.app/i,
  /venmo\.com/i,
];

const PLACEHOLDER_PATTERNS = [
  /\[insert[^\]]*\]/i,
  /\[briefly[^\]]*\]/i,
  /\[link to[^\]]*\]/i,
  /\[describe[^\]]*\]/i,
  /\[your[^\]]*\]/i,
  /\[[a-z ]{3,40}here\]/i,
  /\btbd\b/i,
  /lorem ipsum/i,
  /wallet[:\s]*\.\.\./i,
  /0x\.\.\./,
];

// This project is Solana-only — a Solana address is base58 (e.g. "8SQwUgRs..."), never "0x...".
// Any 0x-style hex string is either a fabricated/truncated address or the wrong network entirely.
const ETH_STYLE_ADDRESS = /\b0x[a-fA-F0-9]{4,}\b/;

/** Returns a reason string if `text` shouldn't be published as-is, or null if it's clean.
 *  Pass `realWallet` to also verify any mention of "wallet"/USDC payment info actually includes
 *  the real configured Solana address, rather than accepting the mention on faith. */
export function findPublishIssue(text: string, realWallet?: string): string | null {
  for (const pattern of FORBIDDEN_LINK_PATTERNS) {
    if (pattern.test(text)) {
      return `Contains a ${pattern.source.replace(/\\\./g, '.')} link — the only payment channel for this project is the Solana wallet already given to you. Remove any other donation link; don't invent one.`;
    }
  }
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(text)) {
      return `Contains an unfilled template placeholder (matched ${pattern.source}). Write the actual content — don't leave brackets like "[insert X here]" in published copy.`;
    }
  }
  if (ETH_STYLE_ADDRESS.test(text)) {
    return `Contains a "0x..." style address — this project is Solana-only, which never uses 0x-prefixed addresses. You wrote a fake/wrong-network address instead of the real Solana wallet you were given. Use the exact wallet address from the prompt, verbatim.`;
  }
  // Narrow on purpose: generic words like "support" or "payment" appear constantly in unrelated
  // code/READMEs (e.g. "supported browsers"). Only trigger on phrasing that specifically implies
  // a Solana/USDC payment instruction is being given.
  if (realWallet && /\busdc\b|\bsolana wallet\b|\bwallet address\b|\bsend.{0,20}(usdc|solana)\b/i.test(text) && !text.includes(realWallet)) {
    return `Mentions a Solana/USDC payment but doesn't include the real configured wallet address (${realWallet}) verbatim — looks like a paraphrased or invented address. Copy the exact address from the prompt instead of retyping or summarizing it.`;
  }
  return null;
}
