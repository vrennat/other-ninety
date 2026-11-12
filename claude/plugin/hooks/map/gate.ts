/**
 * o90's gated actions (the "Gated" list in claude/config/CLAUDE.md) as command
 * patterns. The map marks a matching call; it never blocks one. Blocking
 * belongs to hooks and the push guard (D12: warn, do not block).
 *
 * The command line is read here and nowhere else, and only the gate's name
 * leaves this module.
 */
type Gate = { name: string; pattern: RegExp }

const WORD_START = String.raw`(?:^|[\s;&|(]|\$\()`

const shell = (name: string, body: string): Gate => ({ name, pattern: new RegExp(WORD_START + body) })

/** Order matters: the first match names the gate. */
export const GATES: readonly Gate[] = [
  shell('force push', String.raw`git\s+(?:-C\s+\S+\s+)?push\b[^;&|]*\s(?:--force(?:-with-lease)?|-f)\b`),
  shell('git push', String.raw`git\s+(?:-C\s+\S+\s+)?push\b`),
  shell('hard reset', String.raw`git\s+(?:-C\s+\S+\s+)?reset\s+[^;&|]*--hard\b`),
  shell('branch delete', String.raw`git\s+(?:-C\s+\S+\s+)?branch\s+[^;&|]*(?:-D|--delete\s+--force)\b`),
  shell('PR merge', String.raw`gh\s+pr\s+merge\b`),
  shell('deploy', String.raw`(?:bunx\s+|npx\s+)?wrangler(?:@\S+)?\s+(?:deploy|publish|pages\s+deploy)\b`),
  shell('remote migration', String.raw`wrangler(?:@\S+)?\s+d1\s+migrations\s+apply\b[^;&|]*--remote\b`),
  shell('remote D1 write', String.raw`wrangler(?:@\S+)?\s+d1\s+execute\b[^;&|]*--remote\b`),
  shell('remote R2 write', String.raw`wrangler(?:@\S+)?\s+r2\s+object\s+(?:put|delete)\b[^;&|]*--remote\b`),
  shell('secret', String.raw`wrangler(?:@\S+)?\s+secret\s+(?:put|delete|bulk)\b`),
  shell('global install', String.raw`(?:npm\s+(?:i|install)\s+[^;&|]*(?:-g|--global)\b|bun\s+(?:add|install|i)\s+[^;&|]*(?:-g|--global)\b|brew\s+install\b)`),
]

/** MCP tools on a remote service whose name says they change it. */
const MCP_CHANGE = /(?:^|_)(delete|deploy|apply|create)(?:_|$)/i

export function gateForCommand(command: string): string | undefined {
  return GATES.find(g => g.pattern.test(command))?.name
}

export function gateForMcp(toolName: string): string | undefined {
  const m = toolName.split('__').slice(2).join('__').match(MCP_CHANGE)
  return m ? `remote ${m[1]!.toLowerCase()}` : undefined
}
