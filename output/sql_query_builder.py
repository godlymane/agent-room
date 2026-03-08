#!/usr/bin/env python3
"""
SQL Query Builder CLI - Interactive tool to build SQL queries without writing code.
Supports SELECT, INSERT, UPDATE, DELETE operations with a friendly command-line interface.
"""

import argparse
import json
import sys
from pathlib import Path
from typing import List, Dict, Any
import re


class SQLQueryBuilder:
    """Build SQL queries interactively from CLI arguments."""
    
    def __init__(self, operation: str, table: str):
        self.operation = operation.upper()
        self.table = table
        self.query_parts = {}
        
    def select(self, columns: List[str] = None, where: str = None, 
               order_by: str = None, limit: int = None, join: str = None) -> str:
        """Build SELECT query."""
        cols = ", ".join(columns) if columns else "*"
        query = f"SELECT {cols}\nFROM {self.table}"
        
        if join:
            query += f"\n{join}"
        if where:
            query += f"\nWHERE {where}"
        if order_by:
            query += f"\nORDER BY {order_by}"
        if limit:
            query += f"\nLIMIT {limit}"
            
        return query.strip()
    
    def insert(self, columns: List[str], values: List[str]) -> str:
        """Build INSERT query."""
        if len(columns) != len(values):
            raise ValueError("Number of columns must match number of values")
        
        cols = ", ".join(columns)
        vals = ", ".join([f"'{v}'" if not v.isdigit() else v for v in values])
        query = f"INSERT INTO {self.table} ({cols})\nVALUES ({vals})"
        return query.strip()
    
    def update(self, set_clause: Dict[str, Any], where: str) -> str:
        """Build UPDATE query."""
        set_parts = []
        for col, val in set_clause.items():
            if isinstance(val, str) and not val.isdigit():
                set_parts.append(f"{col} = '{val}'")
            else:
                set_parts.append(f"{col} = {val}")
        
        set_str = ", ".join(set_parts)
        query = f"UPDATE {self.table}\nSET {set_str}\nWHERE {where}"
        return query.strip()
    
    def delete(self, where: str) -> str:
        """Build DELETE query."""
        if not where:
            raise ValueError("WHERE clause is required for DELETE to prevent data loss")
        query = f"DELETE FROM {self.table}\nWHERE {where}"
        return query.strip()
    
    def build(self, **kwargs) -> str:
        """Route to appropriate builder method."""
        method = getattr(self, self.operation.lower())
        return method(**kwargs)


def format_output(query: str, format_type: str = "text") -> str:
    """Format query for output."""
    if format_type == "json":
        return json.dumps({"query": query}, indent=2)
    elif format_type == "markdown":
        return f"```sql\n{query}\n```"
    return query


def main():
    parser = argparse.ArgumentParser(
        description="Build SQL queries interactively without writing code.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Simple SELECT
  %(prog)s SELECT users -c id,name,email
  
  # SELECT with WHERE and ORDER BY
  %(prog)s SELECT users -c id,name -w "age > 21" -o "name ASC" -l 10
  
  # INSERT
  %(prog)s INSERT users -c id,name,email -v 1,"John Doe",john@example.com
  
  # UPDATE
  %(prog)s UPDATE users -w "id = 5" -s name="Jane Smith" status="active"
  
  # DELETE (requires WHERE)
  %(prog)s DELETE users -w "id = 999"
  
  # Output to file
  %(prog)s SELECT products -c * -o "name" --output query.sql
  
  # JSON format
  %(prog)s SELECT users --format json
        """
    )
    
    parser.add_argument("operation", choices=["SELECT", "INSERT", "UPDATE", "DELETE"],
                       help="SQL operation to perform")
    parser.add_argument("table", help="Table name")
    
    # SELECT options
    parser.add_argument("-c", "--columns", type=str, default=None,
                       help="Comma-separated column names (default: *)")
    parser.add_argument("-w", "--where", type=str,
                       help="WHERE clause (e.g. 'id > 5')")
    parser.add_argument("-o", "--order-by", type=str,
                       help="ORDER BY clause (e.g. 'name ASC')")
    parser.add_argument("-l", "--limit", type=int,
                       help="LIMIT clause")
    parser.add_argument("--join", type=str,
                       help="JOIN clause (e.g. 'JOIN orders ON users.id = orders.user_id')")
    
    # INSERT options
    parser.add_argument("-v", "--values", type=str, nargs="+",
                       help="Values for INSERT (space-separated)")
    
    # UPDATE options
    parser.add_argument("-s", "--set", type=str, nargs="+",
                       help="SET clause for UPDATE (e.g. name=John age=30)")
    
    # Output options
    parser.add_argument("--output", "-f", type=str,
                       help="Output file path")
    parser.add_argument("--format", choices=["text", "json", "markdown"],
                       default="text", help="Output format")
    parser.add_argument("-v", "--verbose", action="store_true",
                       help="Verbose output")
    
    args = parser.parse_args()
    
    try:
        builder = SQLQueryBuilder(args.operation, args.table)
        
        if args.operation == "SELECT":
            columns = args.columns.split(",") if args.columns else None
            query = builder.select(
                columns=columns,
                where=args.where,
                order_by=args.order_by,
                limit=args.limit,
                join=args.join
            )
        
        elif args.operation == "INSERT":
            if not args.columns or not args.values:
                parser.error("INSERT requires --columns and --values")
            columns = args.columns.split(",")
            values = args.values
            query = builder.insert(columns, values)
        
        elif args.operation == "UPDATE":
            if not args.where:
                parser.error("UPDATE requires --where")
            if not args.set:
                parser.error("UPDATE requires --set")
            set_dict = {}
            for item in args.set:
                if "=" not in item:
                    parser.error(f"Invalid SET format: {item}. Use key=value")
                k, v = item.split("=", 1)
                set_dict[k.strip()] = v.strip()
            query = builder.update(set_dict, args.where)
        
        elif args.operation == "DELETE":
            if not args.where:
                parser.error("DELETE requires --where (prevents accidental data loss)")
            query = builder.delete(args.where)
        
        # Format output
        output = format_output(query, args.format)
        
        if args.verbose:
            print(f"[Operation: {args.operation}] [Table: {args.table}]", file=sys.stderr)
        
        if args.output:
            Path(args.output).write_text(query)
            print(f"Query saved to {args.output}")
        else:
            print(output)
    
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
