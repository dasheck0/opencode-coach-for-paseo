# Incremental analysis cache

The Coach keeps derived per-session reports on the daemon host. It never uploads them or makes model requests. Full prompt/response text and tool output are not persisted in this cache; reports contain session metadata, metric totals, rule findings and evidence message IDs.

The cache lives at `$COACH_CACHE_DIR` when configured, otherwise `$PASEO_HOME/plugin-data/opencode-coach-for-paseo/cache-v4` (with `~/.paseo` as the default Paseo home). Directories use owner-only permissions and files use mode 0600 on systems supporting POSIX modes. Entries are gzip-compressed, schema-validated and written through atomic temporary-file renames.

Each entry is keyed by the analysis-contract version, adapter ID, source ID, session ID, creation timestamp and update timestamp. The OpenCode source identity includes the database path and file identity so replacing a database at the same path cannot silently reuse the previous database's reports. All three prompt bases are computed from a single session read, so changing the origin filter does not reimport that session.

Every overview still performs a cheap metadata/index scan for the selected range. Only sessions without a matching cached report are read and normalized. This distinction is visible in the UI: reused reports, new/updated sessions and cache errors.

- 30 days → 7 days → 30 days: reuse unchanged session reports; no body reimport.
- A plugin reload or daemon restart: reload reports from disk; no body reimport for unchanged sessions.
- Tomorrow: enumerate the newly selected date window, reuse every existing unchanged session and import only new or changed records.
- New messages in an existing session: its updated timestamp changes and only that session is imported again.
- Language or workspace-name changes: apply at presentation time and do not invalidate normalized reports.
- Updated normalization/analysis semantics: deliberately bump `ANALYSIS_VERSION`; old reports are not treated as valid under new rules.

The runtime additionally retains up to 1000 reports in memory and shares in-flight reads. Disk entries are not evicted by date-window switches. The current implementation leaves old versions of entries on disk; manual removal of the dedicated cache directory forces a rebuild and does not alter OpenCode data. Filesystem/schema errors are visible and cause only affected entries to be recomputed. A failed raw session read is not cached as a valid result.

Workspace and origin filters are applied to the indexed session metadata before body imports. They do not change the session's storage identity. Details and overviews use the same cache. Third-party adapters can implement the optional `summary()` method for a metadata-only detail lookup; older adapters without it retain compatibility but may read a session once to obtain its update timestamp.
