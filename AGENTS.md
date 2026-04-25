# AGENTS.md

## Repository shape
- `src/index.ts` is the OpenCode plugin entry, `src/cli.ts` is the `opencode-autoresearch` CLI entry.
- Package contents are limited to `dist/`; do not add `agent/` back to packaged files.
- `refer/` is read only reference material, it is not packaged and it is not a runtime dependency.
- v1 is server/text-first and exports static snapshots only, not a browser UI, live server, or TUI.

## State and install contracts
- Default state lives under `.opencode-autoresearch/`.
- `--state-dir <dir>` changes that base directory.
- Session ids are safe to use in paths, with `<state-dir>/<session-id>.json` as the stored file.
- Enable the plugin through `opencode.json` with `"plugin": ["opencode-autoresearch"]`; disable it by removing that entry.
- The plugin config hook injects exactly one primary-only `autoresearch` agent. Keep both the config key and runtime `name` prefixed with five escaped `\u200B` prefixes for OpenCode/oh-my-openagent selection and list ordering. Do not add a hidden alias or `mode: all` unless the user explicitly asks for subagent use.

## Invisible-byte rule
- Document zero width prefixes only as escaped `\u200B` text.
- Do not add raw invisible bytes except in canonical approved source or fixtures.

## Verification commands
- `bun install`
- `bun run check`
- `bun run test`
- `bun test tests/readme.test.ts`
- Prefer `bun run test` for local work, because it is the repo’s bounded test path and avoids the raw full `bun test` recursion into `refer/` fixtures.

## Notes
- Use source and test backed wording only.
- If README prose and tests conflict, follow the executable config or tests.
