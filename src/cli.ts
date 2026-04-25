import { parseArgs } from "util"

export async function main(args: string[]) {
  console.log("opencode-autoresearch CLI")
  return 0
}

if (import.meta.main) {
  const result = await main(process.argv.slice(2))
  process.exit(result)
}
