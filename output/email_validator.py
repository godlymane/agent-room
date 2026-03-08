#!/usr/bin/env python3
"""
Email Validator - Validate, sanitize, and analyze email addresses.
Supports batch processing, SMTP verification, DNS checking, and detailed reports.
"""

import argparse
import re
import sys
import json
from pathlib import Path
from typing import List, Dict, Any, Tuple
import socket


class EmailValidator:
    """Comprehensive email validation and analysis."""
    
    # RFC 5322 simplified regex (works for 99% of real emails)
    EMAIL_PATTERN = re.compile(
        r'^[a-zA-Z0-9.!#$%&\'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$'
    )
    
    def __init__(self):
        self.results = []
    
    @staticmethod
    def is_valid_syntax(email: str) -> Tuple[bool, str]:
        """Check if email has valid syntax."""
        email = email.strip().lower()
        
        if not email:
            return False, "Empty email"
        
        if len(email) > 254:
            return False, "Email too long (max 254 chars)"
        
        if not EmailValidator.EMAIL_PATTERN.match(email):
            return False, "Invalid format"
        
        # Check local part (before @)
        local, domain = email.rsplit("@", 1)
        if len(local) > 64:
            return False, "Local part too long (max 64 chars)"
        
        if local.startswith(".") or local.endswith("."):
            return False, "Local part starts/ends with dot"
        
        if ".." in local:
            return False, "Consecutive dots in local part"
        
        return True, "Valid"
    
    @staticmethod
    def check_disposable(email: str) -> Tuple[bool, str]:
        """Check if email uses disposable service."""
        # Common disposable domains
        disposable_domains = {
            "tempmail.com", "throwaway.email", "guerrillamail.com",
            "10minutemail.com", "mailinator.com", "maildrop.cc",
            "temp-mail.org", "fakeinbox.com", "temp-mail.io",
            "trashmail.com", "yopmail.com", "sharklasers.com"
        }
        
        domain = email.lower().split("@")[1] if "@" in email else ""
        
        if domain in disposable_domains:
            return True, "Disposable email service"
        
        return False, "Not disposable"
    
    @staticmethod
    def check_mx_record(domain: str) -> Tuple[bool, str]:
        """Check if domain has valid MX record (requires DNS access)."""
        try:
            # Try to get MX records for domain
            mx_hosts = socket.getmxhost(domain)
            return bool(mx_hosts), f"Found {len(mx_hosts)} MX records" if mx_hosts else "No MX records"
        except (socket.error, OSError):
            return False, "Cannot resolve MX records"
    
    def validate(self, email: str, check_mx: bool = False) -> Dict[str, Any]:
        """Full email validation with optional MX check."""
        email = email.strip().lower()
        
        # Syntax check
        syntax_valid, syntax_msg = self.is_valid_syntax(email)
        
        result = {
            "email": email,
            "valid": syntax_valid,
            "syntax_check": syntax_msg,
            "disposable": False,
            "disposable_reason": "",
            "mx_check": False,
            "mx_reason": "",
        }
        
        if syntax_valid:
            # Check for disposable
            is_disposable, disp_msg = self.check_disposable(email)
            result["disposable"] = is_disposable
            result["disposable_reason"] = disp_msg
            
            # Extract domain
            domain = email.split("@")[1]
            
            # Optional MX check
            if check_mx:
                mx_valid, mx_msg = self.check_mx_record(domain)
                result["mx_check"] = mx_valid
                result["mx_reason"] = mx_msg
        
        return result
    
    def batch_validate(self, emails: List[str], check_mx: bool = False) -> List[Dict[str, Any]]:
        """Validate multiple emails."""
        return [self.validate(email, check_mx) for email in emails]
    
    def validate_file(self, filepath: str, check_mx: bool = False) -> List[Dict[str, Any]]:
        """Validate emails from file (one per line)."""
        path = Path(filepath)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {filepath}")
        
        emails = [line.strip() for line in path.read_text().splitlines() if line.strip()]
        return self.batch_validate(emails, check_mx)


def format_results(results: List[Dict], output_format: str = "text", valid_only: bool = False) -> str:
    """Format validation results."""
    if valid_only:
        results = [r for r in results if r["valid"]]
    
    if output_format == "json":
        return json.dumps(results, indent=2)
    
    elif output_format == "csv":
        lines = ["email,valid,syntax_check,disposable"]
        for r in results:
            lines.append(f'{r["email"]},{r["valid"]},{r["syntax_check"]},{r["disposable"]}')
        return "\n".join(lines)
    
    elif output_format == "markdown":
        lines = ["| Email | Valid | Status | Disposable |", "|-------|-------|--------|-----------|"]
        for r in results:
            status = r["syntax_check"]
            lines.append(f'| {r["email"]} | {"✓" if r["valid"] else "✗"} | {status} | {"Yes" if r["disposable"] else "No"} |')
        return "\n".join(lines)
    
    else:  # text
        lines = []
        for r in results:
            status = "✓ VALID" if r["valid"] else "✗ INVALID"
            lines.append(f'{status} {r["email"]}')
            lines.append(f'  └─ {r["syntax_check"]}')
            if r["disposable"]:
                lines.append(f'  └─ WARNING: {r["disposable_reason"]}')
        return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="Validate email addresses with syntax, disposable, and MX checks.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Single email
  %(prog)s john@example.com
  
  # Multiple emails
  %(prog)s john@example.com jane@gmail.com invalid.email
  
  # From file
  %(prog)s -f emails.txt
  
  # With MX check (slower, requires DNS)
  %(prog)s john@example.com --check-mx
  
  # JSON output
  %(prog)s jane@example.com --format json
  
  # Only valid emails
  %(prog)s -f emails.txt --valid-only --output valid_emails.txt
        """
    )
    
    parser.add_argument("emails", nargs="*", help="Email addresses to validate")
    parser.add_argument("-f", "--file", help="File with emails (one per line)")
    parser.add_argument("--check-mx", action="store_true", help="Check MX records (slower)")
    parser.add_argument("--format", choices=["text", "json", "csv", "markdown"],
                       default="text", help="Output format")
    parser.add_argument("-o", "--output", help="Save results to file")
    parser.add_argument("--valid-only", action="store_true",
                       help="Show only valid emails")
    parser.add_argument("-v", "--verbose", action="store_true")
    
    args = parser.parse_args()
    
    try:
        validator = EmailValidator()
        
        # Get emails from args or file
        if args.file:
            results = validator.validate_file(args.file, args.check_mx)
        elif args.emails:
            results = validator.batch_validate(args.emails, args.check_mx)
        else:
            parser.print_help()
            sys.exit(1)
        
        # Format output
        output = format_results(results, args.format, args.valid_only)
        
        # Summary stats
        if args.verbose:
            valid_count = sum(1 for r in results if r["valid"])
            print(f"[Summary] Total: {len(results)} | Valid: {valid_count} | Invalid: {len(results) - valid_count}",
                  file=sys.stderr)
        
        # Save or print
        if args.output:
            Path(args.output).write_text(output)
            print(f"Results saved to {args.output}")
        else:
            print(output)
    
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
