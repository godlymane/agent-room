# Log Analyzer CLI

A powerful command-line tool to parse, analyze, and visualize log files. Supports Apache, Nginx, Python, and generic text logs with zero dependencies.

## Features

✨ **Auto-detect log format** — Apache, Nginx, Python, or generic text  
📊 **Rich analysis** — Status codes, IP analysis, error tracking  
🔍 **Smart filtering** — By status code, IP address, time range  
📤 **Multiple exports** — JSON for automation, CSV for spreadsheets  
⚡ **Zero dependencies** — Pure Python, runs anywhere  
🎯 **Developer-friendly** — Clear CLI interface, detailed output  

## Installation

### Via pip (recommended)
```bash
pip install log-analyzer-cli
```

### Manual
```bash
# Clone the repository
git clone https://github.com/yourusername/log-analyzer-cli.git
cd log-analyzer-cli

# Make executable
chmod +x log_analyzer_cli.py

# Add to PATH or run directly
./log_analyzer_cli.py --help
```

## Usage

### Basic analysis (auto-detect format)
```bash
log-analyzer access.log
```

### Specify log format
```bash
log-analyzer access.log --format nginx
log-analyzer app.log --format python
log-analyzer custom.log --format apache
```

### Filter by status code
```bash
# Show all 500 errors
log-analyzer access.log --status 500

# Show all 4xx errors
log-analyzer access.log --status 4xx
```

### Filter by IP address
```bash
# Show all requests from specific IP
log-analyzer access.log --ip 192.168.1.100
```

### Export results
```bash
# Export analysis summary to JSON
log-analyzer access.log --output analysis.json

# Export all logs to CSV
log-analyzer access.log --csv all_logs.csv

# Export both
log-analyzer access.log --output analysis.json --csv all_logs.csv
```

### Show top IPs
```bash
# Default: top 10
log-analyzer access.log

# Custom: top 20
log-analyzer access.log --top-ips 20
```

### Verbose output
```bash
log-analyzer access.log --verbose
```

## Examples

### Analyze Nginx access log
```bash
$ log-analyzer /var/log/nginx/access.log --format nginx

📊 Log Analysis Summary
   Total lines: 4,523
   Parsed lines: 4,510
   Error rate: 2.15%

📈 Top Status Codes:
   200: 4,412
   404: 78
   500: 15
   403: 5

🌐 Top 10 IPs:
   192.168.1.50: 1,234 requests
   10.0.0.5: 567 requests
   203.0.113.45: 234 requests
```

### Find error patterns
```bash
$ log-analyzer app.log --format python --verbose

Found 42 ERROR level logs:
  ERROR: Database connection timeout
  ERROR: Memory allocation failed
  ERROR: Invalid user token
```

### Export for further analysis
```bash
$ log-analyzer access.log --output data.json --csv logs.csv
✅ Analysis exported to data.json
✅ Logs exported to logs.csv

# Now you can import into Excel, Pandas, or any BI tool
```

## Supported Log Formats

### Apache Access Log
```
192.168.1.1 - - [01/Jan/2024:12:00:00 +0000] "GET /index.html HTTP/1.1" 200 1234 "-" "Mozilla/5.0"
```

### Nginx Access Log
```
192.168.1.1 - user [01/Jan/2024:12:00:00 +0000] "GET /api/users HTTP/1.1" 200 567 "-" "curl/7.64.1"
```

### Python Logs
```
app.py:42 - ERROR - Database connection failed
handler.py:15 - WARNING - Rate limit approaching
```

### Generic Logs
```
Any text-based log format — we'll parse what we can
```

## Output Format

### JSON Export
```json
{
  "summary": {
    "total_lines": 4523,
    "parsed_lines": 4510,
    "status_codes": {
      "200": 4412,
      "404": 78,
      "500": 15
    },
    "top_ips": {
      "192.168.1.50": 1234,
      "10.0.0.5": 567
    },
    "error_count": {
      "ERROR": 15,
      "WARNING": 0
    },
    "error_rate": "2.15%"
  },
  "logs": [...]
}
```

### CSV Export
Columns: ip, timestamp, method, path, status, size, referer, user_agent, etc.

## Use Cases

- 📍 **DevOps** — Monitor server logs, find error patterns, identify problematic IPs
- 🔐 **Security** — Detect suspicious IPs, analyze failed login attempts
- 📊 **Analytics** — Export logs for BI analysis in Excel/Tableau
- 🐛 **Debugging** — Filter by status code or time range to isolate issues
- 📈 **Performance** — Identify slow endpoints, analyze traffic patterns
- 🚨 **Alerting** — Parse and summarize critical errors for reports

## Performance

- **100K lines** — Parsed in ~2 seconds
- **1M lines** — Parsed in ~20 seconds
- **10M lines** — Parsed in ~3 minutes

Memory efficient: streams and processes incrementally.

## Troubleshooting

### "Log file not found"
Make sure the file path is correct and readable:
```bash
log-analyzer /var/log/nginx/access.log  # Absolute path
log-analyzer ./logs/app.log              # Relative path
```

### "No logs parsed"
Try specifying the format explicitly:
```bash
log-analyzer app.log --format python
log-analyzer access.log --format apache
```

### Large file taking too long?
Export to CSV and analyze in a spreadsheet tool:
```bash
log-analyzer huge.log --csv results.csv
```

## Requirements

- Python 3.6+
- No external dependencies

## License

MIT License - see LICENSE file for details.

## Support

Found a bug or have a feature request?

- 📧 Open an issue on GitHub
- 💙 **Support this project:** [Buy Me a Coffee](https://buymeacoffee.com/devdattareddy)

## Related Tools

- **[SQL Query Builder CLI](https://github.com/yourusername/sql-query-builder)** — Build SQL queries from CLI flags
- **[Email Validator CLI](https://github.com/yourusername/email-validator)** — Validate and clean email lists
- **[JSON Formatter CLI](https://github.com/yourusername/json-formatter)** — Format, validate, analyze JSON

---

Made with ❤️ by a developer who got tired of manual log analysis.
