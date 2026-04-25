import {
  AUTORESEARCH_SORT_PREFIX,
  OH_MY_OPENAGENT_PREFIX_COUNTS,
  ZERO_WIDTH_SPACE,
} from "./zero-width"

const INVISIBLE_AGENT_CHARACTERS_REGEX = /[\u200B\u200C\u200D\uFEFF]/g
export function applyRuntimeListPrefix(visibleName: string, prefixCount: number): string {
  if (prefixCount <= 0) return visibleName
  return `${ZERO_WIDTH_SPACE.repeat(prefixCount)}${visibleName}`
}

export function applyCanonicalRuntimeListPrefix(visibleName: string): string {
  if (visibleName === "autoresearch") {
    return AUTORESEARCH_SORT_PREFIX + visibleName
  }

  const prefixCount = OH_MY_OPENAGENT_PREFIX_COUNTS[visibleName as keyof typeof OH_MY_OPENAGENT_PREFIX_COUNTS]
  return typeof prefixCount === "number" ? applyRuntimeListPrefix(visibleName, prefixCount) : visibleName
}

export function stripRuntimeListPrefix(value: string): string {
  return value.replace(INVISIBLE_AGENT_CHARACTERS_REGEX, "")
}

export function normalizeVisibleAgentName(value: string): string {
  return stripRuntimeListPrefix(value).trim()
}

export function sortFixtureNames(names: readonly string[]): string[] {
  const priority = new Map<string, number>([
    ["sisyphus", 1],
    ["hephaestus", 2],
    ["prometheus", 3],
    ["atlas", 4],
    ["autoresearch", 5],
  ])

  return [...names].sort((left, right) => {
    const leftKey = normalizeVisibleAgentName(left).toLowerCase()
    const rightKey = normalizeVisibleAgentName(right).toLowerCase()
    const leftPriority = priority.get(leftKey) ?? Number.POSITIVE_INFINITY
    const rightPriority = priority.get(rightKey) ?? Number.POSITIVE_INFINITY

    if (leftPriority !== rightPriority) return leftPriority - rightPriority
    return leftKey.localeCompare(rightKey)
  })
}
