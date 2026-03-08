import type Anthropic from '@anthropic-ai/sdk';

type Schema = Anthropic.Tool['input_schema'];
const obj = (props: Record<string, any>, required: string[] = []): Schema => ({
  type: 'object' as const, properties: props, required,
});
const str = (desc: string) => ({ type: 'string' as const, description: desc });
const num = (desc: string) => ({ type: 'number' as const, description: desc });

export const agentTools: Anthropic.Tool[] = [
  // === THINKING ===
  { name: 'think', description: 'Internal reasoning shown as thought bubble. Be brief — every token costs money.', input_schema: obj({ reasoning: str('Your thinking') }, ['reasoning']) },

  // === MEMORY ===
  { name: 'save_memory', description: 'Save to persistent memory. Survives restarts.', input_schema: obj({ category: { type: 'string', enum: ['strategy', 'lesson', 'contact', 'opportunity', 'failure'] }, content: str('What to remember'), importance: num('1-10') }, ['category', 'content', 'importance']) },
  { name: 'recall_memories', description: 'Recall memories', input_schema: obj({ category: { type: 'string', enum: ['strategy', 'lesson', 'contact', 'opportunity', 'failure', 'all'] }, limit: num('Max results') }, ['category']) },

  // === BUDGET ===
  { name: 'check_budget', description: 'Check balance, earnings, spending, runway', input_schema: obj({}) },

  // === BROWSER ===
  { name: 'browse_url', description: 'Open a URL. Returns page text + streams screenshot to UI.', input_schema: obj({ url: str('URL to visit') }, ['url']) },
  { name: 'browser_action', description: 'Interact with current page: click, type, extract_text, get_links, screenshot', input_schema: obj({ action: { type: 'string', enum: ['click', 'type', 'extract_text', 'get_links', 'screenshot'] }, selector: str('CSS selector'), text: str('Text to type') }, ['action']) },

  // === GITHUB / FREELANCE ===
  { name: 'github_search_bounties', description: 'Search GitHub issues. Low priority — owner says bounties dont work for him.', input_schema: obj({ query: str('Search query (e.g. "bounty", "help-wanted")'), language: str('Filter by language') }) },
  { name: 'github_read_issue', description: 'Read full details of a GitHub issue', input_schema: obj({ url: str('Issue URL') }, ['url']) },
  { name: 'github_fork_repo', description: 'Fork a repository', input_schema: obj({ repo: str('owner/repo') }, ['repo']) },
  { name: 'github_clone_repo', description: 'Clone a repo to local workspace', input_schema: obj({ repo: str('owner/repo') }, ['repo']) },
  { name: 'github_create_pr', description: 'Create a pull request', input_schema: obj({ repo: str('owner/repo'), title: str('PR title'), body: str('PR description'), branch: str('Source branch') }, ['repo', 'title']) },
  { name: 'github_comment_issue', description: 'Comment on an issue (e.g. claim a bounty)', input_schema: obj({ url: str('Issue URL'), comment: str('Comment text') }, ['url', 'comment']) },
  { name: 'search_freelance_gigs', description: 'Search freelance platforms. Low priority — owner says freelancing wont work.', input_schema: obj({}) },

  // === CONTENT ===
  { name: 'create_content', description: 'Generate content to sell or post', input_schema: obj({ type: { type: 'string', enum: ['article', 'social_post', 'code_template', 'prompt', 'tutorial', 'tool'] }, topic: str('Topic'), platform: str('Target platform'), requirements: str('Requirements') }, ['type', 'topic']) },

  // === CODE ===
  { name: 'write_code', description: 'Write code for a task/bounty', input_schema: obj({ language: str('Language'), task: str('What to build'), requirements: str('Requirements') }, ['language', 'task']) },
  { name: 'run_command', description: 'Run a shell command on the PC (git, npm, node, python, etc.)', input_schema: obj({ command: str('Shell command to run') }, ['command']) },

  // === CRYPTO ===
  { name: 'crypto_check_market', description: 'Get price, volume, SMA, trend for a crypto pair', input_schema: obj({ symbol: str('e.g. BTCUSDT'), timeframe: { type: 'string', enum: ['1m', '5m', '15m', '1h', '4h', '1d'] } }, ['symbol']) },
  { name: 'crypto_trade', description: 'Paper trade (simulated)', input_schema: obj({ symbol: str('Pair'), side: { type: 'string', enum: ['buy', 'sell'] }, amount: num('USDT amount'), reason: str('Why') }, ['symbol', 'side', 'amount', 'reason']) },
  { name: 'crypto_portfolio', description: 'Check paper trading portfolio', input_schema: obj({}) },
  { name: 'crypto_real_balance', description: 'Check REAL Binance balance (needs API keys)', input_schema: obj({}) },
  { name: 'crypto_real_trade', description: 'Place a REAL trade on Binance (needs API keys + BINANCE_REAL=true)', input_schema: obj({ symbol: str('Pair like BTCUSDT'), side: { type: 'string', enum: ['buy', 'sell'] }, amount: num('USDT amount') }, ['symbol', 'side', 'amount']) },

  // === GITHUB PUBLISH ===
  { name: 'github_publish_repo', description: 'Create a public GitHub repo and push files from output/ to it. This makes your tools visible to the world. Include a good README with install instructions and a "Buy Me a Coffee" link.', input_schema: obj({ repo_name: str('Repository name (kebab-case, e.g. "pdf-merger-cli")'), description: str('Short repo description'), files: { type: 'array', items: { type: 'string' }, description: 'Array of file paths relative to output/ to push (e.g. ["pdf_merger.py", "README.md"])' } }, ['repo_name', 'files']) },
  { name: 'github_list_repos', description: 'List your published GitHub repos', input_schema: obj({}) },

  // === DEV.TO ===
  { name: 'devto_publish_article', description: 'Publish an article to Dev.to. Articles get indexed by Google and seen by thousands of developers. Include "Buy Me a Coffee" link and GitHub repo links in every article.', input_schema: obj({ title: str('Article title (catchy, SEO-friendly)'), body_markdown: str('Full article in markdown. MUST include GitHub links and Buy Me a Coffee link at bottom.'), tags: { type: 'array', items: { type: 'string' }, description: 'Up to 4 tags (e.g. ["python", "opensource", "productivity", "tutorial"])' }, series: str('Optional series name to group articles') }, ['title', 'body_markdown']) },
  { name: 'devto_list_articles', description: 'List your published Dev.to articles with view counts', input_schema: obj({}) },

  // === FILES ===
  { name: 'write_file', description: 'Write/save a file', input_schema: obj({ path: str('File path (relative to output/)'), content: str('File content') }, ['path', 'content']) },
  { name: 'read_file', description: 'Read a file', input_schema: obj({ path: str('File path') }, ['path']) },

  // === HUMAN ===
  { name: 'request_approval', description: 'Ask human for approval on something big', input_schema: obj({ action: str('What you want to do'), amount: num('Dollar amount (0 if none)'), reason: str('Why') }, ['action', 'reason']) },
];
