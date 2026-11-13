/**
 * o90's gated actions (the "Gated" list in claude/config/CLAUDE.md) as command
 * patterns. The map marks a matching call; it never blocks one. Blocking
 * belongs to hooks and the push guard (D12: warn, do not block).
 *
 * A tag means a match against these known patterns, nothing more: a call with
 * no tag may still be gated (an alias, a script, a tool these rows do not
 * name). The map is display only and is no check that a step was allowed.
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

/**
 * `git`, then any global options (`-C dir`, `-c k=v`, `--no-pager`, ...), then the subcommand:
 * `git -c core.hooksPath=/dev/null push` is still a push.
 */
const GIT = String.raw`git(?:\s+(?:-[Cc]\s+\S+|--(?:git-dir|work-tree|namespace)(?:=|\s+)\S+|--no-pager|--paginate|--bare|--no-replace-objects|--no-optional-locks|--literal-pathspecs|-[pP]))*\s+`
const WRANGLER = String.raw`(?:bunx\s+|npx\s+|pnpm\s+(?:dlx|exec)\s+)?wrangler(?:@\S+)?\s+`
/** The rest of one simple command: `commandsOf` has already cut the line at `;`, `&`, `|` and newlines. */
const REST = String.raw`[^;&|\n]*`
/** An option or argument ends at whitespace or the end of the command. */
const END = String.raw`(?=\s|$)`

/** Order matters: the first match names the gate. */
export const GATES: readonly Gate[] = [
  // Force: --force, --force-with-lease[=...], a short-flag cluster holding f (-f, -uf), or a +refspec.
  shell('force push', String.raw`${GIT}push\b${REST}\s(?:--force(?:-with-lease)?(?:=\S*)?|-[A-Za-z]*f[A-Za-z]*|\+\S+)${END}`),
  shell('git push', String.raw`${GIT}push\b`),
  shell('hard reset', String.raw`${GIT}reset\s+${REST}--hard\b`),
  shell('branch delete', String.raw`${GIT}branch\s+${REST}(?:-D|--delete\s+--force)\b`),
  // Work in the tree or the stash thrown away: checkout of paths, clean -f, restore of the
  // worktree (not --staged alone), stash drop and clear.
  shell(
    'discard',
    String.raw`${GIT}(?:checkout\b${REST}\s(?:--|\.)${END}|clean\b${REST}\s(?:-[A-Za-z]*f[A-Za-z]*|--force)${END}|restore\b(?:(?=${REST}(?:--worktree|\s-W\b))|(?!${REST}(?:--staged|\s-S\b)))|stash\s+(?:drop|clear)\b)`,
  ),
  shell('PR merge', String.raw`gh\s+pr\s+merge\b`),
  shell('repo delete', String.raw`gh\s+repo\s+delete\b`),
  shell('API delete', String.raw`gh\s+api\b${REST}(?:-X\s*|--method(?:=|\s+))DELETE\b`),
  shell(
    'deploy',
    String.raw`(?:${WRANGLER}(?:deploy|publish|pages\s+deploy|versions\s+deploy)\b|(?:bun|npm|pnpm|yarn)\s+(?:run\s+)?deploy\b|make\s+(?:\S+\s+)*?deploy\b)`,
  ),
  shell('remote migration', String.raw`${WRANGLER}d1\s+migrations\s+apply\b${REST}--remote\b`),
  shell('remote D1 write', String.raw`${WRANGLER}d1\s+execute\b${REST}--remote\b`),
  shell('remote R2 write', String.raw`${WRANGLER}r2\s+object\s+(?:put|delete)\b${REST}--remote\b`),
  // Creating or deleting a database, bucket or namespace (`d1 create`, `r2 bucket delete`, `kv namespace create`).
  shell('remote resource', String.raw`${WRANGLER}(?:d1|r2|kv)\b${REST}\s(?:create|delete)\b`),
  shell('secret', String.raw`${WRANGLER}secret\s+(?:put|delete|bulk)\b`),
  shell(
    'global install',
    String.raw`(?:(?:npm|pnpm)\s+(?:i|install|add)\s+${REST}(?:-g|--global)\b|bun\s+(?:add|install|i)\s+${REST}(?:-g|--global)\b|yarn\s+global\s+add\b|brew\s+install\b|uv\s+tool\s+install\b|pipx\s+install\b|cargo\s+install\b)`,
  ),
]

/**
 * A command that hands its real work to another shell as a string the map cannot read: `bash -c`,
 * `sh -c`, `eval`, `ssh host <command>`, or a script piped into a shell. Found on the stripped
 * line, where the string itself is already blanked, so only the wrapper's shape is matched.
 */
export const WRAPPED = 'wrapped, not read'

const SSH_ARG_FLAGS = 'bcDEeFIiJLlmOopQRSWw'
const WRAPPERS: readonly RegExp[] = [
  /^(?:\S*\/)?(?:ba|z|da|k|fi)?sh\s+(?:-\w+\s+)*-\w*c\b/,
  /^eval\b/,
  // ssh, its options (those that take a value with it), a host, then a command.
  new RegExp(String.raw`^ssh(?:\s+(?:-[${SSH_ARG_FLAGS}]\s*\S+|-[AaCfGgKkMNnqsTtVvXxYy46]+))*\s+[^\s-]\S*\s+\S`),
]
const PIPED_TO_SHELL = /\|\s*(?:sudo\s+)?(?:\S*\/)?(?:ba|z|da|k)?sh(?:\s+-\S+)*\s*(?:$|[;&|\n)])/

export function isWrapped(bare: string): boolean {
  return PIPED_TO_SHELL.test(bare) || commandsOf(bare).some(c => WRAPPERS.some(w => w.test(c)))
}

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

/**
 * MCP tools on a remote service whose name says they change it. A name heuristic: it cannot
 * tell a remote service from a local one, so a `create` on a memory-style server (a knowledge
 * graph's entities, relations, observations) is left untagged.
 */
const MCP_CHANGE = /(?:^|_)(delete|deploy|apply|create)(?:_|$)/i
const LOCAL_MEMORY = /memor|knowledge|entit|relation|observation/i

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

/**
 * The command's bounded head, line continuations joined, quoted text and heredoc bodies blanked:
 * what every reader of a command line takes. Joined first, so `X=\<newline>value` stays one word.
 */
export function bareCommand(command: string): string {
  return withoutQuoted(command.slice(0, MAX_COMMAND).replace(/\\\r?\n/g, ''))
}

export function gateForCommand(command: string): string | undefined {
  return gateForBare(bareCommand(command))
}

export function gateForMcp(toolName: string): string | undefined {
  const m = toolName.split('__').slice(2).join('__').match(MCP_CHANGE)
  if (!m) return undefined
  const verb = m[1]!.toLowerCase()
  if (verb === 'create' && LOCAL_MEMORY.test(toolName)) return undefined
  return `remote ${verb}`
}
