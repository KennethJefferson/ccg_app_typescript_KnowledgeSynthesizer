---
name: extractor-pptx
description: Extract PowerPoint presentation content to text/markdown format for LLM processing and content synthesis. Use when processing .pptx files from course materials that need to be converted to text formats for analysis, synthesis, or inclusion in LLM context windows. Routed from file-identifier.
---

# PowerPoint Content Extractor

Extract PowerPoint presentation content to text/markdown format for LLM-based content synthesis.

## Quick Start

```bash
# Extract to markdown (recommended)
python scripts/pptx_extract.py presentation.pptx

# Extract to plain text
python scripts/pptx_extract.py presentation.pptx -f txt

# Include speaker notes
python scripts/pptx_extract.py presentation.pptx --notes

# Batch process directory
python scripts/pptx_extract.py --dir /path/to/presentations -o ./extracted
```

## Output Formats

| Format | Best For | File Extension |
|--------|----------|----------------|
| Markdown | LLM context, preserves structure | `.md` |
| Plain text | Simple text processing | `.txt` |

## Common Workflows

### Course Material Extraction
```bash
# Extract all course presentations
python scripts/pptx_extract.py --dir /course/slides -o ./extracted
```

### With Speaker Notes
```bash
# Include speaker notes for full context
python scripts/pptx_extract.py lecture.pptx --notes
```

## CLI Reference

```
python scripts/pptx_extract.py PRESENTATION [OPTIONS]

Arguments:
  PRESENTATION          Path to PowerPoint file (.pptx)

Options:
  -o, --output PATH     Output file/directory (default: same as input)
  -f, --format FORMAT   md|txt (default: md)
  -d, --dir PATH        Process directory of presentations
  -r, --recursive       Recursive directory scan
  --notes               Include speaker notes
  -q, --quiet           Suppress progress output
```

## Output Structure

Single file:
```
presentation.pptx → presentation.md
```

Directory:
```
extracted/
├── lecture1.md
├── lecture2.md
└── overview.md
```

## Output Format

```markdown
# Presentation Title

## Slide 1: Introduction

- Bullet point 1
- Bullet point 2

> Speaker Notes: Additional context provided by instructor...

## Slide 2: Overview

Content from slide 2...
```

## Extraction Method

Uses `markitdown` for extraction:
```bash
python -m markitdown presentation.pptx
```

Or programmatically:
```python
from markitdown import MarkItDown

md = MarkItDown()
result = md.convert("presentation.pptx")
print(result.text_content)
```

## Dependencies

- Python 3.8+
- markitdown

## Notes

- Images are not extracted (use extractor-image if needed)
- Animations and transitions are not captured
- Complex SmartArt may be simplified
- Speaker notes require `--notes` flag
