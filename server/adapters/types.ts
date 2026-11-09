import type { HistoryQuery, Session, SessionSummary, Source } from '../../shared/model';

/** A provider only owns discovery and normalization. No UI or analysis dependencies. */
export interface CoachAdapter {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  discover(paths: string[]): Promise<Source[]>;
  history(source: Source, query: HistoryQuery): Promise<SessionSummary[]>;
  summary?(source: Source, sessionId: string): Promise<SessionSummary>;
  load(source: Source, sessionId: string): Promise<Session>;
}
export class AdapterRegistry {
  private readonly entries = new Map<string, CoachAdapter>();
  constructor(adapters: CoachAdapter[]) {
    for (const adapter of adapters) {
      if (!/^[a-z][a-z0-9-]*$/.test(adapter.id)) throw new Error(`Invalid adapter ID: ${adapter.id}`);
      if (this.entries.has(adapter.id)) throw new Error(`Duplicate adapter: ${adapter.id}`);
      this.entries.set(adapter.id, adapter);
    }
  }
  all() { return [...this.entries.values()]; }
  get(id: string) {
    const adapter = this.entries.get(id);
    if (!adapter) throw new Error(`Unknown adapter: ${id}`);
    return adapter;
  }
}
