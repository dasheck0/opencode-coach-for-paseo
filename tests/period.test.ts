import { afterEach, expect, it, vi } from 'vitest';
import { database } from './fixtures';
import { OpenCodeAdapter } from '../server/adapters/opencode';
import { CoachService } from '../server/service';
import { AdapterRegistry } from '../server/adapters/types';
import { MemoryReportCache } from '../server/cache';
import { analyze } from '../server/analyze';
import { periodSession, sessionFacts } from '../server/facts';
import { OverviewAccumulator } from '../server/overview';
const fixtures: ReturnType<typeof database>[] = [];
afterEach(() => { for (const f of fixtures.splice(0)) f.close(); });
async function setup(legacy = false, forceCli = false) {
  const f = database(!legacy); fixtures.push(f); f.session('resumed', 10); f.session('quiet', 10); f.session('child', 10, 'resumed');
  f.message('old', 'resumed', 'user', 1, { text: 'OLD PRIVATE PROMPT' });
  f.message('today', 'resumed', 'user', 2, { text: 'Implement src/hello.ts and run tests' });
  f.message('synthetic', 'resumed', 'synthetic', 3, { text: 'AUTOMATIC PRIVATE PROMPT' });
  f.message('answer', 'resumed', 'assistant', 4, { tokens: { input: 7, output: 9 }, content: [{ type: 'tool', name: 'edit', id: 'e', state: { status: 'completed', input: { filePath: 'PRIVATE FILE' } } }] });
  f.message('tomorrow', 'resumed', 'user', 5, { text: 'FUTURE PRIVATE PROMPT' });
  f.message('child-user', 'child', 'user', 1, { text: 'Delegated task' });
  f.message('quiet-old', 'quiet', 'user', 1, { text: 'Inactive' });
  const table = legacy ? 'message' : 'session_message';
  for (const [id, time] of [['old', 100], ['today', 1000], ['synthetic', 1001], ['answer', 1002], ['tomorrow', 2000], ['child-user', 1000], ['quiet-old', 100]] as const) f.db.prepare(`UPDATE ${table} SET time_created=? WHERE id=?`).run(time, id);
  const adapter = new OpenCodeAdapter([f.root], forceCli), [source] = await adapter.discover([]);
  return { f, adapter, source };
}
it.each([[false, false], [false, true], [true, false], [true, true]])('finds resumed sessions by message activity, not their creation (%s,%s)', async (legacy, cli) => {
  const { adapter, source } = await setup(legacy, cli);
  const rows = await adapter.history(source, { from: 1000, to: 1002, limit: 50, offset: 0 });
  expect(rows.map(r => r.id).sort()).toEqual(['child', 'resumed']);
  expect(rows.find(r => r.id === 'resumed')).toMatchObject({ created: 10, activityStart: 1000, activityEnd: 1002 });
});
it('clips metrics and findings to message time, preserves origins and excludes future activity', async () => {
  const { adapter, source } = await setup();
  const session = await adapter.load(source, 'resumed'), facts = sessionFacts(session);
  const report = analyze(periodSession(facts, { from: 1000, to: 1002 }), 'human');
  expect(report.metrics).toMatchObject({ humanPrompts: 1, aiPrompts: 1, assistantCalls: 1, edits: 1, inputTokens: 7, outputTokens: 9 });
  expect(report.activity).toEqual([1000, 1001, 1002]);
  expect(analyze(periodSession(facts, { from: 2000, to: 2000 })).metrics).toMatchObject({ humanPrompts: 1, assistantCalls: 0, edits: 0 });
  expect(analyze(periodSession(facts, { from: 2000, to: 2000 })).findings.some(f => f.rule === 'verification-gap')).toBe(false);
  const child = analyze(periodSession(sessionFacts(await adapter.load(source, 'child')), { from: 1000, to: 1002 }));
  expect(child.metrics).toMatchObject({ humanPrompts: 0, aiPrompts: 1 });
  const serialized = JSON.stringify(facts); expect(serialized).not.toContain('PRIVATE'); expect(serialized).not.toContain('Implement src');
  expect(analyze(facts)).toEqual(analyze(session));
});
it('reuses normalized facts across periods and service restarts, including detail views', async () => {
  const { adapter, source } = await setup(), cache = new MemoryReportCache(); const load = vi.spyOn(adapter, 'load');
  const start = () => new CoachService(new AdapterRegistry([adapter]), async () => ({ disabled: [], hidden: [], selected: adapter.id, paths: {} }), cache);
  let service = start();
  const complete = async (from: number, to: number) => {
    const input = { adapterId: adapter.id, sourceId: source.id, from, to, origin: 'human' as const };
    let r = await service.overview(input);
    await vi.waitFor(async () => { r = await service.overview(input); expect(r.status).toBe('complete'); }); return r;
  };
  expect((await complete(1000, 1002)).metrics.humanPrompts).toBe(1);
  expect(load).toHaveBeenCalledTimes(1); service.dispose(); service = start();
  expect((await complete(100, 2000)).metrics.humanPrompts).toBe(4); // resumed (3), quiet (1)
  expect((await complete(1000, 1002)).cache.imported).toBe(0);
  expect((await service.analyze(adapter.id, source.id, 'resumed', 'human', { from: 1000, to: 1002 })).metrics.humanPrompts).toBe(1);
  expect(load).toHaveBeenCalledTimes(2); service.dispose();
});
it('buckets ongoing sessions by actual activity days and hours in the period', () => {
  const summary = { id: 'old', created: 1, updated: 999999999, parentId: null, directory: '/', adapterId: 'f', sourceId: 's', title: '', inputTokens: null, outputTokens: null, cost: null };
  const report = analyze({ summary, messages: [], compactions: 0, warnings: [] });
  report.activity = [86400000, 86400001, 2 * 86400000];
  const acc = new OverviewAccumulator({ adapterId: 'f', sourceId: 's', from: 86400000, to: 3 * 86400000 });
  acc.discover([summary]); acc.start([summary]); acc.add(report);
  expect(acc.snapshot().breakdown.calendar).toEqual([{ day: '1970-01-02', sessions: 1 }, { day: '1970-01-03', sessions: 1 }]);
  expect(acc.snapshot().breakdown.hours.reduce((a, b) => a + b, 0)).toBe(2);
});
it('counts dated compactions only inside the period and preserves rule features without raw text', () => {
  const summary = { id: 's', created: 0, updated: 100, parentId: null, directory: '/', adapterId: 'f', sourceId: 's', title: '', inputTokens: null, outputTokens: null, cost: null };
  const message = { id: 'm', role: 'assistant' as const, synthetic: false, text: 'PRIVATE OUTPUT', timestamp: 20, tools: Array.from({ length: 3 }, (_, i) => ({ id: `t${i}`, name: 'bash', status: 'error', command: 'PRIVATE COMMAND' })), inputTokens: null, outputTokens: null, cacheRead: null, cacheWrite: null, cost: null };
  const session = { summary, messages: [message], compactions: 4, compactionTimes: [1, 20, 21, 22], warnings: [] };
  const facts = sessionFacts(session);
  expect(JSON.stringify(facts)).not.toContain('PRIVATE');
  expect(analyze(facts)).toEqual(analyze(session));
  expect(analyze(periodSession(facts, { from: 20, to: 21 })).metrics.compactions).toBe(2);
  expect(analyze(periodSession(facts, { from: 20, to: 21 })).findings.some(f => f.rule === 'retry-loop')).toBe(true);
  expect(analyze(periodSession(facts, { from: 21, to: 22 })).findings.some(f => f.rule === 'retry-loop')).toBe(false);
});
