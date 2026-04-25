import { describe, it, expect } from "bun:test"
import { readFileSync } from "fs"
import { resolve } from "path"

describe("package scaffold", () => {
  describe("#setup", () => {
    it("has package.json at root", () => {
      const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf-8"))
      expect(pkg).toBeDefined()
      expect(pkg.name).toBe("opencode-autoresearch")
      expect(pkg.type).toBe("module")
    })

    it("package.json has required scripts", () => {
      const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf-8"))
      expect(pkg.scripts).toBeDefined()
      expect(pkg.scripts.typecheck).toBeDefined()
      expect(pkg.scripts.build).toBeDefined()
      expect(pkg.scripts.test).toBeDefined()
      expect(pkg.scripts.check).toBeDefined()
    })

    it("package.json exports and main fields are correct", () => {
      const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf-8"))
      expect(pkg.main).toBe("./dist/index.js")
      expect(pkg.types).toBe("./dist/index.d.ts")
      expect(pkg.exports).toBeDefined()
    })

    it("package.json files allowlist ships only dist and excludes agent prompts", () => {
      const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf-8"))
      expect(pkg.files).toEqual(["dist"])
      expect(pkg.files.some((f: string) => f.includes("agent"))).toBe(false)
      expect(pkg.files.some((f: string) => f.includes("refer"))).toBe(false)
    })

    it("package.json exposes a binary for local CLI commands", () => {
      const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf-8"))
      expect(pkg.bin).toEqual({ "opencode-autoresearch": "./dist/cli.js" })
    })
  })

  describe("#plugin-surface", () => {
    it("src/index.ts exists and exports plugin id constant", async () => {
      const indexPath = resolve("src/index.ts")
      const content = readFileSync(indexPath, "utf-8")
      // Should have plugin id constant or similar surface
      expect(content).toContain("opencode-autoresearch")
    })

    it("src/cli.ts exists", () => {
      const cliPath = resolve("src/cli.ts")
      const content = readFileSync(cliPath, "utf-8")
      expect(content).toBeDefined()
      expect(content.length).toBeGreaterThan(0)
    })
  })

  describe("#build-output", () => {
    it("dist/index.js and dist/cli.js exist", () => {
      const { existsSync, statSync } = require("fs")
      const indexPath = resolve("dist/index.js")
      const cliPath = resolve("dist/cli.js")
      expect(existsSync(indexPath)).toBe(true)
      expect(existsSync(cliPath)).toBe(true)
      expect(statSync(indexPath).size).toBeGreaterThan(0)
      expect(statSync(cliPath).size).toBeGreaterThan(0)
    })

    it("dist/index.d.ts and dist/cli.d.ts type declarations exist", () => {
      const { existsSync } = require("fs")
      const indexDtsPath = resolve("dist/index.d.ts")
      const cliDtsPath = resolve("dist/cli.d.ts")
      expect(existsSync(indexDtsPath)).toBe(true)
      expect(existsSync(cliDtsPath)).toBe(true)
    })
  })

  describe("#refer-is-not-runtime-dependency", () => {
    it("src/index.ts does not import from refer/", () => {
      const content = readFileSync(resolve("src/index.ts"), "utf-8")
      expect(content).not.toContain('from "../../refer')
      expect(content).not.toContain('from "../refer')
    })

    it("src/cli.ts does not import from refer/", () => {
      const content = readFileSync(resolve("src/cli.ts"), "utf-8")
      expect(content).not.toContain('from "../../refer')
      expect(content).not.toContain('from "../refer')
      expect(content).not.toContain("refer/")
    })
  })
})
