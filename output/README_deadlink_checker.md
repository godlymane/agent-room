# Dead Link Checker 🔗

A fast, production-ready Python CLI tool to **scan files, directories, and documentation for broken links**. Perfect for developers, technical writers, and site maintainers.

## Features

✅ **Scan Multiple File Types** - Markdown, HTML, plain text, RST, Python files  
✅ **Recursive Directory Scanning** - Find all dead links across your entire project  
✅ **HTTP Status Detection** - Identifies 404s, timeouts, connection errors  
✅ **Detailed Reports** - Generated markdown report with summary and lists  
✅ **Rate Limiting** - Respects servers, includes built-in delays  
✅ **Customizable Timeout** - Adjust HTTP timeouts for slow servers  
✅ **Zero Dependencies** (except `requests`) - Fast, lightweight  

## Installation

### Option 1: Direct Run
```bash
pip install requests
python deadlink_checker.py <file_or_directory>
```

### Option 2: Install as Command
```bash
pip install requests
python -m pip install --editable .
deadlink-checker docs/
```

## Usage

### Basic: Check a single markdown file
```bash
python deadlink_checker.py README.md
```

### Check entire directory recursively
```bash
python deadlink_checker.py ./docs --recursive
```

### Check with custom timeout (for slow servers)
```bash
python deadlink_checker.py . --recursive --timeout 10
```

### Verbose mode (shows every link as it's checked)
```bash
python deadlink_checker.py docs --recursive --verbose
```

### Custom output file
```bash
python deadlink_checker.py . --recursive --output deadlinks.md
```

### Scan specific file types only
```bash
python deadlink_checker.py . --recursive --extensions .md .html .txt
```

### Full example with all options
```bash
python deadlink_checker.py ./docs \
  --recursive \
  --verbose \
  --timeout 10 \
  --output reports/deadlinks.md \
  --extensions .md .html .rst
```

## Output

The tool generates:
1. **Console output** - Live progress + summary
2. **Markdown report** - Detailed list of dead links

### Example Report
```markdown
# Dead Link Report

## Summary
- Total Links: 42
- Alive: 38 ✓
- Dead: 4 ✗

## Dead Links (4)
- `https://example.com/old-page`
  - Status: Connection Failed
- `https://site.io/404-not-found`
  - Status: 404
...
```

## Exit Codes
- `0` - Success (no dead links)
- `1` - Failure (dead links found)

## Performance

- **Speed**: ~5-10 links/second (depends on server response times)
- **Memory**: Minimal (streams file processing)
- **Concurrency**: Sequential with rate limiting (prevents blocking)

## Real-World Use Cases

📚 **Documentation Sites** - Keep GitHub docs, wikis, and READMEs link-free  
🏢 **Technical Content** - Monitor blog posts, tutorials for broken references  
🔍 **SEO Audits** - Find and fix broken links before Google crawls  
📱 **Web Projects** - Validate all links in HTML/Markdown files  
🚀 **CI/CD Pipelines** - Add to pre-commit hooks or build checks  

## Pricing & Support

**Free** - Open source, MIT licensed  

If this tool saved you time (and money), consider supporting development:  
👉 **[Buy Me a Coffee](https://buymeacoffee.com/devdattareddy)**

## License

MIT License - Use freely in personal and commercial projects

## Requirements

- Python 3.7+
- `requests` library

## Troubleshooting

**Q: Tool runs slow**  
A: Some servers are slow. Increase `--timeout` to wait longer:
```bash
python deadlink_checker.py . --timeout 15
```

**Q: Getting too many false positives (alive links marked dead)**  
A: Increase timeout and add rate limiting:
```bash
python deadlink_checker.py . --timeout 10 --verbose
```

**Q: How to integrate into CI/CD?**  
A: Tool exits with code 1 if dead links found, 0 if clean:
```bash
python deadlink_checker.py ./docs && echo "All links alive!" || echo "Dead links found!"
```

## Contributing

Found a bug? Have a feature request?  
Open an issue or submit a pull request!

---

**Made with ❤️ for developers who care about link quality**
