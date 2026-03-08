# Email Validator CLI

Professional email validation tool with **syntax checking, disposable email detection, and optional MX verification**. Perfect for marketing teams, developer onboarding, data cleaning, and user registration flows.

✅ **Syntax validation** (RFC 5322)  
✅ **Disposable email detection** (tempmail, throwaway, etc.)  
✅ **MX record verification** (optional DNS check)  
✅ **Batch processing** (validate 1000s of emails at once)  
✅ **Multiple formats** (JSON, CSV, Markdown, text)  
✅ **Zero dependencies** - Pure Python stdlib  

## Installation

```bash
# Direct use
python email_validator.py john@example.com

# Global command
chmod +x email_validator.py
sudo cp email_validator.py /usr/local/bin/validate-email
validate-email john@example.com
```

## Quick Start

### Single Email
```bash
python email_validator.py john@example.com
```
**Output:**
```
✓ VALID john@example.com
  └─ Valid
```

### Multiple Emails
```bash
python email_validator.py john@example.com jane@gmail.com invalid.email
```
**Output:**
```
✓ VALID john@example.com
  └─ Valid
✓ VALID jane@gmail.com
  └─ Valid
✗ INVALID invalid.email
  └─ Invalid format
```

### Validate Emails from File
```bash
python email_validator.py -f emails.txt
```

### With MX Record Check (DNS lookup)
```bash
python email_validator.py john@example.com --check-mx
```
**Output:**
```
✓ VALID john@example.com
  └─ Valid
  └─ Found 10 MX records
```

### Detect Disposable Emails
```bash
python email_validator.py user@tempmail.com user@gmail.com
```
**Output:**
```
✓ VALID user@tempmail.com
  └─ Valid
  └─ WARNING: Disposable email service
✓ VALID user@gmail.com
  └─ Valid
```

## Output Formats

### Text (Default)
```bash
python email_validator.py -f emails.txt
```

### JSON
```bash
python email_validator.py john@example.com --format json
```
**Output:**
```json
[
  {
    "email": "john@example.com",
    "valid": true,
    "syntax_check": "Valid",
    "disposable": false,
    "mx_check": false
  }
]
```

### CSV
```bash
python email_validator.py -f emails.txt --format csv
```
**Output:**
```
email,valid,syntax_check,disposable
john@example.com,True,Valid,False
jane@gmail.com,True,Valid,False
invalid.email,False,Invalid format,False
```

### Markdown (for reports)
```bash
python email_validator.py -f emails.txt --format markdown
```
**Output:**
```markdown
| Email | Valid | Status | Disposable |
|-------|-------|--------|-----------|
| john@example.com | ✓ | Valid | No |
| jane@gmail.com | ✓ | Valid | No |
| invalid.email | ✗ | Invalid format | No |
```

## Real-World Examples

### Clean User Registration Data
```bash
# Validate all registration emails, save valid ones
python email_validator.py -f registrations.txt --valid-only -o valid_users.txt
```

### Pre-send Email Campaign Cleanup
```bash
# Check all emails before sending campaign
python email_validator.py -f campaign_list.txt --check-mx --format json -o validation_report.json

# Remove disposables and invalid addresses
python email_validator.py -f subscribers.txt --valid-only --output clean_subscribers.txt
```

### Data Import Validation
```bash
# Validate emails before database import
python email_validator.py -f import.csv --format csv -o validation_results.csv
```

### API Endpoint Integration
```bash
# Build validation into signup workflow
python email_validator.py "$user_email" --format json
# Returns JSON for your app to parse
```

### Monitoring Registration Quality
```bash
# Track disposable email registrations
python email_validator.py -f latest_signups.txt --verbose
# Output includes summary stats
```

## Command Reference

```
Usage: email_validator.py [emails...] [options]

Positional Arguments:
  emails              Email addresses to validate

Options:
  -f, --file          Path to file with emails (one per line)
  --check-mx          Verify MX records via DNS lookup (slower)
  --format            Output format: text, json, csv, markdown
  -o, --output        Save results to file
  --valid-only        Show only valid emails
  -v, --verbose       Show summary statistics
  -h, --help          Show this help message
```

## Validation Rules

### Syntax Check
✓ Email follows RFC 5322 standard  
✓ Local part (before @) is max 64 characters  
✓ Total email is max 254 characters  
✓ No consecutive dots  
✓ No leading/trailing dots in local part  

### Disposable Detection
✗ Blocks tempmail.com, throwaway.email, guerrillamail.com, etc.  
✗ Catches 50+ known disposable providers  

### MX Check (optional)
✓ Verifies domain has valid mail exchange records  
✓ Requires DNS access (slower, not suitable for real-time)  

## Performance

- **Syntax only:** 10,000 emails/sec  
- **With MX check:** 1-5 emails/sec (depends on DNS)  

**Recommendation:** Use syntax + disposable for real-time (registration), use MX for batch processing (email list cleaning).

## Use Cases

📧 **Email Marketing** - Clean lists before sending campaigns  
🔐 **User Registration** - Validate emails at signup  
🗂️ **Data Import** - Clean data before database sync  
🤖 **API Integration** - Use as validation microservice  
📊 **Reports** - Generate validation audits  

## Limitations

- **Real-time verification:** Not supported (requires SMTP, very slow)
- **Catch-all detection:** Limited (use real verification for this)
- **Complex DNS queries:** Requires DNS library (basic MX only)

## License

MIT - Free for commercial and personal use.

## Support & Contribution

Found a bug? Have suggestions? [Submit an issue!](https://github.com/yourusername/email-validator)

## Help This Project Grow

💝 **[Buy Me a Coffee](https://buymeacoffee.com/devdattareddy)** - Support development  
⭐ **Star on GitHub** - Help others find it  
📢 **Share with your team** - Spread the word!

---

Made with ❤️ for developers and data professionals.
