import { workspaceTimelines } from '../shared/session-groups';
import type { Source, HistoryQuery, SessionSummary } from '../shared/model';
import type { OverviewInput } from '../shared/overview';
import type { Origin } from '../shared/preferences';
import type { WorkspaceCatalog } from '../shared/workspaces';
import { OverviewAccumulator } from './overview';
import { setImmediate } from 'node:timers/promises';
import { periodSession, sessionFacts, type Period } from './facts';
import { analyze } from './analyze';
import { ANALYSIS_VERSION, MemoryReportCache, type ReportCache, type ReportBundle } from './cache';
import { enrichSummary, selectedProject, projectsFor } from './workspaces';
import type { AdapterRegistry, CoachAdapter } from './adapters/types';
export interface Preferences { disabled: string[]; hidden: string[]; selected: string; paths: Record<string, string[]> }
const matchesOrigin = (s: SessionSummary, origin: Origin = 'all') => origin === 'all' || (origin === 'human' ? !s.parentId : !!s.parentId);
export class CoachService {
  private readonly jobs = new Map<string, { accumulator: OverviewAccumulator; touched: number }>();
  private readonly inFlight = new Map<string, Promise<ReportBundle>>();
  private readonly memory = new Map<string, ReportBundle>();
  private closed = false;
  dispose() { this.closed = true; this.jobs.clear(); this.memory.clear(); }
  constructor(readonly registry: AdapterRegistry, private readonly readPreferences: () => Promise<Preferences>,
    private readonly cache: ReportCache = new MemoryReportCache(), private readonly readWorkspaces: () => Promise<WorkspaceCatalog> = async () => ({ workspaces: [] })) {}
  async workspaces() { return this.readWorkspaces(); }
  async catalog() {
    const config = await this.readPreferences();
    return { adapters: await Promise.all(this.registry.all().map(async adapter => {
      const enabled = !config.disabled.includes(adapter.id), hidden = config.hidden.includes(adapter.id);
      try { return { id: adapter.id, title: adapter.title, description: adapter.description, enabled, hidden,
        sources: enabled ? await adapter.discover(config.paths[adapter.id] ?? []) : [], error: null }; }
      catch (error) { return { id: adapter.id, title: adapter.title, description: adapter.description, enabled, hidden, sources: [], error: error instanceof Error ? error.message : 'Source discovery failed' }; }
    })) };
  }
  private async resolve(adapterId: string, sourceId: string) {
    const adapter = this.registry.get(adapterId), config = await this.readPreferences();
    if (config.disabled.includes(adapterId)) throw new Error('Provider is disabled. Enable it in Coach settings.');
    const source = (await adapter.discover(config.paths[adapterId] ?? [])).find(s => s.id === sourceId);
    if (!source) throw new Error('Source no longer available. Refresh the provider list.');
    return { adapter, source };
  }
  private async projectSelection(ids?: string[]) {
    const catalog = await this.readWorkspaces();
    if (ids?.some(id => !projectsFor(catalog).some(w => w.id === id))) throw new Error('A selected project is no longer available. Update the project selection.');
    return catalog;
  }
  private async report(adapter: CoachAdapter, source: Source, summary: SessionSummary, counts?: { reused: number; imported: number; errors: number }) {
    const key = JSON.stringify([ANALYSIS_VERSION, adapter.id, source.id, summary.id, summary.created, summary.updated]);
    const found = this.memory.get(key);
    if (found) { if (counts) counts.reused++; return found; }
    let pending = this.inFlight.get(key);
    if (!pending) {
      pending = (async () => {
        let cached: ReportBundle | undefined;
        try { cached = await this.cache.get(key); } catch { if (counts) counts.errors++; }
        if (cached?.factsVersion === 2 && cached.facts) { if (counts) counts.reused++; return cached; }
        const session = await adapter.load(source, summary.id);
        const facts = sessionFacts(session);
        const bundle: ReportBundle = { human: analyze(facts, 'human'), ai: analyze(facts, 'ai'), all: analyze(facts, 'all'), facts, factsVersion: 2 };
        if (counts) counts.imported++;
        try { await this.cache.put(key, bundle); } catch { if (counts) counts.errors++; }
        return bundle;
      })();
      this.inFlight.set(key, pending);
    } else if (counts) counts.reused++;
    try {
      const value = await pending;
      this.memory.set(key, value);
      if (this.memory.size > 1000) this.memory.delete(this.memory.keys().next().value!);
      return value;
    } finally { this.inFlight.delete(key); }
  }
  async history(adapterId: string, sourceId: string, query: HistoryQuery) {
    const { adapter, source } = await this.resolve(adapterId, sourceId), catalog = await this.projectSelection(query.projectIds);
    const matched: SessionSummary[] = [], seen = new Set<string>(); let offset = 0;
    while (true) {
      const page = await adapter.history(source, { from: query.from, to: query.to, directory: query.directory, limit: 200, offset });
      const fresh = page.filter(s => { if (seen.has(s.id)) return false; seen.add(s.id); return true; });
      if (page.length && !fresh.length) throw new Error('Provider pagination did not advance. Refresh the overview.');
      matched.push(...fresh.filter(s => matchesOrigin(s, query.origin) && selectedProject(s, query.projectIds, catalog)).map(s => enrichSummary(s, catalog)));
      if (page.length < 200) break;
      offset += page.length; await setImmediate();
    }
    const groups = query.groupBy === 'workspace' ? workspaceTimelines(matched) : undefined;
    const total = groups?.length ?? matched.length;
    const focus = query.focusSessionId ? (groups ? groups.findIndex(g => g.sessions.some(s => s.id === query.focusSessionId)) : matched.findIndex(s => s.id === query.focusSessionId)) : -1;
    const requestedOffset = focus >= 0 ? Math.floor(focus / query.limit) * query.limit : query.offset;
    const pageOffset = Math.min(requestedOffset, Math.max(0, Math.ceil(total / query.limit) - 1) * query.limit);
    const sessions = groups ? groups.slice(pageOffset, pageOffset + query.limit).flatMap(g => g.sessions) : matched.slice(pageOffset, pageOffset + query.limit);
    return { sessions, total, totalSessions: matched.length, offset: pageOffset, hasMore: pageOffset + query.limit < total };
  }

  async overview(input: OverviewInput) {
    const { adapter, source } = await this.resolve(input.adapterId, input.sourceId), catalog = await this.projectSelection(input.projectIds);
    const origin = input.origin ?? 'all';
    const key = JSON.stringify([input.adapterId, input.sourceId, input.from ?? null, input.to, input.directory ?? '', [...(input.projectIds ?? [])].sort(), origin, catalog]);
    const existing = this.jobs.get(key);
    if (existing) { existing.touched = Date.now(); return existing.accumulator.snapshot(); }
    for (const [id, entry] of this.jobs) if (['complete', 'error'].includes(entry.accumulator.result.status) && (this.jobs.size >= 6 || Date.now() - entry.touched > 900000)) this.jobs.delete(id);
    if (this.jobs.size >= 6) throw new Error('Overview analyses are already running. Wait for one to finish.');
    const accumulator = new OverviewAccumulator(input); accumulator.result.cache.persistent = this.cache.persistent;
    this.jobs.set(key, { accumulator, touched: Date.now() });
    const assertEnabled = async () => {
      if (this.closed) throw new Error('Coach stopped');
      if ((await this.readPreferences()).disabled.includes(adapter.id)) throw new Error('Provider disabled; analysis stopped.');
    };
    const run = async () => {
      const summaries: SessionSummary[] = [], seen = new Set<string>(); let offset = 0;
      while (true) {
        await assertEnabled();
        const page = await adapter.history(source, { from: input.from, to: input.to, directory: input.directory, limit: 200, offset });
        const fresh = page.filter(s => { if (seen.has(s.id)) return false; seen.add(s.id); return true; });
        if (page.length && !fresh.length) throw new Error('Provider pagination did not advance. Refresh the overview.');
        const included = fresh.filter(s => matchesOrigin(s, origin) && selectedProject(s, input.projectIds, catalog)).map(s => enrichSummary(s, catalog));
        summaries.push(...included); accumulator.discover(included);
        if (page.length < 200) break;
        offset += page.length; await setImmediate();
      }
      accumulator.start(summaries);
      for (const summary of summaries) {
        await assertEnabled();
        try {
          const bundle = await this.report(adapter, source, summary, accumulator.result.cache);
          const raw = analyze(periodSession(bundle.facts!, input), origin); accumulator.add({ ...raw, session: enrichSummary(raw.session, catalog) });
        } catch { accumulator.result.failed++; }
        await setImmediate();
      }
      accumulator.result.status = 'complete';
    };
    void run().catch(error => { accumulator.result.status = 'error'; accumulator.result.error = error instanceof Error ? error.message : 'Overview analysis failed'; });
    return accumulator.snapshot();
  }
  async analyze(adapterId: string, sourceId: string, sessionId: string, origin: Origin = 'all', period: Period = {}) {
    const { adapter, source } = await this.resolve(adapterId, sourceId), catalog = await this.readWorkspaces();
    // Detail requests use the same persistent session cache as the overview.
    const summary = adapter.summary ? await adapter.summary(source, sessionId) : (await adapter.load(source, sessionId)).summary;
    const bundle = await this.report(adapter, source, summary);
    const report = analyze(periodSession(bundle.facts!, period), origin);
    return { ...report, session: enrichSummary(report.session, catalog) };
  }
}
