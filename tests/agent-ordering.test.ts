import { describe, expect, it } from "bun:test"
import {
  applyCanonicalRuntimeListPrefix,
  applyRuntimeListPrefix,
  normalizeVisibleAgentName,
  sortFixtureNames,
  stripRuntimeListPrefix,
} from "../src/compat/agent-ordering"
import {
  AUTORESEARCH_PREFIX_COUNT,
  AUTORESEARCH_SORT_PREFIX,
  AUTORESEARCH_VISIBLE_NAME,
  OH_MY_OPENAGENT_PREFIX_COUNTS,
  ZERO_WIDTH_SPACE,
} from "../src/compat/zero-width"

describe("canonical zero-width ordering", () => {
  it("exports the canonical zero-width constants", () => {
    expect(ZERO_WIDTH_SPACE).toBe("\u200B")
    expect(OH_MY_OPENAGENT_PREFIX_COUNTS).toEqual({
      sisyphus: 1,
      hephaestus: 2,
      prometheus: 3,
      atlas: 4,
    })
    expect(AUTORESEARCH_PREFIX_COUNT).toBe(5)
    expect(AUTORESEARCH_SORT_PREFIX).toBe("\u200B\u200B\u200B\u200B\u200B")
    expect(AUTORESEARCH_VISIBLE_NAME).toBe("autoresearch")
  })

  it("applies and strips runtime list prefixes", () => {
    const prefixed = applyRuntimeListPrefix("atlas", 4)
    expect(prefixed).toBe("\u200B\u200B\u200B\u200Batlas")
    expect(stripRuntimeListPrefix(prefixed)).toBe("atlas")
    expect(normalizeVisibleAgentName("\u200B\u200BHephaestus - Deep Agent")).toBe("Hephaestus - Deep Agent")
  })

  it("sorts a raw prefixed runtime list into the visible canonical order", () => {
    const runtimeList = [
      applyRuntimeListPrefix("autoresearch", 5),
      applyRuntimeListPrefix("atlas", 4),
      applyRuntimeListPrefix("prometheus", 3),
      applyRuntimeListPrefix("hephaestus", 2),
      applyRuntimeListPrefix("sisyphus", 1),
    ]

    expect(sortFixtureNames(runtimeList).map(normalizeVisibleAgentName)).toEqual([
      "sisyphus",
      "hephaestus",
      "prometheus",
      "atlas",
      "autoresearch",
    ])
  })

  it("keeps autoresearch usable without oh-my-openagent fixtures", () => {
    expect(applyCanonicalRuntimeListPrefix(AUTORESEARCH_VISIBLE_NAME)).toBe("\u200B\u200B\u200B\u200B\u200Bautoresearch")
    expect(stripRuntimeListPrefix("\u200B\u200B\u200B\u200B\u200Bautoresearch")).toBe("autoresearch")
    expect(sortFixtureNames(["autoresearch", "other"])).toEqual(["autoresearch", "other"])
  })
})
