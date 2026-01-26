import type { FileEntry, ParsedAssets } from "./types";

const SECTION_DELIMITER = "================================================================";
const FILE_DELIMITER = "================";

/**
 * Parse fileassets_optimized.txt and extract directory listing + file entries
 */
export function parseFileAssets(content: string): ParsedAssets {
  // Normalize line endings to \n
  const normalized = content.replace(/\r\n/g, "\n");
  const sections = normalized.split(SECTION_DELIMITER);

  // Find directory listing section
  let directoryListing = "";
  let filesSection = "";

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i].trim();
    if (section === "Directory List" && sections[i + 1]) {
      directoryListing = sections[i + 1].trim();
    }
    if (section === "Files" && sections[i + 1]) {
      filesSection = sections.slice(i + 1).join(SECTION_DELIMITER);
      break;
    }
  }

  // Parse file entries using regex
  const FILE_PATTERN =
    /================\nFile: "([^"]+)"\n================\n([\s\S]*?)(?=\n================\nFile:|$)/g;

  const files: FileEntry[] = [];
  let match;

  while ((match = FILE_PATTERN.exec(filesSection)) !== null) {
    const filePath = match[1];
    const fileContent = match[2].trim();
    const filename = filePath.split(/[/\\]/).pop() || filePath;
    const extension = filename.includes(".")
      ? "." + filename.split(".").pop()!.toLowerCase()
      : "";

    files.push({
      path: filePath,
      filename,
      extension,
      content: fileContent,
    });
  }

  return {
    directoryListing,
    files,
  };
}

/**
 * Read and parse fileassets_optimized.txt from a course directory
 */
export async function loadFileAssets(coursePath: string): Promise<ParsedAssets> {
  const filePath = `${coursePath}/fileassets_optimized.txt`;
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    throw new Error(`fileassets_optimized.txt not found in ${coursePath}`);
  }

  const content = await file.text();
  return parseFileAssets(content);
}
