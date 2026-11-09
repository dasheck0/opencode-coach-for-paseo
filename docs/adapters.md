# Adding a provider

Implement `CoachAdapter` from `server/adapters/types.ts`, then add one instance to `server/registry.ts`. The existing UI lists every registered adapter automatically. No provider ID enum, UI branch, service modification, or analysis-engine change is required.

```ts
import type { CoachAdapter } from './types';

export class ClaudeCodeAdapter implements CoachAdapter {
  readonly id = 'claude-code';
  readonly title = 'Claude Code';
  readonly description = 'Describe the supported local data format here.';
  // Implement discover(paths), history(source, query), and load(source, sessionId).
}
```

This excerpt illustrates the contract only; it is not a stub to register as a working adapter.

`discover(paths)` returns stable opaque source IDs, user-facing labels, absolute paths, and a format identifier. An empty explicit path list means automatic discovery. Avoid reading conversation payloads during discovery. Report inaccessible explicit paths and unsupported formats as errors.

`history(source, query)` returns normalized `SessionSummary` entries ordered by last activity in the selected window descending, then ID descending. Apply the inclusive `from`/`to` timestamps (milliseconds) to message activity, including sessions created before the window. Empty sessions can use their creation date. Return optional `activityStart`/`activityEnd` for the selected window. Apply the exact directory filter, limit and offset. The service enumerates adapter metadata in batches of 200 to calculate exact filtered totals. The Timeline RPC requests `groupBy: workspace` and paginates complete workspace groups; adapter `limit`/`offset` always refer to session metadata rows and adapters do not implement workspace pagination. RPC responses include `total` in the requested pagination unit, `totalSessions`, the clamped `offset`, and `hasMore`. The overview independently enumerates and aggregates every matching session. Return at most the requested limit and honor the offset. No overview-specific adapter method is required. Keep unknown cost and token values null.

`summary(source, sessionId)` is an optional metadata-only lookup for shared persistent detail caching. Existing adapters without it remain compatible. `load(source, sessionId)` returns one normalized `Session`. Normalize every tool call into a stable ID, name, status, and optional command/file. Map provider-specific statuses to `completed` or `error` when applicable. Preserve ordering and message IDs for evidence. Human messages have role `user` and synthetic=false; mark generated prompts synthetic. Set a parent session ID for delegated work. Report skipped records and truncation in warnings.

Token counters must describe one assistant model call, once. Keep cache reads/writes separate from uncached input and use null for missing data. Never include step-summary duplicates. The engine does not need tool outputs or credentials. Normalize equivalent edit, shell, and test operations to names recognized by `server/analyze.ts`, or extend the common rule vocabulary with appropriate tests.

The service resolves source IDs against fresh adapter discovery before reading. Never interpret an RPC source ID as a filesystem path. Disabled adapters are rejected before discovery or loading; hiding only affects the provider selector. Settings are versioned host documents managed by Paseo with revision conflict checks.

Tests should cover real-format synthetic fixtures, ordering, token accounting, generated prompts, corruption, missing paths, pagination, read-only behavior, and adapter-specific schema variations. `tests/service.test.ts` registers a test-only Claude Code adapter to prove that registry and service behavior are provider independent. It does not claim Claude Code log support.

Keep session `updated` timestamps correct when content changes. Cache keys include adapter/source/session identity and both creation/update timestamps; stale update metadata can prevent changed content from being reanalyzed. The plugin caches timestamped, text-free rule features and filters messages by timestamp before computing period metrics and rules. Preserve valid message timestamps and optionally supply `compactionTimes`; if compaction timestamps are unavailable, bounded-period compaction totals are omitted with a warning. The main/subagent scope is applied separately.
