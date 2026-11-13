/**
 * o90's gated actions (the "Gated" list in claude/config/CLAUDE.md) as command
 * patterns. The map marks a matching call; it never blocks one. Blocking
 * belongs to hooks and the push guard (D12: warn, do not block).
 *
 * The command line is read here and nowhere else, and only the gate's name
 * leaves this module.
 */
type Gate = { name: string; pattern: RegExp }

/**
 * Each pattern is tried once, at the start of each simple command (see `commandsOf`), never at
 * every word: a regex tried at every position of a long line is quadratic in its length.
 */
const shell = (name: string, body: string): Gate => ({ name, pattern: new RegExp(String.raw`^(?:\S*/)?` + body) })

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

/** Words that may stand before a command's program without changing what it runs. */
const PREFIX = /^(?:\w+=\S*|sudo|time|exec|nohup|command|builtin|env|xargs|do|then|else|elif|if|while|until|\{|\(|!)$/

/** The simple commands in a stripped line, each with its leading assignments and prefix words dropped. */
export function commandsOf(bare: string): string[] {
  const out: string[] = []
  for (const part of bare.split(/&&|\|\||[;&|\n`(]|\$\(/)) {
    const words = part.trim().split(/\s+/)
    let k = 0
    while (k < words.length - 1 && PREFIX.test(words[k]!)) k++
    const cmd = words.slice(k).join(' ')
    if (cmd) out.push(cmd)
  }
  return out
}

/** MCP tools on a remote service whose name says they change it. */
const MCP_CHANGE = /(?:^|_)(delete|deploy|apply|create)(?:_|$)/i

/**
 * How much of a command line the map reads. Every tool call waits on the
 * classification, so it reads a bounded head: a gated step past 16 KB of
 * command goes unmarked.
 */
export const MAX_COMMAND = 16 * 1024

const HEREDOC_WORD = /^<<-?[ \t]*(['"]?)(\w+)\1/

/**
 * The command with heredoc bodies and quoted strings blanked: text a command
 * carries as data (a commit message, a grep pattern, a script fed on stdin)
 * is not a command it runs. `bash -c "..."` is missed as a result; the map
 * only marks, so a miss costs less than a false mark.
 *
 * One pass, left to right, so its cost is linear in the length: a quote or a
 * heredoc left open blanks the rest of the line, as the shell would read it
 * as data to the end.
 */
export function withoutQuoted(command: string): string {
  const out: string[] = []
  const pending: string[] = []
  let i = 0
  const n = command.length
  while (i < n) {
    const c = command[i]!
    if (c === "'") {
      const end = command.indexOf("'", i + 1)
      out.push("''")
      i = end < 0 ? n : end + 1
    } else if (c === '"') {
      let j = i + 1
      while (j < n && command[j] !== '"') j += command[j] === '\\' ? 2 : 1
      out.push('""')
      i = j + 1
    } else if (c === '<' && command.startsWith('<<', i) && command[i + 2] !== '<') {
      // The delimiter is read here; its body starts on the next line.
      const m = HEREDOC_WORD.exec(command.slice(i, i + 80))
      if (m) {
        pending.push(m[2]!)
        out.push(' ')
        i += m[0].length
      } else {
        out.push('<<')
        i += 2
      }
    } else if (c === '\n' && pending.length > 0) {
      // Each heredoc opened on the line just ended takes the lines up to its delimiter.
      let j = i + 1
      for (const word of pending) {
        while (j < n) {
          const eol = command.indexOf('\n', j)
          const line = command.slice(j, eol < 0 ? n : eol)
          j = eol < 0 ? n : eol + 1
          const t = line.trimStart()
          if (t.startsWith(word) && (t.length === word.length || /\s/.test(t[word.length]!))) break
        }
      }
      pending.length = 0
      out.push('\n')
      i = j
    } else {
      out.push(c)
      i++
    }
  }
  return out.join('')
}

/** The gate a command line matches, from its stripped form (see `withoutQuoted`). */
export function gateForBare(bare: string): string | undefined {
  const commands = commandsOf(bare)
  return GATES.find(g => commands.some(c => g.pattern.test(c)))?.name
}

export function gateForCommand(command: string): string | undefined {
  return gateForBare(withoutQuoted(command.slice(0, MAX_COMMAND)))
}

export function gateForMcp(toolName: string): string | undefined {
  const m = toolName.split('__').slice(2).join('__').match(MCP_CHANGE)
  return m ? `remote ${m[1]!.toLowerCase()}` : undefined
}
