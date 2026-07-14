import { logActivity } from '../db.js';
import { findPublishIssue } from './content-guard.js';
import { repoExists } from './github-publish.js';

const DEVTO_API = 'https://dev.to/api';

function getKey(): string {
  const key = process.env.DEVTO_API_KEY;
  if (!key) throw new Error('DEVTO_API_KEY not set in .env');
  return key;
}

async function devtoAPI(endpoint: string, method = 'GET', body?: any): Promise<any> {
  const res = await fetch(`${DEVTO_API}${endpoint}`, {
    method,
    headers: {
      'api-key': getKey(),
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Dev.to API ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}

export async function handleDevtoTool(name: string, input: any): Promise<string> {
  switch (name) {
    case 'devto_publish_article': {
      const { title, body_markdown, tags, series } = input;
      if (!title || !body_markdown) return 'Error: title and body_markdown required';
      const issue = findPublishIssue(`${title}\n${body_markdown}`, process.env.SOLANA_OPERATIONAL_ADDRESS);
      if (issue) return `Not published — ${issue}`;

      // Any github.com/owner/repo link in the article must be a repo that's actually there —
      // otherwise this is a fabricated or failed-but-claimed-successful publish, same class of
      // problem as a fake donation link, just pointing at GitHub instead.
      const repoLinks = [...body_markdown.matchAll(/github\.com\/([\w.-]+)\/([\w.-]+)/g)];
      for (const [, owner, repo] of repoLinks) {
        if (!(await repoExists(owner, repo.replace(/\.git$/, '')))) {
          return `Not published — links to https://github.com/${owner}/${repo}, but that repo doesn't exist. Only link to a repo you already published with github_publish_repo, using the exact URL it returned.`;
        }
      }

      try {
        const article = await devtoAPI('/articles', 'POST', {
          article: {
            title,
            body_markdown,
            published: true,
            tags: tags || ['programming', 'opensource', 'productivity'],
            ...(series ? { series } : {}),
          },
        });

        const url = article.url || article.canonical_url || `https://dev.to/p/${article.id}`;
        logActivity({ type: 'earning', message: `Published article: ${url}`, device: 'laptop' });
        return `Published! URL: ${url}\nID: ${article.id}\nTitle: ${article.title}`;
      } catch (e: any) {
        return `Dev.to publish error: ${e.message}`;
      }
    }

    case 'devto_list_articles': {
      try {
        const articles = await devtoAPI('/articles/me?per_page=10');
        if (!articles || articles.length === 0) return 'No articles published yet.';
        return articles.map((a: any) =>
          `${a.title} (${a.page_views_count || 0} views, ${a.positive_reactions_count || 0} reactions) ${a.url}`
        ).join('\n');
      } catch (e: any) {
        return `Error: ${e.message}`;
      }
    }

    default:
      return `Unknown devto tool: ${name}`;
  }
}
