# Git Commit Message Generator CLI

**Never write a boring git commit message again.** Analyze your staged changes and get professional semantic commit suggestions in seconds.

[![License: MIT](https://opensource.org/licenses/MIT)](LICENSE)
[![Python 3.8+](https://img.shields.io/badge/python-3.8%2B-blue)](https://www.python.org/downloads/)

## Why This Exists

Writing git commit messages is annoying.

You make changes, stage them, then stare at the terminal: "What do I even call this?"

- `git commit -m "fix"` — Useless. What did you fix?
- `git commit -m "update stuff"` — Your future self will hate this
- `git commit -m "changes to files in the auth module after reviewing the PR and making adjustments based on feedback from the code review"` — Way too long, violates conventions

**Good commit messages matter.** They:
- Make code history readable
- Help with debugging (`git blame`, `git bisect`)
- Show professionalism on GitHub
- Follow industry standards (Conventional Commits)

But writing them manually is tedious.

**Git Commit Message Generator** analyzes your staged changes and suggests professional, semantic commit messages automatically.

## Features

✨ **Analyzes Your Code** — Reads git diff to understand what you changed  
✨ **Semantic Format** — Follows Conventional Commits specification  
✨ **Multiple Suggestions** — Get 3+ message options, pick your favorite  
✨ **Scope Detection** — Automatically detects what area changed (auth, api, ui, etc)  
✨ **Zero Dependencies** — Pure Python, uses only `git` and `subprocess`  
✨ **Fast** — Generates suggestions in milliseconds  

## Installation

### From GitHub

```bash
git clone https://github.com/godlmane/git-commit-gen.git
cd git-commit-gen
python git_commit_gen.py --help
```

### Or Just Copy the File

```bash
curl -o git-commit-gen https://raw.githubusercontent.com/godlmane/git-commit-gen/main/git_commit_gen.py
chmod +x git-commit-gen
python git-commit-gen --help
```

### Requirements

- Python 3.8+
- Git (obviously)
- No other dependencies!

## Quick Start

### 1. Make Some Changes

```bash
# Create/edit files
echo "print('hello')" > app.py
git add app.py
```

### 2. Generate Commit Message

```bash
python git_commit_gen.py
```

**Output:**
```
💡 Suggested Commit Messages:

1. ⭐⭐⭐⭐ feat: add feature affecting 1 file(s)
   └─ Standard semantic format, clear intent

2. ⭐⭐⭐ feat: feat changes (1 files, +1/-0)
   └─ More detailed, shows stats

3. ⭐⭐ feat: changes
   └─ Minimal, concise

📝 Quick commit:
  git commit -m "feat: add feature affecting 1 file(s)"
```

### 3. Use It

Pick one of the suggestions and commit:

```bash
git commit -m "feat: add feature affecting 1 file(s)"
```

Done. Your commit is professional and follows conventions.

## Usage Examples

### Default (Staged Changes Only)

```bash
python git_commit_gen.py
```

Analyzes staged changes and suggests messages.

### Include Unstaged Changes

```bash
python git_commit_gen.py --all
```

Analyzes ALL changes (staged + unstaged).

### More Suggestions

```bash
python git_commit_gen.py --suggestions 5
```

Get 5 message options instead of 3.

### Verbose Output

```bash
python git_commit_gen.py --verbose
```

Shows detailed analysis:
```
📊 Analysis Results:
  Type: feat
  Scope: auth
  Files: 2
  +45/-8
  Breaking: False
```

### JSON Output

```bash
python git_commit_gen.py --json
```

Machine-readable output for automation:
```json
{
  "analysis": {
    "type": "feat",
    "scope": "auth",
    "breaking": false,
    "files_changed": 2
  },
  "suggestions": [...]
}
```

## How It Works

The tool:

1. **Reads your git diff** — Analyzes what changed
2. **Detects the type** — feat, fix, docs, style, refactor, perf, test, chore
3. **Finds the scope** — What part of the codebase (auth, api, ui, etc)
4. **Checks for breaking changes** — Flags if you made major changes
5. **Generates suggestions** — Follows Conventional Commits spec

## Semantic Commit Format

All suggestions follow **Conventional Commits** specification:

```
<type>[scope][!]: <description>
```

**Type options:**
- `feat` — A new feature
- `fix` — A bug fix
- `docs` — Documentation changes
- `style` — Code formatting (no logic change)
- `refactor` — Refactoring without feature changes
- `perf` — Performance improvements
- `test` — Adding or updating tests
- `chore` — Dependency updates, config changes

**Scope (optional):**
- The affected module/area: `auth`, `api`, `ui`, `database`, etc
- Auto-detected from your file structure

**Breaking change (!):**
- Add `!` if you made breaking API changes

**Examples:**

```
feat(auth): add OAuth2 support
fix(api): handle null response body
docs: update installation instructions
style(ui): format React components
refactor: simplify database queries
perf: optimize image loading
test(auth): add OAuth tests
chore: upgrade dependencies
```

## Real Example

### Scenario: You fixed a bug in authentication

```bash
# Make changes
vim src/auth/login.py
git add src/auth/login.py

# Generate message
python git_commit_gen.py
```

**Output:**
```
💡 Suggested Commit Messages:

1. ⭐⭐⭐⭐ fix(auth): fix bug in auth (1 files, +12/-5)
2. ⭐⭐⭐ fix: fix changes (1 files, +12/-5)
3. ⭐⭐ fix: changes
```

Pick suggestion #1:
```bash
git commit -m "fix(auth): fix bug in auth (1 files, +12/-5)"
```

Your git log now looks professional:
```
* fix(auth): fix bug in auth
* feat(auth): add OAuth support
* docs: update README
* refactor(api): simplify endpoints
```

## Why This Matters

**Good commit messages = better code history.**

Compare these two repositories:

**Bad commit messages:**
```
commit 1: fix
commit 2: update
commit 3: changes
commit 4: stuff
commit 5: wtf
```

VS

**Good commit messages (with this tool):**
```
commit 1: fix(auth): handle null token
commit 2: feat(api): add rate limiting
commit 3: docs: update installation guide
commit 4: refactor(database): optimize queries
commit 5: perf: cache user sessions
```

Which would you rather work with?

## Integration with Git Hooks

Want this automatic? Add a git hook:

```bash
# Create .git/hooks/prepare-commit-msg
#!/bin/bash
python git_commit_gen.py --json > /tmp/commit_suggestions.json
```

Now every time you're about to commit, the suggestions appear.

## Keyboard Shortcut (Alias)

Tired of typing the full command? Add to `.bashrc` or `.zshrc`:

```bash
alias gcm="python ~/path/to/git_commit_gen.py"
```

Then just:
```bash
gcm
```

## Use Cases

- 📝 **Professional open source** — Your git history matters to contributors
- 🏢 **Teams** — Standardize commit messages across your team
- 👤 **Portfolio** — GitHub history is part of your professional profile
- 🤖 **Automation** — Generate commits programmatically
- 📖 **Learning** — Understand what good commits look like

## Limitations & Known Issues

- Requires Git 2.0+ (any modern Git version)
- Works best with staged changes (use `git add` first)
- Scope detection works best with organized directory structure
- Suggestions are rule-based, not AI-powered (intentional: reliable + fast)

## Contributing

Found a bug? Want better message suggestions? Contributions welcome!

```bash
git clone https://github.com/godlmane/git-commit-gen.git
cd git-commit-gen
# Make changes
git commit -m "feat: improve message suggestions"
git push
# Open Pull Request
```

## License

MIT License. Free forever.

## Support This Project

If **Git Commit Message Generator** improves your workflow:

☕ **[Buy me a coffee](https://www.buymeacoffee.com/godlmane)** — Helps me build more tools

⭐ **Star this repo** — Helps other developers find it

💬 **Share your commits** — Show me your favorite generated message in the comments

---

**Better commits, less thinking. That's the goal.**

Made with ❤️ for developers who care about clean git history.

Questions? Open an issue on [GitHub](https://github.com/godlmane/git-commit-gen/issues)
