#!/usr/bin/env python3
"""
Log File Analyzer CLI - Parse, analyze, and visualize log files
Supports: Apache, Nginx, Python, generic text logs
Features: Error detection, IP analysis, time-based filtering, export to JSON/CSV
"""

import argparse
import json
import csv
import re
from collections import defaultdict, Counter
from datetime import datetime
from pathlib import Path
import sys


class LogAnalyzer:
    """Analyze and process log files"""
    
    APACHE_PATTERN = r'(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+) (\S+)" (\d+) (\S+) "([^"]*)" "([^"]*)"'
    NGINX_PATTERN = r'(\S+) - (\S+) \[([^\]]+)\] "(\S+ (\S+) \S+)" (\d+) (\d+) "([^"]*)" "([^"]*)"'
    PYTHON_PATTERN = r'(\w+):(\d+) - (\w+) - (.+)'
    
    def __init__(self, filepath, format_type='auto'):
        self.filepath = Path(filepath)
        if not self.filepath.exists():
            raise FileNotFoundError(f"Log file not found: {filepath}")
        self.format_type = format_type
        self.lines = self.filepath.read_text().splitlines()
        self.parsed_logs = []
        self.errors = defaultdict(int)
        self.ips = Counter()
        self.status_codes = Counter()
        self.timestamps = []
        
    def parse(self):
        """Parse log lines based on format"""
        for line in self.lines:
            if not line.strip():
                continue
                
            parsed = None
            if self.format_type in ('auto', 'apache'):
                parsed = self._parse_apache(line)
            if not parsed and self.format_type in ('auto', 'nginx'):
                parsed = self._parse_nginx(line)
            if not parsed and self.format_type in ('auto', 'python'):
                parsed = self._parse_python(line)
            if not parsed:
                parsed = self._parse_generic(line)
                
            if parsed:
                self.parsed_logs.append(parsed)
                
    def _parse_apache(self, line):
        """Parse Apache access log"""
        match = re.search(self.APACHE_PATTERN, line)
        if match:
            return {
                'ip': match.group(1),
                'timestamp': match.group(2),
                'method': match.group(3),
                'path': match.group(4),
                'status': match.group(6),
                'size': match.group(7),
                'referer': match.group(8),
                'user_agent': match.group(9),
                'format': 'apache'
            }
        return None
        
    def _parse_nginx(self, line):
        """Parse Nginx access log"""
        match = re.search(self.NGINX_PATTERN, line)
        if match:
            return {
                'ip': match.group(1),
                'user': match.group(2),
                'timestamp': match.group(3),
                'method': match.group(4).split()[0],
                'path': match.group(5),
                'status': match.group(6),
                'size': match.group(7),
                'referer': match.group(8),
                'user_agent': match.group(9),
                'format': 'nginx'
            }
        return None
        
    def _parse_python(self, line):
        """Parse Python log output"""
        match = re.search(self.PYTHON_PATTERN, line)
        if match:
            level = match.group(3).upper()
            return {
                'file': match.group(1),
                'line': match.group(2),
                'level': level,
                'message': match.group(4),
                'format': 'python'
            }
        return None
        
    def _parse_generic(self, line):
        """Parse generic log line"""
        return {
            'raw': line,
            'format': 'generic'
        }
        
    def analyze(self):
        """Extract statistics from parsed logs"""
        self.parse()
        
        for log in self.parsed_logs:
            if 'status' in log:
                self.status_codes[log['status']] += 1
            if 'ip' in log:
                self.ips[log['ip']] += 1
            if 'level' in log and log['level'] in ('ERROR', 'CRITICAL', 'WARNING'):
                self.errors[log['level']] += 1
                
    def get_summary(self):
        """Return analysis summary"""
        return {
            'total_lines': len(self.lines),
            'parsed_lines': len(self.parsed_logs),
            'status_codes': dict(self.status_codes.most_common(10)),
            'top_ips': dict(self.ips.most_common(10)),
            'error_count': dict(self.errors),
            'error_rate': f"{(len([x for x in self.parsed_logs if 'status' in x and x['status'].startswith('4') or x['status'].startswith('5')]) / len(self.parsed_logs) * 100):.2f}%" if self.parsed_logs else "0%"
        }
        
    def filter_by_status(self, status_code):
        """Filter logs by HTTP status code"""
        return [log for log in self.parsed_logs if log.get('status') == str(status_code)]
        
    def filter_by_ip(self, ip):
        """Filter logs by IP address"""
        return [log for log in self.parsed_logs if log.get('ip') == ip]
        
    def export_json(self, output_file):
        """Export analysis to JSON"""
        data = {
            'summary': self.get_summary(),
            'logs': self.parsed_logs
        }
        with open(output_file, 'w') as f:
            json.dump(data, f, indent=2)
            
    def export_csv(self, output_file):
        """Export logs to CSV"""
        if not self.parsed_logs:
            return
        keys = set()
        for log in self.parsed_logs:
            keys.update(log.keys())
        keys = sorted(list(keys))
        
        with open(output_file, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            writer.writerows(self.parsed_logs)


def main():
    parser = argparse.ArgumentParser(
        description='Analyze log files - supports Apache, Nginx, Python logs',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  log-analyzer access.log                    # Auto-detect format
  log-analyzer access.log --format nginx     # Specify Nginx format
  log-analyzer app.log --format python       # Python log format
  log-analyzer access.log --status 500       # Filter by status code
  log-analyzer access.log --ip 192.168.1.1   # Filter by IP
  log-analyzer access.log --output summary.json  # Export analysis
  log-analyzer access.log --csv report.csv   # Export as CSV
  log-analyzer access.log --top-ips 20       # Show top 20 IPs
  log-analyzer access.log --verbose          # Show detailed output
        '''
    )
    
    parser.add_argument('logfile', help='Path to log file')
    parser.add_argument('--format', choices=['auto', 'apache', 'nginx', 'python', 'generic'],
                        default='auto', help='Log format (default: auto)')
    parser.add_argument('--status', type=str, help='Filter by HTTP status code')
    parser.add_argument('--ip', type=str, help='Filter by IP address')
    parser.add_argument('--output', type=str, help='Export analysis to JSON')
    parser.add_argument('--csv', type=str, help='Export logs to CSV')
    parser.add_argument('--top-ips', type=int, default=10, help='Show top N IPs')
    parser.add_argument('--verbose', action='store_true', help='Verbose output')
    parser.add_argument('--version', action='version', version='log-analyzer 1.0.0')
    
    args = parser.parse_args()
    
    try:
        analyzer = LogAnalyzer(args.logfile, args.format)
        analyzer.analyze()
        
        if args.status:
            results = analyzer.filter_by_status(args.status)
            print(f"Found {len(results)} logs with status {args.status}")
            if args.verbose:
                for log in results[:5]:
                    print(f"  {log}")
                    
        elif args.ip:
            results = analyzer.filter_by_ip(args.ip)
            print(f"Found {len(results)} logs from IP {args.ip}")
            if args.verbose:
                for log in results[:5]:
                    print(f"  {log}")
                    
        else:
            summary = analyzer.get_summary()
            print(f"\n📊 Log Analysis Summary")
            print(f"   Total lines: {summary['total_lines']}")
            print(f"   Parsed lines: {summary['parsed_lines']}")
            print(f"   Error rate: {summary['error_rate']}")
            
            if summary['status_codes']:
                print(f"\n📈 Top Status Codes:")
                for status, count in summary['status_codes'].items():
                    print(f"   {status}: {count}")
                    
            if summary['top_ips']:
                print(f"\n🌐 Top {args.top_ips} IPs:")
                for ip, count in list(summary['top_ips'].items())[:args.top_ips]:
                    print(f"   {ip}: {count} requests")
                    
            if summary['error_count']:
                print(f"\n⚠️  Error Summary:")
                for level, count in summary['error_count'].items():
                    print(f"   {level}: {count}")
        
        if args.output:
            analyzer.export_json(args.output)
            print(f"\n✅ Analysis exported to {args.output}")
            
        if args.csv:
            analyzer.export_csv(args.csv)
            print(f"✅ Logs exported to {args.csv}")
            
    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
