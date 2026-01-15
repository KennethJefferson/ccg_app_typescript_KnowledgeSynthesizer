# Manifest Schema Reference (Multi-Asset)

Complete specification for `project-findings.json` file.

## Full Schema

```typescript
interface ProjectFindingsManifest {
  // Course identification
  course_path: string;           // Absolute path to course root
  discovered_at: string;         // ISO 8601 timestamp of discovery
  discovery_version: string;     // Schema version ("2.0" for multi-asset)

  // Source summary
  source_summary: {
    total_files: number;
    by_type: {
      code: number;
      database: number;
      transcript: number;
      document: number;
      ocr: number;
    };
  };

  // Discovery results
  has_projects: boolean;
  projects: ProjectEntry[];
  skipped_files: string[];
  no_project_reason: string | null;
}

interface SourceFile {
  path: string;                  // Relative path within __cc_validated_files
  type: FileType;                // code, database, transcript, document, ocr
  weight: Weight;                // high, medium, low
}

type FileType = "code" | "database" | "transcript" | "document" | "ocr";
type Weight = "high" | "medium" | "low";

interface ProjectEntry {
  // Identification
  id: string;                    // Unique ID (e.g., "proj_001")
  name: string;                  // Simple name from content
  synthesized_name: string;      // Full folder name (Project_XxxYyy)

  // Description
  description: string;           // 1-2 sentences describing the project

  // Source files (CHANGED: now array of SourceFile objects)
  source_files: SourceFile[];    // Files with type and weight

  // Technical details
  tech_stack: string[];          // Detected technologies
  complexity: Complexity;        // Difficulty level

  // Generation tracking
  generation_status: GenerationStatus;
  generated_at: string | null;
  output_path: string | null;
}

type Complexity = "beginner" | "intermediate" | "advanced";

type GenerationStatus =
  | "not_started"
  | "in_progress"
  | "complete"
  | "failed"
  | "skipped";
```

## Example: Full Manifest

```json
{
  "course_path": "/home/user/courses/FullStackMasterclass",
  "discovered_at": "2025-01-15T10:30:00.000Z",
  "discovery_version": "2.0",
  "source_summary": {
    "total_files": 47,
    "by_type": {
      "code": 15,
      "database": 4,
      "transcript": 22,
      "document": 5,
      "ocr": 1
    }
  },
  "has_projects": true,
  "projects": [
    {
      "id": "proj_001",
      "name": "TodoApp",
      "synthesized_name": "Project_ReactTodoWithLocalStorage",
      "description": "A React-based todo application featuring local storage persistence, filtering, and a responsive design.",
      "source_files": [
        { "path": "App.jsx", "type": "code", "weight": "high" },
        { "path": "TodoList.jsx", "type": "code", "weight": "high" },
        { "path": "TodoItem.jsx", "type": "code", "weight": "high" },
        { "path": "useLocalStorage.js", "type": "code", "weight": "high" },
        { "path": "03_TodoApp_Part1.srt", "type": "transcript", "weight": "medium" },
        { "path": "04_TodoApp_Part2.srt", "type": "transcript", "weight": "medium" },
        { "path": "05_TodoApp_Part3.srt", "type": "transcript", "weight": "medium" }
      ],
      "tech_stack": ["React", "JavaScript", "CSS", "LocalStorage"],
      "complexity": "beginner",
      "generation_status": "not_started",
      "generated_at": null,
      "output_path": null
    },
    {
      "id": "proj_002",
      "name": "JobPortal",
      "synthesized_name": "Project_NextJobPortalWithPrisma",
      "description": "Full-stack job portal with authentication, job listings, applications, and admin dashboard.",
      "source_files": [
        { "path": "schema.prisma", "type": "code", "weight": "high" },
        { "path": "api/jobs/route.ts", "type": "code", "weight": "high" },
        { "path": "db_schema_jobs.md", "type": "database", "weight": "high" },
        { "path": "db_schema_users.md", "type": "database", "weight": "high" },
        { "path": "07_JobPortal_Setup.srt", "type": "transcript", "weight": "medium" },
        { "path": "08_JobPortal_Auth.srt", "type": "transcript", "weight": "medium" },
        { "path": "09_JobPortal_CRUD.srt", "type": "transcript", "weight": "medium" },
        { "path": "slides_architecture.md", "type": "document", "weight": "low" }
      ],
      "tech_stack": ["Next.js", "TypeScript", "Prisma", "PostgreSQL", "NextAuth"],
      "complexity": "advanced",
      "generation_status": "not_started",
      "generated_at": null,
      "output_path": null
    }
  ],
  "skipped_files": [
    "01_Introduction.srt",
    "02_ReactBasics.srt",
    "06_StateTheory.srt",
    "readme.md"
  ],
  "no_project_reason": null
}
```

## Weight Guidelines

### High Weight Files
- Actual source code files (.py, .js, .ts, .rs, etc.)
- Database schema extractions
- Configuration files (package.json, Cargo.toml)

Use these as primary source of truth for generated code.

### Medium Weight Files
- Transcripts explaining the implementation
- Tutorial-style documentation

Use for context, explanations, and filling gaps.

### Low Weight Files
- General documentation
- OCR-extracted text (may have errors)
- Supplementary materials

Use only when higher-weight sources are insufficient.

## Validation Rules

1. **source_files array**: Must have at least one `high` weight file for code generation
2. **project IDs**: Must be unique within manifest
3. **source_files paths**: Each file must exist in `__cc_validated_files/`
4. **synthesized_name**: Must match pattern `Project_[A-Z][a-zA-Z0-9]+`
