import type { SkillInfo } from "./types";
import { Glob } from "bun";

/**
 * Find a skill by name in the skills directory
 */
export async function findSkill(skillName: string, skillsDir: string): Promise<SkillInfo | null> {
  // Normalize skill name for matching
  const normalized = skillName.toLowerCase().replace(/\s+/g, "-");

  // Try exact match first: ccg-<name>
  const exactPath = `${skillsDir}/ccg-${normalized}/SKILL.md`;
  if (await Bun.file(exactPath).exists()) {
    const content = await Bun.file(exactPath).text();
    const description = extractDescription(content);
    return {
      name: `ccg-${normalized}`,
      path: exactPath,
      description,
    };
  }

  // Try partial match
  const glob = new Glob(`*${normalized}*/SKILL.md`);
  for await (const match of glob.scan(skillsDir)) {
    const skillPath = `${skillsDir}/${match}`;
    const skillDir = match.replace(/[/\\]SKILL\.md$/, "");
    const content = await Bun.file(skillPath).text();
    const description = extractDescription(content);
    return {
      name: skillDir,
      path: skillPath,
      description,
    };
  }

  return null;
}

/**
 * List all available ccg-* skills
 */
export async function listCcgSkills(skillsDir: string): Promise<SkillInfo[]> {
  const skills: SkillInfo[] = [];
  const glob = new Glob("ccg-*/SKILL.md");

  for await (const match of glob.scan(skillsDir)) {
    const skillPath = `${skillsDir}/${match}`;
    const skillDir = match.replace(/[/\\]SKILL\.md$/, "");
    const content = await Bun.file(skillPath).text();
    const description = extractDescription(content);
    skills.push({
      name: skillDir,
      path: skillPath,
      description,
    });
  }

  return skills;
}

/**
 * Extract description from SKILL.md frontmatter
 */
function extractDescription(content: string): string | undefined {
  const match = content.match(/^---\n[\s\S]*?description:\s*(.+?)\n[\s\S]*?---/);
  return match?.[1]?.trim();
}

/**
 * Validate that a skill exists, exit with error if not
 */
export async function validateSkill(skillName: string, skillsDir: string): Promise<SkillInfo> {
  const skill = await findSkill(skillName, skillsDir);

  if (!skill) {
    console.error(`\nError: Skill not found: "${skillName}"\n`);
    console.error("Available ccg-* skills:");

    const available = await listCcgSkills(skillsDir);
    if (available.length === 0) {
      console.error("  (none found)");
    } else {
      for (const s of available) {
        console.error(`  - ${s.name}${s.description ? `: ${s.description}` : ""}`);
      }
    }

    process.exit(1);
  }

  return skill;
}
