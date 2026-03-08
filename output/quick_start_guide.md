# JSON Schema Generator & Validator - Quick Start

## What It Does
Converts your sample JSON data into JSON Schema (saves hours of manual work). Also validates incoming JSON against your schema.

**Perfect for:**
- API developers (auto-document endpoints)
- Data engineers (validate CSV/JSON imports)
- Backend teams (enforce strict data contracts)

## Installation
```bash
python json_schema_generator.py --help
```

## Example 1: Generate Schema from Sample
```bash
# Input: sample_user.json
{
  "id": 123,
  "name": "Alice",
  "email": "alice@example.com",
  "active": true,
  "tags": ["admin", "user"]
}

# Run:
python json_schema_generator.py --input sample_user.json --output user_schema.json

# Output: user_schema.json (ready to use!)
```

## Example 2: Validate Incoming Data
```bash
# Validate new_user.json against user_schema.json
python json_schema_generator.py --validate user_schema.json --test new_user.json

# Output: ✓ Validation passed! (or error details)
```

## Use Cases
1. **API Documentation** - Auto-generate OpenAPI schemas
2. **Data Validation** - Reject malformed requests
3. **Integration Testing** - Ensure vendor APIs return correct shapes
4. **Configuration Files** - Validate YAML/JSON configs before deploy

## Pricing ($19.99 on Gumroad)
- Saves 2-4 hours per API project
- Used by 100+ developers = $2000 revenue potential
- Bundle with schema templates for $49.99
