#!/usr/bin/env python3
"""
Spreadsheet Content Extractor

Extracts Excel spreadsheet sheets to CSV format for use in LLM-based content synthesis.

Primary use case: Course material spreadsheets -> readable CSV for synthesis

Usage:
    python xlsx_extract.py workbook.xlsx                    # Extract all sheets
    python xlsx_extract.py workbook.xlsx -o ./output        # Specify output dir
    python xlsx_extract.py workbook.xlsx --sheets "Sheet1,Data"  # Specific sheets
"""

import argparse
import re
import sys
from pathlib import Path
from typing import Optional

try:
    import pandas as pd
except ImportError:
    print("ERROR: pandas is required. Install with: pip install pandas openpyxl", file=sys.stderr)
    sys.exit(1)


def sanitize_filename(name: str) -> str:
    """Sanitize sheet name for use as filename."""
    # Replace invalid characters with underscores
    sanitized = re.sub(r'[<>:"/\\|?*]', '_', name)
    # Remove leading/trailing whitespace and dots
    sanitized = sanitized.strip().strip('.')
    # Limit length
    return sanitized[:100] if sanitized else "unnamed_sheet"


def get_sheet_names(file_path: Path) -> list[str]:
    """Get list of all sheet names in workbook."""
    xlsx = pd.ExcelFile(file_path)
    return xlsx.sheet_names


def is_sheet_empty(df: pd.DataFrame) -> bool:
    """Check if dataframe is effectively empty."""
    if df.empty:
        return True
    # Check if all values are NaN
    return df.dropna(how='all').dropna(axis=1, how='all').empty


def export_sheet_to_csv(file_path: Path, sheet_name: str, output_dir: Path) -> Optional[Path]:
    """Export a single sheet to CSV file."""
    try:
        # Read sheet with data_only equivalent (pandas reads values, not formulas)
        df = pd.read_excel(file_path, sheet_name=sheet_name, engine='openpyxl')

        # Clean up: drop completely empty rows and columns
        df = df.dropna(how='all').dropna(axis=1, how='all')

        if df.empty:
            return None

        # Create sanitized filename
        safe_name = sanitize_filename(sheet_name)
        output_file = output_dir / f"{safe_name}.csv"

        # Export to CSV
        df.to_csv(output_file, index=False, encoding='utf-8')

        return output_file
    except Exception as e:
        print(f"  WARNING: Failed to export sheet '{sheet_name}': {e}", file=sys.stderr)
        return None


def main():
    parser = argparse.ArgumentParser(
        description="Extract Excel spreadsheet sheets to CSV format",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Extract all sheets to CSV
  python xlsx_extract.py workbook.xlsx

  # Extract to specific output directory
  python xlsx_extract.py workbook.xlsx -o ./output

  # Extract specific sheets only
  python xlsx_extract.py workbook.xlsx --sheets "Revenue,Expenses"

  # Skip empty sheets
  python xlsx_extract.py workbook.xlsx --skip-empty
        """
    )

    parser.add_argument("spreadsheet", help="Path to Excel file (.xlsx, .xls, .xlsm)")
    parser.add_argument("-o", "--output",
                        help="Output directory (default: same directory as spreadsheet)")
    parser.add_argument("--sheets",
                        help="Comma-separated list of sheets (default: all)")
    parser.add_argument("--exclude",
                        help="Comma-separated list of sheets to exclude")
    parser.add_argument("--skip-empty", action="store_true",
                        help="Skip sheets with no data")
    parser.add_argument("-q", "--quiet", action="store_true",
                        help="Suppress progress output")

    args = parser.parse_args()

    def log(msg):
        if not args.quiet:
            print(msg)

    try:
        file_path = Path(args.spreadsheet)

        if not file_path.exists():
            print(f"ERROR: File not found: {file_path}", file=sys.stderr)
            sys.exit(1)

        log(f"Opening: {file_path}")

        # Get all sheet names
        all_sheets = get_sheet_names(file_path)

        if args.sheets:
            sheets = [s.strip() for s in args.sheets.split(",")]
            sheets = [s for s in sheets if s in all_sheets]
        else:
            sheets = all_sheets

        if args.exclude:
            exclude = [s.strip() for s in args.exclude.split(",")]
            sheets = [s for s in sheets if s not in exclude]

        if not sheets:
            print("No sheets found to export", file=sys.stderr)
            sys.exit(1)

        log(f"Found {len(sheets)} sheets: {', '.join(sheets)}")

        # Create output directory
        if args.output:
            output_dir = Path(args.output)
        else:
            output_dir = file_path.parent
        output_dir.mkdir(parents=True, exist_ok=True)

        # Export each sheet
        exported = 0
        skipped = 0

        for sheet_name in sheets:
            # Check if empty before exporting (if skip-empty flag set)
            if args.skip_empty:
                df = pd.read_excel(file_path, sheet_name=sheet_name, engine='openpyxl')
                if is_sheet_empty(df):
                    log(f"  {sheet_name} (skipped - empty)")
                    skipped += 1
                    continue

            output_file = export_sheet_to_csv(file_path, sheet_name, output_dir)

            if output_file:
                log(f"  {sheet_name} -> {output_file.name}")
                exported += 1
            else:
                log(f"  {sheet_name} (skipped - empty or error)")
                skipped += 1

        log(f"\nExtracted {exported} sheets to: {output_dir}")
        if skipped:
            log(f"Skipped {skipped} sheets (empty or errors)")

    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
