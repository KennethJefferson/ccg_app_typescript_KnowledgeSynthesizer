---
name: ccg-project-maker
description: Orchestrator skill that transforms validated course content into complete, working code projects using AI-powered generation. Coordinates project-discovery, project-architect, and project-generator skills. Invoked via -ccg flag.
---

# Project Maker Skill

Transform validated course content into complete, working code projects using AI-powered generation.

## Purpose

The Project Maker is the crown jewel of CCKnowledgeExtractor. It synthesizes ALL validated file assets (code samples, database schemas, transcripts, documentation, OCR text) into production-ready project implementations that can be built and run immediately.

Unlike simple code extractors, Project Maker:
- **Uses Claude AI** via the Agent SDK for intelligent code generation
- **Understands context** across multiple source files with weighted priorities
- **Identifies teachable projects** from instructional content
- **Generates complete implementations** with all dependencies
- **Creates professional documentation** (README, USAGE, CHANGELOG, CLAUDE.md)
- **Handles large projects** via chunked generation with architecture extraction

## Implementation

**Runtime**: TypeScript/Bun (native, not Python)
**AI Engine**: Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)
**Authentication**: OAuth via Claude Code

### Three-Phase Pipeline

```
Discovery (project-discovery skill)
    │
    ▼
┌─────────────────────────────────────┐
│ Large project (>15 files)?          │
├───────────────┬─────────────────────┤
│ No            │ Yes                 │
│               ▼                     │
│           Architect                 │
│           (project-architect skill) │
│               │                     │
│               ▼                     │
│           Chunked                   │
│           Generation                │
└───────────────┼─────────────────────┘
                │
                ▼
         Generator (project-generator skill)
                │
                ▼
        CODE/__CC_Projects/<ProjectName>/
```

### Multi-Asset Weighting

| File Type | Weight | Priority | Usage |
|-----------|--------|----------|-------|
| Code | High | 1st | Primary source - exact implementations |
| Database | High | 2nd | Schema definitions - exact structures |
| Transcript | Medium | 3rd | Context and explanations |
| Document | Low | 4th | Supplementary information |
| OCR | Low | 5th | Additional context |

## Activation

Use the `-ccg` argument with any of these values:

| Phrase | Command |
|--------|---------|
| `Project` | `ccke -i ./courses -ccg Project` |
| `project` | `ccke -i ./courses -ccg project` |
| `Projects` | `ccke -i ./courses -ccg Projects` |
| `make` | `ccke -i ./courses -ccg make` |
| `synthesize` | `ccke -i ./courses -ccg synthesize` |
| `build-project` | `ccke -i ./courses -ccg build-project` |

## Input

Reads from: `<course>/CODE/__cc_validated_files/`

Supported file types (by priority):
- **Code Samples** (HIGH): `.py`, `.js`, `.ts`, `.rs`, `.go`, `.java`, `.cpp`, `.cs`, `.rb`, `.php`
- **Database Extracts** (HIGH): `.sql`, `.sqlite.md`, `.db.md`, database schema files
- **Transcripts** (MEDIUM): `.srt`, `.vtt` - Instructional context
- **Documentation** (LOW): `.md`, `.txt` - Supplementary guides
- **OCR Text** (LOW): Extracted text from images

## Output

Creates: `<course>/CODE/__CC_Projects/`

```
__CC_Projects/
├── project-findings.json    # Discovery manifest
│
├── Project_<Name1>/         # First discovered project
│   ├── README.md            # Project overview & setup
│   ├── USAGE.md             # Detailed usage guide
│   ├── CHANGELOG.md         # Version history
│   ├── CLAUDE.md            # AI assistant instructions
│   ├── .gitignore           # Standard ignores
│   ├── package.json         # Dependencies (if JS/TS)
│   ├── requirements.txt     # Dependencies (if Python)
│   ├── Cargo.toml           # Dependencies (if Rust)
│   ├── src/                 # Source code
│   │   └── ...
│   └── tests/               # Test files
│       └── ...
│
├── Project_<Name2>/         # Second discovered project
│   └── ...
│
└── architecture-<Name>.json # Architecture specs (large projects only)
```

## Discovery Phase

Uses the `project-discovery` skill to analyze validated content.

### Project Identification Signals

**Strong Positive Signals** (definitely a project):
- Actual code implementations in validated files
- Database schemas with tables and relationships
- "Let's build...", "We'll create...", "Start a new project"
- Framework initialization patterns
- Multiple related files building toward a goal

**Moderate Signals** (likely a project):
- Function/class implementations with real use cases
- Database schema definitions
- API endpoint implementations
- UI component building

**Negative Signals** (skip):
- Pure theory without implementation
- Syntax explanations with toy examples
- Course intro/outro content

### Multi-Asset Discovery

The discovery phase scans ALL file types and assigns weights:

```json
{
  "source_files": [
    {"path": "module1/app.py", "type": "code", "weight": "high"},
    {"path": "module1/schema.sql", "type": "database", "weight": "high"},
    {"path": "module1/lesson1.srt", "type": "transcript", "weight": "medium"},
    {"path": "module1/notes.md", "type": "document", "weight": "low"}
  ]
}
```

## Architecture Phase (Large Projects)

For projects with >15 source files, the `project-architect` skill extracts:

- Complete file structure with purposes
- Build order (dependency-aware)
- Component relationships
- Shared dependencies
- Tech stack details

This enables chunked generation where each chunk receives:
- The full architecture spec
- Its assigned source files
- Overlap files for context
- List of already-generated files

## Generation Phase

Uses the `project-generator` skill with Claude AI to create actual code.

### Code Quality Standards

1. **Type Safety**: Use TypeScript/type hints where applicable
2. **Error Handling**: Comprehensive error handling, no silent failures
3. **Documentation**: JSDoc/docstrings for public APIs
4. **Testing**: At least smoke tests for core functionality
5. **Security**: No hardcoded secrets, proper input validation

### File Generation Order

1. Configuration files (package.json, tsconfig, etc.)
2. Type definitions and interfaces
3. Core utilities and helpers
4. Data models and schemas
5. Business logic and services
6. Controllers/routes/handlers
7. UI components (if applicable)
8. Entry points and initialization
9. Tests
10. Documentation

## Chunked Generation

For large projects (>15 source files):

- **Chunk Size**: 10 files per chunk
- **Overlap**: 2 files between chunks for context continuity
- **Priority Order**: High-weight files processed first

Each chunk:
1. Receives the architecture spec
2. Knows which files already exist
3. Generates its assigned files
4. Reports progress

## Naming Conventions

### Project Names

Pattern: `Project_<Framework><Feature><Qualifier>`

Examples:
- `Project_RustPropertyManager`
- `Project_ReactJobPortal`
- `Project_PythonFlaskBlogAuth`
- `Project_NodeExpressRestAPI`

Rules:
- Always prefix with `Project_`
- PascalCase throughout
- Primary language/framework first
- Main feature/purpose next
- Optional qualifier for clarity
- Maximum 50 characters

## JSON Schemas

### project-findings.json

```json
{
  "course_path": "/path/to/course",
  "discovered_at": "2026-01-10T00:00:00Z",
  "discovery_version": "2.0",
  "has_projects": true,
  "projects": [
    {
      "id": "proj_001",
      "name": "Property Manager",
      "synthesized_name": "Project_RustPropertyManager",
      "description": "A Rust GUI application...",
      "source_files": [
        {"path": "mod1/main.rs", "type": "code", "weight": "high"},
        {"path": "mod1/schema.sql", "type": "database", "weight": "high"},
        {"path": "mod1/lesson1.srt", "type": "transcript", "weight": "medium"}
      ],
      "tech_stack": ["Rust", "Iced", "SQLite"],
      "complexity": "intermediate",
      "generation_status": "pending"
    }
  ],
  "no_project_reason": null
}
```

### architecture-<ProjectName>.json

```json
{
  "project_name": "Property Manager",
  "synthesized_name": "Project_RustPropertyManager",
  "tech_stack": ["Rust", "Iced", "SQLite"],
  "file_structure": [
    {
      "path": "src/main.rs",
      "purpose": "Application entry point",
      "dependencies": ["src/app.rs", "src/db.rs"]
    }
  ],
  "build_order": ["src/types.rs", "src/db.rs", "src/app.rs", "src/main.rs"],
  "shared_components": ["Database connection", "Message types"]
}
```

## Error Handling

### Graceful Degradation

If project generation fails partially:
1. Log the error
2. Continue with remaining projects
3. Mark failed project status
4. Report issues in final summary

### Common Issues

| Issue | Resolution |
|-------|------------|
| No projects found | Log reason, report no buildable content |
| Insufficient content | Generate partial with clear TODOs |
| Large project | Automatically use chunked generation |
| Chunk failure | Continue with remaining chunks, report partial |

## Best Practices

1. **Code files are authoritative** - Use exact implementations from source code
2. **Database schemas are exact** - Replicate structures precisely
3. **Transcripts provide context** - Use for understanding, not direct copying
4. **Group intelligently** - One project may span many lessons
5. **Make it runnable** - Generated projects should work after dependency install
6. **Be complete** - No placeholder functions or TODO-only files
