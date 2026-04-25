import { cp, mkdir } from "fs/promises"
import { dirname, join, resolve } from "path"

export type DefaultExportModule = {
  default?: unknown
}

export type ValidPlugin = {
  id: string
  server: (input: unknown, options?: unknown) => unknown
}

export type LoadRequest = {
  module: unknown
  enabled?: boolean
}

export type LoadResult =
  | { status: "loaded"; id: string; active: true }
  | { status: "disabled"; id: string; active: false }
  | { status: "duplicate"; id: string; active: false }
  | { status: "invalid"; error: string; active: false }

export function defaultExport(module: unknown): unknown | undefined {
  if (!module || typeof module !== "object") return
  if (!("default" in module)) return
  return (module as DefaultExportModule).default
}

export function validatePlugin(module: unknown, expectedId = "opencode-autoresearch"): { ok: true; plugin: ValidPlugin } | { ok: false; error: string } {
  const value = defaultExport(module)
  if (value === undefined) return { ok: false, error: "missing default export" }
  if (!value || typeof value !== "object") return { ok: false, error: "default export must be an object" }

  const plugin = value as Record<string, unknown>
  if (plugin.id !== expectedId) {
    return { ok: false, error: `expected stable plugin id ${expectedId}` }
  }

  if (typeof plugin.server !== "function") {
    return { ok: false, error: "default export must expose server()" }
  }

  if ("tui" in plugin) {
    return { ok: false, error: "v1 plugin must not expose tui()" }
  }

  return {
    ok: true,
    plugin: {
      id: plugin.id,
      server: plugin.server as ValidPlugin["server"],
    },
  }
}

export async function simulatePluginLoader(requests: LoadRequest[]) {
  const seen = new Set<string>()
  const results: LoadResult[] = []

  for (const request of requests) {
    const validated = validatePlugin(request.module)
    if (!validated.ok) {
      results.push({ status: "invalid", error: validated.error, active: false })
      continue
    }

    const id = validated.plugin.id
    if (seen.has(id)) {
      results.push({ status: "duplicate", id, active: false })
      continue
    }
    seen.add(id)

    if (request.enabled === false) {
      results.push({ status: "disabled", id, active: false })
      continue
    }

    await Promise.resolve(validated.plugin.server({}))
    results.push({ status: "loaded", id, active: true })
  }

  return results
}

export async function copyAutoresearchAgent(configDir: string) {
  const source = resolve("agent/autoresearch.md")
  const destination = join(configDir, "agent", "autoresearch.md")
  await mkdir(dirname(destination), { recursive: true })
  await cp(source, destination)
  return destination
}
