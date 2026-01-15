#!/usr/bin/env bun
/**
 * KnowledgeSynthesizer v3 CLI
 *
 * Synthesize AI-generated content from course materials.
 *
 * Usage:
 *   bun run src/cli.ts -i ./course -ccg "SOP walkthrough"
 *   bun run src/cli.ts -i ./course1 ./course2 -w 5 -ccg "Podcast"
 */

import { parseArgs } from "util";
import { validateSkill, listCcgSkills } from "./skill";
import { runWorkerPool } from "./worker";
import path from "path";

const SKILLS_DIR = path.join(import.meta.dir, "../skills");

function printHelp(): void {
  console.log(`
KnowledgeSynthesizer v3 - AI Content Synthesis from Course Materials

Usage:
  bun run src/cli.ts -i <paths...> --ccg <type> [options]

Arguments:
  -i, --input <paths...>   Input directories (courses/projects). Required.
  -c, --ccg <type>         Content type to generate. Must match existing skill. Required.

Options:
  -w, --workers <count>    Number of parallel workers (default: 3)
  -o, --output <path>      Output directory. Default: <course>/CODE/__cc_validated_files/
  -l, --list               List available ccg-* skills
  -h, --help               Show this help message

Examples:
  # Single course
  bun run src/cli.ts -i "./C++ for Beginners" --ccg "SOP walkthrough"

  # Multiple courses with custom workers
  bun run src/cli.ts -i ./course1 ./course2 ./course3 -w 5 --ccg "Podcast"

  # Custom output location
  bun run src/cli.ts -i ./course -o ./generated --ccg "Project"

  # List available skills
  bun run src/cli.ts --list
`);
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      input: { type: "string", short: "i", multiple: true },
      workers: { type: "string", short: "w" },
      output: { type: "string", short: "o" },
      ccg: { type: "string", short: "c" },
      list: { type: "boolean", short: "l" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
  });

  // Help
  if (values.help) {
    printHelp();
    process.exit(0);
  }

  // List skills
  if (values.list) {
    console.log("\nAvailable ccg-* skills:\n");
    const skills = await listCcgSkills(SKILLS_DIR);
    if (skills.length === 0) {
      console.log("  (none found)");
    } else {
      for (const skill of skills) {
        console.log(`  ${skill.name}`);
        if (skill.description) {
          console.log(`    ${skill.description}\n`);
        }
      }
    }
    process.exit(0);
  }

  // Collect input paths (from -i flag and positionals)
  const inputPaths: string[] = [...(values.input || []), ...positionals];

  // Validate required arguments
  if (inputPaths.length === 0) {
    console.error("Error: No input directories specified. Use -i <path> or provide paths directly.");
    printHelp();
    process.exit(1);
  }

  if (!values.ccg) {
    console.error("Error: No content type specified. Use -ccg <type>.");
    printHelp();
    process.exit(1);
  }

  // Validate inputs exist
  for (const inputPath of inputPaths) {
    const resolved = path.resolve(inputPath);
    const dir = Bun.file(resolved);
    // Check if directory exists by trying to read fileassets.txt
    const assetsFile = Bun.file(path.join(resolved, "fileassets.txt"));
    if (!(await assetsFile.exists())) {
      console.error(`Error: fileassets.txt not found in: ${inputPath}`);
      process.exit(1);
    }
  }

  // Validate skill exists (exits if not found)
  const skill = await validateSkill(values.ccg, SKILLS_DIR);
  console.log(`Using skill: ${skill.name}`);

  // Parse workers count
  const workers = values.workers ? parseInt(values.workers, 10) : 3;
  if (isNaN(workers) || workers < 1) {
    console.error("Error: Invalid workers count. Must be a positive number.");
    process.exit(1);
  }

  // Resolve paths
  const resolvedInputs = inputPaths.map((p) => path.resolve(p));
  const resolvedOutput = values.output ? path.resolve(values.output) : undefined;

  // Run worker pool with skill info
  await runWorkerPool(resolvedInputs, workers, resolvedOutput, SKILLS_DIR, values.ccg, skill);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
