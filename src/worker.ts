import { loadFileAssets } from "./parser";
import { processFile, chunkFile, getProcessor } from "./processor";
import { runGenerator, getSkillOutputDir } from "./generator";
import { findSkill } from "./skill";
import { Logger } from "./logger";
import { getTUI, stopTUI, type TUI } from "./tui";
import type { FileEntry, ProcessResult, SkillInfo } from "./types";
import path from "path";

const SUBAGENT_POOL_SIZE = 5;

interface WorkerConfig {
  workerId: number;
  coursePath: string;
  outputDir: string;
  skillsDir: string;
  ccgSkill: string;
  skillInfo: SkillInfo;
  tui: TUI;
}

/**
 * Process files with a pool of concurrent subagents
 */
async function processFilesWithPool(
  files: FileEntry[],
  outputDir: string,
  skillsDir: string,
  logger: Logger,
  workerId: number,
  tui: TUI
): Promise<ProcessResult[]> {
  const results: ProcessResult[] = [];
  const queue = [...files];
  const inProgress = new Set<Promise<ProcessResult>>();
  let processed = 0;

  while (queue.length > 0 || inProgress.size > 0) {
    // Fill pool up to SUBAGENT_POOL_SIZE
    while (queue.length > 0 && inProgress.size < SUBAGENT_POOL_SIZE) {
      const file = queue.shift()!;
      const processor = getProcessor(file.extension);

      // Skip files that don't need processing
      if (processor === "skip") {
        logger.warn(file.filename, file.path, "unsupported_format", "Binary media skipped");
        processed++;
        tui.updateWorker(workerId, processed, file.filename);
        continue;
      }

      tui.updateWorker(workerId, processed, file.filename);

      const promise = processFile(file, outputDir, skillsDir, logger)
        .then((result) => {
          inProgress.delete(promise);
          processed++;
          tui.updateWorker(workerId, processed, file.filename);
          if (result.success) {
            logger.success();
          } else if (result.error) {
            logger.error(file.filename, file.path, result.error);
          }
          return result;
        })
        .catch((error) => {
          inProgress.delete(promise);
          processed++;
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger.error(file.filename, file.path, errorMsg);
          tui.updateWorker(workerId, processed, file.filename);
          return {
            file: file.filename,
            path: file.path,
            success: false,
            error: errorMsg,
          };
        });

      inProgress.add(promise);
    }

    // Wait for at least one to complete if pool is full
    if (inProgress.size > 0) {
      const completed = await Promise.race(inProgress);
      results.push(completed);
    }
  }

  return results;
}

/**
 * Worker function to process a single course
 */
export async function runWorker(config: WorkerConfig): Promise<{
  coursePath: string;
  results: ProcessResult[];
  log: ReturnType<Logger["getRunLog"]>;
  generationResult?: { success: boolean; filesGenerated: string[]; error?: string };
}> {
  const { workerId, coursePath, outputDir, skillsDir, skillInfo, tui } = config;
  const logger = new Logger();

  try {
    // Load and parse fileassets.txt
    const assets = await loadFileAssets(coursePath);

    // Register worker with TUI
    tui.addWorker(workerId, coursePath, assets.files.length);

    // Create output directory for validated files
    const courseOutputDir = outputDir || `${coursePath}/CODE/__cc_validated_files`;
    await Bun.write(`${courseOutputDir}/.gitkeep`, "");

    // Phase 1: Process files with subagent pool (extraction)
    const results = await processFilesWithPool(
      assets.files,
      courseOutputDir,
      skillsDir,
      logger,
      workerId,
      tui
    );

    // Save extraction log
    await logger.saveLog(coursePath);
    const log = logger.getRunLog();

    // Check if extraction had critical failures
    const extractionSuccess = log.files_processed > 0;

    if (!extractionSuccess) {
      tui.completeWorker(workerId, false, "Extraction failed - no files processed");
      return { coursePath, results, log };
    }

    // Phase 2: Content Generation using Claude API
    tui.setGenerating(workerId, skillInfo.name);

    // Determine output directory for generated content
    const generationOutputDir = getSkillOutputDir(skillInfo.name, coursePath);

    // Extract course name from path
    const courseName = path.basename(coursePath);

    // Run generator
    const generationResult = await runGenerator({
      skill: skillInfo,
      validatedFilesDir: courseOutputDir,
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
      ? `Extracted ${log.files_processed} files, generated ${generationResult.filesGenerated.length} output files`
      : `Extraction OK, generation failed: ${generationResult.error}`;

    tui.completeWorker(workerId, generationResult.success, message);

    return { coursePath, results, log, generationResult };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error("worker", coursePath, errorMsg);
    tui.completeWorker(workerId, false, errorMsg);
    return {
      coursePath,
      results: [],
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
      results: ProcessResult[];
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
        outputDir: outputDir || `${coursePath}/CODE/__cc_validated_files`,
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
