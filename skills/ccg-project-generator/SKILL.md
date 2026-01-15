---
name: ccg-project-generator
description: Generate complete, working code projects from validated course content. Use when you have a project specification (from discovery) and need to create all implementation files, documentation, and configuration. Leverages code samples, database schemas, transcripts, and documents for high-fidelity generation. Invoked via -ccg flag.
---

# Project Generator (Multi-Asset)

Generate complete, working code projects from validated course content.

**This is the CCKnowledgeExtractor version** - it uses ALL validated file types (code, databases, transcripts, documents) for higher fidelity output.

## Purpose

This skill creates production-ready code implementations based on multi-asset course content. It supports two modes:
1. **Standard mode**: All source files provided in prompt
2. **Chunked mode**: Architecture spec + partial files for large projects

## When to Use

- After project discovery has identified a project
- When you have validated content ready for code generation
- In chunked mode, when an architecture spec is provided

## Key Difference: Multi-Asset Generation

Unlike SRT-only generation, this skill:

1. **Uses actual code files first** - If `App.jsx` exists in source_files, use it as the template
2. **Applies database schemas directly** - Extract models from schema files, not inferred from discussion
3. **Uses transcripts for context** - Fill gaps and understand "why" decisions were made
4. **Supplements with documents** - Architecture diagrams, additional context

### Source Priority Order

When generating each file:

1. **Direct copy/adapt**: If exact file exists in source_files with `type: "code"`
2. **Schema-driven**: If database schema exists, use it for models/types
3. **Transcript-informed**: Use teaching content for implementation details
4. **Document-supplemented**: Use docs for architecture decisions

## Output Location

All files are created in: `{course_path}/CODE/__CC_Projects/{ProjectName}/`

## Standard Mode

When receiving full source files:

1. Read all provided content, organized by type
2. **Code files**: Use as primary implementation reference
3. **Database files**: Extract exact schemas for models
4. **Transcripts**: Understand context, fill implementation gaps
5. Generate project files following the actual patterns found

### Generation Strategy by File Type

**For files with code sources:**
```
source_files contains: App.jsx (code, high)
→ Read App.jsx content
→ Clean up/modernize if needed
→ Preserve variable names, patterns, structure
→ Output: src/App.jsx
```

**For data models with database sources:**
```
source_files contains: db_schema_users.md (database, high)
→ Parse schema definition
→ Generate corresponding model file
→ Use exact field names, types, relationships
→ Output: src/models/User.ts
```

**For components only in transcripts:**
```
source_files contains: 04_BuildingHeader.srt (transcript, medium)
→ Parse transcript for implementation details
→ Extract code snippets if present
→ Generate component following described patterns
→ Output: src/components/Header.tsx
```

## Chunked Mode

When an architecture spec is provided (for projects with >15 source files):

1. Reference the spec for file structure and patterns
2. Generate only files covered in the current chunk
3. Use proper imports even for files not yet created
4. Maintain consistency with previously generated files

### Chunked Mode Indicators

You're in chunked mode when the prompt includes:
- "Chunk X of Y" in the title
- "Architecture Spec (Reference)" section
- "Files Already Generated" list
- "Remaining Files to Generate" list

### Chunked Mode Rules

1. **Follow the spec** - Use exact file paths, names, and patterns
2. **Check generated files** - Don't recreate files in "Already Generated" list
3. **Prioritize high-weight sources** - Code > Database > Transcript > Document
4. **Handle dependencies** - Import from files that will be created in other chunks
5. **Add TODO markers** - Only for functionality clearly in later chunks

## File Generation Guidelines

### When Code Source Exists

If `source_files` contains actual code for what you're generating:

```typescript
// Source: validated_files/components/TodoItem.jsx
// Weight: high, Type: code

// DO: Use the actual code as base
// DO: Preserve variable names, patterns, logic
// DO: Update dependencies/imports for project structure
// DON'T: Rewrite from scratch
// DON'T: Change working logic unnecessarily
```

### When Database Source Exists

If schema extraction is available:

```typescript
// Source: validated_files/db_schema_users.md
// Weight: high, Type: database

// DO: Use exact table/field names
// DO: Preserve relationships
// DO: Match types precisely
// DON'T: Invent additional fields
// DON'T: Change column names
```

### When Only Transcript Exists

If only teaching content is available:

```typescript
// Source: validated_files/05_UserAuth.srt
// Weight: medium, Type: transcript

// DO: Extract code snippets from transcript
// DO: Follow described patterns
// DO: Use mentioned variable/function names
// DON'T: Ignore spoken implementation details
```

### Source Files

**Configuration files:**
- Use actual `package.json` if in source_files
- Merge with detected dependencies
- Preserve scripts if they exist

**Type definitions:**
- Generate from database schemas first
- Supplement with transcript-mentioned types
- Include proper exports

**Core utilities:**
- Copy from source if available
- Generate from patterns if not

**Business logic:**
- Primary source: code files
- Secondary: database + transcript combined

**Documentation:**
- Generate fresh but reference source patterns
- Include CLAUDE.md for future Claude sessions

## Example: Multi-Asset Generation

Given source_files:
```json
[
  { "path": "App.tsx", "type": "code", "weight": "high" },
  { "path": "TodoList.tsx", "type": "code", "weight": "high" },
  { "path": "db_todos.md", "type": "database", "weight": "high" },
  { "path": "03_Building.srt", "type": "transcript", "weight": "medium" }
]
```

Generation approach:

1. **App.tsx** → Copy/adapt from source code file
2. **TodoList.tsx** → Copy/adapt from source code file
3. **src/models/Todo.ts** → Generate from db_todos.md schema
4. **src/hooks/useTodos.ts** → Infer from transcript + code patterns
5. **package.json** → Detect from imports in code files
6. **README.md** → Generate based on all sources

## Output Structure

```
Project_ReactTodoApp/
├── README.md
├── USAGE.md
├── CHANGELOG.md
├── CLAUDE.md
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── src/
│   ├── App.tsx           # From code source
│   ├── components/
│   │   └── TodoList.tsx  # From code source
│   ├── models/
│   │   └── Todo.ts       # From database source
│   ├── hooks/
│   │   └── useTodos.ts   # From transcript + patterns
│   └── utils/
│       └── storage.ts    # From code or generated
└── public/
    └── index.html
```

## Important Notes

- **Never modify source files** - Only read them
- **Write to __CC_Projects only** - All output goes in the designated folder
- **Preserve original code** - Don't "improve" working code from sources
- **Use exact schemas** - Database extracts are authoritative for data models
- **Working code** - Generated code should be runnable after dependency install
- **High-weight priority** - Always prefer code/database sources over transcripts
