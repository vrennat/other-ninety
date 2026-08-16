import { afterEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { claudeSkillPaths } from "../extensions/claude-compat";

const tempDirs: string[] = [];

function skill(root: string, name: string, description = `${name} skill`): string {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "SKILL.md");
  fs.writeFileSync(file, `---\nname: ${name}\ndescription: ${description}\n---\n`);
  return file;
}

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "o90-claude-skills-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("Claude skill discovery", () => {
  test("project skills shadow same-named global skills without returning the duplicate", () => {
    const project = tempDir();
    const global = tempDir();
    const projectPr = skill(project, "pr", "project PR workflow");
    skill(global, "pr", "global PR workflow");
    const globalTicket = skill(global, "ticket");

    expect(claudeSkillPaths(project, global)).toEqual([project, globalTicket]);
    expect(projectPr).toBe(path.join(project, "pr", "SKILL.md"));
  });

  test("uses the global directory when no project skills exist", () => {
    const global = tempDir();
    skill(global, "pr");

    expect(claudeSkillPaths(undefined, global)).toEqual([global]);
  });
});
