#!/usr/bin/env python3
"""
Markdown to HTML Converter - $19.99 Gumroad
Converts Markdown to clean HTML with optional CSS styling.
Target market: Bloggers, developers, content creators, documentation teams.
"""

import re
import json

class MarkdownConverter:
    def __init__(self, include_css=True):
        self.include_css = include_css
    
    def convert(self, markdown_text: str) -> str:
        """Convert markdown to HTML."""
        html = markdown_text
        
        # Headers
        html = re.sub(r'^### (.*?)$', r'<h3>\1</h3>', html, flags=re.MULTILINE)
        html = re.sub(r'^## (.*?)$', r'<h2>\1</h2>', html, flags=re.MULTILINE)
        html = re.sub(r'^# (.*?)$', r'<h1>\1</h1>', html, flags=re.MULTILINE)
        
        # Bold & Italic
        html = re.sub(r'\*\*\*(.*?)\*\*\*', r'<strong><em>\1</em></strong>', html)
        html = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', html)
        html = re.sub(r'\*(.*?)\*', r'<em>\1</em>', html)
        
        # Links
        html = re.sub(r'\[(.*?)\]\((.*?)\)', r'<a href="\2">\1</a>', html)
        
        # Code blocks
        html = re.sub(r'```(.*?)```', r'<pre><code>\1</code></pre>', html, flags=re.DOTALL)
        html = re.sub(r'`(.*?)`', r'<code>\1</code>', html)
        
        # Lists
        html = re.sub(r'^\* (.*?)$', r'<li>\1</li>', html, flags=re.MULTILINE)
        html = re.sub(r'(<li>.*?</li>)', r'<ul>\1</ul>', html, flags=re.DOTALL)
        
        # Paragraphs
        html = re.sub(r'\n\n', '</p><p>', html)
        html = '<p>' + html + '</p>'
        
        # Line breaks
        html = html.replace('\n', '<br>\n')
        
        if self.include_css:
            html = self._wrap_with_css(html)
        
        return html
    
    def _wrap_with_css(self, html: str) -> str:
        """Wrap HTML with minimal clean CSS."""
        css = '''<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
h1, h2, h3 { color: #333; }
a { color: #0066cc; }
code, pre { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; }
pre { overflow-x: auto; padding: 12px; }
</style>'''
        return f"<!DOCTYPE html><html><head><meta charset='utf-8'>{css}</head><body>{html}</body></html>"

if __name__ == '__main__':
    import sys
    if len(sys.argv) < 2:
        print("Usage: python markdown_to_html_converter.py <file.md> [--no-css]")
        sys.exit(1)
    
    with open(sys.argv[1], 'r') as f:
        md_content = f.read()
    
    converter = MarkdownConverter(include_css='--no-css' not in sys.argv)
    html = converter.convert(md_content)
    
    output_file = sys.argv[1].replace('.md', '.html')
    with open(output_file, 'w') as f:
        f.write(html)
    
    print(f"Converted to {output_file}")
