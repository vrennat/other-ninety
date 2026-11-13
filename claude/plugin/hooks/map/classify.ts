import type { StationId } from '../../types'
import { WRAPPED, bareCommand, gateForBare, gateForMcp, isWrapped } from './gate'

/**
 * A tool call -> the station it lights, a label, and a gate name.
 *
 * Labels hold names, never content: the last two parts of a path, a URL's
 * host, a Bash call's own `description` or else its first word, a subagent's
 * description. A command line, a file's text, a query or a prompt never
 * reaches a label.
 */
export type Classified = { station: StationId; label: string; gate?: string; programs?: string[] }

type Call = { tool: string; [arg: string]: unknown }

const MAX_LABEL = 60

/** Strips control characters and caps the length. */
export function clean(text: string): string {
  // eslint-disable-next-line no-control-regex
  const flat = text.replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ').replace(/\s+/g, ' ').trim()
  return flat.length > MAX_LABEL ? `${flat.slice(0, MAX_LABEL - 1)}…` : flat
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.length > 0 ? v : undefined)

export function shortPath(path: string): string {
  return path.split(/[\\/]+/).filter(Boolean).slice(-2).join('/')
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname || 'url'
  } catch {
    return 'url'
  }
}

const MEMORY_PATH = /[\\/]\.claude[\\/]projects[\\/][^\\/]+[\\/]memory[\\/]/

const FILE_WORDS = new Set(['cat', 'head', 'tail', 'sed', 'awk', 'grep', 'rg', 'find', 'ls', 'mv', 'cp', 'rm', 'mkdir', 'touch', 'tee', 'wc', 'diff', 'stat', 'chmod', 'ln', 'sort', 'uniq', 'cut', 'tr', 'echo', 'printf', 'test', 'cd', 'pwd', 'realpath', 'dirname', 'basename', 'file', 'du'])
const NET_WORDS = new Set(['curl', 'wget', 'ssh', 'scp', 'rsync', 'gh', 'nc', 'http', 'https', 'wrangler', 'dig', 'ping'])
const NET_SUB: Record<string, RegExp> = {
  git: /^(push|pull|fetch|clone|ls-remote)$/,
  npm: /^(i|install|ci|publish|view)$/,
  bun: /^(add|install|i|x)$/,
  pnpm: /^(add|install|i)$/,
  yarn: /^(add|install)$/,
  pip: /^install$/,
  pip3: /^install$/,
  brew: /^(install|upgrade|update)$/,
  docker: /^(pull|push|login)$/,
}

/** Token prefixes of common credentials (GitHub, OpenAI and Stripe, Slack, AWS, GitLab, Google, npm, PyPI, JWT). */
const SECRET_PREFIX = /^(?:gh[pousr]_|github_pat_|sk[-_]|rk_|pk_live|xox[abprs]-|AKIA|ASIA|glpat-|AIza|npm_|pypi-|eyJ)/

/**
 * Whether a word could be a credential rather than a program name: a known token prefix, a
 * value that holds `=`, or a long run that mixes upper case, lower case and digits. Such a word
 * is never used as a label; the call falls back to a generic one.
 */
export function looksSecret(word: string): boolean {
  if (word.includes('=') || SECRET_PREFIX.test(word)) return true
  return word.length >= 20 && /[A-Z]/.test(word) && /[a-z]/.test(word) && /\d/.test(word)
}

const LEAD_KEYWORDS = new Set(['do', 'then', 'else', 'elif', 'if', 'while', 'until', '{', '(', '!'])

/** The program and its first argument for each simple command in a stripped line (`withoutQuoted`). */
function programs(bare: string): Array<[string, string]> {
  return bare
    .split(/&&|\|\||[;|\n]|\$\(/)
    .map(part => {
      const words = part.trim().split(/\s+/).filter(w => !/^\w+=/.test(w) && w !== 'sudo' && w !== 'time' && w !== 'exec')
      // `do cat f`, `then curl x`, `{ git push; }`: the program follows the keyword.
      while (words.length > 1 && LEAD_KEYWORDS.has(words[0]!)) words.shift()
      return words
    })
    .filter(words => words.length > 0)
    .map(words => {
      const raw = words[0] ?? ''
      // Checked before lower-casing, which would hide a mixed-case token.
      const prog = looksSecret(raw) ? '' : raw.replace(/^.*[\\/]/, '').replace(/^["']|["']$/g, '').toLowerCase()
      // `git -C <dir> push` names its subcommand after the directory.
      const rest = prog === 'git' && words[1] === '-C' ? words.slice(3) : words.slice(1)
      return [prog, rest[0] ?? ''] as [string, string]
    })
}

/** Words that start a command but say nothing about what it does. */
const SHELL_NOISE = new Set(['cd', 'pushd', 'popd', 'export', 'set', 'unset', 'source', '.', 'for', 'while', 'until', 'do', 'done', 'if', 'then', 'else', 'elif', 'fi', 'case', 'esac', 'in', '[', '[[', 'test', 'true', 'false', ':', '{', '}', '(', ')', 'local', 'eval'])

/** The programs a stripped command line runs, in order, without shell keywords or repeats: names only. */
export function programsOf(bare: string, max = 3): string[] {
  const out: string[] = []
  for (const [prog] of programs(bare)) {
    const name = prog.replace(/[^a-z0-9._+-]/gi, '')
    if (!name || SHELL_NOISE.has(name) || out.includes(name)) continue
    out.push(name)
    if (out.length >= max) break
  }
  return out
}

export function stationForCommand(bare: string): StationId {
  const progs = programs(bare)
  if (progs.some(([p, sub]) => NET_WORDS.has(p) || (NET_SUB[p]?.test(sub) ?? false))) return 'network'
  if (progs.length > 0 && progs.every(([p]) => FILE_WORDS.has(p))) return 'files'
  return 'shell'
}

const BROWSER_SERVER = /^mcp__(claude[-_]in[-_]chrome|claude_browser|playwright|computer[-_]use)__/i
const MEMORY_SERVER = /^mcp__memory__/i
const UUIDISH = /^[0-9a-f]{8}-[0-9a-f]{4}-/i

function mcpLabel(tool: string): string {
  const [, server = '', ...rest] = tool.split('__')
  const name = rest.join('__')
  return UUIDISH.test(server) ? name : `${server} · ${name}`
}

export function classify(call: Call): Classified {
  const { tool } = call
  const path = str(call.file_path) ?? str(call.notebook_path) ?? str(call.path)

  switch (tool) {
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'NotebookEdit':
    case 'Glob':
    case 'Grep': {
      const isMemory = path !== undefined && MEMORY_PATH.test(path)
      const label = path ? shortPath(path) : tool
      return { station: isMemory ? 'memory' : 'files', label: clean(label) }
    }
    case 'Bash':
    case 'PowerShell': {
      // Stripped once: each reader below scans the same bounded string.
      const bare = bareCommand(str(call.command) ?? '')
      // A known gate outranks the wrapper mark: what the wrapper runs is not read either way.
      const gate = gateForBare(bare) ?? (isWrapped(bare) ? WRAPPED : undefined)
      const progs = programsOf(bare)
      // A bare `cd` names nothing better than itself; anything else names its first real program.
      const label = clean(str(call.description) ?? progs[0] ?? (programs(bare)[0]?.[0] || tool))
      return { station: stationForCommand(bare), label, ...(gate ? { gate } : {}), ...(progs.length ? { programs: progs } : {}) }
    }
    case 'WebFetch':
      return { station: 'network', label: clean(hostOf(str(call.url) ?? '')) }
    case 'WebSearch':
      return { station: 'network', label: 'web search' }
    case 'Agent':
    case 'Task':
      return { station: 'agents', label: clean(str(call.description) ?? str(call.subagent_type) ?? 'subagent') }
    case 'Workflow':
      return { station: 'agents', label: 'workflow' }
    case 'Skill':
      return { station: 'skills', label: clean(str(call.skill) ?? 'skill') }
    case 'ToolSearch':
      return { station: 'skills', label: 'tool search' }
    case 'AskUserQuestion':
      return { station: 'you', label: 'question' }
  }

  if (tool.startsWith('mcp__')) {
    const gate = gateForMcp(tool)
    const station: StationId = BROWSER_SERVER.test(tool) ? 'browser' : MEMORY_SERVER.test(tool) ? 'memory' : 'network'
    return { station, label: clean(mcpLabel(tool)), ...(gate ? { gate } : {}) }
  }
  return { station: 'shell', label: clean(tool) }
}
