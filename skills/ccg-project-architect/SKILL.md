---
name: ccg-project-architect
description: Extract detailed architecture specifications from validated course content for large project generation. Use for projects with many source files (>15) where embedding all content in a single prompt would exceed context limits. Invoked via -ccg flag.
---

# Project Architect (Multi-Asset)

Extract detailed architecture specifications from validated course content for large project generation.

**This is the CCKnowledgeExtractor version** - it analyzes ALL validated file types for comprehensive architecture extraction.

## Purpose

This skill analyzes multi-asset course content and extracts a comprehensive architecture specification that enables chunked code generation. It's used for projects with many source files (>15) where embedding all content in a single prompt would exceed context limits.

## When to Use

- Large projects with many source files (>15)
- Projects with complex file structures
- When you need to understand complete architecture before generating code
- When project implementation spans many different file types

## Multi-Asset Advantage

Unlike transcript-only analysis, this skill:

1. **Extracts actual file structure** from code files
2. **Gets exact schemas** from database extractions
3. **Maps real dependencies** from package manifests
4. **Uses transcripts for context** on architecture decisions

## Capabilities

1. **Catalog all source files** - List every file with type and purpose
2. **Extract real file structure** - From actual code files, not inferred
3. **Parse database schemas** - Exact models, relationships, constraints
4. **Map dependencies** - From package.json, requirements.txt, Cargo.toml
5. **Identify patterns** - Design patterns, architectural decisions
6. **Determine build order** - Logical sequence for implementing files
7. **Document env requirements** - Environment variables, configuration needs

## Source Analysis Order

Process files in this order for best results:

### 1. Package Manifests (if present)
- `package.json` → dependencies, scripts, project metadata
- `requirements.txt` → Python dependencies
- `Cargo.toml` → Rust dependencies
- `go.mod` → Go dependencies

### 2. Code Files (type: "code", weight: "high")
- Map actual file structure
- Extract exports, imports, relationships
- Identify entry points
- Catalog components, hooks, utilities

### 3. Database Schemas (type: "database", weight: "high")
- Extract table definitions
- Map relationships (foreign keys)
- Note constraints, indexes
- Identify data models

### 4. Transcripts (type: "transcript", weight: "medium")
- Architecture discussions
- Pattern explanations
- Implementation order/rationale
- Feature descriptions

### 5. Documents (type: "document", weight: "low")
- Architecture diagrams (described)
- Additional context
- Design decisions

## Output

Creates `architecture-{ProjectName}.json` in the course root:

```json
{
  "project_name": "Job Portal",
  "synthesized_name": "Project_NextJobPortalWithPrisma",
  "description": "Full-stack job portal with authentication...",
  "tech_stack": ["Next.js", "TypeScript", "Prisma", "PostgreSQL"],

  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "prisma": "^5.0.0"
  },
  "dev_dependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0"
  },

  "file_structure": [
    {
      "path": "src/app/page.tsx",
      "purpose": "Home page component",
      "source": "page.tsx",
      "source_type": "code",
      "exports": ["default"],
      "imports": ["@/components/JobList"]
    },
    {
      "path": "src/models/Job.ts",
      "purpose": "Job data model with validation",
      "source": "db_schema_jobs.md",
      "source_type": "database",
      "exports": ["Job", "JobSchema", "CreateJobInput"]
    },
    {
      "path": "src/lib/auth.ts",
      "purpose": "Authentication utilities",
      "source": "08_Auth.srt",
      "source_type": "transcript",
      "exports": ["signIn", "signOut", "getSession"]
    }
  ],

  "data_models": [
    {
      "name": "User",
      "source": "db_schema_users.md",
      "orm_type": "prisma",
      "fields": [
        { "name": "id", "type": "String", "primary": true },
        { "name": "email", "type": "String", "unique": true },
        { "name": "name", "type": "String", "nullable": true },
        { "name": "role", "type": "Role", "default": "USER" }
      ],
      "relations": ["jobs", "applications"]
    },
    {
      "name": "Job",
      "source": "db_schema_jobs.md",
      "orm_type": "prisma",
      "fields": [
        { "name": "id", "type": "String", "primary": true },
        { "name": "title", "type": "String" },
        { "name": "company", "type": "String" },
        { "name": "userId", "type": "String", "foreign_key": "User.id" }
      ],
      "relations": ["user", "applications"]
    }
  ],

  "api_routes": [
    {
      "method": "GET",
      "path": "/api/jobs",
      "description": "List all jobs with pagination",
      "source": "api/jobs/route.ts",
      "request_params": "?page=1&limit=10",
      "response": "{ jobs: Job[], total: number }"
    },
    {
      "method": "POST",
      "path": "/api/jobs",
      "description": "Create a new job listing",
      "source": "09_CRUD.srt",
      "auth_required": true,
      "request_body": "CreateJobInput",
      "response": "Job"
    }
  ],

  "components": [
    {
      "name": "JobList",
      "type": "component",
      "source": "JobList.tsx",
      "props": ["jobs", "onSelect", "isLoading"],
      "dependencies": ["JobCard", "Pagination"]
    },
    {
      "name": "useJobs",
      "type": "hook",
      "source": "10_Hooks.srt",
      "returns": "{ jobs, loading, error, refetch }",
      "dependencies": ["useSWR"]
    }
  ],

  "key_patterns": [
    "Server Components with client interactivity islands",
    "Repository pattern for data access",
    "JWT authentication with refresh tokens",
    "Optimistic UI updates"
  ],

  "build_order": [
    "prisma/schema.prisma",
    "src/lib/db.ts",
    "src/models/User.ts",
    "src/models/Job.ts",
    "src/lib/auth.ts",
    "src/app/api/jobs/route.ts",
    "src/components/JobCard.tsx",
    "src/components/JobList.tsx",
    "src/app/page.tsx"
  ],

  "env_vars": [
    { "name": "DATABASE_URL", "required": true, "example": "postgresql://..." },
    { "name": "NEXTAUTH_SECRET", "required": true },
    { "name": "NEXTAUTH_URL", "required": true, "example": "http://localhost:3000" }
  ],

  "implementation_notes": [
    "Uses Next.js 14 App Router with server components",
    "Prisma for database with PostgreSQL",
    "NextAuth.js for authentication",
    "SWR for client-side data fetching"
  ],

  "source_file_mapping": {
    "code_files": 8,
    "database_files": 3,
    "transcript_files": 12,
    "document_files": 2
  }
}
```

## Extraction Process

### Step 1: Inventory All Sources

Create a complete list of source files by type:

```
Source Files Inventory:
- Code (8): App.tsx, JobList.tsx, api/jobs/route.ts, ...
- Database (3): db_schema_users.md, db_schema_jobs.md, ...
- Transcript (12): 07_Setup.srt, 08_Auth.srt, ...
- Document (2): architecture_overview.md, ...
```

### Step 2: Extract from Code Files

For each code file:
- File path and name
- Exports (functions, components, types)
- Imports (dependencies, internal modules)
- Purpose (inferred from content)

### Step 3: Extract from Database Files

For each database schema:
- Table/model name
- Fields with types
- Relationships (foreign keys)
- Constraints (unique, nullable, default)

### Step 4: Extract from Transcripts

For each relevant transcript:
- Architecture discussions
- Pattern explanations
- Implementation details not in code
- Feature descriptions

### Step 5: Synthesize Architecture

Combine all sources into coherent spec:
- Resolve conflicts (code > database > transcript)
- Map dependencies between files
- Determine logical build order
- Document environment requirements

## Important Notes

- **Be thorough** - The spec guides chunked generation where each chunk sees only partial sources
- **Include ALL files** - Even config files (package.json, tsconfig.json)
- **Preserve exact names** - Use actual field/variable names from sources
- **Note source origins** - Track which source each piece came from
- **Map dependencies** - Critical for determining build order
- **Code files are authoritative** - When code exists, it overrides transcript descriptions
