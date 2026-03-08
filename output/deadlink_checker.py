#!/usr/bin/env python3
"""
Dead Link Checker - Scan URLs in files/websites for broken links.
Useful for documentation, markdown files, and HTML content.
"""

import argparse
import sys
import re
from urllib.parse import urljoin, urlparse
from pathlib import Path
from collections import defaultdict
import time

try:
    import requests
except ImportError:
    print("ERROR: requests library not found. Install with: pip install requests")
    sys.exit(1)


class DeadLinkChecker:
    """Check for broken/dead links in files and websites."""
    
    def __init__(self, timeout=5, retries=2, workers=5, verbose=False):
        self.timeout = timeout
        self.retries = retries
        self.workers = workers
        self.verbose = verbose
        self.results = defaultdict(list)
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DeadLinkChecker/1.0'
        })
    
    def extract_urls_from_file(self, filepath):
        """Extract all URLs from a text/markdown file."""
        urls = set()
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                # Match http(s) URLs
                url_pattern = r'https?://[^\s\)\]"\'\`<>]+'
                urls.update(re.findall(url_pattern, content))
        except Exception as e:
            print(f"ERROR reading {filepath}: {e}")
        return urls
    
    def extract_urls_from_directory(self, directory, extensions=None):
        """Extract URLs from all text files in directory."""
        if extensions is None:
            extensions = ['.md', '.txt', '.html', '.rst', '.py']
        
        urls = set()
        path = Path(directory)
        
        for ext in extensions:
            for file in path.rglob(f'*{ext}'):
                if self.verbose:
                    print(f"Scanning {file}...")
                urls.update(self.extract_urls_from_file(file))
        
        return urls
    
    def check_url(self, url):
        """Check if a URL is alive (returns 2xx status code)."""
        try:
            response = self.session.head(url, timeout=self.timeout, allow_redirects=True)
            status = response.status_code
            is_alive = 200 <= status < 400
            return {
                'url': url,
                'status': status,
                'alive': is_alive,
                'error': None
            }
        except requests.Timeout:
            return {'url': url, 'status': None, 'alive': False, 'error': 'Timeout'}
        except requests.ConnectionError:
            return {'url': url, 'status': None, 'alive': False, 'error': 'Connection Failed'}
        except Exception as e:
            return {'url': url, 'status': None, 'alive': False, 'error': str(e)}
    
    def check_urls(self, urls, batch_size=10):
        """Check multiple URLs with progress reporting."""
        results = []
        total = len(urls)
        
        for i, url in enumerate(urls, 1):
            if self.verbose:
                print(f"[{i}/{total}] Checking {url}...", end=' ')
            
            result = self.check_url(url)
            results.append(result)
            
            if self.verbose:
                status_str = f"✓ {result['status']}" if result['alive'] else f"✗ {result['error'] or result['status']}"
                print(status_str)
            
            if i % batch_size == 0:
                time.sleep(0.5)  # Rate limiting
        
        return results
    
    def save_report(self, results, output_file):
        """Save detailed report to file."""
        with open(output_file, 'w', encoding='utf-8') as f:
            dead_links = [r for r in results if not r['alive']]
            alive_links = [r for r in results if r['alive']]
            
            f.write(f"# Dead Link Report\n\n")
            f.write(f"## Summary\n")
            f.write(f"- Total Links: {len(results)}\n")
            f.write(f"- Alive: {len(alive_links)} ✓\n")
            f.write(f"- Dead: {len(dead_links)} ✗\n\n")
            
            if dead_links:
                f.write(f"## Dead Links ({len(dead_links)})\n")
                for link in dead_links:
                    f.write(f"- `{link['url']}`\n")
                    f.write(f"  - Status: {link['status'] or link['error']}\n")
            
            f.write(f"\n## Alive Links ({len(alive_links)})\n")
            for link in alive_links[:20]:  # Show first 20
                f.write(f"- `{link['url']}` ({link['status']})\n")
            
            if len(alive_links) > 20:
                f.write(f"... and {len(alive_links) - 20} more\n")


def main():
    parser = argparse.ArgumentParser(
        description='Check for broken/dead links in files, directories, or websites',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Check links in a markdown file
  python deadlink_checker.py docs/README.md

  # Check all links in a directory
  python deadlink_checker.py ./docs --recursive

  # Check with custom timeout
  python deadlink_checker.py file.md --timeout 10 --output report.md

  # Verbose output
  python deadlink_checker.py . --recursive --verbose
        """
    )
    
    parser.add_argument('input', help='File or directory to scan')
    parser.add_argument('-o', '--output', default='deadlinks_report.md',
                        help='Output report file (default: deadlinks_report.md)')
    parser.add_argument('-t', '--timeout', type=int, default=5,
                        help='HTTP timeout in seconds (default: 5)')
    parser.add_argument('-r', '--recursive', action='store_true',
                        help='Scan directory recursively')
    parser.add_argument('-v', '--verbose', action='store_true',
                        help='Verbose output')
    parser.add_argument('-e', '--extensions', nargs='+',
                        default=['.md', '.txt', '.html', '.rst', '.py'],
                        help='File extensions to scan (default: .md .txt .html .rst .py)')
    
    args = parser.parse_args()
    
    # Extract URLs
    checker = DeadLinkChecker(timeout=args.timeout, verbose=args.verbose)
    
    if args.recursive or Path(args.input).is_dir():
        if args.verbose:
            print(f"Scanning directory: {args.input}")
        urls = checker.extract_urls_from_directory(args.input, extensions=args.extensions)
    else:
        if args.verbose:
            print(f"Scanning file: {args.input}")
        urls = checker.extract_urls_from_file(args.input)
    
    if not urls:
        print("No URLs found.")
        sys.exit(0)
    
    print(f"\nFound {len(urls)} unique URLs. Checking...\n")
    
    # Check URLs
    results = checker.check_urls(urls)
    
    # Save report
    checker.save_report(results, args.output)
    
    # Summary
    dead_links = [r for r in results if not r['alive']]
    alive_links = [r for r in results if r['alive']]
    
    print(f"\n{'='*60}")
    print(f"SUMMARY:")
    print(f"  Total Links: {len(results)}")
    print(f"  Alive: {len(alive_links)} ✓")
    print(f"  Dead: {len(dead_links)} ✗")
    print(f"  Report saved to: {args.output}")
    print(f"{'='*60}\n")
    
    if dead_links:
        print(f"Dead Links:")
        for link in dead_links[:10]:
            print(f"  ✗ {link['url']}")
            print(f"    → {link['status'] or link['error']}")
        if len(dead_links) > 10:
            print(f"  ... and {len(dead_links) - 10} more (see {args.output})")
    
    sys.exit(1 if dead_links else 0)


if __name__ == '__main__':
    main()
