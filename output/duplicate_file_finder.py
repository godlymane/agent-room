#!/usr/bin/env python3
"""
Duplicate File Finder CLI Tool
Scans directories recursively and identifies duplicate files by MD5 hash.
"""

import os
import sys
import hashlib
import argparse
import json
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Tuple


def calculate_md5(filepath: str, chunk_size: int = 8192) -> str:
    """Calculate MD5 hash of a file."""
    md5_hash = hashlib.md5()
    try:
        with open(filepath, 'rb') as f:
            for chunk in iter(lambda: f.read(chunk_size), b''):
                md5_hash.update(chunk)
        return md5_hash.hexdigest()
    except (IOError, OSError) as e:
        print(f"[ERROR] Could not read {filepath}: {e}", file=sys.stderr)
        return None


def scan_directory(directory: str, extensions: List[str] = None, 
                   skip_hidden: bool = True) -> Dict[str, List[str]]:
    """
    Recursively scan directory and group files by MD5 hash.
    Returns dict: {md5_hash: [filepath1, filepath2, ...]}
    """
    hash_map = defaultdict(list)
    file_count = 0
    
    if not os.path.isdir(directory):
        print(f"[ERROR] {directory} is not a valid directory", file=sys.stderr)
        return hash_map
    
    print(f"[INFO] Scanning {directory}...")
    
    for root, dirs, files in os.walk(directory):
        # Skip hidden directories if requested
        if skip_hidden:
            dirs[:] = [d for d in dirs if not d.startswith('.')]
        
        for filename in files:
            if skip_hidden and filename.startswith('.'):
                continue
            
            # Filter by extension if specified
            if extensions:
                if not any(filename.lower().endswith(ext) for ext in extensions):
                    continue
            
            filepath = os.path.join(root, filename)
            file_size = os.path.getsize(filepath)
            
            # Only check files > 0 bytes
            if file_size == 0:
                continue
            
            file_count += 1
            if file_count % 100 == 0:
                print(f"[INFO] Processed {file_count} files...", file=sys.stderr)
            
            md5_hash = calculate_md5(filepath)
            if md5_hash:
                hash_map[md5_hash].append(filepath)
    
    print(f"[INFO] Total files scanned: {file_count}", file=sys.stderr)
    return hash_map


def find_duplicates(hash_map: Dict[str, List[str]]) -> Dict[str, List[str]]:
    """Filter hash_map to return only entries with duplicates."""
    return {k: v for k, v in hash_map.items() if len(v) > 1}


def format_size(bytes_size: int) -> str:
    """Convert bytes to human-readable format."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_size < 1024.0:
            return f"{bytes_size:.2f}{unit}"
        bytes_size /= 1024.0
    return f"{bytes_size:.2f}TB"


def print_duplicates(duplicates: Dict[str, List[str]], verbose: bool = False):
    """Print duplicate files in organized format."""
    if not duplicates:
        print("[INFO] No duplicates found!", file=sys.stderr)
        return
    
    total_duplicate_size = 0
    duplicate_group_count = 0
    
    print("\n" + "=" * 80)
    print("DUPLICATE FILES FOUND")
    print("=" * 80 + "\n")
    
    for md5_hash, filepaths in sorted(duplicates.items()):
        duplicate_group_count += 1
        file_size = os.path.getsize(filepaths[0])
        group_size = file_size * (len(filepaths) - 1)  # Extra copies only
        total_duplicate_size += group_size
        
        print(f"Group #{duplicate_group_count} | MD5: {md5_hash}")
        print(f"File Size: {format_size(file_size)} | Duplicates: {len(filepaths)} | Wasted Space: {format_size(group_size)}")
        print("-" * 80)
        
        for i, filepath in enumerate(filepaths, 1):
            print(f"  {i}. {filepath}")
        
        print()
    
    print("=" * 80)
    print(f"Total Duplicate Groups: {duplicate_group_count}")
    print(f"Total Wasted Space: {format_size(total_duplicate_size)}")
    print("=" * 80)


def export_json(duplicates: Dict[str, List[str]], output_file: str):
    """Export duplicate report to JSON file."""
    report = {
        'total_groups': len(duplicates),
        'duplicates': {}
    }
    
    total_wasted = 0
    for md5_hash, filepaths in duplicates.items():
        file_size = os.path.getsize(filepaths[0])
        wasted = file_size * (len(filepaths) - 1)
        total_wasted += wasted
        
        report['duplicates'][md5_hash] = {
            'file_size': file_size,
            'count': len(filepaths),
            'wasted_space': wasted,
            'files': filepaths
        }
    
    report['total_wasted_space'] = total_wasted
    
    with open(output_file, 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"[INFO] Report exported to {output_file}")


def main():
    parser = argparse.ArgumentParser(
        description="Find duplicate files in a directory by MD5 hash comparison",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Scan current directory
  duplicate_file_finder.py .

  # Scan with specific extensions
  duplicate_file_finder.py /path/to/dir --ext .jpg .png .gif

  # Verbose mode with JSON export
  duplicate_file_finder.py /media --verbose --export report.json

  # Include hidden files/directories
  duplicate_file_finder.py . --no-skip-hidden
        """
    )
    
    parser.add_argument('directory', help='Directory to scan for duplicates')
    parser.add_argument('--ext', nargs='+', help='File extensions to filter (e.g., .jpg .png)')
    parser.add_argument('--export', type=str, help='Export results to JSON file')
    parser.add_argument('--verbose', action='store_true', help='Verbose output')
    parser.add_argument('--no-skip-hidden', action='store_true', 
                       help='Include hidden files and directories')
    
    args = parser.parse_args()
    
    # Normalize extensions
    extensions = None
    if args.ext:
        extensions = [ext if ext.startswith('.') else f'.{ext}' for ext in args.ext]
    
    # Scan directory
    hash_map = scan_directory(
        args.directory, 
        extensions=extensions,
        skip_hidden=not args.no_skip_hidden
    )
    
    # Find duplicates
    duplicates = find_duplicates(hash_map)
    
    # Print results
    print_duplicates(duplicates, verbose=args.verbose)
    
    # Export if requested
    if args.export:
        export_json(duplicates, args.export)
    
    # Exit code based on duplicates found
    sys.exit(0 if not duplicates else 1)


if __name__ == '__main__':
    main()
