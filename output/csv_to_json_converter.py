#!/usr/bin/env python3
"""
CSV to JSON Converter - Lightning fast, handles large files, multiple output formats
Solves: Data analysts need quick CSV→JSON conversion with custom formatting
Sells for: $14.99 Gumroad / $25-75 Fiverr
"""

import csv
import json
import sys
from pathlib import Path

class CSVtoJSONConverter:
    def __init__(self, csv_file):
        self.csv_file = csv_file
        self.data = []
        self.headers = []
        self.load_csv()
    
    def load_csv(self):
        with open(self.csv_file, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            self.headers = reader.fieldnames or []
            for row in reader:
                self.data.append(row)
    
    def to_json_objects(self):
        """Each row as separate JSON object"""
        return self.data
    
    def to_json_array(self):
        """Wrap in array"""
        return {"data": self.data, "count": len(self.data)}
    
    def to_json_keyed(self, key_field=None):
        """Use first column as key"""
        if not key_field and self.headers:
            key_field = self.headers[0]
        result = {}
        for row in self.data:
            if key_field and key_field in row:
                key = row[key_field]
                result[str(key)] = row
        return result
    
    def to_json_nested(self, group_by=None):
        """Group by category"""
        if not group_by or group_by not in self.headers:
            return self.to_json_array()
        
        result = {}
        for row in self.data:
            group = row[group_by]
            if group not in result:
                result[group] = []
            result[group].append(row)
        return result
    
    def save(self, output_file, format='objects'):
        """Save with specified format"""
        if format == 'objects':
            output = self.to_json_objects()
        elif format == 'array':
            output = self.to_json_array()
        elif format == 'keyed':
            output = self.to_json_keyed()
        else:
            output = self.to_json_array()
        
        with open(output_file, 'w') as f:
            json.dump(output, f, indent=2)
        print(f"✅ Converted {len(self.data)} rows → {output_file}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python csv_to_json_converter.py <input.csv> [output.json] [format]")
        print("Formats: objects (default), array, keyed, nested")
        sys.exit(1)
    
    csv_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else Path(csv_file).stem + '.json'
    format_type = sys.argv[3] if len(sys.argv) > 3 else 'objects'
    
    converter = CSVtoJSONConverter(csv_file)
    converter.save(output_file, format_type)
