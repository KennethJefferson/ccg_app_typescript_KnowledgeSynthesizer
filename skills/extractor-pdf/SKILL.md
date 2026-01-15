---
name: extractor-pdf
description: Extract PDF document content to text/markdown format for LLM processing and content synthesis. Use when processing PDF files from course materials that need to be converted to text formats for analysis, synthesis, or inclusion in LLM context windows. Routed from file-identifier.
---

# PDF Content Extractor

Extract PDF document content to text/markdown format for LLM-based content synthesis.

## Quick Start

```bash
# Extract to markdown (recommended)
python scripts/pdf_extract.py document.pdf

# Extract to plain text
python scripts/pdf_extract.py document.pdf -f txt

# Extract tables to CSV
python scripts/pdf_extract.py document.pdf --tables

# Batch process directory
python scripts/pdf_extract.py --dir /path/to/pdfs -o ./extracted
```

## Output Formats

| Format | Best For | File Extension |
|--------|----------|----------------|
| Markdown | LLM context, preserves structure | `.md` |
| Plain text | Simple text processing | `.txt` |
| CSV | Tables extracted separately | `.csv` |

## Common Workflows

### Course Material Extraction
```bash
# Extract all course PDFs
python scripts/pdf_extract.py --dir /course/materials -o ./extracted
```

### PDF with Tables
```bash
# Extract text and tables separately
python scripts/pdf_extract.py data_report.pdf --tables -o ./output
```

### Scanned PDFs
```bash
# For scanned PDFs, use OCR mode
python scripts/pdf_extract.py scanned.pdf --ocr
```

## CLI Reference

```
python scripts/pdf_extract.py DOCUMENT [OPTIONS]

Arguments:
  DOCUMENT              Path to PDF file

Options:
  -o, --output PATH     Output file/directory (default: same as input)
  -f, --format FORMAT   md|txt (default: md)
  -d, --dir PATH        Process directory of PDFs
  -r, --recursive       Recursive directory scan
  --tables              Also extract tables to CSV
  --ocr                 Use OCR for scanned documents
  -q, --quiet           Suppress progress output
```

## Output Structure

Single file:
```
document.pdf → document.md
```

With tables:
```
output/
├── document.md
├── document_table_1.csv
└── document_table_2.csv
```

## Extraction Methods

### Text Extraction (pdfplumber)
```python
import pdfplumber

with pdfplumber.open("document.pdf") as pdf:
    text = ""
    for page in pdf.pages:
        text += page.extract_text() + "\n"
```

### Table Extraction (pdfplumber)
```python
with pdfplumber.open("document.pdf") as pdf:
    for page in pdf.pages:
        tables = page.extract_tables()
```

## Dependencies

- Python 3.8+
- pdfplumber
- pytesseract (for OCR mode)

## Notes

- Scanned PDFs require `--ocr` flag and tesseract installation
- Complex layouts may not extract perfectly
- Images are not extracted (use extractor-image if needed)
- Password-protected PDFs are not supported
