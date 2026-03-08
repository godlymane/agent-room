#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
YouTube Description Optimizer - Generate SEO-optimized YouTube descriptions.
Includes keyword analysis, timestamp generation, hashtag optimization, and CTA templates.

Usage:
  python youtube_desc_optimizer.py --title "My Video Title" --keywords "AI, Python, Automation"
  python youtube_desc_optimizer.py --title "Tutorial" --keywords "coding" --timestamps "00:00 Intro,02:15 Setup,05:30 Code"
"""

import argparse
import sys

def analyze_keywords(keywords_str):
    """Analyze and optimize keywords for YouTube."""
    keywords = [k.strip() for k in keywords_str.split(',')]
    keywords = [k for k in keywords if k]  # Remove empty
    
    # Remove duplicates and sort by length (longer keywords first)
    keywords = sorted(set(keywords), key=len, reverse=True)
    
    return keywords[:5]  # Limit to top 5

def generate_hashtags(keywords):
    """Generate YouTube-optimized hashtags."""
    hashtags = []
    for kw in keywords:
        # Convert to hashtag
        hashtag = '#' + kw.replace(' ', '').replace('&', 'and')
        if len(hashtag) <= 30:  # YouTube hashtag limit
            hashtags.append(hashtag)
    
    return hashtags[:5]  # Limit to 5 hashtags

def generate_timestamps(timestamps_str):
    """Parse and format timestamps."""
    if not timestamps_str:
        return []
    
    timestamps = []
    for ts in timestamps_str.split(','):
        parts = ts.strip().split(' ', 1)
        if len(parts) == 2:
            time_code, label = parts
            timestamps.append(f"{time_code.strip()} - {label.strip()}")
    
    return timestamps

def generate_description(title, keywords, timestamps=None, include_links=False, include_cta=False):
    """
    Generate optimized YouTube description.
    
    Args:
        title (str): Video title
        keywords (list): List of keywords
        timestamps (list): List of formatted timestamps
        include_links (bool): Include template for external links
        include_cta (bool): Include call-to-action
    
    Returns:
        str: Optimized description
    """
    lines = []
    
    # Hook/intro (first line crucial for click-through)
    lines.append("[TITLE] " + title)
    lines.append("")
    
    # Main description with keywords naturally integrated
    keyword_str = " | ".join(keywords)
    lines.append(f"In this video, we explore: {keyword_str}")
    lines.append("")
    
    # Timestamps if provided
    if timestamps:
        lines.append("TIMESTAMPS:")
        for ts in timestamps:
            lines.append(f"  {ts}")
        lines.append("")
    
    # Main content section
    lines.append("WHAT YOU'LL LEARN:")
    for i, kw in enumerate(keywords[:3], 1):
        lines.append(f"  {i}. {kw.capitalize()}")
    lines.append("")
    
    # Resources section (template)
    if include_links:
        lines.append("RESOURCES & LINKS:")
        lines.append("  - [Add your primary resource]")
        lines.append("  - [Add secondary resource]")
        lines.append("  - [Link to your website/blog]")
        lines.append("")
    
    # CTA section
    if include_cta:
        lines.append("HELP THIS VIDEO:")
        lines.append("  - Like if you found this helpful")
        lines.append("  - Subscribe for more content")
        lines.append("  - Turn on notifications (bell icon)")
        lines.append("  - Comment your thoughts below")
        lines.append("")
    
    # Hashtags (last line)
    hashtags = generate_hashtags(keywords)
    hashtag_line = " ".join(hashtags)
    lines.append(hashtag_line)
    
    return "\n".join(lines)

def generate_title_variations(title, keywords):
    """Generate clickable title variations."""
    variations = [
        title,
        f"[2024] {title}",
        f"{title} - FULL GUIDE",
        f"{title} in 10 MINUTES",
        f"I Built {title} and Here's What Happened",
        f"{title} {keywords[0].upper()} Tutorial",
    ]
    return variations

def main():
    parser = argparse.ArgumentParser(
        description="Generate SEO-optimized YouTube descriptions with keywords, hashtags, and timestamps",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic description
  python youtube_desc_optimizer.py --title "Python Tutorial" --keywords "python, coding, beginners"

  # With timestamps
  python youtube_desc_optimizer.py --title "Python Basics" --keywords "python" \\
    --timestamps "00:00 Intro,01:30 Setup,05:00 Hello World"

  # Full featured
  python youtube_desc_optimizer.py --title "AI Guide" --keywords "AI, Machine Learning, Python" \\
    --timestamps "0:00 Start,5:30 Code,15:00 Results" --links --cta --verbose

  # Export to file
  python youtube_desc_optimizer.py --title "My Video" --keywords "tech" --output description.txt
        """
    )
    
    parser.add_argument('--title', required=True, help='Video title')
    parser.add_argument('--keywords', required=True, help='Keywords (comma-separated, max 5)')
    parser.add_argument('--timestamps', help='Timestamps (format: "00:00 Label,01:30 Next Label")')
    parser.add_argument('--links', action='store_true', help='Include resource links template')
    parser.add_argument('--cta', action='store_true', help='Include call-to-action template')
    parser.add_argument('--output', help='Save description to file')
    parser.add_argument('--titles', action='store_true', help='Generate title variations')
    parser.add_argument('--verbose', '-v', action='store_true', help='Show detailed analysis')
    
    args = parser.parse_args()
    
    # Analyze keywords
    keywords = analyze_keywords(args.keywords)
    
    # Parse timestamps
    timestamps = None
    if args.timestamps:
        timestamps = generate_timestamps(args.timestamps)
    
    # Generate description
    description = generate_description(
        args.title,
        keywords,
        timestamps=timestamps,
        include_links=args.links,
        include_cta=args.cta
    )
    
    print("="*70)
    print("YOUTUBE DESCRIPTION (Ready to Copy)")
    print("="*70)
    print(description)
    print("="*70)
    
    # Title variations
    if args.titles:
        print("\nTITLE VARIATIONS (Test These):")
        print("-"*70)
        for i, var_title in enumerate(generate_title_variations(args.title, keywords), 1):
            print(f"{i}. {var_title}")
        print("-"*70)
    
    # Analysis
    if args.verbose:
        print("\nANALYSIS:")
        print(f"  Description Length: {len(description)} characters ({len(description.split())} words)")
        print(f"  Primary Keywords: {', '.join(keywords[:3])}")
        print(f"  Hashtags Generated: {', '.join(generate_hashtags(keywords))}")
        print(f"  Timestamps Parsed: {len(timestamps) if timestamps else 0}")
        print("-"*70)
    
    # Save to file
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(description)
        print(f"\nSaved to {args.output}")

if __name__ == '__main__':
    main()
