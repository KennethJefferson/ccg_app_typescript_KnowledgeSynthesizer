---
name: extractor-docx
description: Extract Word document content to text/markdown format for LLM processing and content synthesis. Use when processing .docx files from course materials that need to be converted to text formats for analysis, synthesis, or inclusion in LLM context windows. Routed from file-identifier.
---

# Word Document Content Extractor

Extract Word document content to text/markdown format for LLM-based content synthesis.

## Quick Start

```bash
# Extract to markdown (recommended)
python scripts/docx_extract.py document.docx

# Extract to plain text
python scripts/docx_extract.py document.docx -f txt

# Batch process directory
python scripts/docx_extract.py --dir /path/to/docs -o ./extracted
```

## Output Formats

| Format | Best For | File Extension |
|--------|----------|----------------|
| Markdown | LLM context, preserves structure | `.md` |
| Plain text | Simple text processing | `.txt` |

## Common Workflows

### Course Material Extraction
```bash
# Extract all course documents
python scripts/docx_extract.py --dir /course/materials -o ./extracted
```

### Single Document
```bash
# Extract with structure preserved
python scripts/docx_extract.py syllabus.docx -o syllabus.md
```

## CLI Reference

```
python scripts/docx_extract.py DOCUMENT [OPTIONS]

Arguments:
  DOCUMENT              Path to Word document (.docx)

Options:
  -o, --output PATH     Output file/directory (default: same as input)
  -f, --format FORMAT   md|txt (default: md)
  -d, --dir PATH        Process directory of documents
  -r, --recursive       Recursive directory scan
  -q, --quiet           Suppress progress output
```

## Output Structure

Single file:
```
document.docx → document.md
```

Directory:
```
extracted/
├── chapter1.md
├── chapter2.md
└── syllabus.md
```

## Extraction Method

Uses `pandoc` for high-quality conversion:
```bash
pandoc -f docx -t markdown document.docx -o output.md
```

Pandoc preserves:
- Headings and structure
- Lists (bulleted, numbered)
- Tables
- Bold/italic formatting
- Links

## Dependencies

- pandoc (command-line tool)
- Python 3.8+

## Notes

- Images are not extracted (use extractor-image if needed)
- Comments and tracked changes can be included with `--track-changes=all`
- Complex formatting may be simplified in markdown output
