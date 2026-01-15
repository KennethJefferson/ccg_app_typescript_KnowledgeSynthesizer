---
name: ccg-summary-generator
description: Generate structured documentation and summaries from validated course files. Creates comprehensive study guides, topic overviews, and reference documentation. Input is path to __cc_validated_files/ folder. Output is markdown documentation in __ccg_Summary/ folder.
---

# Summary Generator

Generate structured documentation from extracted course materials.

## Activation

This skill is invoked via the `-ccg` CLI argument:

```bash
ccke -i ./courses -ccg Summary
ccke -i ./courses -ccg summary
ccke -i ./courses -ccg study-guide
```

## Input

- Directory containing validated text files (`__cc_validated_files/`)
- Supports: .txt, .md, .srt, .vtt, code files

## Output Structure

```
__ccg_Summary/
├── README.md              # Course overview and navigation
├── topics/
│   ├── topic_01.md        # Individual topic summaries
│   ├── topic_02.md
│   └── ...
├── glossary.md            # Key terms and definitions
├── quick_reference.md     # Condensed reference guide
└── study_guide.md         # Combined study material
```

## Output Formats

### Overview (default)
- Course introduction
- Main topics list
- Key concepts summary

### Detailed
- Full topic breakdowns
- Examples and explanations
- Cross-references between topics

### Quick Reference
- Bullet point summaries
- Essential facts only
- Optimized for quick lookup

## Implementation

**Runtime**: TypeScript/Bun (via Claude Agent SDK)
**AI Engine**: Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)

### Generation Process

1. Agent receives validated files from `__cc_validated_files/`
2. Analyzes content to identify main topics and themes
3. Extracts key definitions, concepts, and terminology
4. Organizes content hierarchically by topic
5. Generates structured markdown documentation
6. Creates glossary from extracted definitions
7. Writes output to `__ccg_Summary/`

### Generation Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| max_topics | 20 | Maximum number of topics to extract |
| min_content | 100 | Minimum content length per topic (chars) |
| format | detailed | Output format: overview, detailed, quick |

### Topic Detection

The agent identifies topics by looking for:

**Strong Signals:**
- Section headings and subheadings
- "Introduction to..." or "Overview of..." patterns
- Repeated key terms across multiple files

**Content Extraction:**
- Definitions (term: definition patterns)
- Key concepts and their explanations
- Examples and use cases
- Relationships between topics

### Output Quality

Generated summaries should:
- Preserve technical accuracy from source material
- Provide clear, concise explanations
- Include cross-references between related topics
- Highlight prerequisites and dependencies
