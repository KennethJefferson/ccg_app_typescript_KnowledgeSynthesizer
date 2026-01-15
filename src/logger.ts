import type { RunLog, Warning } from "./types";

export class Logger {
  private runId: string;
  private startedAt: Date;
  private warnings: Warning[] = [];
  private errors: Array<{ file: string; path: string; error: string; stack?: string }> = [];
  private filesProcessed = 0;
  private filesFailed = 0;

  constructor() {
    this.runId = this.generateRunId();
    this.startedAt = new Date();
  }

  private generateRunId(): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  }

  worker(workerId: number, message: string): void {
    console.log(`[Worker ${workerId}] ${message}`);
  }

  info(message: string): void {
    console.log(message);
  }

  warn(file: string, path: string, reason: Warning["reason"], message?: string): void {
    const warning: Warning = { file, path, reason, message };
    this.warnings.push(warning);
    console.warn(`[WARN] ${file}: ${reason}${message ? ` - ${message}` : ""}`);
  }

  error(file: string, path: string, error: string, stack?: string): void {
    this.errors.push({ file, path, error, stack });
    this.filesFailed++;
    console.error(`[ERROR] ${file}: ${error}`);
  }

  success(): void {
    this.filesProcessed++;
  }

  getRunLog(): RunLog {
    const status: RunLog["status"] =
      this.filesFailed > 0
        ? "failed"
        : this.warnings.length > 0
          ? "completed_with_warnings"
          : "success";

    return {
      run_id: this.runId,
      started_at: this.startedAt.toISOString(),
      completed_at: new Date().toISOString(),
      status,
      files_processed: this.filesProcessed,
      files_failed: this.filesFailed,
      warnings: this.warnings,
      errors: this.errors,
    };
  }

  async saveLog(outputDir: string): Promise<void> {
    const logDir = `${outputDir}/__cc_processing_log`;
    await Bun.write(`${logDir}/run_${this.runId}.json`, JSON.stringify(this.getRunLog(), null, 2));
  }
}
