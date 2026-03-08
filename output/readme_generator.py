#!/usr/bin/env python3
"""
README Generator CLI - Auto-generate professional GitHub READMEs
Reads project info from a config file and generates a complete, well-formatted README.md
"""

import argparse
import json
import os
from pathlib import Path
from datetime import datetime


def generate_readme(config):
    """Generate a complete README from config dict."""
    
    project_name = config.get("name", "My Project")
    description = config.get("description", "A useful Python project")
    tags = config.get("tags", ["python", "cli"])
    features = config.get("features", [])
    installation = config.get("installation", "pip install my-project")
    usage = config.get("usage", "my-project --help")
    author = config.get("author", "Your Name")
    license_type = config.get("license", "MIT")
    repo_url = config.get("repo_url", "https://github.com/yourusername/project")
    buy_me_coffee = config.get("buy_me_coffee", "https://www.buymeacoffee.com/yourusername")
    dependencies = config.get("dependencies", [])
    examples = config.get("examples", {})
    
    # Build README markdown
    readme = f"""# {project_name}

{description}

[![License: {license_type}](https://opensource.org/licenses/{license_type})](LICENSE)
[![Python Version](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
![GitHub Stars](https://img.shields.io/github/stars/yourusername/{project_name.lower().replace(' ', '-')})

## Features

"""
    
    # Add features
    if features:
        for feature in features:
            readme += f"- ✨ {feature}\n"
    else:
        readme += "- ✨ Fast and efficient\n- ✨ Easy to use\n- ✨ Well documented\n"
    
    readme += f"""
## Installation

```bash
{installation}
```

### Requirements
"""
    
    if dependencies:
        for dep in dependencies:
            readme += f"- {dep}\n"
    else:
        readme += "- Python 3.8+\n"
    
    readme += f"""
## Quick Start

```bash
{usage}
```

"""
    
    # Add examples
    if examples:
        readme += "## Examples\n\n"
        for title, code in examples.items():
            readme += f"### {title}\n\n```bash\n{code}\n```\n\n"
    else:
        readme += """## Examples

### Basic Usage
```bash
readme-gen --config project.json
```

### With Custom Output Path
```bash
readme-gen --config project.json --output docs/README.md
```
"""
    
    readme += f"""## Usage Options

```
usage: readme-gen [-h] [--config CONFIG] [--output OUTPUT] [--validate]

Generate professional GitHub READMEs automatically

options:
  -h, --help            show this help message and exit
  --config CONFIG       Path to config JSON file (default: readme.json)
  --output OUTPUT       Output path for README (default: README.md)
  --validate            Validate config and show preview without writing
  --template TEMPLATE   Template type: standard, minimal, extended (default: standard)
```

## Configuration File Format

Create a `readme.json` file:

```json
{{
  "name": "My Awesome Project",
  "description": "A brief description of what your project does",
  "author": "Your Name",
  "license": "MIT",
  "repo_url": "https://github.com/yourusername/project",
  "buy_me_coffee": "https://www.buymeacoffee.com/yourusername",
  "tags": ["python", "cli", "automation"],
  "installation": "pip install my-project",
  "usage": "my-project --help",
  "dependencies": [
    "Python 3.8+",
    "requests",
    "click"
  ],
  "features": [
    "Lightning fast processing",
    "Supports 50+ file formats",
    "Cross-platform (Windows, Mac, Linux)"
  ],
  "examples": {{
    "Basic Example": "my-project input.txt --output output.txt",
    "Advanced Usage": "my-project input.txt --format json --verbose"
  }}
}}
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the {license_type} License - see the [LICENSE](LICENSE) file for details.

## Support

If this tool helped you, please consider:
- ⭐ Starring the repo
- ☕ [Buy me a coffee]({buy_me_coffee})
- 📢 Sharing with your dev friends

---

Generated with ❤️ by readme-gen
"""
    
    return readme


def validate_config(config):
    """Validate config has required fields."""
    required = ["name", "description"]
    missing = [f for f in required if f not in config]
    if missing:
        print(f"❌ Config missing required fields: {', '.join(missing)}")
        return False
    print(f"✅ Config is valid! Ready to generate README for: {config['name']}")
    return True


def main():
    parser = argparse.ArgumentParser(
        description="Generate professional GitHub READMEs automatically",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  readme-gen --config project.json
  readme-gen --config project.json --output docs/README.md
  readme-gen --config project.json --validate
        """
    )
    
    parser.add_argument(
        "--config",
        default="readme.json",
        help="Path to config JSON file (default: readme.json)"
    )
    parser.add_argument(
        "--output",
        default="README.md",
        help="Output path for README (default: README.md)"
    )
    parser.add_argument(
        "--validate",
        action="store_true",
        help="Validate config and show preview without writing"
    )
    parser.add_argument(
        "--template",
        choices=["standard", "minimal", "extended"],
        default="standard",
        help="Template style (default: standard)"
    )
    
    args = parser.parse_args()
    
    # Load config
    if not os.path.exists(args.config):
        print(f"❌ Config file not found: {args.config}")
        print(f"\n📋 Create {args.config} with this template:")
        print(json.dumps({
            "name": "My Project",
            "description": "What it does",
            "author": "Your Name",
            "license": "MIT",
            "repo_url": "https://github.com/yourusername/project",
            "buy_me_coffee": "https://www.buymeacoffee.com/yourusername",
            "features": ["Feature 1", "Feature 2"],
            "installation": "pip install my-project",
            "usage": "my-project --help"
        }, indent=2))
        return
    
    try:
        with open(args.config) as f:
            config = json.load(f)
    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON in {args.config}: {e}")
        return
    
    # Validate
    if not validate_config(config):
        return
    
    # Generate
    readme = generate_readme(config)
    
    if args.validate:
        print("\n" + "="*60)
        print("README PREVIEW")
        print("="*60)
        print(readme)
        print("="*60)
        print(f"✅ Preview generated (not written to {args.output})")
        return
    
    # Write
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, "w") as f:
        f.write(readme)
    
    print(f"✅ README generated successfully!")
    print(f"📄 Written to: {output_path.absolute()}")
    print(f"📊 Lines: {len(readme.splitlines())}")
    print(f"📦 Size: {len(readme)} bytes")


if __name__ == "__main__":
    main()
