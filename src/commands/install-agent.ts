import { constants } from "fs"
import { access, lstat, mkdir, readFile, rename, rm, writeFile } from "fs/promises"
import { dirname, join, resolve } from "path"
import { optionBoolean, optionString, type CommandHandler } from "../cli"
import { renderInstalledAutoresearchAgent } from "../compat/installed-agent"

export const installAgentCommand: CommandHandler = async (context) => {
  const configDir = optionString(context.args, "config-dir")
  if (configDir === undefined) throw new Error("Missing required option: --config-dir")

  const agentDir = join(resolve(configDir), "agent")
  await rejectSymlink(resolve(configDir))
  await rejectSymlink(agentDir)
  await mkdir(agentDir, { recursive: true })
  await rejectSymlink(agentDir)

  const target = join(agentDir, "autoresearch.md")
  const targetState = await pathState(target)
  if (targetState === "symlink") throw new Error(`Refusing to write through symlink: ${target}`)
  if (targetState === "directory") throw new Error(`Refusing to overwrite directory: ${target}`)
  if (targetState === "file" && !optionBoolean(context.args, "force")) {
    throw new Error(`Agent already exists: ${target}\nUse --force to overwrite.`)
  }

  await copyAgentFile(target, targetState === "file")
  return { ok: true, path: target, overwritten: targetState === "file" }
}

async function packagedAgentPath() {
  const candidates = [
    join(import.meta.dir, "..", "agent", "autoresearch.md"),
    join(import.meta.dir, "..", "..", "agent", "autoresearch.md"),
  ]
  for (const candidate of candidates) {
    if (await pathExists(candidate)) return candidate
  }
  throw new Error("Packaged agent asset not found: agent/autoresearch.md")
}

async function copyAgentFile(target: string, overwrite: boolean) {
  const source = renderInstalledAutoresearchAgent(await readFile(await packagedAgentPath(), "utf-8"))
  if (!overwrite) {
    await writeFile(target, source, { flag: constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY })
    return
  }

  const tempPath = join(dirname(target), `.autoresearch.md.tmp-${process.pid}-${Date.now()}`)
  try {
    await writeFile(tempPath, source, { flag: constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY })
    await rename(tempPath, target)
  } catch (error) {
    await rm(tempPath, { force: true })
    throw error
  }
}

async function rejectSymlink(path: string) {
  const state = await pathState(path)
  if (state === "symlink") throw new Error(`Refusing to write through symlink: ${path}`)
}

async function pathState(path: string): Promise<"missing" | "file" | "directory" | "symlink"> {
  try {
    const stats = await lstat(path)
    if (stats.isSymbolicLink()) return "symlink"
    if (stats.isDirectory()) return "directory"
    return "file"
  } catch (error) {
    if (isFileNotFound(error)) return "missing"
    throw error
  }
}

async function pathExists(path: string) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function isFileNotFound(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error as { code: unknown }).code === "ENOENT"
}
