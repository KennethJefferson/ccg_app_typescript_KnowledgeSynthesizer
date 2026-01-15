#!/usr/bin/env python3
"""
PostgreSQL Database Content Extractor

Extracts PostgreSQL database tables to text-readable formats (CSV, JSON, Markdown)
for use in LLM-based content synthesis.

Primary use case: Course material databases -> readable text for synthesis

Usage:
    python db_extract.py postgresql://user:pass@localhost:5432/mydb
    python db_extract.py postgresql://user:pass@host/db -o ./output
    python db_extract.py postgresql://user:pass@host/db -f json
    python db_extract.py postgresql://user:pass@host/db -f markdown
    python db_extract.py postgresql://user:pass@host/db --tables users,posts
    python db_extract.py postgresql://user:pass@host/db --schema

Requires: pip install psycopg2-binary
"""

import argparse
import csv
import json
import sys
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse, unquote

try:
    import psycopg2
    from psycopg2 import Error as PostgreSQLError
except ImportError:
    print("ERROR: psycopg2 is required.", file=sys.stderr)
    print("Install with: pip install psycopg2-binary", file=sys.stderr)
    sys.exit(1)


# System schemas to exclude from extraction
SYSTEM_SCHEMAS = {"pg_catalog", "information_schema", "pg_toast"}


def parse_connection_string(uri: str) -> dict:
    """
    Parse PostgreSQL connection string.

    Format: postgresql://[user[:password]@]host[:port]/database

    Examples:
        postgresql://postgres:password@localhost:5432/mydb
        postgresql://postgres@localhost/mydb
        postgresql://user:pass@db.example.com/production
    """
    if not uri.startswith(("postgresql://", "postgres://")):
        raise ValueError(f"Invalid connection string. Expected postgresql://... got: {uri}")

    parsed = urlparse(uri)

    if not parsed.hostname:
        raise ValueError("Host is required in connection string")

    if not parsed.path or parsed.path == "/":
        raise ValueError("Database name is required in connection string")

    return {
        "host": parsed.hostname,
        "port": parsed.port or 5432,
        "user": unquote(parsed.username) if parsed.username else "postgres",
        "password": unquote(parsed.password) if parsed.password else "",
        "database": parsed.path.lstrip("/"),
    }


def get_connection(connection_string: str, timeout: int = 30):
    """Create PostgreSQL database connection."""
    config = parse_connection_string(connection_string)

    conn = psycopg2.connect(
        host=config["host"],
        port=config["port"],
        user=config["user"],
        password=config["password"],
        dbname=config["database"],
        connect_timeout=timeout,
    )

    return conn


def get_tables(conn, schema: str = "public") -> list[str]:
    """Get list of all user tables in database (excludes system tables)."""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = %s
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
    """, (schema,))
    tables = [row[0] for row in cursor.fetchall()]
    cursor.close()
    return tables


def get_schema(conn, table: str, schema: str = "public") -> list[dict]:
    """Get column info for a table from information_schema."""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT
            column_name,
            data_type,
            is_nullable,
            column_default
        FROM information_schema.columns
        WHERE table_schema = %s
          AND table_name = %s
        ORDER BY ordinal_position
    """, (schema, table))

    # Get primary key columns
    cursor.execute("""
        SELECT a.attname
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        JOIN pg_class c ON c.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE i.indisprimary
          AND n.nspname = %s
          AND c.relname = %s
    """, (schema, table))
    pk_columns = {row[0] for row in cursor.fetchall()}

    cursor.execute("""
        SELECT
            column_name,
            data_type,
            is_nullable,
            column_default
        FROM information_schema.columns
        WHERE table_schema = %s
          AND table_name = %s
        ORDER BY ordinal_position
    """, (schema, table))

    schema_info = []
    for row in cursor.fetchall():
        col_default = row[3] or ""
        schema_info.append({
            "name": row[0],
            "type": row[1],
            "nullable": row[2] == "YES",
            "primary_key": row[0] in pk_columns,
            "auto_increment": "nextval(" in col_default.lower() if col_default else False,
        })

    cursor.close()
    return schema_info


def get_row_count(conn, table: str, schema: str = "public") -> int:
    """Get row count for a table."""
    cursor = conn.cursor()
    cursor.execute(f'SELECT COUNT(*) FROM "{schema}"."{table}"')
    count = cursor.fetchone()[0]
    cursor.close()
    return count


def get_table_info(conn, table: str, schema: str = "public") -> dict:
    """Get additional table metadata."""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT pg_size_pretty(pg_total_relation_size(%s::regclass))
    """, (f"{schema}.{table}",))
    row = cursor.fetchone()
    cursor.close()

    if row:
        return {"size": row[0]}
    return {}


def export_to_csv(conn, table: str, output_dir: Path, schema: str = "public") -> Path:
    """Export table to CSV file."""
    output_file = output_dir / f"{table}.csv"

    cursor = conn.cursor()
    cursor.execute(f'SELECT * FROM "{schema}"."{table}"')
    columns = [desc[0] for desc in cursor.description]
    rows = cursor.fetchall()
    cursor.close()

    with open(output_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(columns)
        for row in rows:
            # Handle bytes/bytea data
            processed_row = []
            for cell in row:
                if isinstance(cell, (bytes, memoryview)):
                    processed_row.append(f"[BINARY:{len(cell)} bytes]")
                else:
                    processed_row.append(cell)
            writer.writerow(processed_row)

    return output_file


def export_to_json(conn, table: str, output_dir: Path, schema: str = "public") -> Path:
    """Export table to JSON file."""
    output_file = output_dir / f"{table}.json"

    cursor = conn.cursor()
    cursor.execute(f'SELECT * FROM "{schema}"."{table}"')
    columns = [desc[0] for desc in cursor.description]
    rows = cursor.fetchall()
    cursor.close()

    data = []
    for row in rows:
        record = {}
        for col, cell in zip(columns, row):
            if isinstance(cell, (bytes, memoryview)):
                record[col] = f"[BINARY:{len(cell)} bytes]"
            else:
                record[col] = cell
        data.append(record)

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, default=str)

    return output_file


def export_to_markdown(conn, table: str, output_dir: Path, schema: str = "public", max_rows: int = 100) -> Path:
    """Export table to Markdown file with table format."""
    output_file = output_dir / f"{table}.md"

    cursor = conn.cursor()
    cursor.execute(f'SELECT * FROM "{schema}"."{table}"')
    columns = [desc[0] for desc in cursor.description]
    rows = cursor.fetchall()
    cursor.close()

    total_rows = len(rows)
    display_rows = rows[:max_rows]

    lines = [f"# {table}", ""]

    # Add row count info
    lines.append(f"**Rows:** {total_rows}")
    if total_rows > max_rows:
        lines.append(f"*(showing first {max_rows} rows)*")
    lines.append("")

    # Create markdown table
    if columns and display_rows:
        # Header
        lines.append("| " + " | ".join(columns) + " |")
        lines.append("| " + " | ".join(["---"] * len(columns)) + " |")

        # Rows
        for row in display_rows:
            cells = []
            for cell in row:
                if isinstance(cell, (bytes, memoryview)):
                    cells.append(f"[BINARY:{len(cell)}B]")
                else:
                    # Escape pipes and truncate long content
                    cell_str = str(cell).replace("|", "\\|").replace("\n", " ")[:100]
                    cells.append(cell_str)
            lines.append("| " + " | ".join(cells) + " |")
    else:
        lines.append("*Empty table*")

    with open(output_file, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    return output_file


def export_schema_info(conn, tables: list[str], output_dir: Path, schema: str = "public") -> Path:
    """Export database schema as Markdown documentation."""
    output_file = output_dir / "_schema.md"

    # Get database name
    cursor = conn.cursor()
    cursor.execute("SELECT current_database()")
    db_name = cursor.fetchone()[0]
    cursor.close()

    lines = [f"# Database Schema: {db_name}", f"**Schema:** {schema}", ""]

    for table in tables:
        table_schema = get_schema(conn, table, schema)
        row_count = get_row_count(conn, table, schema)
        table_info = get_table_info(conn, table, schema)

        lines.append(f"## {table}")
        lines.append(f"**Rows:** {row_count}")
        if table_info.get("size"):
            lines.append(f"**Size:** {table_info['size']}")
        lines.append("")
        lines.append("| Column | Type | Nullable | Primary Key | Auto-Inc |")
        lines.append("| --- | --- | --- | --- | --- |")

        for col in table_schema:
            pk = "Yes" if col["primary_key"] else ""
            nullable = "Yes" if col["nullable"] else ""
            auto_inc = "Yes" if col["auto_increment"] else ""
            lines.append(f"| {col['name']} | {col['type']} | {nullable} | {pk} | {auto_inc} |")

        lines.append("")

    with open(output_file, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    return output_file


def main():
    parser = argparse.ArgumentParser(
        description="Extract PostgreSQL database content to text-readable formats",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Extract all tables to CSV (default)
  python db_extract.py postgresql://user:pass@localhost:5432/mydb

  # Extract to JSON format
  python db_extract.py postgresql://user:pass@localhost/mydb -f json

  # Extract to Markdown tables (good for LLM context)
  python db_extract.py postgresql://user:pass@localhost/mydb -f markdown

  # Extract specific tables only
  python db_extract.py postgresql://user:pass@localhost/mydb --tables lessons,quizzes

  # Include schema documentation
  python db_extract.py postgresql://user:pass@localhost/mydb --schema

  # All formats at once
  python db_extract.py postgresql://user:pass@localhost/mydb -f all --schema
        """
    )

    parser.add_argument("connection",
                        help="PostgreSQL connection string: postgresql://user:pass@host:port/database")
    parser.add_argument("-o", "--output",
                        help="Output directory (default: same directory as script invocation)")
    parser.add_argument("-f", "--format",
                        choices=["csv", "json", "markdown", "all"],
                        default="csv",
                        help="Output format (default: csv)")
    parser.add_argument("--tables",
                        help="Comma-separated list of tables (default: all)")
    parser.add_argument("--exclude",
                        help="Comma-separated list of tables to exclude")
    parser.add_argument("--db-schema", default="public",
                        help="PostgreSQL schema to extract from (default: public)")
    parser.add_argument("--schema", action="store_true",
                        help="Also export schema documentation")
    parser.add_argument("--max-rows", type=int, default=100,
                        help="Max rows for markdown format (default: 100)")
    parser.add_argument("--timeout", type=int, default=30,
                        help="Connection timeout in seconds (default: 30)")
    parser.add_argument("-q", "--quiet", action="store_true",
                        help="Suppress progress output")

    args = parser.parse_args()

    def log(msg):
        if not args.quiet:
            print(msg)

    try:
        # Connect to database
        masked_conn = args.connection.split('@')[0].split(':')[0] + "://***@" + args.connection.split('@')[-1]
        log(f"Connecting: {masked_conn}")
        conn = get_connection(args.connection, timeout=args.timeout)

        # Get tables
        all_tables = get_tables(conn, args.db_schema)

        if args.tables:
            tables = [t.strip() for t in args.tables.split(",")]
            tables = [t for t in tables if t in all_tables]
        else:
            tables = all_tables

        if args.exclude:
            exclude = [t.strip() for t in args.exclude.split(",")]
            tables = [t for t in tables if t not in exclude]

        if not tables:
            print("No tables found to export", file=sys.stderr)
            sys.exit(1)

        log(f"Found {len(tables)} tables: {', '.join(tables)}")

        # Create output directory - default to current directory if not specified
        output_dir = Path(args.output) if args.output else Path.cwd()
        output_dir.mkdir(parents=True, exist_ok=True)

        # Determine formats to export
        formats = ["csv", "json", "markdown"] if args.format == "all" else [args.format]

        # Export each table
        for table in tables:
            row_count = get_row_count(conn, table, args.db_schema)
            log(f"  {table} ({row_count} rows)")

            for fmt in formats:
                if fmt == "csv":
                    subdir = output_dir / "csv" if len(formats) > 1 else output_dir
                    subdir.mkdir(exist_ok=True)
                    export_to_csv(conn, table, subdir, args.db_schema)
                elif fmt == "json":
                    subdir = output_dir / "json" if len(formats) > 1 else output_dir
                    subdir.mkdir(exist_ok=True)
                    export_to_json(conn, table, subdir, args.db_schema)
                elif fmt == "markdown":
                    subdir = output_dir / "markdown" if len(formats) > 1 else output_dir
                    subdir.mkdir(exist_ok=True)
                    export_to_markdown(conn, table, subdir, args.db_schema, args.max_rows)

        # Export schema if requested
        if args.schema:
            schema_file = export_schema_info(conn, tables, output_dir, args.db_schema)
            log(f"  Schema -> {schema_file}")

        conn.close()
        log(f"\nExtracted to: {output_dir}")

    except ValueError as e:
        print(f"CONNECTION ERROR: {e}", file=sys.stderr)
        sys.exit(1)
    except PostgreSQLError as e:
        print(f"DATABASE ERROR: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
