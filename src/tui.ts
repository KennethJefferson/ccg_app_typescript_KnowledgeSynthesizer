import {
  createCliRenderer,
  TextRenderable,
  BoxRenderable,
  type CliRenderer,
} from "@opentui/core";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const PROGRESS_CHAR = "█";
const PROGRESS_EMPTY = "░";

interface WorkerStatus {
  id: number;
  course: string;
  status: "pending" | "processing" | "complete" | "error";
  current?: string;
  processed: number;
  total: number;
  spinnerFrame: number;
}

interface WorkerRow {
  spinner: TextRenderable;
  progress: TextRenderable;
  label: TextRenderable;
}

export class TUI {
  private renderer: CliRenderer | null = null;
  private workers: Map<number, WorkerStatus> = new Map();
  private workerRows: Map<number, WorkerRow> = new Map();
  private headerText: TextRenderable | null = null;
  private spinnerInterval: ReturnType<typeof setInterval> | null = null;
  private enabled = true;

  async init(): Promise<void> {
    try {
      this.renderer = await createCliRenderer({
        targetFps: 30,
      });

      // Header
      this.headerText = new TextRenderable(this.renderer, {
        id: "header",
        content: "KnowledgeSynthesizer v3",
        fg: "#00FFFF",
        position: "absolute",
        left: 2,
        top: 1,
      });
      this.renderer.root.add(this.headerText);

      // Start spinner animation
      this.spinnerInterval = setInterval(() => this.updateSpinners(), 80);

      this.renderer.start();
    } catch (error) {
      // Fallback to non-TUI mode if renderer fails
      this.enabled = false;
      console.log("TUI not available, using text output");
    }
  }

  private updateSpinners(): void {
    for (const [workerId, status] of this.workers) {
      if (status.status === "processing") {
        status.spinnerFrame = (status.spinnerFrame + 1) % SPINNER_FRAMES.length;
        const row = this.workerRows.get(workerId);
        if (row) {
          row.spinner.content = SPINNER_FRAMES[status.spinnerFrame];
        }
      }
    }
  }

  addWorker(workerId: number, course: string, totalFiles: number): void {
    const status: WorkerStatus = {
      id: workerId,
      course: this.truncatePath(course, 30),
      status: "pending",
      processed: 0,
      total: totalFiles,
      spinnerFrame: 0,
    };
    this.workers.set(workerId, status);

    if (this.enabled && this.renderer) {
      const yOffset = 3 + (workerId - 1) * 2;

      // Spinner
      const spinner = new TextRenderable(this.renderer, {
        id: `spinner-${workerId}`,
        content: "○",
        fg: "#888888",
        position: "absolute",
        left: 2,
        top: yOffset,
      });

      // Progress bar
      const progress = new TextRenderable(this.renderer, {
        id: `progress-${workerId}`,
        content: this.renderProgressBar(0, totalFiles),
        fg: "#00FF00",
        position: "absolute",
        left: 5,
        top: yOffset,
      });

      // Label
      const label = new TextRenderable(this.renderer, {
        id: `label-${workerId}`,
        content: `Worker ${workerId}: ${status.course}`,
        fg: "#FFFFFF",
        position: "absolute",
        left: 5,
        top: yOffset + 1,
      });

      this.renderer.root.add(spinner);
      this.renderer.root.add(progress);
      this.renderer.root.add(label);

      this.workerRows.set(workerId, { spinner, progress, label });
    } else {
      console.log(`[Worker ${workerId}] Starting: ${course} (${totalFiles} files)`);
    }
  }

  updateWorker(workerId: number, processed: number, currentFile?: string): void {
    const status = this.workers.get(workerId);
    if (!status) return;

    status.status = "processing";
    status.processed = processed;
    status.current = currentFile;

    if (this.enabled) {
      const row = this.workerRows.get(workerId);
      if (row) {
        row.spinner.fg = "#FFFF00";
        row.progress.content = this.renderProgressBar(processed, status.total);
        if (currentFile) {
          row.label.content = `Worker ${workerId}: ${this.truncatePath(currentFile, 40)}`;
        }
      }
    } else {
      if (currentFile && processed % 10 === 0) {
        console.log(`[Worker ${workerId}] ${processed}/${status.total}: ${currentFile}`);
      }
    }
  }

  completeWorker(workerId: number, success: boolean, message?: string): void {
    const status = this.workers.get(workerId);
    if (!status) return;

    status.status = success ? "complete" : "error";

    if (this.enabled) {
      const row = this.workerRows.get(workerId);
      if (row) {
        row.spinner.content = success ? "✓" : "✗";
        row.spinner.fg = success ? "#00FF00" : "#FF0000";
        row.progress.content = this.renderProgressBar(status.total, status.total);
        row.progress.fg = success ? "#00FF00" : "#FF0000";
        row.label.content = `Worker ${workerId}: ${message || (success ? "Complete" : "Failed")}`;
      }
    } else {
      console.log(`[Worker ${workerId}] ${success ? "Complete" : "Failed"}: ${message || ""}`);
    }
  }

  setGenerating(workerId: number, skillName: string): void {
    const status = this.workers.get(workerId);
    if (!status) return;

    if (this.enabled) {
      const row = this.workerRows.get(workerId);
      if (row) {
        row.spinner.content = "⚡";
        row.spinner.fg = "#FF00FF";
        row.progress.content = "Generating content...".padEnd(45);
        row.progress.fg = "#FF00FF";
        row.label.content = `Worker ${workerId}: ${skillName}`;
      }
    } else {
      console.log(`[Worker ${workerId}] Generating: ${skillName}`);
    }
  }

  setGenerationComplete(workerId: number, success: boolean, filesGenerated: number): void {
    const status = this.workers.get(workerId);
    if (!status) return;

    if (this.enabled) {
      const row = this.workerRows.get(workerId);
      if (row) {
        row.spinner.content = success ? "✓" : "✗";
        row.spinner.fg = success ? "#00FF00" : "#FF0000";
        row.progress.content = success
          ? `Generated ${filesGenerated} files`.padEnd(45)
          : "Generation failed".padEnd(45);
        row.progress.fg = success ? "#00FF00" : "#FF0000";
      }
    } else {
      console.log(`[Worker ${workerId}] Generation ${success ? "complete" : "failed"}: ${filesGenerated} files`);
    }
  }

  private renderProgressBar(current: number, total: number, width = 30): string {
    const percentage = total > 0 ? current / total : 0;
    const filled = Math.round(percentage * width);
    const empty = width - filled;
    const percent = Math.round(percentage * 100);
    return `${PROGRESS_CHAR.repeat(filled)}${PROGRESS_EMPTY.repeat(empty)} ${percent.toString().padStart(3)}% (${current}/${total})`;
  }

  private truncatePath(path: string, maxLen: number): string {
    if (path.length <= maxLen) return path;
    const parts = path.split(/[/\\]/);
    const filename = parts.pop() || path;
    if (filename.length >= maxLen - 3) {
      return "..." + filename.slice(-(maxLen - 3));
    }
    return "..." + path.slice(-(maxLen - 3));
  }

  async stop(): Promise<void> {
    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval);
    }
    if (this.renderer) {
      // Give time for final render
      await new Promise((resolve) => setTimeout(resolve, 100));
      this.renderer.stop();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

// Singleton instance
let tuiInstance: TUI | null = null;

export async function getTUI(): Promise<TUI> {
  if (!tuiInstance) {
    tuiInstance = new TUI();
    await tuiInstance.init();
  }
  return tuiInstance;
}

export async function stopTUI(): Promise<void> {
  if (tuiInstance) {
    await tuiInstance.stop();
    tuiInstance = null;
  }
}
