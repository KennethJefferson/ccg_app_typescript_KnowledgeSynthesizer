import { $ } from "bun";
import type { FileEntry, FileChunk, ProcessResult, FileProcessor } from "./types";
import { Logger } from "./logger";

const MAX_CHUNK_SIZE = 100_000; // 100K characters

// Extension to processor mapping
const EXTENSION_MAP: Record<string, FileProcessor> = {
  // Documents
  ".pdf": "extractor-pdf",
  ".docx": "extractor-docx",
  ".doc": "extractor-docx",
  ".pptx": "extractor-pptx",
  ".ppt": "extractor-pptx",
  ".xlsx": "db-extractor-xlsx",
  ".xls": "db-extractor-xlsx",

  // Databases
  ".db": "db-extractor-sqlite",
  ".sqlite": "db-extractor-sqlite",
  ".sqlite3": "db-extractor-sqlite",

  // HTML
  ".html": "extractor-html",
  ".htm": "extractor-html",

  // Images
  ".png": "extractor-image",
  ".jpg": "extractor-image",
  ".jpeg": "extractor-image",
  ".gif": "extractor-image",
  ".bmp": "extractor-image",
  ".tiff": "extractor-image",
  ".tif": "extractor-image",

  // Archives
  ".zip": "archive-extractor",
  ".rar": "archive-extractor",
  ".7z": "archive-extractor",
  ".tar": "archive-extractor",
  ".gz": "archive-extractor",

  // Passthrough (already text)
  ".txt": "passthrough",
  ".md": "passthrough",
  ".csv": "passthrough",
  ".json": "passthrough",
  ".xml": "passthrough",
  ".yaml": "passthrough",
  ".yml": "passthrough",
  ".srt": "passthrough",
  ".vtt": "passthrough",
  ".ts": "passthrough",
  ".tsx": "passthrough",
  ".js": "passthrough",
  ".jsx": "passthrough",
  ".py": "passthrough",
  ".java": "passthrough",
  ".c": "passthrough",
  ".cpp": "passthrough",
  ".h": "passthrough",
  ".hpp": "passthrough",
  ".cs": "passthrough",
  ".go": "passthrough",
  ".rs": "passthrough",
  ".rb": "passthrough",
  ".php": "passthrough",
  ".sql": "passthrough",
  ".sh": "passthrough",
  ".ps1": "passthrough",

  // Skip (binary media)
  ".mp4": "skip",
  ".mkv": "skip",
  ".avi": "skip",
  ".mov": "skip",
  ".mp3": "skip",
  ".wav": "skip",
  ".flac": "skip",
};

/**
 * Get the processor for a file based on extension
 */
export function getProcessor(extension: string): FileProcessor {
  return EXTENSION_MAP[extension.toLowerCase()] || null;
}

/**
 * Split a file into chunks if it exceeds the max size
 */
export function chunkFile(file: FileEntry): FileChunk[] {
  if (file.content.length <= MAX_CHUNK_SIZE) {
    return [
      {
        ...file,
        chunkIndex: 0,
        totalChunks: 1,
      },
    ];
  }

  const chunks: FileChunk[] = [];
  const lines = file.content.split("\n");
  let currentChunk = "";
  let chunkIndex = 0;

  for (const line of lines) {
    if (currentChunk.length + line.length + 1 > MAX_CHUNK_SIZE && currentChunk.length > 0) {
      chunks.push({
        ...file,
        content: currentChunk,
        chunkIndex,
        totalChunks: -1, // Will be updated after
      });
      currentChunk = line;
      chunkIndex++;
    } else {
      currentChunk += (currentChunk ? "\n" : "") + line;
    }
  }

  if (currentChunk) {
    chunks.push({
      ...file,
      content: currentChunk,
      chunkIndex,
      totalChunks: -1,
    });
  }

  // Update totalChunks
  const total = chunks.length;
  for (const chunk of chunks) {
    chunk.totalChunks = total;
  }

  return chunks;
}

/**
 * Process a passthrough file (just copy content)
 */
async function processPassthrough(
  file: FileEntry,
  outputDir: string
): Promise<ProcessResult> {
  const outputPath = `${outputDir}/${file.filename}`;
  await Bun.write(outputPath, file.content);
  return {
    file: file.filename,
    path: file.path,
    success: true,
    outputPath,
  };
}

/**
 * Process a file using a Python extraction script
 */
async function processWithScript(
  file: FileEntry,
  processor: FileProcessor,
  outputDir: string,
  skillsDir: string
): Promise<ProcessResult> {
  // Map processor to script path
  const scriptMap: Record<string, string> = {
    "extractor-pdf": "extractor-pdf/scripts/pdf_extract.py",
    "extractor-docx": "extractor-docx/scripts/docx_extract.py",
    "extractor-pptx": "extractor-pptx/scripts/pptx_extract.py",
    "extractor-html": "extractor-html/scripts/html2markdown.py",
    "extractor-image": "extractor-image/scripts/image_ocr.py",
    "db-extractor-sqlite": "db-extractor-sqlite/scripts/db_extract.py",
    "db-extractor-xlsx": "db-extractor-xlsx/scripts/xlsx_extract.py",
  };

  const scriptPath = scriptMap[processor as string];
  if (!scriptPath) {
    return {
      file: file.filename,
      path: file.path,
      success: false,
      error: `No script found for processor: ${processor}`,
    };
  }

  // For files in fileassets.txt, we need to write content to a temp file first
  const tempFile = `${outputDir}/.tmp_${file.filename}`;
  await Bun.write(tempFile, file.content);

  try {
    const result = await $`python "${skillsDir}/${scriptPath}" "${tempFile}" -o "${outputDir}" -q`.quiet();

    // Clean up temp file
    await Bun.file(tempFile).exists() && (await $`rm "${tempFile}"`.quiet());

    const outputPath = `${outputDir}/${file.filename.replace(/\.[^.]+$/, ".md")}`;

    return {
      file: file.filename,
      path: file.path,
      success: result.exitCode === 0,
      outputPath: result.exitCode === 0 ? outputPath : undefined,
      error: result.exitCode !== 0 ? result.stderr.toString() : undefined,
    };
  } catch (error) {
    // Clean up temp file on error
    await Bun.file(tempFile).exists() && (await $`rm "${tempFile}"`.quiet());

    return {
      file: file.filename,
      path: file.path,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Process a single file entry
 */
export async function processFile(
  file: FileEntry,
  outputDir: string,
  skillsDir: string,
  logger: Logger
): Promise<ProcessResult> {
  const processor = getProcessor(file.extension);

  if (processor === "skip") {
    logger.warn(file.filename, file.path, "unsupported_format", "Binary media file skipped");
    return {
      file: file.filename,
      path: file.path,
      success: true, // Not a failure, just skipped
    };
  }

  if (processor === null) {
    logger.warn(file.filename, file.path, "unsupported_format", "Unknown file type");
    return {
      file: file.filename,
      path: file.path,
      success: false,
      error: "Unknown file type",
    };
  }

  if (processor === "passthrough") {
    return processPassthrough(file, outputDir);
  }

  // Binary extraction required - these need actual files, not content from fileassets.txt
  // For now, we'll handle text-based extraction or log that extraction is needed
  return processWithScript(file, processor, outputDir, skillsDir);
}
