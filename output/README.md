# Duplicate File Finder

A fast, powerful command-line tool to find, report, and clean up duplicate files on your system using SHA256 hashing.

**Perfect for:**
- 💾 Reclaiming disk space
- 🔍 Backup verification
- 📁 Storage audits
- 🧹 System cleanup

## Features

✅ **Fast SHA256 hashing** - Find true duplicates by content, not just filename  
✅ **Recursive scanning** - Search entire directory trees  
✅ **Flexible filtering** - By file size, hidden files, extensions  
✅ **Multiple reports** - Console, JSON, cleanup scripts  
✅ **Detailed analytics** - Total wasted space, duplicate counts  
✅ **Auto-cleanup** - Generate shell scripts for safe deletion  
✅ **Cross-platform** - Works on Windows, macOS, Linux  

## Installation

### Option 1: pip install
```bash
pip install duplicate-file-finder
duplicate-file-finder ./Downloads
```

### Option 2: Direct download
```bash
git clone https://github.com/devdattareddy/duplicate-file-finder.git
cd duplicate-file-finder
python duplicate_file_finder.py ./Documents
```

### Option 3: Standalone (no installation)
```bash
python duplicate_file_finder.py /path/to/scan
```

## Usage

### Basic Usage

**Scan current directory:**
```bash
python duplicate_file_finder.py .
```

**Scan specific folder:**
```bash
python duplicate_file_finder.py ./Downloads
```

**Verbose output (see each file being hashed):**
```bash
python duplicate_file_finder.py . --verbose
```

### Advanced Usage

**Find large duplicates (>10MB):**
```bash
python duplicate_file_finder.py . --min-size 10485760
```

**Include hidden files:**
```bash
python duplicate_file_finder.py . --include-hidden
```

**Save detailed JSON report:**
```bash
python duplicate_file_finder.py . --json duplicates_report.json
```

**Generate cleanup script (before running):**
```bash
python duplicate_file_finder.py . --cleanup cleanup.sh
# Review cleanup.sh manually
bash cleanup.sh  # Run only after verification!
```

**Sort by number of duplicates:**
```bash
python duplicate_file_finder.py . --sort count
```

**Limit to top 10 largest duplicate groups:**
```bash
python duplicate_file_finder.py . --limit 10
```

## Examples

### Example 1: Find all duplicates
```bash
$ python duplicate_file_finder.py ~/Documents
Scanning ~/Documents...

======================================================================
DUPLICATE FILES REPORT
======================================================================
Total Files Scanned: 1,247
Duplicate Groups: 24
Total Duplicate Files: 67
Wasted Space: 2,341.50 MB (2,456,932,120 bytes)
======================================================================

[1] Hash: a1b2c3d4e5f6g7h8... (Size: 450.5 MB, Wasted: 901.0 MB)
    → ~/Documents/video_backup.mp4
    ✗ ~/Downloads/video_backup.mp4
    ✗ ~/Desktop/video_backup.mp4

[2] Hash: x9y8z7w6v5u4t3s2... (Size: 125.3 MB, Wasted: 250.6 MB)
    → ~/Documents/Photos/vacation_2024.zip
    ✗ ~/Backups/vacation_2024.zip
```

### Example 2: Create cleanup script
```bash
$ python duplicate_file_finder.py . --cleanup cleanup.sh
Report saved. Cleanup script generated: cleanup.sh

# Review the script
cat cleanup.sh

# Then run (backup first!)
bash cleanup.sh
```

### Example 3: JSON report for analysis
```bash
$ python duplicate_file_finder.py . --json report.json
Report saved to: report.json

# View results
cat report.json
```

Output:
```json
{
  "summary": {
    "total_duplicates": 5,
    "total_duplicate_files": 12,
    "wasted_space_bytes": 2456932120,
    "wasted_space_mb": 2341.5
  },
  "duplicates": [
    {
      "hash": "a1b2c3d4e5f6g7h8...",
      "file_size": 472236060,
      "copies": 3,
      "wasted_bytes": 944472120,
      "files": [
        "/path/to/file1.mp4",
        "/path/to/file2.mp4",
        "/path/to/file3.mp4"
      ]
    }
  ]
}
```

## Command Reference

```
usage: duplicate_file_finder.py [-h] [-r] [-m MIN_SIZE] [--include-hidden]
                                [-j FILE] [-c FILE] [--sort {size,count}]
                                [-l LIMIT] [-v]
                                directory

positional arguments:
  directory             Directory to scan

optional arguments:
  -h, --help            Show help message
  -r, --recursive       Scan recursively (default: true)
  -m, --min-size        Minimum file size in bytes (default: 0)
  --include-hidden      Include hidden files/folders
  -j, --json FILE       Save report as JSON
  -c, --cleanup FILE    Generate cleanup shell script
  --sort {size,count}   Sort by size or count (default: size)
  -l, --limit LIMIT     Show only top N duplicate groups
  -v, --verbose         Verbose output
```

## Performance

**Speed depends on:**
- Disk speed (HDD slower than SSD)
- Number of files (more files = longer scan)
- File sizes (larger files = slower hashing)
- System load

**Typical performance:**
- Small folder (100 files, <1GB): < 1 second
- Medium folder (10k files, 100GB): 30-60 seconds
- Large folder (100k+ files): 2-5 minutes

**Tips for faster scanning:**
1. Use `--min-size` to skip small files
2. Exclude specific folders
3. Use verbose mode to track progress

## Safety

⚠️ **IMPORTANT:**
- Always **backup** before running cleanup scripts
- Review `cleanup.sh` manually before executing
- Test on a small folder first
- The tool is read-only by default (cleanup scripts require manual approval)

The cleanup script keeps the **first copy** and removes duplicates. Verify this is the correct version!

## Troubleshooting

**"Permission denied" error:**
- Run with appropriate permissions: `sudo python duplicate_file_finder.py /path`

**"No files found" message:**
- Check the path exists
- Check file permissions
- Use `-v` flag to debug

**Scanning too slow:**
- Use `--min-size` to skip small files
- Exclude network drives (use local paths)
- Run on SSD instead of HDD

**False positives (identical content different files):**
- This is **correct behavior** - files with identical content are duplicates
- Use cleanup script carefully to preserve correct versions

## Support

If this tool saved you disk space or time, please consider supporting development:

🎉 **[Buy Me a Coffee](https://buymeacoffee.com/devdattareddy)** - Support ongoing development!

Your support helps:
- Add new features
- Improve performance
- Create more tools
- Fix bugs faster

## License

MIT License - See LICENSE file for details

## Contributing

Found a bug? Want a feature? 
- Open an issue on GitHub
- Submit a pull request
- Share your feedback

---

**Made with ❤️ for developers, sysadmins, and digital packrats**

Happy cleaning! 🧹
