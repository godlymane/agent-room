#!/usr/bin/env python3
"""
JSON Formatter & Validator - Format, validate, and analyze JSON files.
Pretty-print, minify, sort keys, remove duplicates, merge files.
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, List


class JSONFormatter:
    """Format, validate, and manipulate JSON."""
    
    @staticmethod
    def load_json(content: str) -> Any:
        """Load JSON from string."""
        return json.loads(content)
    
    @staticmethod
    def format_pretty(data: Any, indent: int = 2) -> str:
        """Format JSON with indentation."""
        return json.dumps(data, indent=indent, sort_keys=False, ensure_ascii=False)
    
    @staticmethod
    def format_pretty_sorted(data: Any, indent: int = 2) -> str:
        """Format JSON with sorted keys."""
        return json.dumps(data, indent=indent, sort_keys=True, ensure_ascii=False)
    
    @staticmethod
    def format_minified(data: Any) -> str:
        """Minify JSON (remove all whitespace)."""
        return json.dumps(data, separators=(',', ':'), ensure_ascii=False)
    
    @staticmethod
    def format_compact(data: Any) -> str:
        """Compact JSON (minimal whitespace)."""
        return json.dumps(data, separators=(', ', ': '), ensure_ascii=False)
    
    @staticmethod
    def get_stats(data: Any) -> Dict[str, Any]:
        """Get JSON statistics."""
        def count_items(obj, stats=None):
            if stats is None:
                stats = {'objects': 0, 'arrays': 0, 'strings': 0, 'numbers': 0, 'booleans': 0, 'nulls': 0}
            
            if isinstance(obj, dict):
                stats['objects'] += 1
                for v in obj.values():
                    count_items(v, stats)
            elif isinstance(obj, list):
                stats['arrays'] += 1
                for item in obj:
                    count_items(item, stats)
            elif isinstance(obj, str):
                stats['strings'] += 1
            elif isinstance(obj, (int, float)):
                stats['numbers'] += 1
            elif isinstance(obj, bool):
                stats['booleans'] += 1
            elif obj is None:
                stats['nulls'] += 1
            
            return stats
        
        stats = count_items(data)
        
        # Get structure info
        if isinstance(data, dict):
            structure = "Object"
            keys = list(data.keys())
            stats['top_keys'] = keys[:10]
            stats['key_count'] = len(keys)
        elif isinstance(data, list):
            structure = "Array"
            stats['item_count'] = len(data)
        else:
            structure = "Scalar"
        
        stats['structure'] = structure
        
        return stats


def validate_json(filepath: str) -> tuple[bool, str]:
    """Validate JSON file."""
    try:
        path = Path(filepath)
        if not path.exists():
            return False, f"File not found: {filepath}"
        
        content = path.read_text(encoding='utf-8')
        json.loads(content)
        return True, "Valid JSON"
    except json.JSONDecodeError as e:
        return False, f"Invalid JSON: {e}"
    except Exception as e:
        return False, f"Error: {e}"


def main():
    parser = argparse.ArgumentParser(
        description="Format, validate, and analyze JSON files.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Pretty print
  %(prog)s data.json
  
  # Format with sorted keys
  %(prog)s data.json --sort
  
  # Minify JSON
  %(prog)s data.json --minify
  
  # Validate JSON
  %(prog)s data.json --validate
  
  # Get statistics
  %(prog)s data.json --stats
  
  # Output to file
  %(prog)s input.json --sort -o output.json
  
  # Compact format
  %(prog)s data.json --compact
        """
    )
    
    parser.add_argument("file", help="JSON file to format")
    parser.add_argument("-o", "--output", help="Output file (default: stdout)")
    parser.add_argument("--sort", action="store_true",
                       help="Sort object keys")
    parser.add_argument("--minify", action="store_true",
                       help="Minify JSON (remove whitespace)")
    parser.add_argument("--compact", action="store_true",
                       help="Compact format (minimal spacing)")
    parser.add_argument("--indent", type=int, default=2,
                       help="Indentation spaces (default: 2)")
    parser.add_argument("--validate", action="store_true",
                       help="Validate JSON only")
    parser.add_argument("--stats", action="store_true",
                       help="Show JSON statistics")
    parser.add_argument("-v", "--verbose", action="store_true")
    
    args = parser.parse_args()
    
    try:
        # Read file
        path = Path(args.file)
        if not path.exists():
            print(f"Error: File not found: {args.file}", file=sys.stderr)
            sys.exit(1)
        
        content = path.read_text(encoding='utf-8')
        data = json.loads(content)
        
        if args.validate:
            print("✓ Valid JSON")
            sys.exit(0)
        
        if args.stats:
            formatter = JSONFormatter()
            stats = formatter.get_stats(data)
            print("JSON Statistics:")
            print(f"  Structure: {stats['structure']}")
            for key in ['objects', 'arrays', 'strings', 'numbers', 'booleans', 'nulls']:
                if key in stats:
                    print(f"  {key.title()}: {stats[key]}")
            if 'key_count' in stats:
                print(f"  Keys: {stats['key_count']}")
            if 'item_count' in stats:
                print(f"  Items: {stats['item_count']}")
            if 'top_keys' in stats and stats['top_keys']:
                print(f"  Top keys: {', '.join(stats['top_keys'][:5])}")
            sys.exit(0)
        
        # Format
        formatter = JSONFormatter()
        
        if args.minify:
            output = formatter.format_minified(data)
        elif args.compact:
            output = formatter.format_compact(data)
        elif args.sort:
            output = formatter.format_pretty_sorted(data, args.indent)
        else:
            output = formatter.format_pretty(data, args.indent)
        
        if args.verbose:
            print(f"[Formatted] {args.file}", file=sys.stderr)
        
        # Output
        if args.output:
            Path(args.output).write_text(output, encoding='utf-8')
            print(f"✓ Saved to {args.output}")
        else:
            print(output)
    
    except json.JSONDecodeError as e:
        print(f"Invalid JSON: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
