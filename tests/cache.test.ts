import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, rm, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { DiskReportCache } from '../server/cache';
import { CoachService } from '../server/service';
import { AdapterRegistry, type CoachAdapter } from '../server/adapters/types';
import type { OverviewInput } from '../shared/overview';
import type { SessionSummary } from '../shared/model';
const roots: string[] = [];
afterEach(async () => { for (const path of roots.splice(0)) await rm(path, { recursive: true, force: true }); });
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'coach-cache-')); roots.push(directory);
  const day = 86400000, now = 100 * day;
  const sessions: SessionSummary[] = Array.from({ length: 30 }, (_, n) => ({ id: `s${n}`, adapterId: 'fixture', sourceId: 'db', title: 'Fixture session', directory: '/project/worktree', parentId: n % 2 ? 'parent' : null,
    created: now - n * day, updated: now - n * day, inputTokens: null, outputTokens: null, cost: null }));
  const adapter: CoachAdapter = { id: 'fixture', title: '', description: '', discover: async () => [{ id: 'db', label: '', path: '/fixture.db', format: 'fixture' }],
    history: async (_s, q) => sessions.filter(s => s.created >= (q.from ?? 0) && s.created <= (q.to ?? Infinity)).slice(q.offset, q.offset + q.limit),
    summary: async (_s, id) => sessions.find(s => s.id === id)!,
    load: vi.fn(async (_s, id) => ({ summary: sessions.find(s => s.id === id)!, compactions: 0, warnings: [], messages: [{ id: 'u', role: 'user' as const, synthetic: false, text: 'PRIVATE PROMPT NOT TO PERSIST', timestamp: now,
      tools: [], inputTokens: null, outputTokens: null, cacheRead: null, cacheWrite: null, cost: null }] })),
  };
  const start = () => new CoachService(new AdapterRegistry([adapter]), async () => ({ disabled: [], hidden: [], selected: 'fixture', paths: {} }), new DiskReportCache(directory));
  return { directory, sessions, adapter, now, day, start };
}
async function complete(service: CoachService, input: OverviewInput) {
  let result = await service.overview(input);
  await vi.waitFor(async () => { result = await service.overview(input); expect(result.status).toBe('complete'); expect(result.cache.refreshing).not.toBe(true); }, { timeout: 5000, interval: 10 }); return result;
}
it('reuses 30→7→30 days across service restarts and imports only new/changed sessions next day', async () => {
  const f = await fixture(); let service = f.start();
  const input = { adapterId: 'fixture', sourceId: 'db', from: f.now - 30 * f.day, to: f.now };
  expect((await complete(service, input)).cache).toMatchObject({ imported: 30, reused: 0, persistent: true, errors: 0 });
  service.dispose(); service = f.start();
  const week = await complete(service, { ...input, from: f.now - 7 * f.day });
  expect(week.cache).toMatchObject({ imported: 0, reused: 8 });
  expect((await complete(service, input)).cache).toMatchObject({ imported: 0, reused: 30 });
  f.sessions[0].updated++;
  f.sessions.unshift({ ...f.sessions[0], id: 'new', created: f.now + f.day, updated: f.now + f.day });
  service.dispose(); service = f.start();
  const next = await complete(service, { ...input, from: input.from + f.day, to: f.now + f.day });
  expect(next.cache).toMatchObject({ imported: 2, reused: 29, errors: 0 });
  expect(f.adapter.load).toHaveBeenCalledTimes(32);
  // Details share the persistent report cache too.
  await service.analyze('fixture', 'db', 's0'); expect(f.adapter.load).toHaveBeenCalledTimes(32);
  service.dispose();
  for (const file of (await readdir(f.directory)).filter(name => name.endsWith('.json.gz'))) expect(gunzipSync(await readFile(join(f.directory, file))).toString()).not.toContain('PRIVATE PROMPT NOT TO PERSIST');
});
it('origin changes reuse the same session import while excluding delegated work from human-led views', async () => {
  const f = await fixture(), service = f.start(), input = { adapterId: 'fixture', sourceId: 'db', to: f.now };
  expect((await complete(service, { ...input, origin: 'all' })).matched).toBe(30);
  const human = await complete(service, { ...input, origin: 'human' }); expect(human).toMatchObject({ matched: 15, delegatedSessions: 0 }); expect(human.cache.imported).toBe(0);
  const ai = await complete(service, { ...input, origin: 'ai' }); expect(ai).toMatchObject({ matched: 15, mainSessions: 0 }); expect(ai.cache.imported).toBe(0);
  expect(ai.metrics.humanPrompts).toBe(0); expect(ai.metrics.aiPrompts).toBe(15);
  expect(f.adapter.load).toHaveBeenCalledTimes(30); service.dispose();
});
it('recovers a corrupt cache entry visibly and rewrites only that session', async () => {
  const f = await fixture(); let service = f.start(); const input = { adapterId: 'fixture', sourceId: 'db', to: f.now };
  await complete(service, input); service.dispose();
  const [file] = (await readdir(f.directory)).filter(name => name.endsWith('.json.gz')); await writeFile(join(f.directory, file), 'corrupt');
  service = f.start(); const result = await complete(service, input);
  expect(result.cache).toMatchObject({ imported: 1, reused: 29, errors: 1 }); service.dispose();
});

it('upgrades an old aggregate-only cache entry once and persists its timestamped facts', async () => {
  const f = await fixture(); let service = f.start(); const input = { adapterId: 'fixture', sourceId: 'db', to: f.now };
  await complete(service, input); service.dispose();
  const [file] = (await readdir(f.directory)).filter(name => name.endsWith('.json.gz')), path = join(f.directory, file);
  const old = JSON.parse(gunzipSync(await readFile(path)).toString()); delete old.facts; delete old.factsVersion;
  await writeFile(path, gzipSync(JSON.stringify(old)));
  service = f.start(); expect((await complete(service, input)).cache).toMatchObject({ imported: 1, reused: 29, errors: 0 }); service.dispose();
  const upgraded = JSON.parse(gunzipSync(await readFile(path)).toString()); expect(upgraded.factsVersion).toBe(2);
  expect(upgraded.facts.messages[0]).toMatchObject({ timestamp: f.now, text: '', promptFeatures: { short: false } });
  service = f.start(); expect((await complete(service, { ...input, from: f.now - 7 * f.day })).cache).toMatchObject({ imported: 0, reused: 8 }); service.dispose();
  expect(f.adapter.load).toHaveBeenCalledTimes(31);
});
it('returns a persisted rolling-window snapshot immediately after reload, then validates updates in the background', async () => {
  const f = await fixture(); let service = f.start();
  const input = { adapterId: 'fixture', sourceId: 'db', from: f.now - 7 * f.day, to: f.now };
  const first = await complete(service, input); service.dispose();
  const history = vi.spyOn(f.adapter, 'history'); let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const original = history.getMockImplementation()!;
  history.mockImplementation(async (...args) => { await barrier; return original(...args); });
  service = f.start();
  const shifted = { ...input, from: input.from + 1, to: input.to + 1 };
  const saved = await service.overview(shifted);
  expect(saved.cache).toMatchObject({ refreshing: true, imported: 0, reused: first.analyzed, snapshotAt: expect.any(Number) });
  expect(saved.metrics).toEqual(first.metrics);
  expect(f.adapter.load).toHaveBeenCalledTimes(8);
  history.mockImplementation(original); release();
  const fresh = await complete(service, shifted);
  expect(fresh.from).toBe(shifted.from); expect(fresh.cache.refreshing).not.toBe(true); expect(fresh.cache.imported).toBe(0);
  service.dispose();
});
it('rebuilds a damaged aggregate view using existing session facts without reimporting bodies', async () => {
  const f = await fixture(); let service = f.start(); const input = { adapterId: 'fixture', sourceId: 'db', to: f.now };
  await complete(service, input); service.dispose();
  const directory = join(f.directory, 'overviews-v1'), [file] = await readdir(directory);
  await writeFile(join(directory, file), 'broken');
  service = f.start(); const result = await complete(service, input);
  expect(result.cache).toMatchObject({ imported: 0, reused: 30, errors: 1 }); expect(f.adapter.load).toHaveBeenCalledTimes(30); service.dispose();
});
