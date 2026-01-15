---
name: ccg-sop-generator
description: Generate Standard Operating Procedures (SOPs) from validated course files. Creates step-by-step procedural documentation with prerequisites, verification steps, and troubleshooting guides. Input is path to __cc_validated_files/ folder. Output is markdown SOPs in __ccg_SOP/ folder.
---

# SOP Generator Skill

Generate Standard Operating Procedures (SOPs) from course content and validated files.

## Purpose

Transforms extracted course content into structured, actionable Standard Operating Procedures. SOPs are step-by-step instructions that document how to perform specific tasks or processes, commonly used in professional, technical, and educational contexts.

## Activation

This skill is invoked via the `-ccg` CLI argument:

```bash
ccke -i ./courses -ccg SOP
ccke -i ./courses -ccg sop
ccke -i ./courses -ccg procedure
ccke -i ./courses -ccg procedures
```

## Input

- Directory containing validated text files (`__cc_validated_files/`)
- Supports: .txt, .md, .srt, .vtt, code files

## Output

Creates `__ccg_SOP/` directory containing:

| File | Description |
|------|-------------|
| `README.md` | Overview of all procedures with navigation |
| `procedures/` | Individual SOP files organized by topic |
| `quick_reference.md` | Condensed checklist version of all procedures |
| `glossary.md` | Terms and definitions used in procedures |

## SOP Format

Each generated SOP follows a standard format:

```markdown
# SOP: [Procedure Title]

## Purpose
Brief description of what this procedure accomplishes.

## Scope
Who should use this procedure and when.

## Prerequisites
- Required knowledge
- Required tools/access
- Required materials

## Procedure

### Step 1: [Action]
Detailed instructions...

**Expected Result:** What should happen

### Step 2: [Action]
...

## Verification
How to confirm the procedure was completed successfully.

## Troubleshooting
Common issues and solutions.

## Related Procedures
Links to related SOPs.
```

## Implementation

**Runtime**: TypeScript/Bun (via Claude Agent SDK)
**AI Engine**: Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)

### Generation Process

1. Agent receives validated files from `__cc_validated_files/`
2. Scans content for procedural patterns:
   - Numbered sequences (1. 2. 3.)
   - Action verbs (click, configure, install, run, etc.)
   - Sequential markers (first, then, next, finally)
3. Groups related steps into logical procedures
4. Generates SOP documents following the standard format
5. Creates index, quick reference, and glossary
6. Writes output to `__ccg_SOP/`

### Generation Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| min_steps | 3 | Minimum steps to form a procedure |
| max_depth | 3 | Maximum nesting depth for sub-steps |

### Procedure Detection

The agent identifies procedures by looking for:

**Strong Signals:**
- Explicit step numbering with action verbs
- "How to..." or "Steps to..." headings
- Sequential instruction patterns

**Moderate Signals:**
- Imperative sentences grouped together
- Code blocks with explanatory text
- Configuration or setup instructions

**Skip:**
- Pure conceptual explanations
- Single-step trivial actions
- Incomplete instruction fragments
