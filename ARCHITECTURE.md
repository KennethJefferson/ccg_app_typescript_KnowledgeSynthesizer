# KnowledgeSynthesizer v3 Architecture

CLI application using Bun/TypeScript with Claude Agent SDK to synthesize AI-generated content from course materials.

## Overview

```
CLI (Bun/TypeScript)
 │
 ├── Parse args: -i, -w, -o, -ccg
 │
 ├── Validate -ccg skill exists (fail early)
 │
 └── Worker Pool (-w workers, default 3)
       │
       ├── Worker 1 → Course A
       │     │
       │     ├── Read fileassets.txt
       │     ├── Extract directory listing (shared context)
       │     ├── Parse file entries
       │     │
       │     └── Subagent Pool (fixed: 5)
       │           │
       │           ├── File < 100K chars → 1 subagent
       │           │     └── file-identifier → extractor → output
       │           │
       │           └── File > 100K chars → N sequential subagents
       │                 └── chunk1 → chunk2 → ... → output
       │
       ├── Worker 2 → Course B
       └── Worker N → Course N
```

## CLI Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `-i, --input <paths...>` | Yes | Input directories (courses/projects). Accepts multiple. |
| `-w, --workers <count>` | No | Number of parallel workers (default: 3) |
| `-o, --output <path>` | No | Output directory. Default: `<course>/CODE/__cc_validated_files/` |
| `-ccg, --claude-code-generated <type>` | Yes | Content type to generate. Must match existing skill. |

### Examples

```bash
# Single course
bun run cli.ts -i "./C++ for Beginners" -ccg "SOP walkthrough"

# Multiple courses with custom workers
bun run cli.ts -i ./course1 ./course2 ./course3 -w 5 -ccg "Podcast"

# Custom output location
bun run cli.ts -i ./course -o ./generated -ccg "Project"
```

## Directory Structure

### Input (Course)

```
C++ for Beginners/
├── fileassets.txt          # Master file (required)
├── class01.srt
├── class02.srt
└── CODE/
    ├── Project01/
    │   ├── car.hpp
    │   ├── car.cpp
    │   └── car.sln
    └── Project02/
        └── ...
```

### Output

```
C++ for Beginners/
└── CODE/
    ├── __cc_validated_files/    # Generated content
    │   ├── project01_sop.md
    │   └── project02_sop.md
    └── __cc_processing_log/     # Logs
        ├── run_2025-01-15_143022.json
        └── errors.json
```

## fileassets.txt Format

Generated externally. Contains all course resources in a single file.

### Structure

```
This file is a merged representation...
Generated on: 2026-01-15 11:38:29

================================================================
Directory List
================================================================

├───1 - Introduction
│   ├───2. Welcome to the Course.srt
│   └───3. What Is the OpenAPI Specification.srt
├───CODE
│   └───Project01
│       ├───main.cpp
│       └───...

================================================================
Files
================================================================

================
File: "K:\courses\cpp\1 - Introduction\2. Welcome to the Course.srt"
================
1
00:00:00,000 --> 00:00:03,500
Welcome to the course...

================
File: "K:\courses\cpp\CODE\Project01\main.cpp"
================
#include <iostream>
int main() {
    return 0;
}
```

### Delimiters

| Element | Delimiter |
|---------|-----------|
| Major sections | `================================================================` |
| File entry start | `================\nFile: "` |
| File path | Quoted string after `File: ` |
| File content | Everything after second `================` until next file |

### Parsing Regex

```typescript
const FILE_PATTERN = /================\nFile: "([^"]+)"\n================\n([\s\S]*?)(?=\n================\nFile:|$)/g;
// Group 1: Absolute path
// Group 2: File content
```

## Chunking Strategy

### Thresholds

| Setting | Value |
|---------|-------|
| Max chars per chunk | 100,000 (~25K tokens) |
| Multi-chunk strategy | Sequential |

### File-Type Specific Chunkers

| File Type | Strategy |
|-----------|----------|
| `.srt` | Split by timestamp blocks |
| `.py`, `.ts`, `.cpp`, `.js` | AST-aware (function/class boundaries) |
| `.md`, `.txt` | Heading or paragraph boundaries |
| `.csv` | Row-based (keep header in each chunk) |
| `.json` | Top-level array elements |
| Default | Line-based |

### Chunk Interface

```typescript
interface FileChunk {
  path: string;           // Absolute path from fileassets.txt
  filename: string;       // Extracted filename
  extension: string;      // File extension
  content: string;        // Chunk content
  chunkIndex?: number;    // If multi-chunk: 0, 1, 2...
  totalChunks?: number;   // If multi-chunk: total count
}
```

## Worker Architecture

### Worker per Course (Option A)

Each worker is an independent Claude Code instance processing one course.

```typescript
interface WorkerConfig {
  workers: number;        // User-provided via -w (default: 3)
  fileSubagents: number;  // Fixed: 5
}
```

### Why This Design

- **Isolation**: No cross-course contamination possible
- **Tracking**: Easy to know when a course is complete
- **Debugging**: Isolated logs per course
- **Cost**: Marginal overhead vs. shared queue (~2%)

### Worker Flow

```
Worker (Course A)
 │
 ├── 1. Read fileassets.txt
 ├── 2. Extract directory listing (context for all subagents)
 ├── 3. Parse file entries
 ├── 4. For each file:
 │      │
 │      ├── Check size
 │      ├── If < 100K: spawn 1 subagent
 │      └── If > 100K: chunk → spawn N sequential subagents
 │
 └── 5. Collect results → __cc_validated_files/
```

## Subagent Flow

### Single File (< 100K chars)

```
Subagent
 │
 ├── Receives: directory listing + file chunk
 │
 ├── file-identifier (identify type)
 │     │
 │     ├── Database → db-identify → db-extractor-* → CSV
 │     ├── PDF → extractor-pdf → text/markdown
 │     ├── DOCX → extractor-docx → text/markdown
 │     ├── PPTX → extractor-pptx → text/markdown
 │     ├── HTML → extractor-html → markdown
 │     ├── Image → extractor-image → text
 │     ├── Code → passthrough (already text)
 │     └── Unknown → log warning, skip
 │
 └── Output to __cc_validated_files/
```

### Large File (> 100K chars)

```
Chunk 1 → Subagent → result1
              ↓ (context passed)
Chunk 2 → Subagent → result2
              ↓ (context passed)
Chunk 3 → Subagent → result3
              ↓
         Final merged result
```

Sequential processing preserves context between chunks.

## Skill Routing

### file-identifier Targets

| File Type | Route To |
|-----------|----------|
| `.db`, `.sqlite`, `.sqlite3` | db-identify → db-router |
| `.xlsx`, `.xls`, `.xlsm` | db-extractor-xlsx |
| `.pdf` | extractor-pdf |
| `.docx` | extractor-docx |
| `.pptx` | extractor-pptx |
| `.html`, `.htm` | extractor-html |
| `.png`, `.jpg`, `.jpeg`, `.gif` | extractor-image |
| `.zip`, `.rar`, `.7z`, `.tar.gz` | archive-extractor |
| `.srt`, `.txt`, `.md`, code files | passthrough (already text) |

### db-router Targets

| Database Type | Route To |
|---------------|----------|
| SQLite | db-extractor-sqlite |
| MySQL dump | db-extractor-mysql |
| PostgreSQL dump | db-extractor-postgresql |
| Excel | db-extractor-xlsx |

## Logging

### Log Location

```
<course>/CODE/__cc_processing_log/
├── run_<timestamp>.json    # Per-run log
└── errors.json             # Cumulative errors
```

### Log Schema

```typescript
interface RunLog {
  run_id: string;           // "2025-01-15_143022"
  started_at: string;       // ISO timestamp
  completed_at: string;     // ISO timestamp
  status: "success" | "completed_with_warnings" | "failed";
  files_processed: number;
  files_failed: number;
  warnings: Warning[];
  errors: Error[];
}

interface Warning {
  file: string;
  path: string;
  reason: "unsupported_format" | "extraction_failed" | "chunk_failed";
  message?: string;
}

interface Error {
  file: string;
  path: string;
  error: string;
  stack?: string;
}
```

### Console Output

- Progress: `[Worker 1] Processing: C++ for Beginners (45 files)`
- Warnings: `[WARN] Unsupported format: mystery.xyz`
- Errors: `[ERROR] Failed to process: corrupt.pdf`
- Completion: `[Worker 1] Complete: 43/45 files (2 warnings)`

## Error Handling

### Unsupported File Types

- Log warning (console + file)
- Continue processing other files
- Do not stop the worker

### Extraction Failures

- Log error with details
- Mark file as failed
- Continue processing

### Chunk Failures

- If chunk N fails, stop processing remaining chunks for that file
- Log partial completion
- Continue with other files

## -ccg Skill Validation

Before processing begins:

1. Parse -ccg argument
2. Look for matching skill in `skills/` directory
3. If not found: error and exit immediately
4. If found: proceed with processing

### Skill Matching

```typescript
// Exact match first
skills/ccg-<name>/SKILL.md

// Fallback: partial match
skills/*<name>*/SKILL.md

// Example: -ccg "SOP walkthrough" → skills/ccg-sop-walkthrough/SKILL.md
```

## Dependencies

### Runtime

- Bun 1.0+
- Claude Agent SDK
- TypeScript

### Python (for extraction scripts)

- Python 3.8+
- pandas
- openpyxl
- pdfplumber
- pytesseract
- markitdown
- pandoc (CLI)

## Skills Inventory

### File Identification

| Skill | Purpose | Scripts |
|-------|---------|---------|
| file-identifier | Entry point - identify file types | file_router.py |

### Document Extraction

| Skill | Purpose | Scripts |
|-------|---------|---------|
| extractor-pdf | PDF → text/markdown | pdf_extract.py |
| extractor-docx | Word → text/markdown | docx_extract.py |
| extractor-pptx | PowerPoint → text/markdown | pptx_extract.py |
| extractor-html | HTML → Markdown | html2markdown.py |
| extractor-image | Image → text (OCR) | image_ocr.py |

### Database Extraction

| Skill | Purpose | Scripts |
|-------|---------|---------|
| db-identify | Identify database type | db_identify.py |
| db-router | Route to correct extractor | db_route.py |
| db-extractor-sqlite | SQLite → CSV/JSON/MD | db_extract.py |
| db-extractor-mysql | MySQL → CSV/JSON/MD | db_extract.py |
| db-extractor-postgresql | PostgreSQL → CSV/JSON/MD | db_extract.py |
| db-extractor-xlsx | Excel → CSV | xlsx_extract.py |

### Archive Processing

| Skill | Purpose | Scripts |
|-------|---------|---------|
| archive-extractor | Extract archives | archive_extract.py |

### Content Synthesis (ccg-*)

| Skill | Purpose | Scripts |
|-------|---------|---------|
| ccg-project-discovery | Identify projects in validated files | SKILL.md only |
| ccg-project-architect | Extract architecture from large projects | SKILL.md only |
| ccg-project-generator | Generate code from validated content | SKILL.md only |
| ccg-project-maker | Orchestrator | SKILL.md only |
| ccg-sop-generator | Generate SOPs from course content | SKILL.md only |
| ccg-summary-generator | Generate summaries and study guides | SKILL.md only |

### Publishing

| Skill | Purpose | Scripts |
|-------|---------|---------|
| ccg-github-sync | Publish to GitHub | github_sync.py |

## Future Considerations

### Planned Skills

- ccg-podcast (Podcast script generation)
- ccg-exam (Exam/quiz generation)

### Potential Optimizations

- Parallel chunk processing (with merge step)
- Shared job queue for better load balancing
- Caching of extracted content
- Incremental processing (skip unchanged files)
