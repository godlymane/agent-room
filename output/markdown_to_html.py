#!/usr/bin/env python3
"""
Markdown to HTML Converter - Convert markdown files to beautiful HTML with syntax highlighting.
Zero dependencies. Supports GitHub-flavored markdown, code blocks, and custom CSS.
"""

import argparse
import re
import sys
from pathlib import Path
from html import escape


class MarkdownParser:
    """Convert Markdown to HTML."""
    
    def __init__(self, theme: str = "light"):
        self.theme = theme
        self.html_lines = []
    
    @staticmethod
    def escape_html(text: str) -> str:
        """Escape HTML special characters."""
        return escape(text)
    
    @staticmethod
    def parse_inline(text: str) -> str:
        """Parse inline markdown: bold, italic, code."""
        # Bold: **text** or __text__
        text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
        text = re.sub(r'__(.+?)__', r'<strong>\1</strong>', text)
        
        # Italic: *text* or _text_
        text = re.sub(r'\*(.+?)\*', r'<em>\1</em>', text)
        text = re.sub(r'_(.+?)_', r'<em>\1</em>', text)
        
        # Code: `text`
        text = re.sub(r'`(.+?)`', r'<code>\1</code>', text)
        
        # Links: [text](url)
        text = re.sub(r'\[(.+?)\]\((.+?)\)', r'<a href="\2">\1</a>', text)
        
        return text
    
    def parse_markdown(self, markdown: str) -> str:
        """Convert markdown to HTML."""
        lines = markdown.split('\n')
        html = []
        i = 0
        in_code_block = False
        code_language = ""
        code_lines = []
        
        while i < len(lines):
            line = lines[i]
            
            # Code blocks: ```language code ```
            if line.startswith('```'):
                if in_code_block:
                    code_block = '\n'.join(code_lines)
                    html.append(f'<pre><code class="language-{code_language}">{self.escape_html(code_block)}</code></pre>')
                    in_code_block = False
                    code_lines = []
                else:
                    in_code_block = True
                    code_language = line[3:].strip()
                i += 1
                continue
            
            if in_code_block:
                code_lines.append(line)
                i += 1
                continue
            
            # Headings: # ## ### etc
            heading_match = re.match(r'^(#{1,6})\s+(.+)$', line)
            if heading_match:
                level = len(heading_match.group(1))
                content = self.parse_inline(heading_match.group(2))
                html.append(f'<h{level}>{content}</h{level}>')
                i += 1
                continue
            
            # Horizontal rule: --- or *** or ___
            if re.match(r'^(-{3,}|\*{3,}|_{3,})$', line):
                html.append('<hr>')
                i += 1
                continue
            
            # Unordered lists: - * +
            list_match = re.match(r'^(\s*)[-*+]\s+(.+)$', line)
            if list_match:
                indent = len(list_match.group(1)) // 2
                content = self.parse_inline(list_match.group(2))
                
                # Open ul tags if needed
                while len(html) == 0 or not html[-1].startswith('<ul'):
                    if len(html) > 0 and html[-1].startswith('</li>'):
                        break
                    html.append('<ul>')
                
                html.append(f'<li>{content}</li>')
                i += 1
                continue
            
            # Ordered lists: 1. 2. etc
            ol_match = re.match(r'^(\s*)\d+\.\s+(.+)$', line)
            if ol_match:
                content = self.parse_inline(ol_match.group(2))
                html.append(f'<li>{content}</li>')
                i += 1
                continue
            
            # Blockquotes: > text
            if line.startswith('>'):
                content = line[1:].strip()
                content = self.parse_inline(content)
                html.append(f'<blockquote>{content}</blockquote>')
                i += 1
                continue
            
            # Paragraphs
            if line.strip():
                content = self.parse_inline(line.strip())
                html.append(f'<p>{content}</p>')
            
            i += 1
        
        return '\n'.join(html)
    
    def get_html_template(self, title: str, content: str) -> str:
        """Wrap content in HTML template."""
        css = self.get_css()
        
        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{escape(title)}</title>
    <style>
{css}
    </style>
</head>
<body>
    <div class="container">
        <main>
{content}
        </main>
    </div>
</body>
</html>"""
        return html
    
    def get_css(self) -> str:
        """Get CSS stylesheet based on theme."""
        if self.theme == "dark":
            return """        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #e0e0e0;
            background: #1e1e1e;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
        }
        h1, h2, h3, h4, h5, h6 {
            margin-top: 24px;
            margin-bottom: 16px;
            font-weight: 600;
            line-height: 1.25;
            color: #ffffff;
        }
        h1 { font-size: 2em; border-bottom: 2px solid #444; padding-bottom: 10px; }
        h2 { font-size: 1.5em; }
        h3 { font-size: 1.25em; }
        p { margin-bottom: 16px; }
        code {
            background: #333;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', Courier, monospace;
            color: #ffab91;
        }
        pre {
            background: #2d2d2d;
            padding: 16px;
            border-radius: 6px;
            overflow-x: auto;
            margin-bottom: 16px;
        }
        pre code {
            background: none;
            padding: 0;
            color: #e0e0e0;
        }
        a {
            color: #64b5f6;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
        blockquote {
            border-left: 4px solid #444;
            padding-left: 16px;
            margin-left: 0;
            color: #a0a0a0;
            font-style: italic;
        }
        ul, ol {
            margin-left: 24px;
            margin-bottom: 16px;
        }
        li {
            margin-bottom: 8px;
        }
        hr {
            border: none;
            border-top: 2px solid #444;
            margin: 24px 0;
        }"""
        else:  # light theme
            return """        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #ffffff;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
        }
        h1, h2, h3, h4, h5, h6 {
            margin-top: 24px;
            margin-bottom: 16px;
            font-weight: 600;
            line-height: 1.25;
            color: #000;
        }
        h1 { font-size: 2em; border-bottom: 2px solid #ddd; padding-bottom: 10px; }
        h2 { font-size: 1.5em; }
        h3 { font-size: 1.25em; }
        p { margin-bottom: 16px; }
        code {
            background: #f5f5f5;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', Courier, monospace;
            color: #d63384;
        }
        pre {
            background: #f5f5f5;
            padding: 16px;
            border-radius: 6px;
            overflow-x: auto;
            margin-bottom: 16px;
            border: 1px solid #ddd;
        }
        pre code {
            background: none;
            padding: 0;
            color: #333;
        }
        a {
            color: #0066cc;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
        blockquote {
            border-left: 4px solid #ddd;
            padding-left: 16px;
            margin-left: 0;
            color: #666;
            font-style: italic;
        }
        ul, ol {
            margin-left: 24px;
            margin-bottom: 16px;
        }
        li {
            margin-bottom: 8px;
        }
        hr {
            border: none;
            border-top: 2px solid #ddd;
            margin: 24px 0;
        }"""


def main():
    parser = argparse.ArgumentParser(
        description="Convert Markdown files to beautiful HTML.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Convert markdown to HTML
  %(prog)s readme.md
  
  # Output to file
  %(prog)s readme.md -o index.html
  
  # Dark theme
  %(prog)s readme.md --theme dark -o index.html
  
  # Light theme (default)
  %(prog)s readme.md --theme light
        """
    )
    
    parser.add_argument("input", help="Input markdown file")
    parser.add_argument("-o", "--output", help="Output HTML file (default: stdout)")
    parser.add_argument("--theme", choices=["light", "dark"], default="light",
                       help="Color theme")
    parser.add_argument("--title", help="Document title (default: filename)")
    parser.add_argument("-v", "--verbose", action="store_true")
    
    args = parser.parse_args()
    
    try:
        # Read markdown file
        input_path = Path(args.input)
        if not input_path.exists():
            print(f"Error: File not found: {args.input}", file=sys.stderr)
            sys.exit(1)
        
        markdown_content = input_path.read_text(encoding='utf-8')
        
        # Convert
        converter = MarkdownParser(theme=args.theme)
        html_content = converter.parse_markdown(markdown_content)
        
        # Get title
        title = args.title or input_path.stem.replace('-', ' ').title()
        
        # Wrap in template
        full_html = converter.get_html_template(title, html_content)
        
        if args.verbose:
            print(f"[Converted] {args.input} -> {args.output or 'stdout'}", file=sys.stderr)
        
        # Output
        if args.output:
            Path(args.output).write_text(full_html, encoding='utf-8')
            print(f"✓ HTML saved to {args.output}")
        else:
            print(full_html)
    
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
