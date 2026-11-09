OpenCode Coach reads historical OpenCode sessions and shows tool usage, token counts, recorded costs, and coaching suggestions inside Paseo. Findings include evidence message IDs and a practical next step.

The plugin reads the database on the selected Paseo host in read-only mode. It recognizes V2 sessions and older SQLite databases. A database containing both uses V2 to avoid counting migrated sessions twice. No OpenCode server, VS Code extension, API key, or language model service is required.

Paseo 0.15.3 or later is required. The daemon needs Node's built-in SQLite support or the sqlite3 executable on its PATH. SQLite fallback was tested on macOS. Other operating systems have not been tested in a live host.

Provider settings let you enable, disable, select, or hide registered adapters and configure database paths. Discovery checks standard OpenCode data directories by default. An explicit path list replaces discovery. Only the OpenCode adapter is included; contributors can add other providers through the documented adapter contract.

History supports date windows, exact workspace directory filters, and pagination. Counts and recorded cost totals describe the current page. Coaching is deterministic and heuristic. A logged test command is evidence that verification was attempted, not proof it passed. Reports are limited to the first 2000 messages and 20000 legacy parts, with warnings for incomplete or invalid records.

Analysis runs on the daemon host. Authorized Paseo clients receive session titles, directories, metrics, findings, and evidence IDs through Paseo's connection. The plugin has no outbound analytics or model requests, does not execute recorded commands, and does not modify session databases. As a trusted Paseo plugin, its code runs with the daemon's normal filesystem permissions.
