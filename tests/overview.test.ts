import { expect, it, vi } from 'vitest';
import type { Report, Session, SessionSummary } from '../shared/model';
import { overviewSchema } from '../shared/overview';
import { OverviewAccumulator } from '../server/overview';
import { CoachService, type Preferences } from '../server/service';
import { AdapterRegistry, type CoachAdapter } from '../server/adapters/types';
import { analyze } from '../server/analyze';
function summary(id: number): SessionSummary { return { id: String(id), adapterId: 'fixture', sourceId: 'db', title: `Session ${id}`, directory: '/fixture', parentId: id % 2 ? 'parent' : null,
  created: id, updated: 1, inputTokens: null, outputTokens: null, cost: null }; }
function session(s: SessionSummary, warning = true): Session {
  return { summary: s, compactions: 0, warnings: [], messages: [{ id: `m${s.id}`, role: 'assistant', text: '', synthetic: false, timestamp: s.created,
    tools: warning ? [{ id: 'edit', name: 'edit', status: 'completed' }] : [], inputTokens: null, outputTokens: null, cacheRead: null, cacheWrite: null, cost: null }] };
}
function fixture(count = 251) {
  const summaries = Array.from({ length: count }, (_, n) => summary(n)).reverse();
  const adapter: CoachAdapter = { id: 'fixture', title: 'Fixture', description: '',
    discover: vi.fn(async () => [{ id: 'db', label: '', path: '/fixture.db', format: 'fixture' }]),
    history: vi.fn(async (_source, query) => summaries.filter(s => s.created >= (query.from ?? 0) && s.created <= (query.to ?? Infinity) && (!query.directory || s.directory === query.directory)).slice(query.offset, query.offset + query.limit)),
    load: vi.fn(async (_source, id) => session(summaries.find(s => s.id === id)!)),
  };
  const prefs: Preferences = { disabled: [], hidden: [], selected: 'fixture', paths: {} };
  const service = new CoachService(new AdapterRegistry([adapter]), async () => prefs);
  const input = { adapterId: 'fixture', sourceId: 'db', from: 0, to: 250, directory: '/fixture' };
  return { summaries, adapter, prefs, service, input };
}
async function finish(f: ReturnType<typeof fixture>, input = f.input) {
  let result = await f.service.overview(input);
  await vi.waitFor(async () => { result = await f.service.overview(input); expect(['complete', 'error']).toContain(result.status); }, { timeout: 5000, interval: 10 });
  return result;
}
it('automatically analyzes every matching session beyond the first 50 and every adapter page', async () => {
  const f = fixture();
  try {
    const result = await finish(f);
    expect(result).toMatchObject({ status: 'complete', matched: 251, analyzed: 251, failed: 0, incomplete: 0, mainSessions: 126, delegatedSessions: 125 });
    expect(result.insights[0]).toMatchObject({ rule: 'verification-gap', affectedSessions: 251, percentage: 100 });
    expect(f.adapter.history).toHaveBeenCalledTimes(2); expect(f.adapter.load).toHaveBeenCalledTimes(251);
    expect(overviewSchema.parse(result)).toEqual(result);
  } finally { f.service.dispose(); }
});
it('deduplicates polling jobs and reuses unchanged reports on refresh, invalidating updated sessions', async () => {
  const f = fixture(3);
  try {
    await Promise.all([f.service.overview(f.input), f.service.overview(f.input)]); await finish(f);
    expect(f.adapter.load).toHaveBeenCalledTimes(3);
    await finish(f, { ...f.input, to: 251 }); expect(f.adapter.load).toHaveBeenCalledTimes(3);
    f.summaries[0].updated++;
    await finish(f, { ...f.input, to: 252 }); expect(f.adapter.load).toHaveBeenCalledTimes(4);
  } finally { f.service.dispose(); }
});
it('honors filters, returns a complete empty state, and rejects disabled providers', async () => {
  const f = fixture(5);
  try {
    expect(await finish(f, { ...f.input, from: 2, to: 3 })).toMatchObject({ matched: 2, analyzed: 2 });
    expect(await finish(f, { ...f.input, directory: '/other' })).toMatchObject({ status: 'complete', matched: 0, analyzed: 0, insights: [] });
    f.prefs.disabled.push('fixture');
    await expect(f.service.overview(f.input)).rejects.toThrow('disabled');
  } finally { f.service.dispose(); }
});
it('reports failed and partial sessions without claiming complete evidence', async () => {
  const f = fixture(3);
  vi.mocked(f.adapter.load).mockImplementation(async (_source, id) => {
    if (id === '2') throw new Error('unreadable');
    const s = session(f.summaries.find(s => s.id === id)!); if (id === '1') s.warnings.push('truncated'); return s;
  });
  try { expect(await finish(f)).toMatchObject({ status: 'complete', matched: 3, analyzed: 2, failed: 1, incomplete: 1 }); }
  finally { f.service.dispose(); }
});
it('stops reading when a provider is disabled during an ongoing analysis', async () => {
  const f = fixture(10);
  vi.mocked(f.adapter.load).mockImplementation(async (_source, id) => { f.prefs.disabled.push('fixture'); return session(f.summaries.find(s => s.id === id)!); });
  try {
    await f.service.overview(f.input);
    await vi.waitFor(() => expect(f.adapter.load).toHaveBeenCalledTimes(1));
    await new Promise(resolve => setTimeout(resolve, 25));
    expect(f.adapter.load).toHaveBeenCalledTimes(1);
  } finally { f.service.dispose(); }
});
it('counts each warning once, excludes informational findings and computes normalized period rates', () => {
  const input = { adapterId: 'fixture', sourceId: 'db', from: 0, to: 100 };
  const acc = new OverviewAccumulator(input), sessions = [summary(10), summary(20), summary(60), summary(70)];
  acc.discover(sessions); acc.start(sessions);
  for (const s of sessions) {
    const report: Report = analyze(session(s, s.created < 50));
    if (report.findings[0]) report.findings.push(report.findings[0]);
    report.findings.push({ rule: 'informational', title: '', advice: '', evidence: '', severity: 'info', messageIds: [] });
    acc.add(report);
  }
  const result = acc.snapshot();
  expect(result.insights).toHaveLength(1);
  expect(result.insights[0]).toMatchObject({ affectedSessions: 2, percentage: 50, earlierPercentage: 100, laterPercentage: 0, changePoints: -100 });
  expect(result.metrics.inputTokens).toBeNull(); expect(result.metrics.cost).toBeNull();
});
it('does not turn absent usage into zero and uses known-session coverage', () => {
  const acc = new OverviewAccumulator({ adapterId: 'fixture', sourceId: 'db', to: 100 });
  const s = summary(10); acc.discover([s]); acc.start([s]);
  const report = analyze(session(s)); report.metrics.inputTokens = 0; report.metrics.cost = 0;
  acc.add(report);
  expect(acc.snapshot().metrics).toMatchObject({ inputTokens: 0, outputTokens: null, cost: 0, usageSessions: 1, costSessions: 1 });
});
it('detects a non-advancing adapter rather than hanging or double-counting', async () => {
  const f = fixture(200); vi.mocked(f.adapter.history).mockImplementation(async () => f.summaries);
  try { expect(await finish(f)).toMatchObject({ status: 'error', matched: 200, analyzed: 0 }); }
  finally { f.service.dispose(); }
});
it('shares in-flight session reads across overlapping overview ranges', async () => {
  const f = fixture(3);
  vi.mocked(f.adapter.load).mockImplementation(async (_source, id) => { await new Promise(resolve => setTimeout(resolve, 10)); return session(f.summaries.find(s => s.id === id)!); });
  try {
    await Promise.all([finish(f), finish(f, { ...f.input, to: 251 })]);
    expect(f.adapter.load).toHaveBeenCalledTimes(3);
  } finally { f.service.dispose(); }
});
it('builds workspace, model, heatmap and context views from all sessions without double-counting models', () => {
  const acc = new OverviewAccumulator({ adapterId: 'fixture', sourceId: 'db', from: 0, to: 100 });
  const summaries = [summary(10), summary(20)]; acc.discover(summaries); acc.start(summaries);
  const report = analyze(session(summaries[0])); report.metrics.models = ['fixture-model', 'fixture-model'];
  report.metrics.compactions = 4; report.metrics.humanPrompts = 31; report.metrics.toolCalls = 6;
  acc.add(report); acc.add(analyze(session(summaries[1], false)));
  const result = acc.snapshot();
  expect(result.breakdown.workspaces).toEqual([{ directory: '/fixture', sessions: 2, humanPrompts: 31, toolCalls: 6 }]);
  expect(result.breakdown.models).toEqual([{ name: 'fixture-model', sessions: 1 }]);
  expect(result.breakdown.hours.reduce((a, b) => a + b, 0)).toBe(2);
  expect(result.breakdown.calendar).toEqual([{ day: '1970-01-01', sessions: 2 }]);
  expect(result.breakdown).toMatchObject({ compactions: 4, compactedSessions: 1, longSessions: 1 });
  result.breakdown.hours[0] = 999;
  expect(acc.snapshot().breakdown.hours[0]).not.toBe(999);
});
it('counts long sessions using the selected prompt origin instead of attributing AI prompts to humans', () => {
  const s = summary(1), report = analyze(session(s)); report.metrics.humanPrompts = 0; report.metrics.aiPrompts = 40;
  const ai = new OverviewAccumulator({ adapterId: 'fixture', sourceId: 'db', to: 100, origin: 'ai' }); ai.discover([s]); ai.start([s]); ai.add(report);
  const human = new OverviewAccumulator({ adapterId: 'fixture', sourceId: 'db', to: 100, origin: 'human' }); human.discover([s]); human.start([s]); human.add(report);
  expect(ai.snapshot().breakdown.longSessions).toBe(1); expect(human.snapshot().breakdown.longSessions).toBe(0);
});
