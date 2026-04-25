import { closeSync, fsyncSync, openSync } from "fs"
import { mkdir, open, readFile, rename, rm } from "fs/promises"
import { basename, dirname, join, resolve } from "path"
import {
  createExperiment,
  createInitialSessionState,
  parseSessionState,
  SESSION_SCHEMA_VERSION,
  type NewSessionExperimentInput,
  type NewSessionStateInput,
  type SessionState,
} from "./schema"

export const DEFAULT_SESSION_BASE_DIR = resolve(process.cwd(), ".opencode-autoresearch")

export type SessionStoreOptions = {
  baseDir?: string
  now?: () => string
}

export type SessionReadResult =
  | { status: "missing"; path: string }
  | { status: "ready"; path: string; state: SessionState }
  | { status: "recovered"; path: string; corruptPath: string; reason: string }

export type SessionStore = {
  baseDir: string
  sessionPath: (sessionId: string) => string
  read: (sessionId: string) => Promise<SessionReadResult>
  create: (input: NewSessionStateInput) => Promise<SessionState>
  save: (state: SessionState) => Promise<SessionState>
  appendExperiment: (sessionId: string, input: NewSessionExperimentInput) => Promise<SessionState>
}

let atomicWriteCounter = 0

export class FutureSessionSchemaVersionError extends Error {
  constructor(version: number, filePath: string) {
    super(
      `Unsupported future session schema version ${version}; this plugin supports version ${SESSION_SCHEMA_VERSION}. Upgrade opencode-autoresearch before reading ${filePath}.`,
    )
    this.name = "FutureSessionSchemaVersionError"
  }
}

export function createSessionStore(options: SessionStoreOptions = {}): SessionStore {
  const baseDir = resolve(options.baseDir ?? DEFAULT_SESSION_BASE_DIR)
  const now = options.now ?? (() => new Date().toISOString())

  const sessionPath = (sessionId: string) => join(baseDir, `${assertSafeSessionId(sessionId)}.json`)

  const read = async (sessionId: string): Promise<SessionReadResult> => {
    const path = sessionPath(sessionId)
    let raw: string
    try {
      raw = await readFile(path, "utf-8")
    } catch (error) {
      if (isFileNotFound(error)) return { status: "missing", path }
      throw error
    }

    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(raw)
    } catch (error) {
      return quarantineCorruptFile(path, `Corrupt session state JSON: ${errorMessage(error)}`, now)
    }

    const parsed = parseSessionState(parsedJson)
    if (!parsed.ok) {
      if (parsed.kind === "future-version") throw new FutureSessionSchemaVersionError(parsed.version, path)
      return quarantineCorruptFile(path, `Corrupt session state shape: ${parsed.reason}`, now)
    }

    if (parsed.state.sessionId !== sessionId) {
      return quarantineCorruptFile(
        path,
        `Corrupt session state shape: sessionId ${parsed.state.sessionId} does not match file session ${sessionId}`,
        now,
      )
    }

    return { status: "ready", path, state: parsed.state }
  }

  const writeState = async (state: SessionState): Promise<SessionState> => {
    const path = sessionPath(state.sessionId)
    try {
      await writeJsonAtomically(path, state)
      return state
    } catch (error) {
      throw new Error(`Unable to write session state at ${path}: ${errorMessage(error)}`)
    }
  }

  const create = async (input: NewSessionStateInput): Promise<SessionState> => {
    const existing = await read(input.sessionId)
    if (existing.status === "ready") return existing.state

    const timestamp = now()
    return writeState(createInitialSessionState(input, timestamp))
  }

  const save = async (state: SessionState): Promise<SessionState> => {
    return writeState({ ...state, updatedAt: now() })
  }

  const appendExperiment = async (sessionId: string, input: NewSessionExperimentInput): Promise<SessionState> => {
    const existing = await read(sessionId)
    if (existing.status !== "ready") {
      throw new Error(`Cannot append experiment for ${sessionId}: session state is ${existing.status}`)
    }

    const timestamp = now()
    const experiment = createExperiment(input, timestamp)
    const previousExperiment = existing.state.experiments.find((candidate) => candidate.id === input.id)
    const experiments = upsertById(
      existing.state.experiments,
      previousExperiment ? { ...experiment, createdAt: previousExperiment.createdAt } : experiment,
    )
    const metrics = input.metric
      ? upsertBySourceExperiment(existing.state.metrics, { ...input.metric, sourceExperimentId: input.id })
      : existing.state.metrics.filter((metric) => metric.sourceExperimentId !== input.id)

    return writeState({
      ...existing.state,
      updatedAt: timestamp,
      experiments,
      metrics,
    })
  }

  return {
    baseDir,
    sessionPath,
    read,
    create,
    save,
    appendExperiment,
  }
}

function assertSafeSessionId(sessionId: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(sessionId)) {
    throw new Error(`Unsafe session id: ${sessionId}`)
  }
  return sessionId
}

async function quarantineCorruptFile(path: string, reason: string, now: () => string): Promise<SessionReadResult> {
  const corruptPath = await nextCorruptPath(path, now())
  await rename(path, corruptPath)
  return {
    status: "recovered",
    path,
    corruptPath,
    reason: `${reason}. Moved unreadable state to ${corruptPath}.`,
  }
}

async function nextCorruptPath(path: string, timestamp: string): Promise<string> {
  const safeTimestamp = timestamp.replace(/[^0-9A-Za-z._-]/g, "") || `${Date.now()}`
  let candidate = `${path}.corrupt.${safeTimestamp}`
  let suffix = 1
  while (await fileExists(candidate)) {
    candidate = `${path}.corrupt.${safeTimestamp}.${suffix}`
    suffix += 1
  }
  return candidate
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path)
    return true
  } catch (error) {
    if (isFileNotFound(error)) return false
    throw error
  }
}

async function writeJsonAtomically(path: string, state: SessionState): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const content = `${JSON.stringify(state, null, 2)}\n`
  const tempPath = join(
    dirname(path),
    `.${basename(path)}.tmp-${process.pid}-${Date.now()}-${atomicWriteCounter++}`,
  )
  let closed = false
  const handle = await open(tempPath, "w", 0o600)
  try {
    await handle.writeFile(content, "utf-8")
    await handle.sync()
    await handle.close()
    closed = true
    await rename(tempPath, path)
    fsyncDirectory(dirname(path))
  } catch (error) {
    if (!closed) {
      try {
        await handle.close()
      } catch {
        // Original write error is more useful than a cleanup error.
      }
    }
    await rm(tempPath, { force: true })
    throw error
  }
}

function fsyncDirectory(path: string): void {
  if (process.platform === "win32") return
  let descriptor: number | undefined
  try {
    descriptor = openSync(path, "r")
    fsyncSync(descriptor)
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
  }
}

function upsertById<T extends { id: string }>(items: T[], item: T): T[] {
  const index = items.findIndex((candidate) => candidate.id === item.id)
  if (index === -1) return [...items, item]
  return [...items.slice(0, index), item, ...items.slice(index + 1)]
}

function upsertBySourceExperiment<T extends { sourceExperimentId?: string }>(items: T[], item: T): T[] {
  const index = items.findIndex((candidate) => candidate.sourceExperimentId === item.sourceExperimentId)
  if (index === -1) return [...items, item]
  return [...items.slice(0, index), item, ...items.slice(index + 1)]
}

function isFileNotFound(error: unknown): boolean {
  return isErrorWithCode(error) && error.code === "ENOENT"
}

function isErrorWithCode(error: unknown): error is Error & { code: string } {
  return error instanceof Error && "code" in error && typeof (error as { code: unknown }).code === "string"
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
