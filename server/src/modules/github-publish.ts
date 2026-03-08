import fs from 'fs';
import path from 'path';
import { logActivity } from '../db.js';

const GITHUB_API = 'https://api.github.com';
const OUTPUT_DIR = 'C:/Users/devda/agent-room/output';

function getToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN not set in .env');
  return token;
}

async function githubAPI(endpoint: string, method = 'GET', body?: any): Promise<any> {
  const res = await fetch(`${GITHUB_API}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${data.message || JSON.stringify(data)}`);
  return data;
}

async function getUsername(): Promise<string> {
  const user = await githubAPI('/user');
  return user.login;
}

export async function handleGithubPublishTool(name: string, input: any): Promise<string> {
  switch (name) {
    case 'github_publish_repo': {
      const { repo_name, description, files } = input;
      if (!repo_name) return 'Error: repo_name required';
      if (!files || !Array.isArray(files) || files.length === 0) return 'Error: files array required (paths relative to output/)';

      try {
        const username = await getUsername();

        // 1. Create the repo
        let repoCreated = false;
        try {
          await githubAPI('/user/repos', 'POST', {
            name: repo_name,
            description: description || 'Built by AI Agent',
            auto_init: true,
            private: false,
          });
          repoCreated = true;
          // Wait a moment for GitHub to initialize
          await new Promise(r => setTimeout(r, 2000));
        } catch (e: any) {
          if (e.message.includes('422') || e.message.includes('already exists')) {
            // Repo already exists, we'll update files
          } else {
            return `Failed to create repo: ${e.message}`;
          }
        }

        // 2. Push each file
        const pushed: string[] = [];
        const errors: string[] = [];

        for (const filePath of files) {
          const fullPath = path.join(OUTPUT_DIR, filePath);
          if (!fs.existsSync(fullPath)) {
            errors.push(`${filePath}: file not found`);
            continue;
          }

          const content = fs.readFileSync(fullPath);
          const base64Content = content.toString('base64');
          const repoPath = filePath.replace(/\\/g, '/');

          try {
            // Check if file exists (to get its SHA for updates)
            let sha: string | undefined;
            try {
              const existing = await githubAPI(`/repos/${username}/${repo_name}/contents/${repoPath}`);
              sha = existing.sha;
            } catch {
              // File doesn't exist yet, that's fine
            }

            await githubAPI(`/repos/${username}/${repo_name}/contents/${repoPath}`, 'PUT', {
              message: sha ? `Update ${repoPath}` : `Add ${repoPath}`,
              content: base64Content,
              ...(sha ? { sha } : {}),
            });
            pushed.push(filePath);
          } catch (e: any) {
            errors.push(`${filePath}: ${e.message.slice(0, 100)}`);
          }
        }

        const repoUrl = `https://github.com/${username}/${repo_name}`;
        logActivity({ type: 'earning', message: `Published repo: ${repoUrl} (${pushed.length} files)`, device: 'laptop' });

        let result = `${repoCreated ? 'Created' : 'Updated'} repo: ${repoUrl}\nPushed ${pushed.length}/${files.length} files: ${pushed.join(', ')}`;
        if (errors.length > 0) result += `\nErrors: ${errors.join('; ')}`;
        return result;

      } catch (e: any) {
        return `GitHub publish error: ${e.message}`;
      }
    }

    case 'github_list_repos': {
      try {
        const username = await getUsername();
        const repos = await githubAPI(`/users/${username}/repos?sort=updated&per_page=10`);
        return repos.map((r: any) =>
          `${r.name} - ${r.description || 'no desc'} (${r.stargazers_count} stars) ${r.html_url}`
        ).join('\n');
      } catch (e: any) {
        return `Error: ${e.message}`;
      }
    }

    default:
      return `Unknown github-publish tool: ${name}`;
  }
}
