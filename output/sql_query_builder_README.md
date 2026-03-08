# SQL Query Builder CLI

Build SQL queries interactively **without typing raw SQL**. Perfect for data analysts, developers, and anyone who needs to quickly construct SELECT, INSERT, UPDATE, or DELETE queries.

**No more syntax errors. No more memorizing SQL. Just simple command-line flags.**

## Features

✅ **SELECT queries** - Columns, WHERE, ORDER BY, LIMIT, JOINs  
✅ **INSERT queries** - Specify columns and values easily  
✅ **UPDATE queries** - Set multiple columns with WHERE conditions  
✅ **DELETE queries** - Safe deletion with required WHERE clause  
✅ **Multiple formats** - Text, JSON, Markdown  
✅ **Export to file** - Save queries for reuse  
✅ **Zero dependencies** - Pure Python stdlib  

## Installation

### Option 1: Direct Run
```bash
python sql_query_builder.py SELECT users -c id,name,email
```

### Option 2: Make it Global
```bash
chmod +x sql_query_builder.py
sudo cp sql_query_builder.py /usr/local/bin/sqlbuild
sqlbuild SELECT users --help
```

### Option 3: Install as Python Package
```bash
pip install git+https://github.com/yourusername/sql-query-builder
```

## Usage Examples

### SELECT Queries

**Simple SELECT all columns:**
```bash
python sql_query_builder.py SELECT users
```
**Output:**
```sql
SELECT *
FROM users
```

**SELECT specific columns with WHERE and LIMIT:**
```bash
python sql_query_builder.py SELECT users -c id,name,email -w "age > 21" -l 10
```
**Output:**
```sql
SELECT id, name, email
FROM users
WHERE age > 21
LIMIT 10
```

**SELECT with JOIN:**
```bash
python sql_query_builder.py SELECT orders -c orders.id,orders.total,users.name \
  --join "JOIN users ON orders.user_id = users.id" \
  -w "orders.total > 100" -o "orders.total DESC"
```
**Output:**
```sql
SELECT orders.id, orders.total, users.name
FROM orders
JOIN users ON orders.user_id = users.id
WHERE orders.total > 100
ORDER BY orders.total DESC
```

### INSERT Queries

**Insert a single record:**
```bash
python sql_query_builder.py INSERT users -c id,name,email,age -v 1 "John Doe" john@example.com 30
```
**Output:**
```sql
INSERT INTO users (id, name, email, age)
VALUES (1, 'John Doe', 'john@example.com', 30)
```

### UPDATE Queries

**Update with multiple SET clauses:**
```bash
python sql_query_builder.py UPDATE users -w "id = 5" -s name="Jane Smith" status="active" age=25
```
**Output:**
```sql
UPDATE users
SET name = 'Jane Smith', status = 'active', age = 25
WHERE id = 5
```

### DELETE Queries

**Delete with WHERE (safe - requires WHERE to prevent accidents):**
```bash
python sql_query_builder.py DELETE users -w "id = 999"
```
**Output:**
```sql
DELETE FROM users
WHERE id = 999
```

## All Options

```
Positional Arguments:
  operation              SELECT, INSERT, UPDATE, or DELETE
  table                  Table name

Common Options:
  -c, --columns          Comma-separated column names
  -w, --where            WHERE clause condition
  -o, --order-by         ORDER BY clause (e.g., "name ASC")
  -l, --limit            LIMIT number
  --join                 JOIN clause (e.g., "JOIN table ON condition")

INSERT Options:
  -v, --values           Values to insert (space-separated)

UPDATE Options:
  -s, --set              SET clause items (e.g., name=John age=30)

Output Options:
  -f, --output           Save query to file
  --format               Output format: text, json, or markdown
  -v, --verbose          Show detailed information
```

## Real-World Examples

### Data Analysis
```bash
# Get top 5 customers by spending
python sql_query_builder.py SELECT customers \
  -c id,name,total_spent \
  -w "status = 'active'" \
  -o "total_spent DESC" \
  -l 5 \
  --format markdown
```

### Backup Queries Before Deletion
```bash
# Build query, review it, then execute
python sql_query_builder.py DELETE old_logs \
  -w "created_date < '2023-01-01'" \
  --output delete_old_logs.sql

# Review the file, then execute it in your database
cat delete_old_logs.sql
mysql -u root mydb < delete_old_logs.sql
```

### Generate INSERT Scripts
```bash
# Build multiple INSERTs for migration
python sql_query_builder.py INSERT users \
  -c id,name,email -v 1 "Alice" alice@example.com \
  --format markdown > migration.md
```

## Why Use This?

🎯 **Faster Development** - Build queries 3x faster than typing SQL  
🎯 **Fewer Syntax Errors** - The CLI handles proper escaping  
🎯 **Learning Tool** - See how SQL queries are structured  
🎯 **Safe Deletions** - Forces WHERE clause to prevent accidents  
🎯 **Team Friendly** - Non-technical users can build complex queries  

## Limitations

- Complex subqueries not yet supported (coming soon)
- Window functions not included (consider for v2)
- For very complex queries, you'll still need raw SQL

## License

MIT - Use freely in commercial and personal projects.

## Contributing

Found a bug? Have a feature request? Submit an issue!

## Support This Project

If this tool saves you time, consider supporting:

🎉 **[Buy Me a Coffee](https://buymeacoffee.com/devdattareddy)** - Help me build more tools  
⭐ **GitHub Stars** - Star the repo to help others find it  
💬 **Share It** - Tell your developer friends!

---

**Made with ❤️ by DevData**
