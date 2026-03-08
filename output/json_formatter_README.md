# JSON Formatter & Validator

Professional-grade JSON formatting tool with **validation, minification, sorting, and analysis**. Perfect for developers, data engineers, and anyone working with JSON.

✅ **Pretty-print with custom indentation**  
✅ **Minify & compact formats**  
✅ **Sort keys alphabetically**  
✅ **Comprehensive statistics**  
✅ **Validate JSON files**  
✅ **Zero dependencies**  

## Installation

```bash
python json_formatter.py --help
```

## Quick Start

### Pretty Print JSON

```bash
python json_formatter.py data.json
```

**Input:**
```json
{"name":"John","age":30,"city":"NYC"}
```

**Output:**
```json
{
  "name": "John",
  "age": 30,
  "city": "NYC"
}
```

### Minify JSON

```bash
python json_formatter.py data.json --minify
```

**Output:** `{"name":"John","age":30,"city":"NYC"}`

### Sort Keys

```bash
python json_formatter.py data.json --sort
```

**Output:**
```json
{
  "age": 30,
  "city": "NYC",
  "name": "John"
}
```

### Save to File

```bash
python json_formatter.py input.json --sort -o output.json
```

### Validate JSON

```bash
python json_formatter.py data.json --validate
```

**Output:** `✓ Valid JSON`

### Get Statistics

```bash
python json_formatter.py data.json --stats
```

**Output:**
```
JSON Statistics:
  Structure: Object
  Objects: 5
  Arrays: 3
  Strings: 12
  Numbers: 8
  Booleans: 2
  Nulls: 1
  Keys: 15
  Top keys: name, age, email, ...
```

## Command Reference

```
Usage: json_formatter.py <file> [options]

Positional Arguments:
  file                JSON file to format

Options:
  -o, --output        Output file (default: stdout)
  --sort              Sort object keys alphabetically
  --minify            Remove all whitespace
  --compact           Minimal whitespace format
  --indent NUM        Indentation spaces (default: 2)
  --validate          Validate JSON only
  --stats             Show JSON statistics
  -v, --verbose       Verbose output
  -h, --help          Show help
```

## Examples

### Example 1: API Response Formatting

Received API response as minified JSON:

**response.json:**
```json
{"status":"success","data":{"user":{"id":123,"name":"Jane","email":"jane@example.com"},"total":1},"timestamp":"2024-01-15T10:30:00Z"}
```

Pretty-print it:
```bash
python json_formatter.py response.json
```

**Output:**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": 123,
      "name": "Jane",
      "email": "jane@example.com"
    },
    "total": 1
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Example 2: Data Pipeline Optimization

Before sending data over network, minify it:

```bash
# Pretty version (readable)
python json_formatter.py config.json -o config-pretty.json

# Minified version (production)
python json_formatter.py config.json --minify -o config-min.json
```

Saves 40-60% file size!

### Example 3: Configuration File Standardization

Ensure all config files have sorted keys:

```bash
# Bash script
for json in configs/*.json; do
    python json_formatter.py "$json" --sort -o "$json"
done
```

### Example 4: Data Analysis

Analyze JSON structure before processing:

```bash
python json_formatter.py large-dataset.json --stats
```

Know structure, key counts, and types before processing in Python/Node.

## Use Cases

🔧 **Developer Tools** - Format API responses, configs  
📊 **Data Engineering** - Process JSON pipelines  
🗄️ **DevOps** - Validate and format config files  
🔍 **Data Analysis** - Understand JSON structure  
🌐 **Web APIs** - Minify for production  

## Format Comparison

| Format | Size | Readability | Use Case |
|--------|------|-------------|----------|
| Pretty (indent 2) | 100% | Excellent | Development |
| Compact | 85% | Good | Sharing |
| Minified | 55% | Poor | Production |

## Performance

- Formats 1MB+ JSON files in < 100ms
- No external dependencies
- Memory efficient
- Handles deeply nested structures

## Real-World Scenarios

### Scenario 1: API Development

Your API returns minified JSON. Format it for debugging:

```bash
curl https://api.example.com/data | python json_formatter.py /dev/stdin --sort
```

### Scenario 2: Data Quality Checks

Validate a batch of JSON files:

```bash
for f in data/*.json; do
    python json_formatter.py "$f" --validate || echo "Invalid: $f"
done
```

### Scenario 3: Config Management

Your deployment scripts use JSON config. Keep it standardized:

```bash
python json_formatter.py deploy-config.json --sort -o deploy-config.json
git add deploy-config.json
git commit -m "Standardize JSON format"
```

### Scenario 4: Data Pipeline

Transform raw data:

```bash
# Ingest (minified)
python json_formatter.py raw-data.json --minify -o data-compact.json

# Process (pretty)
python my_processor.py data-compact.json
python json_formatter.py output.json --sort -o final-output.json

# Export (minified again)
python json_formatter.py final-output.json --minify -o api-response.json
```

## Integration Examples

### Python Script
```python
import subprocess
import json

# Format JSON using CLI
subprocess.run(['python', 'json_formatter.py', 'data.json', '--sort', '-o', 'output.json'])
```

### Bash Pipeline
```bash
# Get, format, and send
curl https://api.example.com/data | \
  python json_formatter.py /dev/stdin --sort | \
  curl -X POST https://another-api.example.com -d @-
```

## Limitations

- Large files (100MB+) may slow down
- For data transformation, use jq instead
- For complex queries, use dedicated tools

## Premium Version

Want advanced features? Check the **Premium version** with:
- CSV/Excel to JSON conversion
- JSON schema validation
- Template conversion
- Scheduled formatting
- Bulk file processing

## Get It Free

**On GitHub:**
👉 [github.com/devdattareddy/json-formatter-cli](https://github.com/devdattareddy/json-formatter-cli)

```bash
git clone https://github.com/devdattareddy/json-formatter-cli
cd json-formatter-cli
python json_formatter.py sample.json
```

## License

MIT - Free for commercial and personal use.

## Support

💝 **[Buy Me a Coffee](https://buymeacoffee.com/devdattareddy)** - Support development  
⭐ **Star on GitHub** - Help others find it  

---

Made with ❤️ for developers and data professionals.
