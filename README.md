# Opencode Autoresearch

Measured research loops for OpenCode, with a server/text-first v1 that installs one shipped agent prompt, keeps session state on disk, and exports static snapshots for review.

## Purpose

Opencode Autoresearch turns a broad improvement request into a bounded loop with durable state. The shipped surface is the CLI plus `agent/autoresearch.md`, so the package stays file based and easy to inspect.

## v1 scope

* One repo local research loop at a time.
* CLI commands that read and write JSON state under a plugin owned directory.
* A shipped agent prompt that can be copied into an OpenCode config directory.
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

Build the CLI, then copy the shipped agent prompt into your OpenCode config directory:

```bash
bun run build
bun dist/cli.js install-agent --config-dir ~/.config/opencode
```

If your OpenCode config lives somewhere else, point `--config-dir` at that root instead:

```bash
bun dist/cli.js install-agent --config-dir <dir>
```

`install-agent` installs the packaged `agent/autoresearch.md` prompt into `<dir>/agent/autoresearch.md`. The packaged source file keeps the plain `name: autoresearch` frontmatter; the installed fallback file keeps the plain `autoresearch.md` filename and writes the runtime/frontmatter `name` with the five escaped `\u200B` prefixes used for OpenCode sorting. It refuses to overwrite an existing file unless you add `--force`.

The package allowlist includes `agent/`, so the shipped prompt asset is available in the package contents. Package-level OpenCode agent discovery from the package alone is not asserted by this repo; the fallback `install-agent --config-dir <dir>` path is tested and works regardless of package-level discovery behavior.

## Local OpenCode config example

If your local OpenCode config directory is `~/.config/opencode`, the install flow looks like this:

```bash
mkdir -p ~/.config/opencode/agent
bun dist/cli.js install-agent --config-dir ~/.config/opencode
```

That produces `~/.config/opencode/agent/autoresearch.md` as the installed prompt file.

## Enable and disable

The supported enable path is to install the agent prompt into the OpenCode config directory. The supported disable path is to remove the installed `agent/autoresearch.md` file from that directory.

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

The runtime and list display order uses five escaped zero width space prefixes only for sorting. The visible names stay plain. The packaged source prompt name stays `autoresearch`, while the supported fallback install writes the prefixed frontmatter name into `<dir>/agent/autoresearch.md` so OpenCode can sort by the configured name without changing the filename.

## Command reference

All commands print JSON.

| Command | What it does |
| --- | --- |
| `install-agent` | Install `agent/autoresearch.md` into an OpenCode config directory. |
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

* If `install-agent` says the agent already exists, rerun it with `--force` only when you really want to replace the file.
* If `install-agent` refuses a symlink, point `--config-dir` at a real directory path instead.
* If state does not appear, check that the command received a writable `--state-dir` or let it use the default `.opencode-autoresearch/` path.
* If you are looking at `refer/*`, remember it is read only reference material. It is not packaged.
