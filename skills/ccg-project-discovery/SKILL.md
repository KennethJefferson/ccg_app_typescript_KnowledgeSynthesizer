---
name: ccg-project-discovery
description: Analyze validated course content (transcripts, code, databases, documents) to discover teachable projects. Use when you need to scan a course folder and identify what hands-on projects are taught, without generating any code. Outputs a manifest file that can be used later for selective project generation. Invoked via -ccg flag.
---

# Project Discovery Skill (Multi-Asset)

Analyze validated course content to discover and catalog projects taught in the course. Produces a manifest file (`project-findings.json`) that can be used for immediate or future project generation.

**This is the CCKnowledgeExtractor version** - it processes ALL validated file types, not just transcripts.

## Purpose

This skill scans the `__cc_validated_files/` directory and identifies hands-on coding projects that can be synthesized into working implementations. It leverages multiple content types for better discovery accuracy.

## When to Use

- At the start of course processing after file validation/extraction
- Scanning a course to see what projects it contains
- Creating a catalog before deciding which projects to generate
- Before running project generation

## Prerequisites

- Course must have been processed by CCKnowledgeExtractor
- `__cc_validated_files/` directory must exist with extracted content

## Supported File Types

| Type | Extensions | Weight | Description |
|------|------------|--------|-------------|
| `code` | `.py`, `.js`, `.ts`, `.rs`, `.go`, `.java`, `.cpp`, `.cs`, `.rb`, `.php` | high | Actual source code to replicate |
| `database` | `.csv`, `.json`, `.md` (from DB extraction) | high | Schema and data models |
| `transcript` | `.srt`, `.vtt`, `.txt` (parsed) | medium | Teaching context, explanations |
| `document` | `.md` (from PDF, DOCX, PPTX) | low | Supplementary documentation |
| `ocr` | `.txt`, `.md` (from images) | low | May have extraction errors |

## Output

Creates two files in the course root:

### progress.json (ALWAYS created first)

```json
{
  "status": "started",
  "started_at": "2024-01-15T10:30:00Z",
  "completed_at": null
}
```

After processing completes:

```json
{
  "status": "complete",
  "started_at": "2024-01-15T10:30:00Z",
  "completed_at": "2024-01-15T10:35:00Z"
}
```

### project-findings.json

```json
{
  "course_path": "/path/to/course",
  "discovered_at": "2024-01-15T10:30:00Z",
  "discovery_version": "2.0",
  "has_projects": true,
  "source_summary": {
    "total_files": 45,
    "by_type": {
      "code": 12,
      "database": 3,
      "transcript": 25,
      "document": 4,
      "ocr": 1
    }
  },
  "projects": [
    {
      "id": "proj_001",
      "name": "Job Portal Application",
      "synthesized_name": "Project_AdvancedJobPortal",
      "description": "Full-stack job portal with authentication...",
      "source_files": [
        { "path": "01_intro.srt", "type": "transcript", "weight": "medium" },
        { "path": "main.py", "type": "code", "weight": "high" },
        { "path": "schema_users.md", "type": "database", "weight": "high" }
      ],
      "tech_stack": ["Next.js", "TypeScript", "Prisma"],
      "complexity": "advanced",
      "generation_status": "not_started"
    }
  ],
  "skipped_files": ["readme.md", "course_overview.txt"],
  "no_project_reason": null
}
```

## Workflow

### Step 1: Check/Create Progress Tracking (CRITICAL - DO THIS FIRST)

Check for existing `progress.json` in the course root:

- **If status is "complete"**: Course already processed. Skip unless user explicitly requests re-run.
- **If status is "started"**: Previous run was interrupted. Clean up any partial `CODE/__CC_Projects/` folder and restart.
- **If no progress.json**: Create it **IMMEDIATELY** with status "started".

### Step 2: Scan Validated Files Directory

Scan `__cc_validated_files/` for all supported file types:

```bash
find __cc_validated_files -type f \( -name "*.srt" -o -name "*.py" -o -name "*.js" -o -name "*.ts" -o -name "*.md" -o -name "*.txt" -o -name "*.json" -o -name "*.csv" \)
```

Categorize each file by type based on:
1. File extension
2. Parent directory name (e.g., `db_extracts/`, `ocr_output/`)
3. File content patterns

### Step 3: Analyze Content by Type

**For CODE files (highest priority):**
- These are actual implementations from the course
- Extract function/class names, imports, patterns
- Use as primary source of truth for project structure

**For DATABASE extracts:**
- Extract table names, column definitions, relationships
- Use to define data models in generated projects

**For TRANSCRIPT files:**
- Parse for teaching context and explanations
- Identify project boundaries (start/end phrases)
- Extract concepts and feature descriptions

**For DOCUMENT files:**
- Supplementary information
- May contain diagrams described as text, additional context

**For OCR files:**
- Lower confidence due to potential extraction errors
- Use to supplement but don't rely on exclusively

### Step 4: Identify Projects

Look for project signals across ALL content types:

**From Code Files:**
- Multiple related files (same import patterns)
- Main entry points (`main.py`, `index.ts`, `App.jsx`)
- Package manifests (`package.json`, `requirements.txt`, `Cargo.toml`)

**From Transcripts:**
- "Let's build...", "We'll create...", "Start a new project"
- Framework initialization commands
- Progressive feature implementation

**From Database Extracts:**
- Related tables/schemas
- Foreign key relationships suggesting an application

### Step 5: Build Project Manifest

For each discovered project, record:

| Field | Description |
|-------|-------------|
| `id` | Unique identifier (e.g., `proj_001`) |
| `name` | Simple name from content |
| `synthesized_name` | Full name for folder (e.g., `Project_ReactJobPortal`) |
| `description` | 1-2 sentence description |
| `source_files` | Array of `{path, type, weight}` objects |
| `tech_stack` | Detected technologies |
| `complexity` | beginner / intermediate / advanced |
| `generation_status` | "not_started" |

### Step 6: Write Manifest and Update Progress

1. Write `project-findings.json`
2. Update `progress.json` to status "complete"

## File Type Detection

### By Extension

```
.py, .pyw           → code (Python)
.js, .jsx, .mjs     → code (JavaScript)
.ts, .tsx           → code (TypeScript)
.rs                 → code (Rust)
.go                 → code (Go)
.java               → code (Java)
.cpp, .c, .h, .hpp  → code (C/C++)
.cs                 → code (C#)
.rb                 → code (Ruby)
.php                → code (PHP)

.srt, .vtt          → transcript
.csv                → database
.json               → database (if in db_extracts/) or config
.md                 → document or database (check parent dir)
.txt                → transcript or ocr (check parent dir)
```

### By Parent Directory

```
db_extracts/        → database
ocr_output/         → ocr
transcripts/        → transcript
code_samples/       → code
```

## Weight Assignment

Weights determine priority during generation:

| Weight | File Types | Usage |
|--------|------------|-------|
| `high` | code, database | Primary source - use actual implementations |
| `medium` | transcript | Context and explanations |
| `low` | document, ocr | Supplementary information |

## Project Identification Signals

### Strong Positive Signals

**From Code:**
- Entry point files exist (`main.py`, `index.js`, `App.tsx`)
- Package manifest present
- Multiple related modules/components

**From Transcripts:**
- "Let's build...", "We'll create..."
- Framework initialization commands
- Progressive feature building

**From Database:**
- Related tables with foreign keys
- CRUD operation patterns evident

### Negative Signals (Skip)

- Pure theory without code
- Isolated utility scripts
- Configuration-only files
- Course intro/outro content

## Synthesized Name Format

Pattern: `Project_[Framework][CoreFeature][Distinguisher]`

Examples:
- `Project_ReactTodoWithLocalStorage`
- `Project_NodeExpressRestAPI`
- `Project_PythonFlaskBlogAuth`
- `Project_RustCLIPasswordManager`

Rules:
- Always prefix with `Project_`
- PascalCase throughout
- Primary framework/language first
- Main feature next
- Maximum 50 characters

## Complexity Assessment

| Level | Indicators |
|-------|------------|
| **Beginner** | Single module, basic CRUD, <5 source files, no auth |
| **Intermediate** | Multiple modules, state management, API integration, basic auth |
| **Advanced** | Complex architecture, multiple services, OAuth/JWT, real-time features |

## Important Notes

### DO NOT in Discovery Phase
- Create any project folders
- Generate any source code
- Write any files except `progress.json` and `project-findings.json`
- Modify or delete source files

### Multi-Asset Advantages
- Code files provide exact implementations to replicate
- Database schemas define accurate data models
- Transcripts provide context for "why" decisions were made
- Combined analysis produces higher-fidelity project specifications

### Be Conservative
- Only mark as project if there's clear buildable content
- Prefer fewer, well-defined projects over many fragments
- Group related files correctly across types
