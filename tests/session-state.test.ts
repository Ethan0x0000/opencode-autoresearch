/// <reference types="bun-types" />
/// <reference path="./bun-test.d.ts" />

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs"
import { readdir } from "fs/promises"
import { tmpdir } from "os"
import { join, resolve } from "path"
import { SESSION_SCHEMA_VERSION } from "../src/session/schema"
import { createSessionStore, DEFAULT_SESSION_BASE_DIR } from "../src/session/store"

const createdAt = "2026-04-25T00:00:00.000Z"
const updatedAt = "2026-04-25T00:01:00.000Z"

function clock(...timestamps: string[]) {
  let index = 0
  return () => timestamps[Math.min(index++, timestamps.length - 1)]
}

async function corruptFiles(dir: string) {
  return (await readdir(dir)).filter((entry) => entry.includes(".corrupt."))
}

async function expectRejects(promise: Promise<unknown>, pattern: RegExp) {
  let rejection: unknown
  try {
    await promise
  } catch (error) {
    rejection = error
  }
  if (rejection === undefined) throw new Error("Expected promise to reject")
  expect(errorMessage(rejection)).toMatch(pattern)
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

describe("plugin-owned session state", () => {
  let baseDir: string

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), "opencode-autoresearch-state-"))
  })

  afterEach(() => {
    try {
      chmodSync(baseDir, 0o700)
    } catch {
      // Directory may already be gone in read-only failure cases.
    }
    rmSync(baseDir, { recursive: true, force: true })
  })

  test("creates and reads a versioned session under an explicit base directory", async () => {
    const store = createSessionStore({ baseDir, now: clock(createdAt) })

    const created = await store.create({ sessionId: "round-trip", goal: "Improve recommendation quality" })
    const read = await store.read("round-trip")

    expect(store.baseDir).toBe(baseDir)
    expect(store.sessionPath("round-trip")).toBe(join(baseDir, "round-trip.json"))
    expect(created.schemaVersion).toBe(SESSION_SCHEMA_VERSION)
    expect(created.sessionId).toBe("round-trip")
    expect(created.goal).toBe("Improve recommendation quality")
    expect(created.setup).toEqual({ checklist: [], notes: "" })
    expect(created.status).toBe("new")
    expect(created.createdAt).toBe(createdAt)
    expect(created.updatedAt).toBe(createdAt)
    expect(created.experiments).toEqual([])
    expect(created.metrics).toEqual([])
    expect(created.recommendations).toEqual([])
    expect(created.notes).toEqual([])
    expect(read.status).toBe("ready")
    if (read.status === "ready") expect(read.state).toEqual(created)
  })

  test("defaults to .opencode-autoresearch in the current workspace", () => {
    const store = createSessionStore()

    expect(DEFAULT_SESSION_BASE_DIR).toBe(resolve(process.cwd(), ".opencode-autoresearch"))
    expect(store.baseDir).toBe(DEFAULT_SESSION_BASE_DIR)
  })

  test("appends experiments while preserving createdAt and updating updatedAt", async () => {
    const store = createSessionStore({ baseDir, now: clock(createdAt, updatedAt) })
    await store.create({ sessionId: "append-experiment", goal: "Try a measured change" })

    const updated = await store.appendExperiment("append-experiment", {
      id: "exp-1",
      run: 1,
      hypothesis: "A clearer prompt improves quality_gap.",
      status: "keep",
      metric: { name: "quality_gap", value: 0, direction: "lower" },
      evidence: "Targeted test passed.",
      nextActionHint: "Finalize kept work.",
    })

    expect(updated.createdAt).toBe(createdAt)
    expect(updated.updatedAt).toBe(updatedAt)
    expect(updated.experiments).toHaveLength(1)
    expect(updated.experiments[0]).toMatchObject({
      id: "exp-1",
      run: 1,
      status: "keep",
      metric: { name: "quality_gap", value: 0, direction: "lower" },
    })
    expect(updated.metrics).toEqual([{ name: "quality_gap", value: 0, direction: "lower", sourceExperimentId: "exp-1" }])
    expect(existsSync(`${store.sessionPath("append-experiment")}.tmp`)).toBe(false)
  })

  test("repeated create calls are idempotent for an existing session", async () => {
    const store = createSessionStore({ baseDir, now: clock(createdAt, updatedAt, "2026-04-25T00:02:00.000Z") })
    const first = await store.create({ sessionId: "repeat", goal: "Original goal" })
    await store.appendExperiment("repeat", {
      id: "exp-1",
      run: 1,
      hypothesis: "Keep existing state.",
      status: "pending",
    })

    const second = await store.create({ sessionId: "repeat", goal: "Different goal should not overwrite" })

    expect(second.goal).toBe("Original goal")
    expect(second.createdAt).toBe(first.createdAt)
    expect(second.experiments.map((experiment) => experiment.id)).toEqual(["exp-1"])
  })

  test("repeated experiment ids update the existing entry instead of duplicating it", async () => {
    const store = createSessionStore({ baseDir, now: clock(createdAt, updatedAt, "2026-04-25T00:02:00.000Z") })
    await store.create({ sessionId: "repeat-experiment", goal: "Retry a run safely" })
    await store.appendExperiment("repeat-experiment", {
      id: "exp-1",
      run: 1,
      hypothesis: "First packet.",
      status: "pending",
    })

    const repeated = await store.appendExperiment("repeat-experiment", {
      id: "exp-1",
      run: 1,
      hypothesis: "First packet with result.",
      status: "keep",
      metric: { name: "quality_gap", value: 0, direction: "lower" },
    })

    expect(repeated.experiments).toHaveLength(1)
    expect(repeated.experiments[0]).toMatchObject({
      id: "exp-1",
      status: "keep",
      hypothesis: "First packet with result.",
      createdAt: updatedAt,
      updatedAt: "2026-04-25T00:02:00.000Z",
    })
    expect(repeated.metrics).toEqual([{ name: "quality_gap", value: 0, direction: "lower", sourceExperimentId: "exp-1" }])
  })

  test("quarantines corrupt JSON and reports recovery without silently discarding it", async () => {
    const store = createSessionStore({ baseDir, now: clock(createdAt) })
    const path = store.sessionPath("corrupt")
    writeFileSync(path, "{ not json", "utf-8")

    const recovered = await store.read("corrupt")

    expect(recovered.status).toBe("recovered")
    if (recovered.status === "recovered") {
      expect(recovered.reason).toContain("Corrupt session state")
      expect(recovered.corruptPath).toMatch(/corrupt\.json\.corrupt\./)
      expect(readFileSync(recovered.corruptPath, "utf-8")).toBe("{ not json")
    }
    expect(existsSync(path)).toBe(false)
    expect(await corruptFiles(baseDir)).toHaveLength(1)
  })

  test("quarantines valid JSON with the wrong schema shape", async () => {
    const store = createSessionStore({ baseDir, now: clock(createdAt) })
    const path = store.sessionPath("wrong-shape")
    writeFileSync(path, JSON.stringify({ schemaVersion: SESSION_SCHEMA_VERSION, sessionId: "wrong-shape" }), "utf-8")

    const recovered = await store.read("wrong-shape")

    expect(recovered.status).toBe("recovered")
    expect(existsSync(path)).toBe(false)
    expect(await corruptFiles(baseDir)).toHaveLength(1)
  })

  test("rejects future schema versions without quarantining the file", async () => {
    const store = createSessionStore({ baseDir, now: clock(createdAt) })
    const path = store.sessionPath("future")
    writeFileSync(
      path,
      JSON.stringify({ schemaVersion: SESSION_SCHEMA_VERSION + 1, sessionId: "future", future: true }),
      "utf-8",
    )

    await expectRejects(store.read("future"), /Unsupported future session schema version 2/)
    expect(existsSync(path)).toBe(true)
    expect(JSON.parse(readFileSync(path, "utf-8")).schemaVersion).toBe(SESSION_SCHEMA_VERSION + 1)
    expect(await corruptFiles(baseDir)).toHaveLength(0)
  })

  test("fails clearly when the session directory is read-only", async () => {
    const store = createSessionStore({ baseDir, now: clock(createdAt) })
    chmodSync(baseDir, 0o555)

    await expectRejects(store.create({ sessionId: "read-only", goal: "Cannot write" }), /Unable to write session state/)
    expect(existsSync(store.sessionPath("read-only"))).toBe(false)
  })

  test("rejects unsafe session ids before resolving a filesystem path", () => {
    const store = createSessionStore({ baseDir })

    expect(() => store.sessionPath("../opencode-session")).toThrow(/Unsafe session id/)
    expect(() => store.sessionPath("contains/slash")).toThrow(/Unsafe session id/)
  })
})
