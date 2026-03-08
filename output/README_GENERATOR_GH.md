# README Generator CLI

**Auto-generate professional GitHub READMEs in seconds.** Stop writing README files manually. Feed it project metadata, get a beautiful, complete README.md that impresses.

[![License: MIT](https://opensource.org/licenses/MIT)](LICENSE)
[![Python 3.8+](https://img.shields.io/badge/python-3.8%2B-blue)](https://www.python.org/downloads/)

## Why This Exists

Writing READMEs is **tedious**. You repeat the same sections every time:
- Description
- Installation steps
- Features list
- Usage examples
- Contributing guidelines
- License info

**README Generator CLI** removes the busywork. Define your project **once** in JSON, generate a professional README in seconds.

## Features

✨ **Complete README in Seconds** — Just provide JSON config, get a fully formatted README.md  
✨ **Professional Structure** — Badges, sections, formatting all included  
✨ **JSON Configuration** — Easy to version control, no writing needed  
✨ **Validation Mode** — Preview before generating  
✨ **Customizable Sections** — Features, dependencies, examples, all optional  
✨ **Zero Dependencies** — Pure Python, no external packages required  

## Installation

### From GitHub (Recommended)

```bash
git clone https://github.com/yourusername/readme-generator-cli.git
cd readme-generator-cli
python readme_generator.py --help
```

### Or Just Download

```bash
# Copy the single file to your project
curl -o readme_generator.py https://raw.githubusercontent.com/yourusername/readme-generator-cli/main/readme_generator.py
python readme_generator.py --config readme.json
```

### Requirements

- Python 3.8+
- No external dependencies!

## Quick Start

### 1. Create a Config File

Save this as `readme.json`:

```json
{
  "name": "My Awesome CLI",
  "description": "A lightweight tool for processing JSON files and generating reports",
  "author": "Jane Developer",
  "license": "MIT",
  "repo_url": "https://github.com/janedev/json-reporter",
  "buy_me_coffee": "https://www.buymeacoffee.com/janedev",
  "tags": ["python", "cli", "json", "automation"],
  "installation": "pip install json-reporter",
  "usage": "json-reporter input.json --format html",
  "dependencies": [
    "Python 3.8+",
    "requests >= 2.28.0"
  ],
  "features": [
    "Lightning-fast JSON parsing",
    "Generate HTML reports automatically",
    "Support for nested JSON structures",
    "Export to CSV, JSON, or HTML"
  ],
  "examples": {
    "Basic Report": "json-reporter data.json --output report.html",
    "With Filters": "json-reporter data.json --filter name=John --format csv",
    "Verbose Output": "json-reporter data.json --verbose --debug"
  }
}
```

### 2. Generate README

```bash
python readme_generator.py --config readme.json
```

**Output:**
```
✅ README generated successfully!
📄 Written to: /home/user/project/README.md
📊 Lines: 142
📦 Size: 5847 bytes
```

### 3. Preview Before Generating

```bash
python readme_generator.py --config readme.json --validate
```

Shows a preview without writing to disk. Perfect for testing.

## Usage Options

```
usage: readme-gen [-h] [--config CONFIG] [--output OUTPUT] [--validate] [--template TEMPLATE]

Generate professional GitHub READMEs automatically

options:
  -h, --help            show this help message and exit
  --config CONFIG       Path to config JSON file (default: readme.json)
  --output OUTPUT       Output path for README (default: README.md)
  --validate            Validate config and show preview without writing
  --template TEMPLATE   Template type: standard, minimal, extended (default: standard)
```

## Configuration Reference

All config fields:

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `name` | ✅ | string | Project name (appears in title) |
| `description` | ✅ | string | One-line project description |
| `author` | ❌ | string | Your name |
| `license` | ❌ | string | License type (default: MIT) |
| `repo_url` | ❌ | string | GitHub repo URL |
| `buy_me_coffee` | ❌ | string | Buy Me a Coffee profile link |
| `tags` | ❌ | array | Tech tags for searchability |
| `installation` | ❌ | string | How to install (pip, npm, etc) |
| `usage` | ❌ | string | Basic usage command |
| `dependencies` | ❌ | array | Required packages/versions |
| `features` | ❌ | array | List of key features |
| `examples` | ❌ | object | Key-value pairs of examples |

### Minimal Config

If you just want the basics:

```json
{
  "name": "My Project",
  "description": "What it does",
  "installation": "pip install my-project",
  "features": ["Fast", "Easy", "Open source"]
}
```

### Full Config Example

See `example_readme.json` in this repo for a complete, detailed example.

## Examples

### Example 1: CLI Tool Project

```bash
# readme.json
{
  "name": "JSON to CSV Converter",
  "description": "Convert complex nested JSON to clean CSV in one command",
  "features": [
    "Handles deeply nested JSON",
    "Automatic type detection",
    "Export headers customizable"
  ],
  "installation": "pip install json-to-csv",
  "usage": "json2csv input.json --output output.csv",
  "examples": {
    "Simple": "json2csv data.json",
    "With Output Path": "json2csv data.json -o results.csv",
    "Verbose": "json2csv data.json --verbose"
  }
}

# Generate
$ python readme_generator.py --config readme.json
✅ README generated successfully!
```

### Example 2: Library Project

```bash
# readme.json
{
  "name": "LogParse",
  "description": "Parse and analyze Apache/Nginx logs with one line of Python",
  "installation": "pip install logparse",
  "dependencies": [
    "Python 3.8+",
    "regex >= 2022.10.0"
  ],
  "features": [
    "Parse 10+ log formats",
    "Export to JSON/CSV",
    "Filter by date, IP, status code"
  ],
  "examples": {
    "Parse Nginx": "logparse.parse_nginx('/var/log/nginx/access.log')",
    "Export to JSON": "logparse.parse_apache('/var/log/apache2/access.log', format='json')"
  }
}

$ python readme_generator.py --config readme.json
✅ README generated successfully!
```

## Generated README Structure

Every README includes:

1. **Title & Description** — What the project does
2. **Badges** — License, Python version, stars
3. **Features** — Key benefits/functionality
4. **Installation** — How to get it
5. **Requirements** — Dependencies
6. **Quick Start** — Usage commands
7. **Examples** — Real usage scenarios
8. **Configuration** — How to use it
9. **Contributing** — How to contribute
10. **License** — License info
11. **Support Section** — Buy Me a Coffee link + star requests

## Real-World Use Cases

- 📦 **Publish to GitHub** — Generate perfect README for every open-source project
- 📝 **Bulk Create READMEs** — Generate READMEs for multiple projects at once
- 🤖 **Automate Documentation** — Integrate into CI/CD to auto-generate docs
- 🎓 **Learn Best Practices** — See what a professional README looks like
- 🚀 **Impress Employers** — Well-documented open source = strong portfolio

## Contributing

Contributions welcome! Please:

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

Licensed under MIT. See [LICENSE](LICENSE) file for details.

## Support This Project

If **README Generator CLI** saved you time:

- ⭐ **Star this repo** on GitHub
- ☕ **[Buy me a coffee](https://www.buymeacoffee.com/godlmane)** to support development
- 📢 **Share with your dev friends** who write READMEs too
- 🐛 **Report bugs** via GitHub Issues

---

**Made with ❤️ for developers who hate writing documentation**

Need help? Open an issue on [GitHub](https://github.com/yourusername/readme-generator-cli/issues)
