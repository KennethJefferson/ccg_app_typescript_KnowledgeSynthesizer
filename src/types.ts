export interface CLIArgs {
  input: string[];
  workers: number;
  output?: string;
  ccg: string;
}

export interface FileEntry {
  path: string;
  filename: string;
  extension: string;
  content: string;
}

export interface FileChunk {
  path: string;
  filename: string;
  extension: string;
  content: string;
  chunkIndex?: number;
  totalChunks?: number;
}

export interface ParsedAssets {
  directoryListing: string;
  files: FileEntry[];
}

export interface ProcessResult {
  file: string;
  path: string;
  success: boolean;
  outputPath?: string;
  error?: string;
}

export interface Warning {
  file: string;
  path: string;
  reason: "unsupported_format" | "extraction_failed" | "chunk_failed";
  message?: string;
}

export interface RunLog {
  run_id: string;
  started_at: string;
  completed_at: string;
  status: "success" | "completed_with_warnings" | "failed";
  files_processed: number;
  files_failed: number;
  warnings: Warning[];
  errors: Array<{
    file: string;
    path: string;
    error: string;
    stack?: string;
  }>;
}

export interface SkillInfo {
  name: string;
  path: string;
  description?: string;
}

export type FileProcessor =
  | "extractor-pdf"
  | "extractor-docx"
  | "extractor-pptx"
  | "extractor-html"
  | "extractor-image"
  | "db-extractor-sqlite"
  | "db-extractor-xlsx"
  | "db-identify"
  | "archive-extractor"
  | "passthrough"
  | "skip"
  | null;

export interface FileRouteResult {
  file_type: string;
  processor: FileProcessor;
  detection_method: "signature" | "extension" | "none";
  confidence: "high" | "low" | "none";
  metadata: {
    path: string;
    name: string;
    size_bytes: number;
    extension: string;
  };
  error?: string;
}
