import { afterEach, beforeEach, mock } from "bun:test"

beforeEach(() => {
  process.env.OPENCODE_AUTORESEARCH_TEST = "true"
})

afterEach(() => {
  delete process.env.OPENCODE_AUTORESEARCH_TEST
  mock.restore()
})
