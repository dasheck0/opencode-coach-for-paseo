# Herkunft der Sessions und Prompts

Jede Ansicht speichert ihre eigene Herkunftsauswahl. Die Vorgaben wurden mit dem Nutzer abgestimmt.

| Ansicht | Standard | Zweck |
| --- | --- | --- |
| Dashboard / eigenes Prompting | Hauptsessions, menschlich gesteuert | Den eigenen Auftrag und die Antworten darauf betrachten |
| Anti-Patterns | Hauptsessions, menschlich gesteuert | Delegierte Aufträge nicht als eigene Promptfehler bewerten |
| Output | Alle Sessions | Auch Arbeit, Tokens und Änderungen von Subagents berücksichtigen |
| Patterns | Alle Sessions | Die gesamte Aktivität inklusive delegierter Arbeit zeigen |
| Timeline | Alle Sessions | Hauptsessions und delegierte Abläufe nachvollziehen |
| Context Health | Alle Sessions | Kontextverdichtungen in der gesamten Arbeit betrachten |

Die Auswahl kann pro Ansicht auf Hauptsessions, Subagent-Sessions oder alle Sessions gesetzt werden. Unter Anbieter → Standard-Herkunft je Ansicht ist die gesamte Zuordnung auf einen Blick änderbar.

Die Herkunftsauswahl filtert **Sessions nach ihrer Elternbeziehung**, nicht nach dem Rollenlabel jeder einzelnen Nachricht. Assistentenantworten und Werkzeugaufrufe auf einen menschlichen Auftrag bleiben damit im Kontext der menschlich gesteuerten Hauptsession erhalten. Eine reine Auswahl der `user`-Nachrichten würde zum Beispiel die Prüfung „Änderung ohne anschließenden Test“ unbrauchbar machen.

Menschliche Prompts sind nicht-synthetische Benutzernachrichten in Hauptsessions. Benutzernachrichten in Subagent-Sessions und ausdrücklich synthetische Prompts zählen als KI-Prompts. System-/Statusmeldungen sind keine menschlichen Prompts. Der Coach verwendet protokollierte Rollen, Synthetic-Markierungen und Elternbeziehungen; er errät keine Autorschaft. Ein extern automatisiert erzeugter Prompt ohne entsprechende Markierung kann nicht zuverlässig erkannt werden.

Die Promptregeln beziehen sich bei „Hauptsessions“ auf die menschlichen Prompts, bei „Subagent-Sessions“ auf die KI-Prompts und bei „Alle Sessions“ auf beide. Die Kennzahl „Menschliche Prompts“ bleibt davon unabhängig immer auf die tatsächlich als menschlich eingestuften Prompts begrenzt. Prozentanteile und Trends beziehen sich auf die aktuell gewählten Sessions.

Workspace-Zuordnungen basieren auf den von Paseo gemeldeten Verzeichnissen. Wenn mehrere lokale Paseo-Workspaces dasselbe Verzeichnis teilen, lassen sich die OpenCode-Sessions anhand dieser Metadaten nicht eindeutig zwischen diesen Workspace-IDs trennen. Die Auswahl eines solchen Workspaces umfasst daher die Sessions des gemeinsamen Verzeichnisses.
