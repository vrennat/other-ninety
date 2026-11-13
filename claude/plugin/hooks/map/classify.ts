import type { Kind } from '../../types'
import { WRAPPED, bareCommand, commandsOf, gateForBare, gateForMcp, heredocToShell, isWrapped } from './gate'

/**
 * A tool call -> what kind of call it is, a label, where it left this machine, and a gate name.
 *
 * Labels hold names, never content: the last two parts of a path, a URL's host, a Bash call's
 * own `description` or else its first program, a subagent's description. A command line, a
 * file's text, a query or a prompt never reaches a label.
 */
export type Classified = { kind: Kind; label: string; via?: string; gate?: string }

type Call = { tool: string; [arg: string]: unknown }

const MAX_LABEL = 100

/** Strips control characters and caps the length, cutting at a word break where there is one. */
export function clean(text: string): string {
  // eslint-disable-next-line no-control-regex
  const flat = text.replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (flat.length <= MAX_LABEL) return flat
  const head = flat.slice(0, MAX_LABEL - 1)
  const brk = head.lastIndexOf(' ')
  return `${brk > MAX_LABEL / 2 ? head.slice(0, brk) : head}…`
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

/** Programs that talk to another machine whatever their subcommand. */
const NET_WORDS = new Set(['curl', 'wget', 'ssh', 'scp', 'sftp', 'ftp', 'rsync', 'gh', 'nc', 'telnet', 'http', 'https', 'xh', 'wrangler', 'dig', 'nslookup', 'ping', 'aws', 'gcloud', 'gsutil', 'az', 'kubectl', 'helm', 'flyctl', 'vercel', 'netlify', 'heroku', 'psql', 'mysql', 'mongosh', 'redis-cli', 'claude'])
/** Programs that talk to another machine only for some subcommands. */
const NET_SUB: Record<string, RegExp> = {
  git: /^(push|pull|fetch|clone|ls-remote|submodule)$/,
  npm: /^(i|install|ci|publish|view|update|add)$/,
  bun: /^(add|install|i|x|update|publish|create)$/,
  pnpm: /^(add|install|i|update|publish|dlx)$/,
  yarn: /^(add|install|dlx|publish|up)$/,
  pip: /^(install|download)$/,
  pip3: /^(install|download)$/,
  uv: /^(add|sync|lock|pip|tool)$/,
  cargo: /^(install|add|fetch|update|publish)$/,
  go: /^(get|install|mod)$/,
  gem: /^install$/,
  brew: /^(install|upgrade|update|fetch|tap)$/,
  docker: /^(pull|push|login|run|build)$/,
}
/** Hosts that are this machine. */
const LOOPBACK_HOST = /^(?:localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|::1|[\w-]+\.localhost)$/i

/**
 * The host an argument names, or undefined when it names none: an option or option value
 * (`-x`, `--noproxy=localhost`, `ProxyJump=localhost`), a path (`/tmp/localhost`, `./a`), or a
 * bare word with no dot that is not a loopback name. `https://u@h:8080/x`, `u@h`, `h:22` and
 * `api.example.com/x` all name `h` or `api.example.com`.
 */
function hostIn(arg: string): string | undefined {
  if (arg.startsWith('-') || arg.includes('=') || /^[/.~$]/.test(arg)) return undefined
  const rest = arg.replace(/^[a-z][\w+.-]*:\/\//i, '').replace(/^[^@/]*@/, '')
  // `[::1]:3000`: the host is inside the brackets; otherwise it ends at a port or a path.
  const host = rest.startsWith('[') ? rest.slice(1, rest.indexOf(']') >>> 0) : rest.replace(/[:/].*$/, '')
  if (!host) return undefined
  return LOOPBACK_HOST.test(host) || host.includes('.') ? host : undefined
}

/**
 * Whether a network program's call stays on this machine: it names a host, and every host it
 * names is a loopback one. Option values and paths are not hosts, so a proxy on localhost or an
 * output file called `localhost` does not hide the remote host the call goes to.
 */
function onlyLoopback(args: string[]): boolean {
  const hosts = args.map(hostIn).filter((h): h is string => h !== undefined)
  return hosts.length > 0 && hosts.every(h => LOOPBACK_HOST.test(h))
}

/** Package runners whose next program word is the one that runs (`bunx wrangler deploy`). */
const RUNNERS: Record<string, number> = { bunx: 1, npx: 1, 'npm exec': 2, 'pnpm dlx': 2, 'pnpm exec': 2, 'yarn dlx': 2, 'bun x': 2 }
/** Git's options that come before its subcommand, and those that take the next word. */
const GIT_VALUE_OPTIONS = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace'])

/** Token prefixes of common credentials (GitHub, OpenAI and Stripe, Slack, AWS, GitLab, Google, npm, PyPI, JWT). */
const SECRET_PREFIX = /^(?:gh[pousr]_|github_pat_|sk[-_]|rk_|pk_live|xox[abprs]-|AKIA|ASIA|glpat-|AIza|npm_|pypi-|eyJ)/

/**
 * Whether a word could be a credential rather than a program name: a known token prefix, a
 * value that holds `=`, a run of 32 or more hex digits, or a long run that mixes upper case,
 * lower case and digits. Such a word
 * is never used as a label; the call falls back to a generic one.
 */
export function looksSecret(word: string): boolean {
  if (word.includes('=') || SECRET_PREFIX.test(word) || /^[0-9a-f]{32,}$/i.test(word)) return true
  return word.length >= 20 && /[A-Z]/.test(word) && /[a-z]/.test(word) && /\d/.test(word)
}

/**
 * What a program name looks like: lower case letters, digits, `-`, `_` and `.`, starting with a
 * letter, at most 24 characters. Anything else (`Q8xk2Lm9Pz`, a hex digest) is never shown as a
 * program; shell punctuation such as `[` or `.` is dropped with it, which costs nothing.
 */
const COMMAND_SHAPE = /^[a-z][a-z0-9._-]{0,23}$/

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
      const base = raw.replace(/^.*[\\/]/, '').replace(/^["']|["']$/g, '')
      // Checked on the word as written: lower-casing would hide a mixed-case token.
      const prog = looksSecret(raw) || !COMMAND_SHAPE.test(base) ? '' : base
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
  // `programs` already gives only command-shaped names, or '' for a word that is not one.
  for (const [name] of programs(bare)) {
    if (!name || SHELL_NOISE.has(name) || out.includes(name)) continue
    out.push(name)
    if (out.length >= max) break
  }
  return out
}

/** A command word as a program name: its last path part without a version (`wrangler@3`), or '' when it is not shaped like one. */
function programName(word: string): string {
  const base = word.replace(/^.*[\\/]/, '').replace(/@[^@]*$/, '')
  return looksSecret(word) || !COMMAND_SHAPE.test(base) ? '' : base
}

/**
 * The first program in a stripped command line that reaches off this machine, as a row shows it:
 * the program (`gh`, `curl`), or the program and its subcommand where only some subcommands do
 * (`git fetch`, `npm install`). Built on the gate's own splitter, so `env`, `sudo -u x`,
 * `timeout 5`, `nohup`, `xargs -n1`, `&`, backticks and subshells hide nothing; package runners
 * (`bunx`, `npx`) name the program they run. A call whose only addresses are this machine
 * (`curl localhost:5173`) stays local. Undefined when nothing on these lists reaches out: the
 * lists are known programs, not a proof that a command stayed local.
 */
export function reachesOut(bare: string): string | undefined {
  for (const command of commandsOf(bare)) {
    const words = command.split(/\s+/).filter(Boolean)
    let i = 0
    // `bunx --bun wrangler deploy`, `npm exec -- wrangler deploy`
    const two = `${words[0]} ${words[1] ?? ''}`
    const skip = RUNNERS[two] ?? RUNNERS[words[0] ?? '']
    if (skip !== undefined) {
      i = skip
      while (i < words.length - 1 && words[i]!.startsWith('-')) i += words[i] === '-p' || words[i] === '--package' ? 2 : 1
    }
    const prog = programName(words[i] ?? '')
    if (!prog) continue
    const args = words.slice(i + 1)
    let sub = args[0] ?? ''
    if (prog === 'git') {
      let k = 0
      while (k < args.length && args[k]!.startsWith('-')) k += GIT_VALUE_OPTIONS.has(args[k]!) ? 2 : 1
      sub = args[k] ?? ''
    }
    if (NET_WORDS.has(prog)) {
      if (!onlyLoopback(args)) return prog
    } else if (NET_SUB[prog]?.test(sub)) {
      return `${prog} ${sub}`
    } else if (prog === 'open' && args.some(a => /^https?:\/\//i.test(a) && !onlyLoopback([a]))) {
      return 'open'
    }
  }
  return undefined
}

/** Words after which the next word is taken as a secret value (`password hunter2`). */
const SECRET_NAMES = /^(?:password|passwd|token|secret|apikey|api_key|bearer)$/i
const EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i

/**
 * A model-written text as a label, or undefined when it may hold a credential: a word that looks
 * like one (also each part of a word split on `:` and `=`, as in `token:sk-…`), an email
 * address, or any word right after "password", "token", "secret" and the like. The caller then
 * falls back to a program or tool name.
 */
export function safeText(text: string | undefined): string | undefined {
  if (text === undefined) return undefined
  const words = text.split(/[\s,;()"'`<>[\]{}]+/).filter(Boolean)
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!
    if (looksSecret(w) || EMAIL.test(w)) return undefined
    if (w.split(/[:=]+/).some(part => part.length > 0 && (looksSecret(part) || SECRET_NAMES.test(part)) && part !== w)) return undefined
    if (SECRET_NAMES.test(w.replace(/[.!?]$/, '')) && i + 1 < words.length) return undefined
  }
  return text
}

/** Whether a URL points at this machine. */
const isLoopbackUrl = (url: string): boolean => {
  const host = hostOf(url)
  return host !== 'url' && LOOPBACK_HOST.test(host.replace(/^\[|\]$/g, ''))
}

const BROWSER_SERVER = /^mcp__(claude[-_]in[-_]chrome|claude_browser|playwright|computer[-_]use)__/i
const MEMORY_SERVER = /^mcp__memory__/i
/** MCP servers that run on this machine or inside the desktop app: their calls stay local. */
const LOCAL_SERVER = /^mcp__(ccd_[a-z_]+|terminal|visualize|easel|rejig|scheduled-tasks|Claude_Code_iOS_Simulator|Claude_Preview)__/i
/** Browser tools that load a page: the browser fetches it from wherever it lives. */
const BROWSER_LOAD = /(?:^|_)(navigate|tabs_create|tabs_create_mcp|preview_start)$/i
/** The desktop app's session tools a person cares about, by verb; the app's other tools are bookkeeping. */
const SESSION_VERBS: Record<string, string> = {
  start_session: 'Started a session',
  send_message: 'Messaged a session',
  stop_session: 'Stopped a session',
  archive_session: 'Archived a session',
  unarchive_session: 'Unarchived a session',
  delete_session: 'Deleted a session',
  hand_off_to_session: 'Handed off to a session',
}
/** Built-in tools that serve the app or the session itself, not the work: never drawn as rows. */
const APP_TOOLS = new Set(['ToolSearch', 'SendUserFile', 'ReadNotifications', 'ListAgents', 'TaskStop', 'TaskOutput', 'Monitor', 'ScheduleWakeup', 'CronCreate', 'CronDelete', 'CronList', 'TodoWrite', 'TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet', 'EnterPlanMode', 'ExitPlanMode', 'EnterWorktree', 'ExitWorktree'])
const UUIDISH = /^[0-9a-f]{8}-[0-9a-f]{4}-/i
const FILE_VERBS: Record<string, string> = { Read: 'Read', Write: 'Wrote', Edit: 'Edited', NotebookEdit: 'Edited', Glob: 'Searched', Grep: 'Searched' }

/** An MCP tool's server, or nothing for a connector named by a bare id. */
function mcpServer(tool: string): string | undefined {
  const server = tool.split('__')[1] ?? ''
  return UUIDISH.test(server) || !server ? undefined : server
}

function mcpLabel(tool: string): string {
  const name = tool.split('__').slice(2).join('__')
  const server = mcpServer(tool)
  return server ? `${server} · ${name}` : name
}

export function classify(call: Call): Classified {
  const { tool } = call
  const path = str(call.file_path) ?? str(call.notebook_path) ?? str(call.path)

  const verb = FILE_VERBS[tool]
  if (verb) {
    const kind: Kind = path !== undefined && MEMORY_PATH.test(path) ? 'memory' : 'files'
    return { kind, label: clean(path ? `${verb} ${shortPath(path)}` : `${verb} files`) }
  }
  switch (tool) {
    case 'Bash':
    case 'PowerShell': {
      // Stripped once: each reader below scans the same bounded string.
      const bare = bareCommand(str(call.command) ?? '')
      // A known gate outranks the wrapper mark: what the wrapper runs is not read either way.
      const gate = gateForBare(bare) ?? (isWrapped(bare) || heredocToShell(str(call.command) ?? '') ? WRAPPED : undefined)
      const via = reachesOut(bare)
      // A bare `cd` names nothing better than itself; anything else names its first real program.
      const label = clean(safeText(str(call.description)) ?? programsOf(bare)[0] ?? (programs(bare)[0]?.[0] || tool))
      return { kind: 'shell', label, ...(via ? { via } : {}), ...(gate ? { gate } : {}) }
    }
    case 'WebFetch': {
      const url = str(call.url) ?? ''
      const host = clean(hostOf(url))
      return { kind: 'web', label: host, ...(isLoopbackUrl(url) ? {} : { via: host }) }
    }
    case 'WebSearch':
      return { kind: 'web', label: 'Searched the web', via: 'web search' }
    case 'Artifact':
      return { kind: 'web', label: 'Published a page', via: 'claude.ai' }
    case 'Agent':
    case 'Task':
      return { kind: 'agent', label: clean(safeText(str(call.description)) ?? str(call.subagent_type) ?? 'subagent') }
    case 'Workflow':
      return { kind: 'agent', label: 'workflow' }
    case 'Skill':
      return { kind: 'skill', label: clean(str(call.skill) ?? 'skill') }
    case 'SendMessage':
      return { kind: 'session', label: SESSION_VERBS.send_message! }
    case 'AskUserQuestion':
      return { kind: 'app', label: 'Asked you a question' }
  }
  if (APP_TOOLS.has(tool)) return { kind: 'app', label: clean(tool) }

  if (tool.startsWith('mcp__')) {
    const gate = gateForMcp(tool)
    const g = gate ? { gate } : {}
    if (BROWSER_SERVER.test(tool)) {
      const url = str(call.url)
      const loads = BROWSER_LOAD.test(tool) && !(url !== undefined && isLoopbackUrl(url))
      // No name gate here: opening or creating a tab changes nothing on a remote service.
      // A page load ends in its host when the call names one (host only, never the path or query).
      const via = url !== undefined && hostOf(url) !== 'url' ? clean(hostOf(url)) : 'browser'
      return { kind: 'browser', label: clean(mcpLabel(tool)), ...(loads ? { via } : {}) }
    }
    if (MEMORY_SERVER.test(tool)) return { kind: 'memory', label: clean(mcpLabel(tool)), ...g }
    if (LOCAL_SERVER.test(tool)) {
      const name = tool.split('__').slice(2).join('__')
      const session = /^mcp__ccd_session/i.test(tool) ? SESSION_VERBS[name] : undefined
      if (session) return { kind: 'session', label: session }
      return { kind: /^mcp__ccd_/i.test(tool) ? 'app' : 'tool', label: clean(mcpLabel(tool)) }
    }
    // Any other server is a connector or a remote service: the call leaves this machine.
    return { kind: 'web', label: clean(mcpLabel(tool)), via: clean(mcpServer(tool) ?? 'connector'), ...g }
  }
  return { kind: 'tool', label: clean(tool) }
}

/**
 * Whether a submitted prompt is one the person typed, by the engine's own test (Claude Code
 * 2.1.323): origin `composer` (the prompt box; the desktop app's typed prompts, stored with
 * origin `human`, arrive as this), `bridge` (Remote Control) or `person`. Not `sdk`, a Slack
 * ping, a background task's notice, another session's message, a scheduled prompt, or an
 * engine-made `isMeta` prompt. A prompt queued with no origin arrives `unclassified` and is
 * not counted.
 */
const TYPED = new Set(['composer', 'bridge', 'person'])
export function isTyped(e: { origin?: { kind: string } | null; isMeta?: true }): boolean {
  const kind = e.origin?.kind
  return e.isMeta !== true && typeof kind === 'string' && TYPED.has(kind)
}

/**
 * A failed shell call's exit code as the reason on its row (`exit 1`). Only the digits are taken;
 * the rest of an error's text is the command's output and may hold anything.
 */
export function exitWhy(text: string | undefined): string | undefined {
  const m = /^Exit code (\d{1,3})\b/.exec(text ?? '')
  return m ? `exit ${m[1]}` : undefined
}
