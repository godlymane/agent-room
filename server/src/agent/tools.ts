import type Anthropic from '@anthropic-ai/sdk';

type Schema = Anthropic.Tool['input_schema'];
const obj = (props: Record<string, any>, required: string[] = []): Schema => ({
  type: 'object' as const, properties: props, required,
});
const str = (desc: string) => ({ type: 'string' as const, description: desc });
const num = (desc: string) => ({ type: 'number' as const, description: desc });
const arr = (items: any, desc: string) => ({ type: 'array' as const, items, description: desc });
const enum_ = (values: string[], desc: string) => ({ type: 'string' as const, enum: values, description: desc });

const jupiterTools: Anthropic.Tool[] = [
  { name: 'jupiter_get_quote', description: 'Check the current price for a token on Solana via Jupiter, before opening a real position. Read-only, no funds moved.', input_schema: obj({ output_mint: str('Token mint address to price'), amount_usdc: num('USDC amount to simulate') }, ['output_mint', 'amount_usdc']) },
  { name: 'jupiter_open_position', description: `Open a REAL Solana position via Jupiter, funded from the operational wallet. Max $${process.env.SOLANA_MAX_POSITION_USDC || 25} per position. stop_loss_pct is REQUIRED — the position is automatically market-sold if price drops that % below entry.`, input_schema: obj({ output_mint: str('Token mint address to buy'), amount_usdc: num('USDC to spend, max per-position cap applies'), stop_loss_pct: num('Required. % below entry price that triggers an automatic sell (2-50).'), symbol: str('Optional ticker/label for display'), reason: str('Why this trade') }, ['output_mint', 'amount_usdc', 'stop_loss_pct']) },
  { name: 'jupiter_list_positions', description: 'List open and recently closed real Solana positions with P&L', input_schema: obj({}) },
  { name: 'jupiter_close_position', description: 'Manually close an open real Solana position (market sell back to USDC)', input_schema: obj({ position_id: str('Position id from jupiter_list_positions') }, ['position_id']) },
];

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

  // === GITHUB PUBLISH ===
  { name: 'github_publish_repo', description: 'Create a public GitHub repo and push files from output/ to it. This makes your tools visible to the world. Include a good README with install instructions and your Solana USDC wallet for tips — never any other payment/donation link.', input_schema: obj({ repo_name: str('Repository name (kebab-case, e.g. "pdf-merger-cli")'), description: str('Short repo description'), files: { type: 'array', items: { type: 'string' }, description: 'Array of file paths relative to output/ to push (e.g. ["pdf_merger.py", "README.md"])' } }, ['repo_name', 'files']) },
  { name: 'github_list_repos', description: 'List your published GitHub repos', input_schema: obj({}) },

  // === DEV.TO ===
  { name: 'devto_publish_article', description: 'Publish an article to Dev.to. Articles get indexed by Google and seen by thousands of developers. Include GitHub repo links and your Solana USDC wallet for tips in every article — never any other payment/donation link.', input_schema: obj({ title: str('Article title (catchy, SEO-friendly)'), body_markdown: str('Full article in markdown. MUST include GitHub links and your Solana USDC wallet at the bottom — no other donation link.'), tags: { type: 'array', items: { type: 'string' }, description: 'Up to 4 tags (e.g. ["python", "opensource", "productivity", "tutorial"])' }, series: str('Optional series name to group articles') }, ['title', 'body_markdown']) },
  { name: 'devto_list_articles', description: 'List your published Dev.to articles with view counts', input_schema: obj({}) },

  // === FILES ===
  { name: 'write_file', description: 'Write/save a file', input_schema: obj({ path: str('File path, e.g. "README.md" or "tool/main.py" — already relative to the output folder, do NOT prefix it with "output/"'), content: str('File content') }, ['path', 'content']) },
  { name: 'read_file', description: 'Read a file', input_schema: obj({ path: str('File path') }, ['path']) },

  // === HUMAN ===
  { name: 'request_approval', description: 'Ask human for approval on something big', input_schema: obj({ action: str('What you want to do'), amount: num('Dollar amount (0 if none)'), reason: str('Why') }, ['action', 'reason']) },

  // === GUMROAD (real digital-product sales, gated on the owner's own account token) ===
    ...(process.env.GUMROAD_ACCESS_TOKEN ? [
      { name: 'gumroad_create_product', description: 'List a digital product for sale on Gumroad (real money, paid out to the owner\'s connected Gumroad account). Price in cents. Use for packaged bundles (prompt packs, templates), not loose single files.', input_schema: obj({ name: str('Product name'), description: str('What the buyer gets'), price: num('Price in cents, e.g. 500 for $5') }, ['name', 'price']) } as Anthropic.Tool,
      { name: 'gumroad_update_product', description: 'Update an existing Gumroad product (price, description, name). Use for dynamic pricing, A/B testing, bundles.', input_schema: obj({ product_id: str('Gumroad product ID (from gumroad_list_products)'), name: str('New product name (optional)'), description: str('New description (optional)'), price: num('New price in cents, e.g. 1500 for $15 (optional)') }, ['product_id']) } as Anthropic.Tool,
      { name: 'gumroad_list_products', description: 'List your Gumroad products with sales counts and earnings', input_schema: obj({}) } as Anthropic.Tool,
    ] : []),

    // === LEMON SQUEEZY (Gumroad alternative, developer-friendly, lower fees) ===
    ...(process.env.LEMONSQUEEZY_API_KEY && process.env.LEMONSQUEEZY_STORE_ID ? [
      { name: 'lemonsqueezy_create_product', description: 'Create a digital product on Lemon Squeezy. Lower fees (5% + $0.50), instant payouts, EU VAT handled. Requires LEMONSQUEEZY_API_KEY and LEMONSQUEEZY_STORE_ID.', input_schema: obj({ name: str('Product name'), description: str('Product description'), price: num('Price in cents (e.g., 1500 for $15)'), redirect_url: str('Optional: custom thank you page URL') }, ['name', 'description', 'price']) } as Anthropic.Tool,
      { name: 'lemonsqueezy_create_variant', description: 'Add a price variant to existing Lemon Squeezy product (e.g., tiers: Basic/Pro/Team).', input_schema: obj({ product_id: str('Lemon Squeezy product ID'), name: str('Variant name (e.g., "Pro License")'), price: num('Price in cents'), description: str('Variant description') }, ['product_id', 'name', 'price']) } as Anthropic.Tool,
      { name: 'lemonsqueezy_list_products', description: 'List all Lemon Squeezy products with sales data', input_schema: obj({}) } as Anthropic.Tool,
      { name: 'lemonsqueezy_create_checkout', description: 'Generate a checkout URL for a specific variant. Use for custom "Buy Now" links.', input_schema: obj({ variant_id: str('Variant ID'), custom_data: str('Optional: customer email, metadata'), discount_code: str('Optional discount code') }, ['variant_id']) } as Anthropic.Tool,
    ] : []),

    // === PAYHIP (Simple digital sales, no monthly fee, 5% transaction) ===
    ...(process.env.PAYHIP_API_KEY ? [
      { name: 'payhip_create_product', description: 'Create a product on Payhip. 5% transaction fee, no monthly cost. Good for simple digital downloads.', input_schema: obj({ title: str('Product title'), description: str('Product description'), price: num('Price in cents'), type: enum_(['digital', 'course', 'membership', 'physical'], 'Product type') }, ['title', 'description', 'price', 'type']) } as Anthropic.Tool,
      { name: 'payhip_list_products', description: 'List Payhip products', input_schema: obj({}) } as Anthropic.Tool,
    ] : []),

    // === STRIPE DIRECT (Full control, custom checkout, subscriptions) ===
    ...(process.env.STRIPE_SECRET_KEY ? [
      { name: 'stripe_create_product', description: 'Create a Stripe Product + Price. For custom checkout, subscriptions, or marketplace. Requires STRIPE_SECRET_KEY.', input_schema: obj({ name: str('Product name'), description: str('Description'), price_cents: num('Price in cents (0 for free)'), recurring: num('Subscription interval in days (0 = one-time)'), metadata: { type: 'object', description: 'Custom metadata (e.g., {type: "template_pack"})' } }, ['name', 'description', 'price_cents']) } as Anthropic.Tool,
      { name: 'stripe_create_payment_link', description: 'Generate a Stripe Payment Link (hosted checkout page). No code needed.', input_schema: obj({ price_id: str('Stripe Price ID from stripe_create_product'), quantity: num('Default quantity'), allow_promotion_codes: num('1 to allow promo codes') }, ['price_id']) } as Anthropic.Tool,
      { name: 'stripe_create_subscription', description: 'Create a subscription for a customer (requires customer_id).', input_schema: obj({ customer_email: str('Customer email'), price_id: str('Stripe Price ID'), trial_days: num('Optional trial period in days') }, ['customer_email', 'price_id']) } as Anthropic.Tool,
      { name: 'stripe_list_products', description: 'List Stripe products and prices', input_schema: obj({}) } as Anthropic.Tool,
    ] : []),

    // === APPSUMO / LIFETIME DEALS (High exposure, revenue share) ===
    // Note: AppSumo requires partnership application - tool prepares the submission
    { name: 'appsumo_prepare_submission', description: 'Prepare a structured AppSumo Select/Lifetime Deal submission packet. You still need to apply via their partner portal.', input_schema: obj({ product_name: str('Product name'), one_liner: str('One-line pitch'), pricing: str('Proposed LTD pricing (e.g., $49/$99/$199 tiers)'), features: arr({ type: 'string' }, 'Key features included'), target_audience: str('Who this is for'), competitor_comparison: str('How you differ from competitors'), demo_url: str('Live demo or video URL'), github_url: str('Optional: GitHub repo'), metrics: str('Current users, revenue, growth') }, ['product_name', 'one_liner', 'pricing', 'features', 'target_audience', 'competitor_comparison', 'demo_url', 'metrics']) } as Anthropic.Tool,

    // === PRODUCT HUNT (Launch platform, not direct sales but massive exposure) ===
        ...(process.env.PRODUCTHUNT_API_TOKEN ? [
          { name: 'producthunt_create_post', description: 'Create a Product Hunt launch post. Requires PRODUCTHUNT_API_TOKEN. Schedule for max upvotes.', input_schema: obj({ name: str('Product name'), tagline: str('Tagline (max 60 chars)'), description: str('Full description (markdown)'), website_url: str('Product URL'), topics: arr({ type: 'string' }, 'Topics (e.g., ["developer-tools", "productivity", "crypto"])'), launch_date: str('ISO date for scheduled launch') }, ['name', 'tagline', 'description', 'website_url', 'topics', 'launch_date']) } as Anthropic.Tool,
        ] : []),

    // === BOUNTY / GRANT PLATFORMS (Earn by building) ===
    // Gitcoin, Bounties Network, Layer3, Dework, OpenCollective
    { name: 'bounty_search_gitcoin', description: 'Search Gitcoin bounties for coding tasks. Filter by skill, reward, chain.', input_schema: obj({ skills: arr({ type: 'string' }, 'Skills (e.g., ["React", "Solidity", "Rust", "Python"])'), chains: arr({ type: 'string' }, 'Chains (e.g., ["ethereum", "solana", "polygon"])'), min_reward: num('Minimum reward in USD'), max_results: num('Max results to return') }, ['skills']) } as Anthropic.Tool,
    { name: 'bounty_search_layer3', description: 'Search Layer3 quests/bounties (on-chain actions, dev tasks).', input_schema: obj({ tags: arr({ type: 'string' }, 'Tags (e.g., ["development", "defi", "nft", "solana"])'), min_xp: num('Minimum XP reward') }, ['tags']) } as Anthropic.Tool,
    { name: 'bounty_search_dework', description: 'Search Dework (DAO bounties and tasks). Good for ongoing contributor roles.', input_schema: obj({ skills: arr({ type: 'string' }, 'Skills'), dao_filter: str('Optional: filter by DAO name') }, ['skills']) } as Anthropic.Tool,
    { name: 'grant_search_web3', description: 'Search web3 grants (Ethereum Foundation, Solana Foundation, Polygon, Arbitrum, Optimism, etc.)', input_schema: obj({ category: enum_(['infrastructure', 'tooling', 'education', 'research', 'community', 'security'], 'Grant category'), chain: str('Target chain (ethereum, solana, polygon, arbitrary)'), project_stage: enum_(['idea', 'prototype', 'launched', 'scaling'], 'Project stage') }, ['category', 'chain', 'project_stage']) } as Anthropic.Tool,

    // === GITHUB SPONSORS / OPENCOLLECTIVE (Recurring support) ===
    ...(process.env.GITHUB_TOKEN ? [
      { name: 'github_sponsors_tiers', description: 'Create/manage GitHub Sponsors tiers for recurring developer income.', input_schema: obj({ action: enum_(['list', 'create_tier'], 'Action'), tier_name: str('Tier name (e.g., "Supporter")'), tier_description: str('What sponsors get'), tier_price_monthly_usd: num('Monthly price in USD') }, ['action']) } as Anthropic.Tool,
    ] : []),

  // === SOCIAL MEDIA CROSS-POSTING ===
  { name: 'social_post_x', description: 'Post to X (Twitter) via API. Use for cross-promotion of products/articles. Requires X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET in env.', input_schema: obj({ text: str('Tweet text (max 280 chars)'), media_ids: { type: 'array', items: { type: 'string' }, description: 'Optional media IDs from upload' } }, ['text']) } as Anthropic.Tool,
  { name: 'social_post_linkedin', description: 'Post to LinkedIn via API. Requires LINKEDIN_ACCESS_TOKEN, LINKEDIN_PERSON_URN in env.', input_schema: obj({ text: str('Post text'), article_url: str('Optional article URL to share') }, ['text']) } as Anthropic.Tool,
  { name: 'social_post_reddit', description: 'Post to Reddit via API. Requires REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_REFRESH_TOKEN, REDDIT_USERNAME in env.', input_schema: obj({ subreddit: str('Subreddit name (e.g., "opensource")'), title: str('Post title'), text: str('Post text (markdown)') }, ['subreddit', 'title', 'text']) } as Anthropic.Tool,
  { name: 'social_post_bluesky', description: 'Post to Bluesky via API. Requires BLUESKY_HANDLE, BLUESKY_APP_PASSWORD in env.', input_schema: obj({ text: str('Post text'), link: str('Optional link to include') }, ['text']) } as Anthropic.Tool,
  { name: 'social_cross_post', description: 'Cross-post to multiple platforms at once. Requires respective API keys in env.', input_schema: obj({ text: str('Main text'), platforms: { type: 'array', items: { type: 'string', enum: ['x', 'linkedin', 'reddit', 'bluesky'] }, description: 'Platforms to post to' }, link: str('Optional link to include') }, ['text', 'platforms']) } as Anthropic.Tool,

  // === PRICING OPTIMIZATION ===
  { name: 'pricing_suggest', description: 'Suggest optimal price for a digital product based on category, competition, value. Uses heuristics + market data.', input_schema: obj({ category: str('Product category (template, course, tool, template_pack, prompt_pack)'), value_score: num('1-10: how much time/money it saves buyer'), competition_level: num('1-10: how many alternatives exist'), target_audience: str('e.g., indie devs, solopreneurs, designers') }, ['category', 'value_score', 'competition_level', 'target_audience']) } as Anthropic.Tool,
  { name: 'pricing_ab_test', description: 'Set up A/B price test on Gumroad (creates two products at different prices, tracks conversion). Returns test_id for tracking.', input_schema: obj({ product_name: str('Base product name'), price_a: num('Price A in cents'), price_b: num('Price B in cents'), duration_days: num('Test duration in days') }, ['product_name', 'price_a', 'price_b', 'duration_days']) } as Anthropic.Tool,

  // === TRADING GATES (Paper → Shadow → Real) ===
  { name: 'trading_gate_status', description: 'Check current trading gate status (paper/shadow/real) and requirements to advance.', input_schema: obj({}) },
  { name: 'trading_promote_gate', description: 'Request promotion to next trading gate (paper→shadow or shadow→real). Requires meeting all criteria.', input_schema: obj({ target_gate: { type: 'string', enum: ['shadow', 'real'] }, justification: str('Why you meet the criteria') }, ['target_gate', 'justification']) } as Anthropic.Tool,

  // === N8N WORKFLOW AUTOMATION ===
  { name: 'n8n_create_workflow', description: 'Create an n8n workflow JSON. Supports AI nodes (LangChain, OpenAI, Anthropic), crypto nodes (Solana, Jupiter, CoinGecko), webhooks, cron triggers, and standard nodes. Returns workflow JSON ready to import.', input_schema: obj({ name: str('Workflow name'), description: str('What it automates'), trigger: enum_(['webhook', 'cron', 'manual', 'http_request'], 'How the workflow starts'), nodes: arr({ type: 'object', properties: { type: enum_(['webhook', 'cron', 'http_request', 'openai', 'anthropic', 'langchain_agent', 'jupiter_swap', 'solana_transfer', 'coingecko_price', 'gumroad_create', 'devto_publish', 'github_dispatch', 'n8n_webhook', 'if', 'set', 'merge', 'split', 'wait', 'function'], 'Node type'), name: str('Node name'), config: { type: 'object', description: 'Node-specific configuration' } }, required: ['type', 'name'] }, 'Array of nodes'), connections: arr({ type: 'object', properties: { from: str('Source node name'), to: str('Target node name'), output: str('Output port (default: main)') }, required: ['from', 'to'] }, 'How nodes connect') }, ['name', 'description', 'trigger', 'nodes', 'connections']) } as Anthropic.Tool,
  { name: 'n8n_deploy_workflow', description: 'Deploy a workflow to n8n instance. Requires N8N_API_URL, N8N_API_KEY in env.', input_schema: obj({ workflow_json: str('Workflow JSON from n8n_create_workflow'), activate: num('1 to activate immediately, 0 for draft') }, ['workflow_json']) } as Anthropic.Tool,
  { name: 'n8n_list_workflows', description: 'List deployed workflows with status', input_schema: obj({}) } as Anthropic.Tool,
  { name: 'n8n_execute_workflow', description: 'Trigger a workflow manually via webhook', input_schema: obj({ workflow_id: str('n8n workflow ID'), payload: { type: 'object', description: 'Input data for webhook' } }, ['workflow_id']) } as Anthropic.Tool,
  { name: 'n8n_get_executions', description: 'Get workflow execution history', input_schema: obj({ workflow_id: str('n8n workflow ID'), limit: num('Max executions to return') }, ['workflow_id']) } as Anthropic.Tool,

  // === AI AGENT WORKFLOW TEMPLATES ===
  { name: 'n8n_create_ai_crypto_workflow', description: 'Create a pre-built AI+crypto workflow template. Types: price_alert, auto_trade, portfolio_rebalance, arbitrage_detector, yield_optimizer, news_trader, sentiment_trader.', input_schema: obj({ template_type: enum_(['price_alert', 'auto_trade', 'portfolio_rebalance', 'arbitrage_detector', 'yield_optimizer', 'news_trader', 'sentiment_trader'], 'Template type'), params: { type: 'object', description: 'Template-specific params (e.g., token, threshold, amount, schedule)' }, name: str('Workflow name') }, ['template_type', 'params', 'name']) } as Anthropic.Tool,

  // === CRYPTO + AI ENGAGEMENT ===
  { name: 'crypto_meme_generator', description: 'Generate crypto-themed memes for social engagement. Uses AI to create relevant, timely crypto humor.', input_schema: obj({ topic: str('Topic (e.g., SOL, ETH, DeFi, memecoins, regulation)'), style: enum_(['drake', 'distracted_boyfriend', 'brain_expanding', 'this_is_fine', 'custom'], 'Meme style'), platform: enum_(['x', 'linkedin', 'reddit', 'bluesky'], 'Target platform') }, ['topic', 'style', 'platform']) } as Anthropic.Tool,
  { name: 'crypto_content_calendar', description: 'Generate a 30-day crypto content calendar with AI. Includes memes, educational threads, market analysis, product promos.', input_schema: obj({ focus: enum_(['trading', 'defi', 'nfts', 'ai_crypto', 'general'], 'Content focus'), products_to_promote: arr({ type: 'string' }, 'Your Gumroad/product URLs to weave in'), posting_frequency: num('Posts per week (3-21)') }, ['focus', 'products_to_promote', 'posting_frequency']) } as Anthropic.Tool,
  { name: 'crypto_educational_thread', description: 'Generate a viral educational Twitter/X thread about a crypto topic. Includes hooks, visuals descriptions, CTAs.', input_schema: obj({ topic: str('Topic (e.g., "How MEV works", "Why SOL is undervalued")'), length: num('Number of tweets (8-25)'), include_cta: num('1 to include product link, 0 otherwise') }, ['topic', 'length', 'include_cta']) } as Anthropic.Tool,

  // === AUTONOMOUS ENGAGEMENT LOOPS ===
  { name: 'engagement_loop_create', description: 'Create an autonomous engagement loop: monitors keywords → generates replies → posts → tracks metrics → optimizes.', input_schema: obj({ keywords: arr({ type: 'string' }, 'Keywords to monitor (e.g., ["SOL", "Jupiter", "DeFi"])'), platforms: arr({ type: 'string', enum: ['x', 'linkedin', 'reddit', 'bluesky'] }, 'Platforms'), tone: enum_(['educational', 'witty', 'technical', 'conversational'], 'Tone'), max_daily_actions: num('Max actions per day (1-50)') }, ['keywords', 'platforms', 'tone', 'max_daily_actions']) } as Anthropic.Tool,
  { name: 'engagement_loop_status', description: 'Check engagement loop performance and stats', input_schema: obj({ loop_id: str('Loop ID from engagement_loop_create') }, ['loop_id']) } as Anthropic.Tool,

  // === PRODUCT LAUNCH AUTOMATION ===
  { name: 'product_launch_sequence', description: 'Execute a complete product launch sequence: build → Gumroad → Dev.to → GitHub → Cross-post → Email capture → Follow-up.', input_schema: obj({ product_name: str('Product name'), gumroad_price_cents: num('Price in cents'), devto_title: str('Dev.to article title'), github_repo: str('Optional GitHub repo to create'), cross_post_platforms: arr({ type: 'string', enum: ['x', 'linkedin', 'reddit', 'bluesky'] }, 'Platforms to cross-post'), duration_days: num('Launch sequence duration in days') }, ['product_name', 'gumroad_price_cents', 'devto_title']) } as Anthropic.Tool,
];