#!/usr/bin/env python3
"""
PDF Merger - Merge, split, and rotate PDF files from command line.
Works with image PDFs, text PDFs, scanned documents, everything.

Install: pip install PyPDF2
Usage:
  python pdf_merger.py --merge file1.pdf file2.pdf file3.pdf --output merged.pdf
  python pdf_merger.py --merge *.pdf --output all_files.pdf
  python pdf_merger.py --split input.pdf --output split_
  python pdf_merger.py --rotate input.pdf --pages 0,2,4 --angle 90 --output rotated.pdf
"""

import argparse
import os
from pathlib import Path
import sys

try:
    from PyPDF2 import PdfMerger, PdfReader, PdfWriter
except ImportError:
    print("Error: PyPDF2 not installed. Run: pip install PyPDF2")
    sys.exit(1)

def merge_pdfs(input_files, output_file, verbose=False):
    """
    Merge multiple PDF files into one.
    
    Args:
        input_files (list): List of PDF file paths
        output_file (str): Output PDF path
        verbose (bool): Print detailed output
    """
    try:
        merger = PdfMerger()
        
        for pdf_file in input_files:
            if not os.path.exists(pdf_file):
                print(f"Error: File not found: {pdf_file}")
                return False
            
            if verbose:
                file_size = os.path.getsize(pdf_file) / (1024 * 1024)
                print(f"  Adding: {pdf_file} ({file_size:.2f} MB)")
            
            merger.append(pdf_file)
        
        merger.write(output_file)
        merger.close()
        
        if verbose:
            output_size = os.path.getsize(output_file) / (1024 * 1024)
            print(f"✓ Merged {len(input_files)} PDFs → {output_file} ({output_size:.2f} MB)")
        
        return True
    except Exception as e:
        print(f"Error merging PDFs: {e}")
        return False

def split_pdf(input_file, output_prefix, pages=None, verbose=False):
    """
    Split PDF into individual pages.
    
    Args:
        input_file (str): Input PDF path
        output_prefix (str): Prefix for output files (e.g., 'split_')
        pages (str): Specific pages (e.g., "0,2,4" or "0-5")
        verbose (bool): Print detailed output
    """
    try:
        if not os.path.exists(input_file):
            print(f"Error: File not found: {input_file}")
            return False
        
        reader = PdfReader(input_file)
        total_pages = len(reader.pages)
        
        # Determine which pages to extract
        if pages:
            page_list = []
            for part in pages.split(','):
                if '-' in part:
                    start, end = map(int, part.split('-'))
                    page_list.extend(range(start, min(end + 1, total_pages)))
                else:
                    page_num = int(part)
                    if page_num < total_pages:
                        page_list.append(page_num)
            page_list = sorted(set(page_list))
        else:
            page_list = list(range(total_pages))
        
        if verbose:
            print(f"Total pages: {total_pages}")
            print(f"Extracting {len(page_list)} pages...")
        
        for idx, page_num in enumerate(page_list):
            writer = PdfWriter()
            writer.add_page(reader.pages[page_num])
            
            out_file = f"{output_prefix}{idx+1:03d}.pdf"
            with open(out_file, 'wb') as f:
                writer.write(f)
            
            if verbose:
                print(f"  Page {page_num + 1} → {out_file}")
        
        print(f"✓ Split {input_file} into {len(page_list)} files with prefix '{output_prefix}'")
        return True
    except Exception as e:
        print(f"Error splitting PDF: {e}")
        return False

def rotate_pages(input_file, output_file, pages, angle, verbose=False):
    """
    Rotate specific pages in a PDF.
    
    Args:
        input_file (str): Input PDF path
        output_file (str): Output PDF path
        pages (str): Pages to rotate (e.g., "0,2,4" or "0-5")
        angle (int): Rotation angle (90, 180, 270)
        verbose (bool): Print detailed output
    """
    try:
        if not os.path.exists(input_file):
            print(f"Error: File not found: {input_file}")
            return False
        
        if angle not in [90, 180, 270]:
            print("Error: Angle must be 90, 180, or 270")
            return False
        
        reader = PdfReader(input_file)
        writer = PdfWriter()
        total_pages = len(reader.pages)
        
        # Parse pages to rotate
        page_list = []
        for part in pages.split(','):
            if '-' in part:
                start, end = map(int, part.split('-'))
                page_list.extend(range(start, min(end + 1, total_pages)))
            else:
                page_num = int(part)
                if page_num < total_pages:
                    page_list.append(page_num)
        page_list = sorted(set(page_list))
        
        if verbose:
            print(f"Rotating pages: {page_list} by {angle}°")
        
        for page_num in range(total_pages):
            page = reader.pages[page_num]
            if page_num in page_list:
                page.rotate(angle)
            writer.add_page(page)
        
        with open(output_file, 'wb') as f:
            writer.write(f)
        
        print(f"✓ Rotated {len(page_list)} pages in {output_file}")
        return True
    except Exception as e:
        print(f"Error rotating PDF: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(
        description="Merge, split, and rotate PDF files",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Merge multiple PDFs
  python pdf_merger.py --merge file1.pdf file2.pdf file3.pdf --output merged.pdf

  # Merge all PDFs in current directory
  python pdf_merger.py --merge *.pdf --output all.pdf

  # Split PDF into individual pages
  python pdf_merger.py --split document.pdf --output pages_

  # Split specific pages only
  python pdf_merger.py --split document.pdf --pages 0,2,4 --output split_

  # Split a page range
  python pdf_merger.py --split document.pdf --pages 0-10 --output first_pages_

  # Rotate pages 0, 2, 4 by 90 degrees
  python pdf_merger.py --rotate document.pdf --pages 0,2,4 --angle 90 --output rotated.pdf
        """
    )
    
    parser.add_argument('--merge', nargs='+', help='Files to merge')
    parser.add_argument('--split', help='PDF file to split')
    parser.add_argument('--rotate', help='PDF file to rotate')
    parser.add_argument('--output', required=True, help='Output file or prefix')
    parser.add_argument('--pages', help='Pages to extract/rotate (e.g., 0,2,4 or 0-10)')
    parser.add_argument('--angle', type=int, choices=[90, 180, 270], help='Rotation angle')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    
    args = parser.parse_args()
    
    if args.merge:
        success = merge_pdfs(args.merge, args.output, verbose=args.verbose)
        sys.exit(0 if success else 1)
    elif args.split:
        success = split_pdf(args.split, args.output, pages=args.pages, verbose=args.verbose)
        sys.exit(0 if success else 1)
    elif args.rotate:
        if not args.pages or not args.angle:
            parser.error("--rotate requires --pages and --angle")
        success = rotate_pages(args.rotate, args.output, args.pages, args.angle, verbose=args.verbose)
        sys.exit(0 if success else 1)
    else:
        parser.print_help()
        sys.exit(1)

if __name__ == '__main__':
    main()
