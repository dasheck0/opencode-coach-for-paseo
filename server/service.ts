import type { Source, HistoryQuery, Report, SessionSummary } from '../shared/model';
import type { OverviewInput } from '../shared/overview';
import { OverviewAccumulator } from './overview';
import { setImmediate } from 'node:timers/promises';
import { analyze } from './analyze';
import type { AdapterRegistry } from './adapters/types';
export interface Preferences { disabled: string[]; hidden: string[]; selected: string; paths: Record<string, string[]> }
export class CoachService {
  private readonly jobs = new Map<string, { accumulator: OverviewAccumulator; touched: number }>();
  private readonly reportCache = new Map<string, { updated: number; report: Report }>();
  private readonly inFlight = new Map<string, Promise<Report>>();
  private closed = false;
  dispose() { this.closed = true; this.jobs.clear(); this.reportCache.clear(); this.inFlight.clear(); }
  constructor(readonly registry: AdapterRegistry, private readonly readPreferences: () => Promise<Preferences>) {}
  async catalog() {
    const config = await this.readPreferences();
    return { adapters: await Promise.all(this.registry.all().map(async adapter => {
      const enabled = !config.disabled.includes(adapter.id), hidden = config.hidden.includes(adapter.id);
      try {
        return { id: adapter.id, title: adapter.title, description: adapter.description, enabled, hidden,
          sources: enabled ? await adapter.discover(config.paths[adapter.id] ?? []) : [], error: null };
      } catch (error) {
        return { id: adapter.id, title: adapter.title, description: adapter.description, enabled, hidden,
          sources: [], error: error instanceof Error ? error.message : 'Source discovery failed' };
      }
    })) };
  }
  private async resolve(adapterId: string, sourceId: string) {
    const adapter = this.registry.get(adapterId), config = await this.readPreferences();
    if (config.disabled.includes(adapterId)) throw new Error('Provider is disabled. Enable it in Coach settings.');
    const sources = await adapter.discover(config.paths[adapterId] ?? []);
    const source: Source | undefined = sources.find(s => s.id === sourceId);
    if (!source) throw new Error('Source no longer available. Refresh the provider list.');
    return { adapter, source };
  }
  async history(adapterId: string, sourceId: string, query: HistoryQuery) {
    const { adapter, source } = await this.resolve(adapterId, sourceId);
    const sessions = await adapter.history(source, { ...query, limit: query.limit + 1 });
    return { sessions: sessions.slice(0, query.limit), hasMore: sessions.length > query.limit };
  }

  async overview(input: OverviewInput) {
    // Enforce activation and source authorization even when serving a cached result.
    const { adapter, source } = await this.resolve(input.adapterId, input.sourceId);
    const key = JSON.stringify([input.adapterId, input.sourceId, input.from ?? null, input.to, input.directory ?? '']);
    let job = this.jobs.get(key);
    if (job) { job.touched = Date.now(); return job.accumulator.snapshot(); }
    for (const [id, entry] of this.jobs) {
      if (entry.accumulator.result.status === 'complete' || entry.accumulator.result.status === 'error') {
        if (this.jobs.size >= 4 || Date.now() - entry.touched > 900000) this.jobs.delete(id);
      }
    }
    if (this.jobs.size >= 4) throw new Error('Four overview analyses are already running. Wait for one to finish.');
    const accumulator = new OverviewAccumulator(input);
    job = { accumulator, touched: Date.now() }; this.jobs.set(key, job);
    const assertEnabled = async () => {
      if (this.closed) throw new Error('Coach stopped');
      const config = await this.readPreferences();
      if (config.disabled.includes(adapter.id)) throw new Error('Provider disabled; analysis stopped.');
    };
    const run = async () => {
      const summaries: SessionSummary[] = [], seen = new Set<string>();
      let offset = 0;
      // Enumerate every matching page, independently of UI history pagination.
      while (true) {
        await assertEnabled();
        const page = await adapter.history(source, { from: input.from, to: input.to, directory: input.directory, limit: 200, offset });
        const fresh = page.filter(s => !seen.has(s.id));
        if (page.length && !fresh.length) throw new Error('Provider pagination did not advance. Refresh the overview.');
        for (const s of fresh) { seen.add(s.id); summaries.push(s); }
        accumulator.discover(fresh);
        if (page.length < 200) break;
        offset += page.length; await setImmediate();
      }
      accumulator.start(summaries);
      for (const summary of summaries) {
        await assertEnabled();
        const cacheKey = JSON.stringify([adapter.id, source.id, summary.id]);
        const cached = this.reportCache.get(cacheKey);
        try {
          const versionKey = JSON.stringify([cacheKey, summary.updated]);
          let report: Report;
          if (cached?.updated === summary.updated) report = cached.report;
          else {
            let pending = this.inFlight.get(versionKey);
            if (!pending) {
              pending = adapter.load(source, summary.id).then(analyze);
              this.inFlight.set(versionKey, pending);
            }
            try { report = await pending; } finally { this.inFlight.delete(versionKey); }
          }
          this.reportCache.delete(cacheKey);
          this.reportCache.set(cacheKey, { updated: summary.updated, report });
          if (this.reportCache.size > 1000) this.reportCache.delete(this.reportCache.keys().next().value!);
          accumulator.add(report);
        } catch { accumulator.result.failed++; }
        // Let RPC polling and provider setting changes run between sessions.
        await setImmediate();
      }
      accumulator.result.status = 'complete';
    };
    void run().catch(error => { accumulator.result.status = 'error'; accumulator.result.error = error instanceof Error ? error.message : 'Overview analysis failed'; });
    return accumulator.snapshot();
  }
  async analyze(adapterId: string, sourceId: string, sessionId: string) {
    const { adapter, source } = await this.resolve(adapterId, sourceId);
    return analyze(await adapter.load(source, sessionId));
  }
}
