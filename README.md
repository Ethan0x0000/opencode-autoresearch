# Opencode Autoresearch

Measured research loops for OpenCode, with a server/text-first v1 that injects one strong research agent through the OpenCode plugin config hook, keeps session state on disk, and exports static snapshots for review.

## Purpose

Opencode Autoresearch turns a broad improvement request into a bounded loop with durable state. The shipped surface is the OpenCode plugin plus the `opencode-autoresearch` CLI binary.

## v1 scope

* One repo local research loop at a time.
* A plugin-injected `autoresearch` agent configured from `opencode.json`.
* CLI commands that read and write JSON state under a plugin owned directory.
* Static export files for review.
* A server/text-first workflow, not an interactive app.

## Non goals

* No browser dashboard.
* No live dashboard server.
* No TUI.
* No MCP server.
* No promise of full `codex-autoresearch` parity.
* No npm publishing claim.

## Install in OpenCode

Install the package where OpenCode can resolve npm plugins, then enable it in `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-autoresearch"]
}
```

For local development, point OpenCode at the built package directory instead:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["/absolute/path/to/opencode-autoresearch"]
}
```

The plugin injects a single primary-only `autoresearch` agent. It uses a five-prefix runtime key/name for OpenCode ordering and does not add a hidden plain alias or subagent-capable `mode: all` entry. The package also exposes the `opencode-autoresearch` binary for durable state commands.

## Local OpenCode config example

If your local OpenCode config directory is `~/.config/opencode`, add this entry to `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["opencode-autoresearch"]
}
```

Disable it by removing `opencode-autoresearch` from the `plugin` array.

## Enable and disable

The supported enable path is the OpenCode `plugin` array. The supported disable path is removing `opencode-autoresearch` from that array.

The package itself stays read only here. This repo does not advertise a browser toggle, a live service toggle, or any broader OpenCode config rewrite.

## Coexistence with oh-my-openagent

This plugin is designed to sit alongside oh-my-openagent. The visible runtime order should end with `autoresearch`, after the four oh-my-openagent agents:

1. `sisyphus`
2. `hephaestus`
3. `prometheus`
4. `atlas`
5. `autoresearch`

That order is handled with five escaped zero width space prefixes in runtime and list display only. The visible names stay plain, the sort keys use `\u200B` prefixes behind the scenes:

* `sisyphus` uses `\u200B`
* `hephaestus` uses `\u200B\u200B`
* `prometheus` uses `\u200B\u200B\u200B`
* `atlas` uses `\u200B\u200B\u200B\u200B`
* `autoresearch` uses `\u200B\u200B\u200B\u200B\u200B`

## Zero width ordering

The runtime and list display order uses five escaped zero width space prefixes only for sorting. The plugin injects the prefixed runtime `name` so OpenCode can sort by the configured name while the visible agent remains `autoresearch`.

## Command reference

All commands print JSON.

| Command | What it does |
| --- | --- |
| `prompt-plan` | Record the goal and constraints in plugin owned session state. |
| `setup-plan` | Record setup checklist items for the session. |
| `onboarding-packet` | Print the current session summary. |
| `recommend-next` | Return one safe next experiment recommendation. |
| `next-experiment` | Create or return a pending experiment entry. |
| `log-experiment` | Record an experiment result, metric, and status. |
| `doctor-session` | Report missing setup, stale experiments, and recovery issues. |
| `checks-inspect` | Record supplied check output summary. |
| `benchmark-lint` | Validate benchmark metric contract fields. |
| `export-dashboard` | Write offline JSON and Markdown dashboard snapshots. |
| `finalize-preview` | Preview finalization counts without mutating source files. |

`export-dashboard` writes a static snapshot only. It does not start a browser UI or a live server.

## State location

Session state lives under `.opencode-autoresearch/` by default.

* `--state-dir <dir>` changes the base directory.
* `--session-id <id>` selects the session file name.
* The session file path is `<state-dir>/<session-id>.json`.
* The default session id is `default`.

## Verification

Use these local checks in this repo today:

```bash
bun install
bun run build
bun run typecheck
bun run test
bun test tests/readme.test.ts
```

Plain `bun test` is the full-project hardening goal, but today it can recurse into `refer/` fixtures and fail in this repo. Use `bun run test` or explicit-path test commands for local verification.

## Troubleshooting

* If the agent does not appear, confirm `opencode-autoresearch` is present in the active OpenCode `plugin` array.
* If state does not appear, check that the command received a writable `--state-dir` or let it use the default `.opencode-autoresearch/` path.
* If you are looking at `refer/*`, remember it is read only reference material. It is not packaged.
