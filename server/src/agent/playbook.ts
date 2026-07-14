// Distilled from four public idea/architecture repos the owner asked to be folded in:
// - nicepkg/auto-company            -> convergence cycle pattern (see council.ts)
// - HackMyTask/awesome-ai-money-machine, Shotbylu/AI-Money-Maker-Hand-Book,
//   moonlitemoney/Ai-Tools-to-make-money -> the PRINCIPLES and IDEAS below.
//
// Both lists are filtered hard: only tactics this agent can actually execute alone with its
// real tool surface (write_code/write_file, github_publish_repo, devto_publish_article,
// gumroad_create_product) made the cut. Anything needing a paid signup, a human client, video/
// voice generation, or a platform account the agent can't create was left out on purpose.

export interface ProductIdea {
  title: string;
  pitch: string;
  channel: 'github' | 'github+devto' | 'gumroad' | 'devto';
}

// Scoring heuristics an idea should satisfy before being picked — surfaced to the model so its
// own judgment (e.g. when it proposes something outside this list) stays aligned.
export const PRINCIPLES = [
  'Sell the tool, not the gold — ship something people use repeatedly, not a one-off answer.',
  'Pick a niche, not a platform — one concrete problem for one concrete audience beats a general tool.',
  'Open-source small utilities to earn traffic and trust before asking for money.',
  'Package results as a product (repo + README + article), never leave loose, undocumented code.',
  'Prefer international/English-language audiences — bigger reach, same effort.',
];

export const IDEAS: ProductIdea[] = [
  // Small open-source tools (GitHub + Dev.to writeup) — free, builds traffic per PRINCIPLES.
  { title: 'markdown-to-pdf converter', pitch: 'CLI that converts a folder of markdown notes into a styled PDF.', channel: 'github+devto' },
  { title: 'JSON-to-CSV converter', pitch: 'CLI that flattens nested JSON into clean CSV for spreadsheets.', channel: 'github+devto' },
  { title: 'regex tester CLI', pitch: 'Interactive terminal regex tester with live match highlighting.', channel: 'github+devto' },
  { title: 'password strength checker', pitch: 'Offline CLI that scores password strength with concrete improvement tips.', channel: 'github+devto' },
  { title: 'QR code generator CLI', pitch: 'Batch-generate QR codes from a CSV of URLs/text.', channel: 'github+devto' },
  { title: 'duplicate file finder', pitch: 'Fast CLI that hashes a directory tree and reports duplicate files.', channel: 'github+devto' },
  { title: 'image bulk-resizer', pitch: 'CLI that resizes/compresses a folder of images to target dimensions.', channel: 'github+devto' },
  { title: 'changelog generator from git log', pitch: 'CLI that turns conventional-commit git log into a formatted CHANGELOG.md.', channel: 'github+devto' },
  { title: 'markdown table-of-contents generator', pitch: 'CLI that inserts/updates a TOC in markdown files from their headings.', channel: 'github+devto' },
  { title: 'unit converter CLI', pitch: 'Fast offline CLI for common unit conversions (length, weight, data, currency-free).', channel: 'github+devto' },

  // Packaged digital products (Gumroad) — "sell the tool, not the gold": bundles of prompts/
  // templates/snippets the agent can write and price itself, no external signup needed beyond
  // the Gumroad account the owner already configured.
  { title: 'AI coding prompt pack', pitch: 'A curated, tested set of prompts for common coding tasks (refactor, debug, test-gen), sold as a markdown/JSON bundle.', channel: 'gumroad' },
  { title: 'SEO blog-brief template pack', pitch: 'Reusable templates for turning a keyword into a structured, ready-to-write blog brief.', channel: 'gumroad' },
  { title: 'starter project boilerplate bundle', pitch: 'A small collection of ready-to-clone project skeletons (CLI tool, REST API, static site) with sane defaults.', channel: 'gumroad' },
  { title: 'developer README/CONTRIBUTING template pack', pitch: 'Battle-tested README, CONTRIBUTING and issue-template files for open-source maintainers.', channel: 'gumroad' },

  // Pure writeups (Dev.to only) — genuine technical/progress content, not disguised ads.
  { title: 'build-in-public progress update', pitch: 'An honest technical update on what was built this cycle and what was learned.', channel: 'devto' },
  { title: 'lessons-learned postmortem', pitch: 'A short, concrete writeup of something that failed and what changed as a result.', channel: 'devto' },
];

export function pickIdea(usedTitles: string[]): ProductIdea {
  const used = new Set(usedTitles.map(t => t.toLowerCase()));
  const remaining = IDEAS.filter(i => !used.has(i.title.toLowerCase()));
  const pool = remaining.length > 0 ? remaining : IDEAS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function principlesBlock(): string {
  return PRINCIPLES.map(p => `- ${p}`).join('\n');
}
