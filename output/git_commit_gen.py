#!/usr/bin/env python3
"""
Git Commit Message Generator - Generate semantic commit messages in seconds
Analyzes git diff and suggests professional, semantic commit messages following Conventional Commits spec
"""

import argparse
import subprocess
import json
from pathlib import Path


def get_git_diff(staged_only=True):
    """Get git diff for current changes"""
    try:
        if staged_only:
            result = subprocess.run(
                ["git", "diff", "--cached", "--no-color"],
                capture_output=True,
                text=True,
                check=True
            )
        else:
            result = subprocess.run(
                ["git", "diff", "--no-color"],
                capture_output=True,
                text=True,
                check=True
            )
        return result.stdout
    except subprocess.CalledProcessError:
        return None


def get_git_status():
    """Get git status for current changes"""
    try:
        result = subprocess.run(
            ["git", "status", "--short"],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout
    except subprocess.CalledProcessError:
        return None


def analyze_changes(diff_text, status_text):
    """Analyze git changes and extract key info"""
    
    analysis = {
        "type": "feat",  # default
        "scope": "",
        "breaking": False,
        "files_changed": 0,
        "additions": 0,
        "deletions": 0,
        "keywords": [],
        "file_patterns": []
    }
    
    if not diff_text:
        return analysis
    
    lines = diff_text.split('\n')
    
    # Count changes
    for line in lines:
        if line.startswith('+') and not line.startswith('+++'):
            analysis["additions"] += 1
        elif line.startswith('-') and not line.startswith('---'):
            analysis["deletions"] += 1
    
    # Detect file types changed
    files_changed = set()
    for line in lines:
        if line.startswith('diff --git'):
            parts = line.split()
            if len(parts) >= 4:
                filename = parts[-1]
                files_changed.add(filename)
                analysis["file_patterns"].append(filename)
    
    analysis["files_changed"] = len(files_changed)
    
    # Detect type from changes
    keywords_by_type = {
        "test": ["test", "spec", ".test.js", ".spec.ts", "pytest", "jest"],
        "docs": ["readme", "doc", "docs", ".md", "documentation"],
        "style": ["prettier", "eslint", "format", "lint", ".css", ".scss"],
        "refactor": ["refactor", "rename", "remove", "clean", "simplify"],
        "perf": ["performance", "optimize", "cache", "speed", "memory"],
        "chore": ["deps", "dependency", "version", "update", "upgrade"],
        "fix": ["fix", "bug", "hotfix", "patch", "error", "issue"],
        "feat": ["feature", "new", "add", "create", "implement"],
    }
    
    # Analyze diff for keywords
    diff_lower = diff_text.lower()
    for commit_type, keywords in keywords_by_type.items():
        for keyword in keywords:
            if keyword in diff_lower:
                analysis["type"] = commit_type
                analysis["keywords"].append(keyword)
                break
        if analysis["keywords"]:
            break
    
    # Detect breaking change
    if "BREAKING CHANGE" in diff_text or "!!!" in diff_text:
        analysis["breaking"] = True
    
    # Extract scope from filenames
    if analysis["file_patterns"]:
        first_file = analysis["file_patterns"][0]
        # Try to extract scope from directory
        parts = first_file.split('/')
        if len(parts) > 1 and parts[0] not in ['.', '']:
            analysis["scope"] = parts[0]
    
    return analysis


def generate_commit_messages(analysis, max_suggestions=3):
    """Generate semantic commit message suggestions"""
    
    messages = []
    
    commit_type = analysis["type"]
    scope = analysis["scope"]
    breaking = "!" if analysis["breaking"] else ""
    files = analysis["files_changed"]
    
    # Message 1: Basic semantic message
    if scope:
        msg1 = f"{commit_type}{breaking}({scope}): "
    else:
        msg1 = f"{commit_type}{breaking}: "
    
    # Add description based on type
    if commit_type == "feat":
        msg1 += f"add feature affecting {files} file(s)"
    elif commit_type == "fix":
        msg1 += f"fix bug in {files} file(s)"
    elif commit_type == "docs":
        msg1 += "update documentation"
    elif commit_type == "style":
        msg1 += "format code style"
    elif commit_type == "refactor":
        msg1 += f"refactor {files} file(s)"
    elif commit_type == "perf":
        msg1 += "improve performance"
    elif commit_type == "test":
        msg1 += "add or update tests"
    elif commit_type == "chore":
        msg1 += "update dependencies"
    else:
        msg1 += f"update {files} file(s)"
    
    messages.append({
        "message": msg1,
        "rating": "⭐⭐⭐⭐",
        "description": "Standard semantic format, clear intent"
    })
    
    # Message 2: More descriptive
    if scope:
        msg2 = f"{commit_type}{breaking}({scope}): {analysis['type']} in {scope} ({files} files, +{analysis['additions']}/-{analysis['deletions']})"
    else:
        msg2 = f"{commit_type}{breaking}: {analysis['type']} changes ({files} files, +{analysis['additions']}/-{analysis['deletions']})"
    
    messages.append({
        "message": msg2,
        "rating": "⭐⭐⭐",
        "description": "More detailed, shows stats"
    })
    
    # Message 3: Minimal
    if scope:
        msg3 = f"{commit_type}({scope}): changes"
    else:
        msg3 = f"{commit_type}: changes"
    
    messages.append({
        "message": msg3,
        "rating": "⭐⭐",
        "description": "Minimal, concise"
    })
    
    return messages[:max_suggestions]


def main():
    parser = argparse.ArgumentParser(
        description="Generate semantic git commit messages from staged changes",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  git-commit-gen                    # Analyze staged changes
  git-commit-gen --all              # Include unstaged changes
  git-commit-gen --suggestions 5    # Generate 5 message suggestions
  git-commit-gen --json             # Output as JSON
        """
    )
    
    parser.add_argument(
        "--all",
        action="store_true",
        help="Include unstaged changes (default: staged only)"
    )
    parser.add_argument(
        "--suggestions",
        type=int,
        default=3,
        help="Number of suggestions to generate (default: 3)"
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output as JSON"
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Show detailed analysis"
    )
    parser.add_argument(
        "--copy",
        action="store_true",
        help="Copy first suggestion to clipboard"
    )
    
    args = parser.parse_args()
    
    # Get git diff
    diff = get_git_diff(staged_only=not args.all)
    status = get_git_status()
    
    if not diff:
        print("❌ No changes to commit. Stage some files first with 'git add'")
        return
    
    # Analyze changes
    analysis = analyze_changes(diff, status)
    
    if args.verbose:
        print("📊 Analysis Results:")
        print(f"  Type: {analysis['type']}")
        print(f"  Scope: {analysis['scope'] or 'N/A'}")
        print(f"  Files: {analysis['files_changed']}")
        print(f"  +{analysis['additions']}/-{analysis['deletions']}")
        print(f"  Breaking: {analysis['breaking']}")
        print()
    
    # Generate suggestions
    suggestions = generate_commit_messages(analysis, max_suggestions=args.suggestions)
    
    if args.json:
        output = {
            "analysis": analysis,
            "suggestions": suggestions
        }
        print(json.dumps(output, indent=2))
        return
    
    # Display suggestions
    print("💡 Suggested Commit Messages:\n")
    
    for i, sugg in enumerate(suggestions, 1):
        print(f"{i}. {sugg['rating']} {sugg['message']}")
        if args.verbose:
            print(f"   └─ {sugg['description']}")
        print()
    
    # Copy to clipboard if requested
    if args.copy:
        try:
            import pyperclip
            pyperclip.copy(suggestions[0]["message"])
            print(f"✅ Copied to clipboard: {suggestions[0]['message']}")
        except ImportError:
            print("💡 Tip: Run 'git commit -m \"<message>\"' with one of the suggestions above")
    else:
        print("💡 Tip: Copy one of these messages and use it in 'git commit -m \"<message>\"'")
    
    # Show usage hint
    print("\n📝 Quick commit:")
    print(f'  git commit -m "{suggestions[0]["message"]}"')


if __name__ == "__main__":
    main()
