#!/usr/bin/env python3
"""
JSON Schema Generator & Validator Tool
Converts sample JSON to schema, validates instances against schema.
Saves hours for API developers, data engineers.
Sellable on Gumroad ($19.99), Fiverr ($25-75/gig), productize as SaaS.

Usage:
  python json_schema_generator.py --input data.json --output schema.json
  python json_schema_generator.py --validate schema.json --test data.json
"""

import json
import sys
import argparse
from typing import Any, Dict, List

class JSONSchemaGenerator:
    def __init__(self):
        self.schema = {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object",
            "properties": {},
            "required": []
        }
    
    def infer_type(self, value: Any) -> str:
        """Infer JSON schema type from Python value."""
        if isinstance(value, bool):
            return "boolean"
        elif isinstance(value, int):
            return "integer"
        elif isinstance(value, float):
            return "number"
        elif isinstance(value, str):
            return "string"
        elif isinstance(value, list):
            return "array"
        elif isinstance(value, dict):
            return "object"
        elif value is None:
            return "null"
        return "string"
    
    def generate_schema(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate JSON schema from sample JSON object."""
        properties = {}
        required = list(data.keys())
        
        for key, value in data.items():
            prop_type = self.infer_type(value)
            
            if prop_type == "array" and value:
                # Infer array item type
                item_type = self.infer_type(value[0])
                properties[key] = {
                    "type": "array",
                    "items": {"type": item_type},
                    "minItems": 1
                }
            elif prop_type == "object":
                # Recursive schema generation
                nested_schema = self.generate_schema(value)
                properties[key] = {
                    "type": "object",
                    "properties": nested_schema["properties"]
                }
            else:
                properties[key] = {"type": prop_type}
        
        return {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object",
            "properties": properties,
            "required": required,
            "additionalProperties": False
        }
    
    def validate(self, schema: Dict[str, Any], instance: Dict[str, Any]) -> tuple[bool, List[str]]:
        """Validate instance against schema. Returns (valid, errors)."""
        errors = []
        
        # Check required fields
        required = schema.get("required", [])
        for field in required:
            if field not in instance:
                errors.append(f"Missing required field: {field}")
        
        # Check properties
        properties = schema.get("properties", {})
        for key, value in instance.items():
            if key not in properties:
                if not schema.get("additionalProperties", True):
                    errors.append(f"Additional property not allowed: {key}")
                continue
            
            prop_schema = properties[key]
            expected_type = prop_schema.get("type")
            actual_type = self.infer_type(value)
            
            if expected_type != actual_type:
                errors.append(f"Field '{key}': expected {expected_type}, got {actual_type}")
        
        return len(errors) == 0, errors


def main():
    parser = argparse.ArgumentParser(description="JSON Schema Generator & Validator")
    parser.add_argument("--input", help="Input JSON file (generate schema from this)")
    parser.add_argument("--output", help="Output schema file")
    parser.add_argument("--validate", help="Schema file (validate mode)")
    parser.add_argument("--test", help="Test JSON file (validate against schema)")
    
    args = parser.parse_args()
    
    generator = JSONSchemaGenerator()
    
    if args.input and args.output:
        # Generate schema from sample
        with open(args.input, 'r') as f:
            data = json.load(f)
        
        schema = generator.generate_schema(data)
        
        with open(args.output, 'w') as f:
            json.dump(schema, f, indent=2)
        
        print(f"✓ Schema generated and saved to {args.output}")
    
    elif args.validate and args.test:
        # Validate instance against schema
        with open(args.validate, 'r') as f:
            schema = json.load(f)
        
        with open(args.test, 'r') as f:
            instance = json.load(f)
        
        valid, errors = generator.validate(schema, instance)
        
        if valid:
            print("✓ Validation passed!")
        else:
            print("✗ Validation failed:")
            for error in errors:
                print(f"  - {error}")
        
        sys.exit(0 if valid else 1)
    
    else:
        parser.print_help()


if __name__ == "__main__":
    main()