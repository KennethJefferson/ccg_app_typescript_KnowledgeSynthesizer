---
name: db-extractor-postgresql
description: Extract PostgreSQL database content to text-readable formats (CSV, JSON, Markdown) for LLM processing and content synthesis. Use when working with PostgreSQL databases that need to be converted to text formats for analysis, synthesis, or inclusion in LLM context windows. Routed from db-router skill.
---

# PostgreSQL Database Extractor

Extract PostgreSQL database tables to text-readable formats for LLM-based content synthesis.

## Quick Start

```bash
# Extract all tables to CSV (default)
python scripts/db_extract.py postgresql://user:password@localhost:5432/mydb

# Extract to JSON
python scripts/db_extract.py postgresql://user:password@localhost/mydb -f json

# Extract to Markdown (best for LLM context)
python scripts/db_extract.py postgresql://postgres:secret@localhost/course_db -f markdown

# All formats with schema documentation
python scripts/db_extract.py postgresql://user:pass@host/db -f all --schema -o ./output
```

## Connection String Format

```
postgresql://[user[:password]@]host[:port]/database
```

**Examples:**
- `postgresql://postgres:password@localhost:5432/mydb` - Full format
- `postgresql://postgres@localhost/mydb` - No password
- `postgresql://user:pass@db.example.com/production` - Remote host
- `postgres://user:pass@host/db` - Alternate scheme (also supported)

## Output Formats

| Format | Best For | File Extension |
|--------|----------|----------------|
| CSV | Data analysis, spreadsheets, pandas | `.csv` |
| JSON | Structured processing, APIs | `.json` |
| Markdown | LLM context, human reading | `.md` |

## Common Workflows

### Course Material Extraction
```bash
# Extract course DB with schema docs for context
python scripts/db_extract.py postgresql://postgres:pass@localhost/course_db -f markdown --schema -o ./course_content
```

### Selective Table Extraction
```bash
# Only specific tables
python scripts/db_extract.py postgresql://user:pass@host/db --tables users,posts,comments

# Exclude system tables
python scripts/db_extract.py postgresql://user:pass@host/db --exclude migrations,logs
```

### Large Database Handling
```bash
# Limit markdown rows for large tables
python scripts/db_extract.py postgresql://user:pass@host/db -f markdown --max-rows 50
```

### Schema-specific Extraction
```bash
# Extract from specific schema (default: public)
python scripts/db_extract.py postgresql://user:pass@host/db --db-schema analytics
```

## CLI Reference

```
python scripts/db_extract.py CONNECTION [OPTIONS]

Arguments:
  CONNECTION            PostgreSQL connection string: postgresql://user:pass@host:port/database

Options:
  -o, --output DIR      Output directory (default: current directory)
  -f, --format FORMAT   csv|json|markdown|all (default: csv)
  --tables TABLES       Comma-separated table list
  --exclude TABLES      Tables to skip
  --db-schema SCHEMA    PostgreSQL schema (default: public)
  --schema              Include _schema.md documentation
  --max-rows N          Row limit for markdown (default: 100)
  --timeout SECONDS     Connection timeout (default: 30)
  -q, --quiet           Suppress progress output
```

## Output Structure

```
output/
├── _schema.md          # Schema documentation (if --schema)
├── csv/                # (if format=all)
│   ├── table1.csv
│   └── table2.csv
├── json/
│   └── ...
└── markdown/
    └── ...
```

Single format outputs files directly to output directory without subdirectories.

## Dependencies

- Python 3.8+
- psycopg2-binary

```bash
pip install psycopg2-binary
```

## Filtered System Schemas

The following schemas are automatically excluded from extraction:
- `pg_catalog`
- `information_schema`
- `pg_toast`
