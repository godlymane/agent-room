#!/usr/bin/env python3
"""
Email List Validator Tool - $24.99 Gumroad
Bulk validates email addresses, detects syntax errors, detects disposable emails.
Target market: Email marketers, SaaS founders, growth hackers.
"""

import re
import csv
import json
from typing import List, Dict

DISPOSABLE_DOMAINS = {
    'tempmail.com', '10minutemail.com', 'guerrillamail.com', 'mailinator.com',
    'sharklasers.com', 'trashmail.com', 'fakeinbox.com', 'throwaway.email'
}

def is_valid_email(email: str) -> bool:
    """RFC 5322 simplified validation."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email.strip()) is not None

def is_disposable(email: str) -> bool:
    """Check if email uses disposable domain."""
    domain = email.split('@')[1].lower() if '@' in email else ''
    return domain in DISPOSABLE_DOMAINS

def validate_list(emails: List[str]) -> Dict:
    """Validate list of emails, return report."""
    results = {
        'total': len(emails),
        'valid': [],
        'invalid': [],
        'disposable': [],
        'summary': {}
    }
    
    for email in emails:
        email = email.strip()
        if not is_valid_email(email):
            results['invalid'].append(email)
        elif is_disposable(email):
            results['disposable'].append(email)
        else:
            results['valid'].append(email)
    
    results['summary'] = {
        'valid_count': len(results['valid']),
        'invalid_count': len(results['invalid']),
        'disposable_count': len(results['disposable']),
        'valid_percentage': round(len(results['valid']) / len(emails) * 100, 2) if emails else 0
    }
    
    return results

def save_results(results: Dict, output_file: str = 'email_validation_report.json'):
    """Save validation report to JSON."""
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2)
    print(f"Report saved to {output_file}")

if __name__ == '__main__':
    import sys
    if len(sys.argv) < 2:
        print("Usage: python email_list_validator.py <emails_file.csv>")
        print("CSV format: one email per line")
        sys.exit(1)
    
    with open(sys.argv[1], 'r') as f:
        emails = [line.strip() for line in f if line.strip()]
    
    results = validate_list(emails)
    save_results(results)
    print(json.dumps(results['summary'], indent=2))
