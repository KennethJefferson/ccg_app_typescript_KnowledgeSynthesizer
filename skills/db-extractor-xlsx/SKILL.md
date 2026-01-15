---
name: db-extractor-xlsx
description: Extract Excel spreadsheet content to CSV format for LLM processing and content synthesis. Use when working with Excel files (.xlsx, .xls, .xlsm) from course materials or datasets that need to be converted to text formats for analysis, synthesis, or inclusion in LLM context windows. Routed from db-router skill via db-identify.
---

# Spreadsheet Content Extractor

Extract Excel spreadsheet sheets to CSV format for LLM-based content synthesis.

## Quick Start

```bash
# Extract all sheets to CSV (default)
python scripts/xlsx_extract.py workbook.xlsx

# Extract specific sheets
python scripts/xlsx_extract.py workbook.xlsx --sheets "Sheet1,Data"

# Extract to specific output directory
python scripts/xlsx_extract.py workbook.xlsx -o ./output
```

## Output Format

| Format | Best For | File Extension |
|--------|----------|----------------|
| CSV | Data analysis, LLM context, text processing | `.csv` |

Each sheet becomes a separate CSV file: `{sheet_name}.csv`

## Common Workflows

### Course Material Extraction
```bash
# Extract course workbook for synthesis
python scripts/xlsx_extract.py course_data.xlsx -o ./course_content
```

### Selective Sheet Extraction
```bash
# Only specific sheets
python scripts/xlsx_extract.py workbook.xlsx --sheets "Revenue,Expenses,Summary"

# Exclude sheets
python scripts/xlsx_extract.py workbook.xlsx --exclude "Chart Data,Scratch"
```

### Large Workbook Handling
```bash
# Skip empty sheets automatically
python scripts/xlsx_extract.py large_workbook.xlsx --skip-empty
```

## CLI Reference

```
python scripts/xlsx_extract.py SPREADSHEET [OPTIONS]

Arguments:
  SPREADSHEET           Path to Excel file (.xlsx, .xls, .xlsm)

Options:
  -o, --output DIR      Output directory (default: same as input file)
  --sheets SHEETS       Comma-separated sheet list
  --exclude SHEETS      Sheets to skip
  --skip-empty          Skip sheets with no data
  -q, --quiet           Suppress progress output
```

## Output Structure

```
output/
├── Sheet1.csv
├── Sheet2.csv
└── Data.csv
```

Files are named after their sheet names (sanitized for filesystem).

## Dependencies

- Python 3.8+
- pandas
- openpyxl (for .xlsx)
- xlrd (for .xls, optional)

## Notes

- Formulas are extracted as their calculated values, not the formula text
- Merged cells are handled by filling the merged range with the value
- Empty rows/columns at edges are trimmed
- Date values are converted to ISO format strings
