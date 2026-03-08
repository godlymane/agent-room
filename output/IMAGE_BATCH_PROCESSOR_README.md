# Image Batch Processor

**Convert, resize, and compress hundreds of images in seconds.**

Perfect for:
- 📸 Photographers optimizing photo collections
- 🏪 E-commerce sellers batch-processing product images
- 🌐 Web developers converting to modern formats (WEBP)
- 📱 Content creators resizing for different platforms
- 💾 Anyone needing to reduce image storage costs

## Features

✓ **Batch Processing** - Handle hundreds of images at once  
✓ **Multiple Formats** - JPG, PNG, WEBP, GIF, BMP, TIFF  
✓ **Smart Resizing** - Maintains aspect ratio, doesn't stretch  
✓ **Flexible Compression** - Quality control (1-100) for JPEG/WEBP  
✓ **Smart RGBA Handling** - Auto-converts transparent PNGs to solid backgrounds  
✓ **Recursive Processing** - Finds images in subdirectories  
✓ **Detailed Stats** - Shows size reduction and processing summary  

---

## Installation

### Requirements
- Python 3.7+
- Pillow (PIL)

### Quick Setup

```bash
pip install pillow
python image_batch_processor.py --help
```

Or make it executable:
```bash
chmod +x image_batch_processor.py
./image_batch_processor.py --input ./photos --output ./web --resize 1920x1080
```

---

## Usage

### Basic Usage

```bash
python image_batch_processor.py --input INPUT_DIR --output OUTPUT_DIR
```

### Common Examples

#### 1. Resize for Web (maintain aspect ratio)
```bash
python image_batch_processor.py \
  --input ./raw_photos \
  --output ./web_ready \
  --resize 1920x1080
```

#### 2. Convert to WEBP with quality control
```bash
python image_batch_processor.py \
  --input ./images \
  --output ./compressed \
  --format webp \
  --quality 75
```

#### 3. Aggressive compression + format conversion
```bash
python image_batch_processor.py \
  --input ./photos \
  --output ./optimized \
  --resize 1200x800 \
  --format jpg \
  --quality 80 \
  --compress
```

#### 4. Convert PNG to JPG (remove transparency, reduce size)
```bash
python image_batch_processor.py \
  --input ./pngs \
  --output ./jpgs \
  --format jpg \
  --quality 85 \
  --compress
```

#### 5. Verbose output (see every file processed)
```bash
python image_batch_processor.py \
  --input ./photos \
  --output ./processed \
  --resize 800x600 \
  --verbose
```

---

## Command Line Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--input` | PATH | **Required** | Input directory containing images |
| `--output` | PATH | **Required** | Output directory for processed images |
| `--resize` | STRING | None | Target size (WIDTHxHEIGHT, e.g., 1920x1080) |
| `--format` | STRING | Original | Output format: jpg, png, webp, gif |
| `--quality` | INT | 85 | Quality for JPEG/WEBP (1-100) |
| `--compress` | FLAG | False | Enable aggressive compression |
| `--verbose` | FLAG | False | Print detailed processing info |

---

## Quality Settings Guide

### Recommended Quality Levels

| Use Case | Format | Quality |
|----------|--------|---------|
| Web (fast loading) | WEBP | 70-75 |
| E-commerce product images | JPG | 85-90 |
| Photography portfolio | JPG | 90-95 |
| Thumbnails | JPG | 60-70 |
| Social media (Instagram) | WEBP | 75 |
| Print (high quality) | PNG | 100 |

### File Size Comparison
```
Original PNG:        2.5 MB
JPG quality 85:      450 KB (82% reduction)
WEBP quality 75:     380 KB (85% reduction)
JPG quality 70:      320 KB (87% reduction)
```

---

## Real-World Scenarios

### Scenario 1: E-commerce Product Images
```bash
# Standardize 500 product photos to 1000x1000px JPG
python image_batch_processor.py \
  --input ./product_photos \
  --output ./product_images_web \
  --resize 1000x1000 \
  --format jpg \
  --quality 85 \
  --compress \
  --verbose
```

### Scenario 2: Website Hero Images
```bash
# Convert high-res photos to mobile-friendly WEBP
python image_batch_processor.py \
  --input ./hero_shots \
  --output ./hero_web \
  --resize 1920x600 \
  --format webp \
  --quality 80
```

### Scenario 3: Social Media Batch Upload
```bash
# Resize PNG designs to Instagram square format
python image_batch_processor.py \
  --input ./designs \
  --output ./instagram_ready \
  --resize 1080x1080 \
  --format jpg \
  --quality 85
```

### Scenario 4: Archive Backup
```bash
# Compress 10,000 photos to 1/3 original size
python image_batch_processor.py \
  --input ./family_photos \
  --output ./backup_compressed \
  --resize 2560x1920 \
  --compress \
  --quality 80
```

---

## Output

The tool provides a detailed summary:

```
============================================================
✓ Processed: 47 images
⚠ Skipped: 2 images
Size: 2,847 KB → 489 KB (-82.8%)
Output: /Users/you/web_images
============================================================
```

---

## Troubleshooting

### "No images found in directory"
- Check the directory path
- Ensure images are in subdirectories if using nested folders (the tool recurses automatically)
- Supported formats: JPG, PNG, GIF, WEBP, BMP, TIFF

### "PIL error: cannot identify image file"
- Image may be corrupted
- Try renaming to correct extension
- The tool skips corrupted images automatically

### "Memory error on large batches"
- Process in smaller batches
- Reduce `--resize` dimensions
- Use `--compress` to reduce quality

### Output images look blurry
- Increase `--quality` (try 90-95)
- Don't resize down too aggressively
- Use PNG format for lossless compression

---

## Advanced Usage

### Chaining Commands
```bash
# First resize, then check results, then compress further if needed
python image_batch_processor.py --input ./raw --output ./step1 --resize 2000x1500
python image_batch_processor.py --input ./step1 --output ./final --format webp --quality 75 --compress
```

### Integration with Other Tools
```bash
# Process images, then upload to server
python image_batch_processor.py --input ./photos --output ./web && rsync -av ./web/ user@server:/var/www/images/
```

---

## Performance

| Operation | Speed |
|-----------|-------|
| Process 100 photos (2MB each) | ~5-10 seconds |
| Resize only | ~3x faster |
| Add compression | ~1.5x slower |
| Convert format | ~1.2x slower |

---

## Pricing & Support

This tool is priced at **$19.99** on Gumroad.

**What you get:**
- Standalone script (no installation needed)
- Full source code
- Free updates
- Email support

---

## License

MIT License - Use freely for personal and commercial projects.

---

## Changelog

### v1.0 (2024)
- Initial release
- Batch resize, format conversion, compression
- Recursive directory processing
- Quality controls

---

Built with ❤️ for creators, developers, and photographers.
