#!/usr/bin/env python3
"""
Image Batch Processor - Convert, resize, and compress images in bulk.
Supports PNG, JPG, WEBP, GIF formats. Perfect for photographers, e-commerce, web devs.

Install: pip install pillow
Usage:
  python image_batch_processor.py --input ./photos --output ./processed --resize 1920x1080 --quality 85
  python image_batch_processor.py --input ./images --format webp --quality 80
  python image_batch_processor.py --input . --compress --quality 70
"""

import argparse
import os
from pathlib import Path
from PIL import Image
import sys

def process_images(input_dir, output_dir, resize=None, format=None, quality=85, compress=False, verbose=False):
    """
    Process all images in input directory.
    
    Args:
        input_dir (str): Input directory path
        output_dir (str): Output directory path
        resize (str): Target size as WIDTHxHEIGHT (e.g., 1920x1080)
        format (str): Output format (png, jpg, webp, gif)
        quality (int): JPEG/WEBP quality 1-100
        compress (bool): Apply aggressive compression
        verbose (bool): Print detailed output
    """
    input_path = Path(input_dir)
    output_path = Path(output_dir)
    
    # Create output directory
    output_path.mkdir(parents=True, exist_ok=True)
    
    if not input_path.is_dir():
        print(f"Error: {input_dir} is not a directory")
        sys.exit(1)
    
    # Supported formats
    supported = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'}
    image_files = [f for f in input_path.rglob('*') if f.suffix.lower() in supported]
    
    if not image_files:
        print(f"No images found in {input_dir}")
        sys.exit(1)
    
    # Parse resize dimensions
    resize_dims = None
    if resize:
        try:
            w, h = map(int, resize.split('x'))
            resize_dims = (w, h)
        except ValueError:
            print(f"Error: Invalid resize format. Use WIDTHxHEIGHT (e.g., 1920x1080)")
            sys.exit(1)
    
    # Default format is source format if not specified
    output_format = format.upper() if format else None
    
    processed_count = 0
    skipped_count = 0
    total_input_size = 0
    total_output_size = 0
    
    for img_path in image_files:
        try:
            if verbose:
                print(f"Processing: {img_path.name}...", end=" ")
            
            # Open image
            img = Image.open(img_path)
            
            # Convert RGBA to RGB if saving as JPEG
            if img.mode in ('RGBA', 'LA', 'P') and (output_format == 'JPEG' or 'jpg' in str(img_path).lower()):
                rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                rgb_img.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = rgb_img
            
            # Resize if specified
            if resize_dims:
                img.thumbnail(resize_dims, Image.Resampling.LANCZOS)
            
            # Determine output filename and format
            out_filename = img_path.stem
            if output_format:
                out_ext = f".{output_format.lower()}"
                out_filename = f"{out_filename}{out_ext}"
            else:
                out_filename = img_path.name
            
            out_filepath = output_path / out_filename
            
            # Save with quality settings
            save_kwargs = {}
            if output_format in ['JPEG', 'JPG'] or out_ext.lower() == '.jpg':
                save_kwargs = {'format': 'JPEG', 'quality': quality, 'optimize': compress}
            elif output_format == 'WEBP' or out_ext.lower() == '.webp':
                save_kwargs = {'format': 'WEBP', 'quality': quality}
            elif output_format == 'PNG' or out_ext.lower() == '.png':
                save_kwargs = {'format': 'PNG', 'optimize': compress}
            else:
                out_ext = img_path.suffix
                save_kwargs = {'optimize': compress} if compress else {}
            
            img.save(out_filepath, **save_kwargs)
            
            # Calculate sizes
            input_size = img_path.stat().st_size
            output_size = out_filepath.stat().st_size
            total_input_size += input_size
            total_output_size += output_size
            
            reduction = ((input_size - output_size) / input_size * 100) if input_size > 0 else 0
            
            if verbose:
                print(f"✓ Saved ({input_size//1024}KB → {output_size//1024}KB, -{reduction:.1f}%)")
            
            processed_count += 1
            
        except Exception as e:
            if verbose:
                print(f"✗ Error: {e}")
            skipped_count += 1
    
    # Summary
    print(f"\n{'='*60}")
    print(f"✓ Processed: {processed_count} images")
    if skipped_count:
        print(f"⚠ Skipped: {skipped_count} images")
    if total_input_size > 0:
        total_reduction = ((total_input_size - total_output_size) / total_input_size * 100)
        print(f"Size: {total_input_size//1024}KB → {total_output_size//1024}KB ({-total_reduction:.1f}%)")
    print(f"Output: {output_path.resolve()}")
    print(f"{'='*60}")

def main():
    parser = argparse.ArgumentParser(
        description="Batch process images: convert, resize, compress",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Resize all images to 1920x1080 and compress as JPEG
  python image_batch_processor.py --input ./photos --output ./web --resize 1920x1080 --format jpg --quality 85

  # Convert all to WEBP with high compression
  python image_batch_processor.py --input ./images --output ./compressed --format webp --quality 75 --compress

  # Resize and keep original format, aggressive compression
  python image_batch_processor.py --input . --output ./resized --resize 800x600 --compress --verbose
        """
    )
    
    parser.add_argument('--input', required=True, help='Input directory with images')
    parser.add_argument('--output', required=True, help='Output directory for processed images')
    parser.add_argument('--resize', help='Resize to WIDTHxHEIGHT (e.g., 1920x1080). Maintains aspect ratio.')
    parser.add_argument('--format', choices=['jpg', 'png', 'webp', 'gif'], help='Output format (default: keep original)')
    parser.add_argument('--quality', type=int, default=85, help='Quality for JPEG/WEBP (1-100, default: 85)')
    parser.add_argument('--compress', action='store_true', help='Enable aggressive compression')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    
    args = parser.parse_args()
    
    process_images(
        args.input,
        args.output,
        resize=args.resize,
        format=args.format,
        quality=args.quality,
        compress=args.compress,
        verbose=args.verbose
    )

if __name__ == '__main__':
    main()
