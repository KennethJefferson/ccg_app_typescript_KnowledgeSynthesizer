#!/usr/bin/env python3
"""
PDF Content Extractor

Extracts PDF document content to text/markdown format for use in LLM-based content synthesis.

Primary use case: Course material PDFs -> readable text for synthesis

Usage:
    python pdf_extract.py document.pdf                    # Extract to markdown
    python pdf_extract.py document.pdf -f txt             # Extract to plain text
    python pdf_extract.py document.pdf --tables           # Also extract tables to CSV
    python pdf_extract.py document.pdf --ocr              # Use OCR for scanned docs
    python pdf_extract.py --dir /path/to/pdfs -o ./out    # Batch process directory
"""

import argparse
import csv
import sys
from pathlib import Path
from typing import Optional

try:
    import pdfplumber
except ImportError:
    print("ERROR: pdfplumber is required. Install with: pip install pdfplumber", file=sys.stderr)
    sys.exit(1)


def extract_text(pdf_path: Path) -> str:
    """Extract text content from PDF using pdfplumber."""
    text_parts = []

    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages):
            page_text = page.extract_text()
            if page_text:
                text_parts.append(f"## Page {i + 1}\n\n{page_text}")

    return "\n\n".join(text_parts)


def extract_text_ocr(pdf_path: Path) -> str:
    """Extract text from scanned PDF using OCR."""
    try:
        import pytesseract
        from pdf2image import convert_from_path
    except ImportError:
        print("ERROR: OCR requires pytesseract and pdf2image. Install with:", file=sys.stderr)
        print("  pip install pytesseract pdf2image", file=sys.stderr)
        sys.exit(1)

    text_parts = []
    images = convert_from_path(str(pdf_path))

    for i, image in enumerate(images):
        page_text = pytesseract.image_to_string(image)
        if page_text.strip():
            text_parts.append(f"## Page {i + 1}\n\n{page_text}")

    return "\n\n".join(text_parts)


def extract_tables(pdf_path: Path, output_dir: Path) -> list[Path]:
    """Extract tables from PDF to CSV files."""
    csv_files = []
    table_count = 0

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages):
            tables = page.extract_tables()
            for table_idx, table in enumerate(tables):
                if table and len(table) > 0:
                    table_count += 1
                    csv_path = output_dir / f"{pdf_path.stem}_table_{table_count}.csv"

                    with open(csv_path, "w", newline="", encoding="utf-8") as f:
                        writer = csv.writer(f)
                        for row in table:
                            # Clean up None values
                            cleaned_row = [cell if cell is not None else "" for cell in row]
                            writer.writerow(cleaned_row)

                    csv_files.append(csv_path)

    return csv_files


def process_file(pdf_path: Path, output_dir: Path, fmt: str, use_ocr: bool, extract_tbls: bool) -> dict:
    """Process a single PDF file."""
    result = {"text_file": None, "table_files": [], "error": None}

    try:
        # Extract text
        if use_ocr:
            text = extract_text_ocr(pdf_path)
        else:
            text = extract_text(pdf_path)

        if not text.strip():
            result["error"] = "No text extracted (try --ocr for scanned documents)"
            return result

        # Format output
        ext = ".md" if fmt == "md" else ".txt"
        output_path = output_dir / f"{pdf_path.stem}{ext}"

        if fmt == "md":
            content = f"# {pdf_path.stem}\n\n{text}"
        else:
            content = text

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)

        result["text_file"] = output_path

        # Extract tables if requested
        if extract_tbls:
            result["table_files"] = extract_tables(pdf_path, output_dir)

    except Exception as e:
        result["error"] = str(e)

    return result


def main():
    parser = argparse.ArgumentParser(
        description="Extract PDF document content to text/markdown format",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Extract to markdown (default)
  python pdf_extract.py document.pdf

  # Extract to plain text
  python pdf_extract.py document.pdf -f txt

  # Also extract tables to CSV
  python pdf_extract.py document.pdf --tables

  # Use OCR for scanned documents
  python pdf_extract.py scanned.pdf --ocr

  # Batch process directory
  python pdf_extract.py --dir /path/to/pdfs -o ./extracted
        """
    )

    parser.add_argument("document", nargs="?", help="Path to PDF file")
    parser.add_argument("-o", "--output",
                        help="Output file or directory")
    parser.add_argument("-f", "--format",
                        choices=["md", "txt"],
                        default="md",
                        help="Output format (default: md)")
    parser.add_argument("-d", "--dir",
                        help="Process directory of PDFs")
    parser.add_argument("-r", "--recursive", action="store_true",
                        help="Recursive directory scan")
    parser.add_argument("--tables", action="store_true",
                        help="Also extract tables to CSV")
    parser.add_argument("--ocr", action="store_true",
                        help="Use OCR for scanned documents")
    parser.add_argument("-q", "--quiet", action="store_true",
                        help="Suppress progress output")

    args = parser.parse_args()

    def log(msg):
        if not args.quiet:
            print(msg)

    # Determine input files
    if args.dir:
        input_dir = Path(args.dir)
        if not input_dir.exists():
            print(f"ERROR: Directory not found: {input_dir}", file=sys.stderr)
            sys.exit(1)

        pattern = "**/*.pdf" if args.recursive else "*.pdf"
        pdf_files = list(input_dir.glob(pattern))

        if not pdf_files:
            print("No .pdf files found", file=sys.stderr)
            sys.exit(1)

        log(f"Found {len(pdf_files)} PDFs")

        # Determine output directory
        output_dir = Path(args.output) if args.output else input_dir
        output_dir.mkdir(parents=True, exist_ok=True)

        # Process all files
        exported = 0
        failed = 0
        tables_extracted = 0

        for pdf_path in pdf_files:
            result = process_file(pdf_path, output_dir, args.format, args.ocr, args.tables)

            if result["text_file"]:
                log(f"  {pdf_path.name} -> {result['text_file'].name}")
                exported += 1
                tables_extracted += len(result["table_files"])
            else:
                log(f"  {pdf_path.name} - FAILED: {result['error']}")
                failed += 1

        log(f"\nExtracted {exported} PDFs to: {output_dir}")
        if tables_extracted:
            log(f"Tables extracted: {tables_extracted}")
        if failed:
            log(f"Failed: {failed} PDFs")

    elif args.document:
        pdf_path = Path(args.document)

        if not pdf_path.exists():
            print(f"ERROR: File not found: {pdf_path}", file=sys.stderr)
            sys.exit(1)

        # Determine output path
        if args.output:
            output_path = Path(args.output)
            if output_path.suffix in [".md", ".txt"]:
                output_dir = output_path.parent
            else:
                output_dir = output_path
        else:
            output_dir = pdf_path.parent

        output_dir.mkdir(parents=True, exist_ok=True)

        log(f"Extracting: {pdf_path.name}")
        result = process_file(pdf_path, output_dir, args.format, args.ocr, args.tables)

        if result["text_file"]:
            log(f"Output: {result['text_file']}")
            if result["table_files"]:
                log(f"Tables: {len(result['table_files'])} CSV files")
        else:
            print(f"ERROR: {result['error']}", file=sys.stderr)
            sys.exit(1)

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
