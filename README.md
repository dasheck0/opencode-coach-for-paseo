# OpenCode Coach for Paseo

A native Paseo plugin that automatically summarizes your historical OpenCode sessions. Start with cross-session coaching priorities, frequency, trends, and concrete next steps; open individual sessions only when you want evidence. Analysis runs on your Paseo host without a model service, an OpenCode server, or VS Code.

## Install

Requires Paseo **0.15.3+**. Plugins must already be enabled in Paseo settings. Plugins are trusted code with your daemon's filesystem permissions; review the source before installing.

```sh
paseo plugin install git:dasheck0/opencode-coach-for-paseo --ref v0.5.2
paseo plugin ls opencode-coach-for-paseo
```

Open **OpenCode Coach** in the sidebar or **OpenCode Coach: Open overview** in the Command Center. Provider controls live under **Settings → Plugins → OpenCode Coach**.

The daemon needs `node:sqlite` (Node 22.13+), or a `sqlite3` executable (3.25+) on its PATH. Paseo supplies the plugin's React, React Native, Zod, and TanStack Query runtimes. Installation from Git needs no npm preparation or Microsoft project checkout.

## What is included

- OpenCode V2: `session_v2` metadata and ordered `session_message` inline content.
- Older OpenCode SQLite: `session`, `message`, and `part` tables.
- Automatic source discovery, configurable paths, and source selection.
- Historical date windows, Paseo project multi-selection, and 50-session pagination.
- An automatic overview across **every matching session in the selected source and period**, independent of the paginated session browser.
- Ranked coaching priorities with affected-session counts and percentages, practical next steps, and optional evidence links.
- Earlier/later period rate comparisons, a 14-day activity chart, and total tool, prompt, token, and recorded cost metrics.
- Background analysis with visible progress, per-session warning/failure counts, and persistent reuse of unchanged session reports.
- Optional individual-session browsing and detailed model, token, cache, tool, edit, error, and compaction metrics.
- Eight coaching checks: brief prompts, missing acceptance cues, edits without recognized verification, edits after verification, tool failures, repeated failing operations, long sessions, and repeated compaction.
- Evidence IDs, actionable advice, and separate informational findings for verification attempts and delegated sessions.
- Provider activation, deactivation, visibility, and selection with persisted host settings. Disabled providers cannot be read through RPC.
- A provider-independent registry, normalized model, analysis engine, and native React Native UI.

This is an initial independent implementation inspired by [Microsoft AI Engineering Coach](https://github.com/microsoft/AI-Engineering-Coach), not feature parity with its full dashboard or rule library. See [NOTICE](NOTICE) for the reviewed upstream revision and attribution. The native navigation grouping is adapted from its dashboard shell with attribution; its MIT license is preserved in [licenses/](licenses/microsoft-ai-engineering-coach-MIT.txt).

## Interface structure

The native UI follows the reference coach's **Observe / Measure / Improve** navigation, shared project/provider filters, page headers, metric cards, practice-area cards, charts, and drill-down hierarchy.

| Area | Page | Current data and behavior |
| --- | --- | --- |
| Observe | Dashboard | Four KPI cards, four practice areas, ranked next steps, daily activity bars, top workspaces |
| Observe | Timeline | Paginated session start/span bars grouped by UTC date, with selected-session evidence above the list |
| Measure | Output | Historical input/output/cache tokens, recorded costs, models by session, successful edit operations |
| Measure | Patterns | Work Hours heatmap (7×24 UTC), Calendar activity, Projects breakdown |
| Improve | Anti-Patterns | Ranked rule findings, frequency, earlier/later rates, recommendations and evidence links |
| Improve | Context Health | Recorded compaction and long-session signals with context-maintenance guidance |
| Settings | Providers | Activation, visibility, selection and explicit data paths |

Navigation preserves the same date/source/project filters and active analysis. Compact clients use a horizontal grouped menu. All pages use native React Native components and Paseo theme colors.

This is a structural adaptation, not full feature parity. The reference's Coding Moments screenshot gallery, Curiosity analysis, Skill Finder, Level Up/learning flows, instruction-file audits, AI readiness scores and code-line accounting are not implemented. They are omitted rather than shown as working features. Context Health is explicitly limited to session evidence. Edit-call totals are not labeled generated code lines. No model-backed feature or outbound model request is enabled.

## Language, origins, projects and persistence

- German and English UI, with saved host-scoped language selection. See [contributing translations](docs/translations.md) for adding JSON catalogs and registering another language.
- Saved date-window selection shared by every page. Reopening the Coach restores it instead of resetting to 30 days.
- Searchable multi-select of existing Paseo projects, with human-readable project/workspace labels in session details, evidence links, and top-workspace lists.
- Saved session-origin defaults per page, agreed with the user: Dashboard and Anti-Patterns use human-led main sessions; Output, Patterns, Timeline and Context Health include subagents. See [the scope matrix](docs/message-origins.md) for semantics and limitations.
- [Persistent incremental cache](docs/cache.md): changing 30→7→30 days or restarting the plugin reuses unchanged reports. Tomorrow only new or updated sessions need body imports. A cheap metadata scan still discovers changes; it is not a full body reimport. Cache reuse/import/error counts are visible.

## Overview first

The overview starts automatically when you open the Coach. Date and Paseo project multi-selection apply to all matching sessions in the selected database. Choose one or more existing Paseo projects from the searchable dropdown; an empty selection includes all projects. The first analysis of a large history can take several minutes. Results update as it runs and are marked provisional until it finishes. You can leave the screen while the daemon continues. **Browse individual sessions** is optional.

Patterns count each warning rule once per session. Informational findings are excluded from coaching priorities. The top three priorities are ranked by affected sessions, with concrete advice. Percentages use all analyzed sessions, including delegated work; they do not indicate productivity or code quality. Trends compare rule occurrence rates in the earlier and later halves of the selected period, with sample counts and percentage-point changes. They compare the session mix within that period, not against a separate previous period. The activity chart covers the last 14 UTC calendar days ending at the chosen cutoff.

Totals describe analyzed reports, not just the current history page. Unknown tokens and costs remain unknown; coverage counts show how many sessions reported them. Read failures and truncated reports remain visible. Refresh starts a new cutoff and reuses reports for unchanged session timestamps. Up to six overview jobs and 1000 normalized reports are retained in memory. Derived session reports are also saved in an atomic, compressed disk cache, so plugin reloads and daemon restarts do not discard analysis results. Overlapping jobs share in-flight session reads. Disabling a provider stops its overview before the next session is read.

## Data sources

By default, discovery checks `$XDG_DATA_HOME/opencode`, `~/.local/share/opencode`, `~/Library/Application Support/opencode`, and `%LOCALAPPDATA%/opencode` when applicable. It recognizes `opencode.db` and `opencode-*.db` files. Configure an absolute database file or data directory, one per line, to replace automatic discovery. Clear the path list to restore defaults.

If V2 and older tables coexist, V2 is used exclusively to avoid counting migrated sessions twice. Historical JSON-directory storage is not supported. Use an OpenCode SQLite database.

## Interpretation and limits

Findings describe observable log patterns. They do not assess correctness, productivity, or individual performance. Brief follow-ups can be appropriate. Prompt specificity uses English/German cues and file-path patterns. A verification command does not prove a passing result; tool completion does not imply exit code zero. Ordering within a single assistant message is not evaluated for the final-edit check.

Input tokens represent recorded uncached input; cache reads and writes are reported separately. Tokens are counted on assistant messages, never again on step-finish parts. Unknown usage stays unknown. Usage and cost metrics sum recorded assistant calls in the chosen session scope. Recorded costs depend on OpenCode/provider accounting and are not invoices. Elapsed span includes idle time.

Sessions with a parent are treated as delegated; their prompts are excluded from human metrics. System records are excluded; explicitly synthetic prompts are counted as AI prompts, never human prompts. Each report reads at most 2000 messages and 20000 older content parts. Each query has a 32 MiB content budget. Records over 2 MiB or malformed JSON are skipped with a warning. Text is capped at 20000 characters per message. Incomplete logs can produce incomplete findings. Data may change while a live session is being read; refresh for a newer report.

The source database is always opened read-only. No recorded tool command is executed. No session content is sent to external model services or telemetry endpoints. Authorized Paseo clients receive titles, directories, aggregate metrics, and evidence IDs. Derived reports are persisted in a protected local cache and retained in bounded daemon memory and the client query cache. Full prompt/response text and tool output are not persisted by the Coach.

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

Project selection includes the project root and its worktrees, including identifiable historical worktrees. The dropdown uses Paseo’s project list, including projects without active workspaces. Existing saved workspace selections migrate to their projects. Language selection is available only in Settings. Each anti-pattern has an info popover explaining its exact detection criteria and limitations; hover, keyboard focus and click/touch are supported.

Date windows use **message activity**, so a session started weeks ago is included when continued today. Prompt, token, tool and coaching metrics use only messages inside the selected window; details use the same window. Activity charts count active sessions rather than session starts. Trend halves group sessions by their first activity within the window. Existing aggregate-only cache entries receive a one-time local upgrade to timestamped, text-free rule features; later window switches reuse those features.

A clickable breadcrumb above the page header tracks your drill-down path. Select any earlier step to restore its view, scroll position, Patterns tab and session-list page. The current step is plain highlighted text. The path belongs to the open Coach screen and resets when the provider, source, project selection or period changes; it is not persisted across plugin reloads. Shared filters remain in place while navigating.
