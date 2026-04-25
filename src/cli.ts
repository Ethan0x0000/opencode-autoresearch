import { doctorHandlers } from "./commands/doctor"
import { exportHandlers } from "./commands/export"
import { installAgentCommand } from "./commands/install-agent"
import { intakeHandlers } from "./commands/intake"
import { loopHandlers } from "./commands/loop"
import { recommendHandlers } from "./commands/recommend"
import { createSessionStore, type SessionStore } from "./session/store"

export const COMMANDS = [
  "install-agent",
  "prompt-plan",
  "setup-plan",
  "onboarding-packet",
  "recommend-next",
  "next-experiment",
  "log-experiment",
  "doctor-session",
  "checks-inspect",
  "benchmark-lint",
  "export-dashboard",
  "finalize-preview",
] as const

export type CommandName = (typeof COMMANDS)[number]
export type CliOptions = Record<string, string | boolean | string[] | undefined> & { _: string[] }
export type CommandContext = {
  args: CliOptions
  command: CommandName
  sessionId: string
  store: SessionStore
}
export type CommandResult = Record<string, unknown>
export type CommandHandler = (context: CommandContext) => CommandResult | Promise<CommandResult>

type CliIo = {
  stdout: (text: string) => void
  stderr: (text: string) => void
}

type ParsedCli = {
  command?: string
  options: CliOptions
  wantsHelp: boolean
}

const commandHandlers = {
  "install-agent": installAgentCommand,
  ...intakeHandlers,
  ...recommendHandlers,
  ...loopHandlers,
  ...doctorHandlers,
  ...exportHandlers,
} satisfies Record<CommandName, CommandHandler>

export async function main(args: string[], io: CliIo = processIo()) {
  const parsed = parseCliArgs(args)
  if (parsed.wantsHelp || parsed.command === undefined) {
    io.stdout(helpText())
    return 0
  }

  if (!isCommandName(parsed.command)) {
    io.stderr(`Unknown command: ${parsed.command}\n`)
    return 1
  }

  try {
    io.stdout(`${JSON.stringify(await commandHandlers[parsed.command](commandContext(parsed.command, parsed.options)), null, 2)}\n`)
    return 0
  } catch (error) {
    io.stderr(`${errorMessage(error)}\n`)
    return 1
  }
}

export function optionString(options: CliOptions, key: string) {
  const value = options[key]
  if (typeof value === "string") return value
  return undefined
}

export function optionBoolean(options: CliOptions, key: string) {
  const value = options[key]
  if (typeof value === "boolean") return value
  if (typeof value !== "string") return false
  return ["1", "true", "yes", "y"].includes(value.toLowerCase())
}

export function stateContract(context: CommandContext, family: string, extra: CommandResult = {}) {
  return {
    ok: true,
    command: context.command,
    family,
    sessionId: context.sessionId,
    stateDir: context.store.baseDir,
    statePath: context.store.sessionPath(context.sessionId),
    ...extra,
  }
}

function commandContext(command: CommandName, options: CliOptions): CommandContext {
  const store = createSessionStore({ baseDir: optionString(options, "state-dir") })
  return {
    args: options,
    command,
    sessionId: optionString(options, "session-id") ?? "default",
    store,
  }
}

function parseCliArgs(args: string[]): ParsedCli {
  const options: CliOptions = { _: [] }
  let command: string | undefined
  let wantsHelp = false

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "--") {
      options._.push(...args.slice(index + 1))
      break
    }
    if (arg === "--help" || arg === "-h") {
      wantsHelp = true
      continue
    }
    if (arg.startsWith("--")) {
      const equalsAt = arg.indexOf("=")
      const key = equalsAt > 2 ? arg.slice(2, equalsAt) : arg.slice(2)
      if (equalsAt > 2) {
        setOption(options, key, arg.slice(equalsAt + 1))
        continue
      }
      const next = args[index + 1]
      if (next === undefined || next.startsWith("--")) {
        setOption(options, key, true)
        continue
      }
      setOption(options, key, next)
      index += 1
      continue
    }
    if (command === undefined) {
      command = arg
      continue
    }
    options._.push(arg)
  }

  return { command, options, wantsHelp }
}

function setOption(options: CliOptions, key: string, value: string | boolean) {
  options[key] = value
  const camelKey = key.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase())
  if (camelKey !== key) options[camelKey] = value
}

function helpText() {
  return `opencode-autoresearch

Usage:
  bun dist/cli.js <command> [options]

Commands:
  install-agent       Copy packaged agent/autoresearch.md into an opencode config directory.
  prompt-plan         Record the goal and constraints in plugin-owned session state.
  setup-plan          Record setup checklist items for the session.
  onboarding-packet   Print the current session summary.
  recommend-next      Return one safe next experiment recommendation.
  next-experiment     Create or return a pending experiment entry.
  log-experiment      Record an experiment result, metric, and status.
  doctor-session      Report missing setup, stale experiments, and recovery issues.
  checks-inspect      Record supplied check output summary.
  benchmark-lint      Validate benchmark metric contract fields.
  export-dashboard    Write offline JSON and Markdown dashboard snapshots.
  finalize-preview    Preview finalization counts without mutating source files.

Options:
  --state-dir <dir>    Use a plugin-owned state directory instead of the default .opencode-autoresearch path.
  --session-id <id>    Select a safe session id for state path resolution. Defaults to "default".
  --config-dir <dir>   Required for install-agent; destination root for agent/autoresearch.md.
  --force              Allow install-agent to overwrite an existing agent file.
  --help               Show this help.

export-dashboard writes a static snapshot only; it does not start a browser UI or live server.
`
}

function isCommandName(value: string): value is CommandName {
  return COMMANDS.includes(value as CommandName)
}

function processIo(): CliIo {
  return {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)))
}
