import type { StationId } from '../../types'
import { gateForCommand, gateForMcp } from './gate'

/**
 * A tool call -> the station it lights, a label, and a gate name.
 *
 * Labels hold names, never content: the last two parts of a path, a URL's
 * host, a Bash call's own `description` or else its first word, a subagent's
 * description. A command line, a file's text, a query or a prompt never
 * reaches a label.
 */
export type Classified = { station: StationId; label: string; gate?: string }

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
  bunx: /.*/,
  npx: /.*/,
  pnpm: /^(add|install|i)$/,
  yarn: /^(add|install)$/,
  pip: /^install$/,
  pip3: /^install$/,
  brew: /^(install|upgrade|update)$/,
  docker: /^(pull|push|login)$/,
}

/** The program and its first argument for each simple command in a line. */
function programs(command: string): Array<[string, string]> {
  return command
    .split(/&&|\|\||[;|\n]|\$\(/)
    .map(part => part.trim().split(/\s+/).filter(w => !/^\w+=/.test(w) && w !== 'sudo' && w !== 'time' && w !== 'exec'))
    .filter(words => words.length > 0)
    .map(words => {
      const prog = (words[0] ?? '').replace(/^.*[\\/]/, '').replace(/^["']|["']$/g, '').toLowerCase()
      // `git -C <dir> push` names its subcommand after the directory.
      const rest = prog === 'git' && words[1] === '-C' ? words.slice(3) : words.slice(1)
      return [prog, rest[0] ?? ''] as [string, string]
    })
}

export function stationForCommand(command: string): StationId {
  const progs = programs(command)
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
      const command = str(call.command) ?? ''
      const gate = gateForCommand(command)
      const first = programs(command)[0]?.[0] ?? tool
      const label = clean(str(call.description) ?? first)
      return { station: stationForCommand(command), label, ...(gate ? { gate } : {}) }
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
