import { loadFileAssets } from "./parser";
import { runGenerator, getSkillOutputDir } from "./generator";
import { Logger } from "./logger";
import { getTUI, stopTUI, type TUI } from "./tui";
import type { SkillInfo } from "./types";
import path from "path";

interface WorkerConfig {
  workerId: number;
  coursePath: string;
  skillsDir: string;
  ccgSkill: string;
  skillInfo: SkillInfo;
  tui: TUI;
}

/**
 * Worker function to process a single course
 */
export async function runWorker(config: WorkerConfig): Promise<{
  coursePath: string;
  filesCount: number;
  log: ReturnType<Logger["getRunLog"]>;
  generationResult?: { success: boolean; filesGenerated: string[]; error?: string };
}> {
  const { workerId, coursePath, skillInfo, tui } = config;
  const logger = new Logger();

  try {
    // Load and parse fileassets_optimized.txt
    const assets = await loadFileAssets(coursePath);

    // Register worker with TUI
    tui.addWorker(workerId, coursePath, assets.files.length);
    tui.updateWorker(workerId, 0, "Parsing fileassets_optimized.txt");

    // Log file count
    const filesCount = assets.files.length;
    if (filesCount === 0) {
      tui.completeWorker(workerId, false, "No files found in fileassets_optimized.txt");
      return { coursePath, filesCount: 0, log: logger.getRunLog() };
    }

    // Update TUI - files parsed
    tui.updateWorker(workerId, filesCount, `Parsed ${filesCount} files`);

    // Run content generation directly from parsed assets
    tui.setGenerating(workerId, skillInfo.name);

    // Determine output directory for generated content
    const generationOutputDir = getSkillOutputDir(skillInfo.name, coursePath);

    // Extract course name from path
    const courseName = path.basename(coursePath);

    // Run generator with parsed assets
    const generationResult = await runGenerator({
      skill: skillInfo,
      assets,
      outputDir: generationOutputDir,
      courseName,
    });

    // Update TUI with generation result
    tui.setGenerationComplete(
      workerId,
      generationResult.success,
      generationResult.filesGenerated.length
    );

    // Final status message
    const message = generationResult.success
      ? `Generated ${generationResult.filesGenerated.length} files from ${filesCount} source files`
      : `Generation failed: ${generationResult.error}`;

    tui.completeWorker(workerId, generationResult.success, message);

    // Save log
    await logger.saveLog(coursePath);

    return { coursePath, filesCount, log: logger.getRunLog(), generationResult };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error("worker", coursePath, errorMsg);
    tui.completeWorker(workerId, false, errorMsg);
    return {
      coursePath,
      filesCount: 0,
      log: logger.getRunLog(),
    };
  }
}

/**
 * Run multiple workers in parallel
 */
export async function runWorkerPool(
  courses: string[],
  maxWorkers: number,
  outputDir: string | undefined,
  skillsDir: string,
  ccgSkill: string,
  skillInfo: SkillInfo
): Promise<void> {
  // Initialize TUI
  const tui = await getTUI();

  const queue = [...courses];
  const inProgress = new Map<
    number,
    Promise<{
      coursePath: string;
      filesCount: number;
      log: ReturnType<Logger["getRunLog"]>;
      generationResult?: { success: boolean; filesGenerated: string[]; error?: string };
    }>
  >();
  let nextWorkerId = 1;

  while (queue.length > 0 || inProgress.size > 0) {
    // Start new workers up to maxWorkers
    while (queue.length > 0 && inProgress.size < maxWorkers) {
      const coursePath = queue.shift()!;
      const workerId = nextWorkerId++;

      const promise = runWorker({
        workerId,
        coursePath,
        skillsDir,
        ccgSkill,
        skillInfo,
        tui,
      });

      inProgress.set(workerId, promise);
    }

    // Wait for at least one worker to complete
    if (inProgress.size > 0) {
      const completed = await Promise.race(
        Array.from(inProgress.entries()).map(async ([id, promise]) => {
          const result = await promise;
          return { id, result };
        })
      );

      inProgress.delete(completed.id);
    }
  }

  // Give TUI time to render final state, then stop
  await new Promise((resolve) => setTimeout(resolve, 500));
  await stopTUI();
}
