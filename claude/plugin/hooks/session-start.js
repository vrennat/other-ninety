#!/usr/bin/env node
// The Other Ninety SessionStart hook.
//
// Injects the three-axis routing rubric (clarity / complexity / stakes) as
// ambient context so the "confirm only when ambiguous" philosophy is active
// even when the user never types /impl. Light by design: the decision
// framework only, not /impl's execution logic.
//
// Reads the active mode from <project>/.claude/other-ninety-mode (written by /mode).
// SessionStart hooks cannot block startup, so any failure degrades silently.

const fs = require("fs");
const path = require("path");

const MODE_BLURBS = {
  cautious: "confirm on ambiguous tasks AND medium/complex tasks",
  default: "confirm only when ambiguous, regardless of complexity",
  autonomous:
    "even ambiguous tasks get a sensible stated default and proceed; only destructive ops confirm",
};

function readMode() {
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const modeFile = path.join(projectDir, ".claude", "other-ninety-mode");
  try {
    const raw = fs.readFileSync(modeFile, "utf8").trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(MODE_BLURBS, raw)) return raw;
  } catch {
    // No mode file (or unreadable) -> fall through to default.
  }
  return "default";
}

const mode = readMode();

const context = [
  "<other-ninety>",
  "Routing philosophy (active even without /impl). Assess every dev task on three axes and keep them separate:",
  "",
  '- Clarity (clear / ambiguous) decides whether to ASK. Ambiguous = 2+ approaches with real tradeoffs, a genuinely missing requirement, or a multi-cause bug. It is not "many files touched" and not "I would like to confirm."',
  "- Complexity (simple / medium / complex) decides how to ROUTE: 1 file / 2-3 files / >3 files.",
  "- Stakes (normal / high) decides how hard to VERIFY: high = auth, money, data integrity, security, privacy, or hard to undo. Orthogonal to file count; when unsure, round up.",
  "",
  "Confirm only when clarity is ambiguous, or for destructive/irreversible operations. Do not seek rubber-stamp approval on routine work.",
  "",
  "Mark deliberate borderline routing calls in-code with a `// o90:` comment (`# o90:` for Python/shell) that names the upgrade trigger, e.g. `// o90: routed simple, escalate if sorting grows past this file`. /debt audits these.",
  "",
  `Mode: ${mode} — ${MODE_BLURBS[mode]}. (/mode changes it.)`,
  "",
  "Run /impl to execute work through this rubric; /trim to review what to delete; /debt to audit routing markers.",
  "</other-ninety>",
].join("\n");

const payload = {
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: context,
  },
};

process.stdout.write(JSON.stringify(payload));
process.exit(0);
