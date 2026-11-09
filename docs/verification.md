# Verification record

Initial implementation checked on 2026-11-09 with Paseo daemon/app 0.15.3 on macOS and Node 24.19.0. No private session content or database fixtures are distributed.

- `npm run typecheck`: passed against the published Paseo Plugin SDK 0.15.3, with strict TypeScript and no DOM library.
- `npm test`: 24 tests passed across four files.
- Both native `node:sqlite` and the system `sqlite3` fallback read synthetic V2 and older SQLite fixtures.
- Database bytes remained unchanged by a complete read-and-analysis cycle.
- Tests cover schema priority, stable pagination/date/directory filters, SQL quoting, malformed records, source discovery failures, synthetic and child prompts, token deduplication, missing usage, verification semantics, retry loops, disabled providers, unknown source IDs, and duplicate registration.
- React component tests exercise desktop/light and compact/dark props, themed text, error rendering, analysis dispatch, and provider activation/visibility/path save controls. These use mocked host primitives and do not substitute for native device QA.
- Installed the plugin into an already plugin-enabled local daemon. `paseo plugin ls opencode-coach-for-paseo --json` returned `enabled: true`, `status: running`.
- The real Paseo desktop app displayed the registered project/workspace, Coach sidebar contribution, detected V2 source, and a 50-session history page fetched through the plugin RPC.
- Read and analyzed an existing local V2 session through the same adapter and engine: 14 assistant calls, 17 tool calls, 2 successful edit calls, 1 recognized verification command, and no import warning. Counts are a point-in-time sample, not a benchmark or correctness claim.
- Exercised installed catalog, history, and analysis RPCs through an authenticated local Paseo SDK connection, including a missing-session error. All three succeeded and the expected error was returned.
- Regenerated the dependency lock from an empty directory after the initial CI install exposed an inconsistent transitive resolution; a clean `npm ci --ignore-scripts` then succeeded.
- Verified direct installation from the public Git repository under a temporary runtime ID, with no local development dependency tree. The plugin reached running and its catalog/history/analysis RPCs succeeded. The temporary installation was removed; the development installation remains running.
- Pinned React, React Native, and the renderer to compatible development versions; strict peer resolution and a clean Node 22 install succeeded.
- No HTML/DOM usage in client modules. React Native primitives and theme colors are used throughout.

Not yet verified on a physical iOS/Android device, on Windows/Linux hosts, or by visually switching the live app theme. Compact/dark coverage is component-level. Provider setting mutations are exercised in component/service tests; live settings conflict/reconnect behavior relies on the Paseo SDK contract. Claude Code parsing is not implemented.

GitHub Actions runs the same typecheck and tests from a clean dependency install on Node 22 and Node 24. Consult the repository Actions page for the actual remote run result rather than assuming a local pass proves CI passed.


## Version 0.2: automatic cross-session overview

- Strict typecheck and 35 tests pass across five files. New tests cover all-session pagination (251 sessions across multiple pages), automatic insights without session clicks, exact/date filters, unchanged-report reuse and timestamp invalidation, overlapping-job read deduplication, provider deactivation during a job, read failures, truncated reports, duplicate findings, rate normalization, unknown usage, and non-advancing adapters.
- The real Paseo app displayed the automatic overview with ranked priorities, counts, provisional progress, period comparisons, and activity, while the session browser remained closed.
- The default overview enumerated 665 matching sessions in a real local 30-day window. The full live scan completed: 665 of 665 sessions analyzed, zero unreadable sessions, three reports flagged as incomplete, and eight warning-rule groups. The cold run took about 335 seconds with overlapping desktop and verification requests; this is one local sample, not a performance benchmark.
- GitHub CI passed on Node 22 and Node 24: https://github.com/dasheck0/opencode-coach-for-paseo/actions/runs/42605679748
- Added support for common `npm run check` / `pnpm check` verification commands; a recognized command still does not prove passing results.
- Native compact/dark rendering remains covered by component tests; physical-device verification is still outstanding.


## Version 0.3: reference-aligned native interface

- Compared the pinned Microsoft revision's dashboard-shell.ts, page-dashboard.ts, page-patterns.ts, and relevant styles. Adapted Observe / Measure / Improve grouping, dashboard hierarchy, and Patterns tabs to native components; recorded source attribution in NOTICE and the navigation module.
- Strict typecheck and 38 tests pass. New tests traverse Output, Patterns, Anti-Patterns, Context Health and Providers on desktop/light and compact/dark props, preserve shared filters, verify themed text, and prove that navigation does not restart overview analysis.
- Aggregate tests verify distinct-model session counts, all-session workspace totals, heatmap/calendar counts and context metrics. No outbound model service is used.
- The actual Paseo app displayed the grouped native navigation, shared filters, dashboard KPI/practice cards, live overview and activity chart. Visual inspection identified narrow card wrapping and the final layout adds minimum widths with responsive wrapping.
- UI compatibility remains Paseo 0.15.3. Physical iOS/Android verification and full Microsoft feature parity remain outside this verified scope.

- Final v0.3 live RPC check: 66 sessions analyzed completely, zero read failures and zero incomplete reports in the selected seven-day sample; four workspace groups, two model groups, three active calendar dates. Heatmap and workspace session totals each equal the matched-session total.
- Final native UI walkthrough opened Dashboard, Output, Patterns, Context Health and Timeline with real host data, then returned to Dashboard. Provider changes were not made.
- CI passed on Node 22 and Node 24: https://github.com/dasheck0/opencode-coach-for-paseo/actions/runs/42609560055

## Version 0.4: saved language, workspace scope and persistent incremental analysis

- Strict typecheck and 48 tests pass across eight files. Added German/English catalog parity and template tests, saved-language/date/origin rendering, named Paseo workspace multi-selection, path-boundary matching, corrupt-cache recovery and persistent reuse across service restarts.
- The restart test imports 30 sessions once, reuses them for 30→7→30 days, then imports exactly two records on the simulated next day: one new and one updated. Raw prompt text is absent from all compressed derived-report cache entries.
- Session-origin defaults were explicitly approved: human-led main sessions for Dashboard and Anti-Patterns; all sessions for Output, Patterns, Timeline and Context Health. Their saved per-page controls and semantics are documented in docs/message-origins.md.
- Live host discovery returned 35 Paseo workspaces, including 20 named worktrees. Ten of ten sampled sessions received project/workspace annotations; a two-workspace history filter returned only those workspace IDs.
- A real seven-day sample imported and persisted 66 sessions without read or cache errors. The actual native app displayed German labels and the new origin/language/workspace controls.
- Persisted the current view preferences without changing the user's choices (German, seven-day window) to prepare a read-back after reload. No API/model requests were added.

- After a real plugin reload the same 66-session sample reused 66 persisted reports, imported zero sessions, and reported zero cache errors. Project/workspace annotations and the two-workspace filter remained correct.
- The saved host preferences survived reload unchanged: German, seven-day period and the approved per-page origin defaults.
- Added a final check that AI-origin long sessions do not count as human-origin long sessions. The German progress-status fragments and origin-sensitive prompt counts use the same localized rendering boundary as the other native pages.
