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
];

/** Returns a reason string if `text` shouldn't be published as-is, or null if it's clean. */
export function findPublishIssue(text: string): string | null {
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
  return null;
}
