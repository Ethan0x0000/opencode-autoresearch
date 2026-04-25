import { describe, expect, test } from "bun:test"
import { AUTORESEARCH_RUNTIME_NAME, PLUGIN_ID, pluginModule } from "../src/index"
import { AUTORESEARCH_VISIBLE_NAME } from "../src/compat/zero-width"
import { simulatePluginLoader, validatePlugin } from "../src/compat/plugin-loader-fixture"

describe("plugin loading contract", () => {
  test("exports a stable v1-compatible server plugin", () => {
    expect(pluginModule.id).toBe(PLUGIN_ID)
    expect(typeof pluginModule.server).toBe("function")
    expect("tui" in pluginModule).toBe(false)
  })

  test("default export validates as a plugin module", async () => {
    const mod = await import("../src/index")
    expect(validatePlugin(mod)).toEqual({
      ok: true,
      plugin: {
        id: PLUGIN_ID,
        server: pluginModule.server,
      },
    })
  })

  test("config hook injects autoresearch as a strong main-visible research agent", async () => {
    const hooks = await pluginModule.server({ directory: process.cwd(), worktree: process.cwd(), serverUrl: new URL("http://localhost") })
    const config: { agent?: Record<string, Record<string, unknown>> } = {}

    await (hooks as { config: (input: typeof config) => Promise<void> }).config(config)

    expect(Object.keys(config.agent ?? {})).toEqual([AUTORESEARCH_RUNTIME_NAME])
    expect(config.agent?.[AUTORESEARCH_RUNTIME_NAME]).toMatchObject({
      name: AUTORESEARCH_RUNTIME_NAME,
      mode: "primary",
      description: "Strong autonomous research agent for bounded, evidence-backed OpenCode research loops.",
    })
    expect(config.agent?.[AUTORESEARCH_RUNTIME_NAME]?.prompt).toContain("strong research agent")
    expect(config.agent?.[AUTORESEARCH_RUNTIME_NAME]?.prompt).toContain("opencode-autoresearch")
    expect(config.agent?.[AUTORESEARCH_RUNTIME_NAME]?.prompt).toContain("Acceptance contract")
    expect(config.agent?.[AUTORESEARCH_RUNTIME_NAME]?.prompt).toContain("Research discipline")
    expect(config.agent?.[AUTORESEARCH_RUNTIME_NAME]?.prompt).toContain("one hypothesis")
    expect(config.agent?.[AUTORESEARCH_VISIBLE_NAME]).toBeUndefined()
    expect(config.agent?.[AUTORESEARCH_RUNTIME_NAME]?.hidden).toBeUndefined()
  })

  test("rejects missing default export", () => {
    expect(validatePlugin({})).toEqual({
      ok: false,
      error: "missing default export",
    })
  })

  test("rejects duplicate plugin ids deterministically", async () => {
    const calls: string[] = []
    const first = {
      default: {
        id: PLUGIN_ID,
        server: async () => {
          calls.push("first")
        },
      },
    }
    const second = {
      default: {
        id: PLUGIN_ID,
        server: async () => {
          calls.push("second")
        },
      },
    }

    const results = await simulatePluginLoader([{ module: first }, { module: second }])

    expect(calls).toEqual(["first"])
    expect(results).toEqual([
      { status: "loaded", id: PLUGIN_ID, active: true },
      { status: "duplicate", id: PLUGIN_ID, active: false },
    ])
  })

  test("disabled plugins do not activate hooks", async () => {
    const calls: string[] = []
    const mod = {
      default: {
        id: PLUGIN_ID,
        server: async () => {
          calls.push("server")
        },
      },
    }

    const results = await simulatePluginLoader([{ module: mod, enabled: false }])

    expect(calls).toEqual([])
    expect(results).toEqual([
      { status: "disabled", id: PLUGIN_ID, active: false },
    ])
  })
})
