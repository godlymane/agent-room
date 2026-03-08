import { execSync } from 'child_process';
import { logActivity } from '../db.js';

function gh(cmd: string): string {
  try {
    return execSync(`gh ${cmd}`, { encoding: 'utf-8', timeout: 15000 }).trim();
  } catch (e: any) {
    return `GitHub CLI error: ${e.message}`;
  }
}

export async function handleFreelanceTool(name: string, input: any): Promise<string> {
  switch (name) {
    case 'github_search_bounties': {
      // Search for issues with bounty labels
      const query = input.query || 'label:bounty,label:help-wanted,label:"good first issue" state:open';
      const lang = input.language ? `language:${input.language}` : '';
      const result = gh(`search issues "${query} ${lang}" --limit 15 --json title,url,labels,repository,body`);
      try {
        const issues = JSON.parse(result);
        if (issues.length === 0) return 'No bounty issues found. Try different search terms.';
        return issues.map((i: any) =>
          `[${i.repository?.nameWithOwner || 'unknown'}] ${i.title}\n  URL: ${i.url}\n  Labels: ${(i.labels || []).map((l: any) => l.name).join(', ')}\n  ${(i.body || '').slice(0, 150)}...`
        ).join('\n\n');
      } catch {
        return result; // Return raw output if JSON parse fails
      }
    }

    case 'github_read_issue': {
      // Read full issue details
      const url = input.url;
      if (!url) return 'Error: url required';
      const result = gh(`issue view "${url}" --json title,body,comments,labels,author`);
      try {
        const issue = JSON.parse(result);
        let output = `Title: ${issue.title}\nAuthor: ${issue.author?.login}\nLabels: ${(issue.labels || []).map((l: any) => l.name).join(', ')}\n\nDescription:\n${(issue.body || '').slice(0, 2000)}`;
        if (issue.comments?.length > 0) {
          output += '\n\nComments:\n' + issue.comments.slice(0, 5).map((c: any) =>
            `  @${c.author?.login}: ${c.body?.slice(0, 200)}`
          ).join('\n');
        }
        return output;
      } catch {
        return result;
      }
    }

    case 'github_fork_repo': {
      const repo = input.repo; // owner/repo format
      if (!repo) return 'Error: repo required (owner/repo format)';
      const result = gh(`repo fork ${repo} --clone=false`);
      logActivity({ type: 'action', message: `Forked ${repo}`, device: 'laptop' });
      return result || `Forked ${repo}`;
    }

    case 'github_clone_repo': {
      const repo = input.repo;
      if (!repo) return 'Error: repo required';
      const dir = `C:/Users/devda/agent-room/workspace/${repo.replace('/', '_')}`;
      try {
        execSync(`gh repo clone ${repo} "${dir}"`, { encoding: 'utf-8', timeout: 30000 });
        logActivity({ type: 'action', message: `Cloned ${repo}`, device: 'laptop' });
        return `Cloned ${repo} to ${dir}`;
      } catch (e: any) {
        return `Clone error: ${e.message}`;
      }
    }

    case 'github_create_pr': {
      const { repo, title, body, branch } = input;
      if (!repo || !title) return 'Error: repo and title required';
      try {
        const result = gh(`pr create --repo ${repo} --title "${title}" --body "${body || ''}" --head ${branch || 'main'}`);
        logActivity({ type: 'action', message: `Created PR: ${title}`, device: 'laptop' });
        return result;
      } catch (e: any) {
        return `PR creation error: ${e.message}`;
      }
    }

    case 'github_comment_issue': {
      const { url, comment } = input;
      if (!url || !comment) return 'Error: url and comment required';
      const result = gh(`issue comment "${url}" --body "${comment.replace(/"/g, '\\"')}"`);
      logActivity({ type: 'action', message: `Commented on issue`, device: 'laptop' });
      return result || 'Comment posted';
    }

    case 'search_freelance_gigs': {
      // This uses browser automation to search freelance platforms
      // Returns a prompt for the agent to use browse_url instead
      return `To search freelance gigs, use browse_url with these URLs:
- Fiverr buyer requests: https://www.fiverr.com/users/buyer_requests
- Upwork job search: https://www.upwork.com/nx/find-work/
- GitHub bounties: Use github_search_bounties tool instead
- Algora bounties: https://console.algora.io/bounties
- Replit bounties: https://replit.com/bounties

Use browse_url to visit these and find opportunities.`;
    }

    default:
      return `Unknown freelance tool: ${name}`;
  }
}
