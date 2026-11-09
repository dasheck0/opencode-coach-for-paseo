# OpenCode Coach for Paseo

A native Paseo plugin for understanding historical OpenCode sessions. Browse sessions, inspect tool and token usage, and get coaching suggestions backed by message IDs. Analysis runs on your Paseo host without a model service, an OpenCode server, or VS Code.

## Install

Requires Paseo **0.15.3+**. Plugins must already be enabled in Paseo settings. Plugins are trusted code with your daemon's filesystem permissions; review the source before installing.

```sh
paseo plugin install github:dasheck0/opencode-coach-for-paseo --ref v0.1.0
paseo plugin ls opencode-coach-for-paseo
```

Open **OpenCode Coach** in the sidebar or **OpenCode Coach: Open history** in the Command Center. Provider controls live under **Settings → Plugins → OpenCode Coach**.

The daemon needs `node:sqlite` (Node 22.13+), or a `sqlite3` executable (3.25+) on its PATH. Paseo supplies the plugin's React, React Native, Zod, and TanStack Query runtimes. Installation from Git needs no npm preparation or Microsoft project checkout.

## What is included

- OpenCode V2: `session_v2` metadata and ordered `session_message` inline content.
- Older OpenCode SQLite: `session`, `message`, and `part` tables.
- Automatic source discovery, configurable paths, and source selection.
- Historical date windows, exact directory filtering, and 50-session pagination.
- Current-page activity counts and recorded costs, with per-session model, token, cache, tool, edit, error, and compaction metrics.
- Eight coaching checks: brief prompts, missing acceptance cues, edits without recognized verification, edits after verification, tool failures, repeated failing operations, long sessions, and repeated compaction.
- Evidence IDs, actionable advice, and separate informational findings for verification attempts and delegated sessions.
- Provider activation, deactivation, visibility, and selection with persisted host settings. Disabled providers cannot be read through RPC.
- A provider-independent registry, normalized model, analysis engine, and native React Native UI.

This is an initial independent implementation inspired by [Microsoft AI Engineering Coach](https://github.com/microsoft/AI-Engineering-Coach), not feature parity with its full dashboard or rule library. See [NOTICE](NOTICE) for the reviewed upstream revision and attribution. No Microsoft implementation code is included; its MIT license is preserved in [licenses/](licenses/microsoft-ai-engineering-coach-MIT.txt).

## Data sources

By default, discovery checks `$XDG_DATA_HOME/opencode`, `~/.local/share/opencode`, `~/Library/Application Support/opencode`, and `%LOCALAPPDATA%/opencode` when applicable. It recognizes `opencode.db` and `opencode-*.db` files. Configure an absolute database file or data directory, one per line, to replace automatic discovery. Clear the path list to restore defaults.

If V2 and older tables coexist, V2 is used exclusively to avoid counting migrated sessions twice. Historical JSON-directory storage is not supported. Use an OpenCode SQLite database.

## Interpretation and limits

Findings describe observable log patterns. They do not assess correctness, productivity, or individual performance. Brief follow-ups can be appropriate. Prompt specificity uses English/German cues and file-path patterns. A verification command does not prove a passing result; tool completion does not imply exit code zero. Ordering within a single assistant message is not evaluated for the final-edit check.

Input tokens represent recorded uncached input; cache reads and writes are reported separately. Tokens are counted on assistant messages, never again on step-finish parts. Unknown usage stays unknown. Session metadata costs are used for page totals; detailed metrics sum recorded assistant calls. Recorded costs depend on OpenCode/provider accounting and are not invoices. Elapsed span includes idle time.

Sessions with a parent are treated as delegated; their prompts are excluded from human metrics. System and synthetic records are excluded too. Each report reads at most 2000 messages and 20000 older content parts. Each query has a 32 MiB content budget. Records over 2 MiB or malformed JSON are skipped with a warning. Text is capped at 20000 characters per message. Incomplete logs can produce incomplete findings. Data may change while a live session is being read; refresh for a newer report.

The source database is always opened read-only. No recorded tool command is executed. No session content is sent to external model services or telemetry endpoints. Authorized Paseo clients receive titles, directories, aggregate metrics, and evidence IDs. Reports are held in the normal client query cache; this plugin does not persist copied conversations.

## Development

Use **Node 22.13+** (Node 24 recommended).

```sh
npm ci
npm run check
paseo plugin install /absolute/path/to/opencode-coach-for-paseo
# After source edits:
npm run typecheck
paseo plugin reload opencode-coach-for-paseo
paseo plugin logs opencode-coach-for-paseo
```

Standalone inspection, outside Paseo:

```sh
npm run coach -- sources
npm run coach -- history SOURCE_ID
npm run coach -- analyze SOURCE_ID SESSION_ID
# Optional custom source for CLI use only:
COACH_OPENCODE_DB=/absolute/path/opencode.db npm run coach -- sources
```

See [adapter development](docs/adapters.md) and [verification](docs/verification.md). Claude Code is an extension point, not an included working adapter.

## License

MIT. Independent of Microsoft, OpenCode, and Paseo.
