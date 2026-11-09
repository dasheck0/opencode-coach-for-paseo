import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { OpenCodeAdapter, defaultRoots } from '../server/adapters/opencode';
import { database } from './fixtures';
import { analyze } from '../server/analyze';
const fixtures: ReturnType<typeof database>[] = [];
afterEach(() => { fixtures.splice(0).forEach(f => f.close()); });
function fixture(v2 = true) { const f = database(v2); fixtures.push(f); return f; }
describe.each([false, true])('OpenCode database reader (CLI fallback=%s)', forceCli => {
  it('reads V2 inline content and tokens once, skips synthetic prompts and preserves evidence', async () => {
    const f = fixture(); f.session('s');
    f.message('u', 's', 'user', 1, { text: 'Implement src/foo.ts and run tests' });
    f.message('sys', 's', 'synthetic', 2, { text: 'auto resume' });
    f.message('a', 's', 'assistant', 3, { model: { id: 'fixture-model' }, tokens: { input: 10, output: 20, cache: { read: 7, write: 3 } }, cost: 0.01,
      content: [{ type: 'tool', id: 't', name: 'edit', state: { status: 'completed', input: { filePath: 'src/foo.ts' } } }] });
    const before = readFileSync(f.path);
    const adapter = new OpenCodeAdapter([f.root], forceCli), [source] = await adapter.discover([]);
    expect(source.format).toBe('v2');
    const [s] = await adapter.history(source, { limit: 10, offset: 0 });
    const report = analyze(await adapter.load(source, s.id));
    expect(report.metrics).toMatchObject({ humanPrompts: 1, assistantCalls: 1, inputTokens: 10, outputTokens: 20, cacheRead: 7, edits: 1 });
    expect(report.findings.find(f => f.rule === 'verification-gap')?.messageIds).toEqual(['a']);
    expect(readFileSync(f.path)).toEqual(before);
  });
  it('supports older SQLite messages and parts without double counting step tokens', async () => {
    const f = fixture(false); f.session('old');
    f.message('u', 'old', 'user', 1, {}); f.message('a', 'old', 'assistant', 2, { tokens: { input: 5, output: 3 } });
    for (const [id, mid, data] of [['p1', 'u', { type: 'text', text: 'Build a fixture' }], ['p2', 'a', { type: 'step-finish', tokens: { input: 5, output: 3 } }]] as const)
      f.db.prepare('INSERT INTO part VALUES(?,?,?,?,?)').run(id, 'old', mid, 1, JSON.stringify(data));
    const adapter = new OpenCodeAdapter([f.path], forceCli), [source] = await adapter.discover([]);
    expect(source.format).toBe('legacy-sqlite');
    const session = await adapter.load(source, 'old');
    expect(session.messages[0].text).toBe('Build a fixture');
    expect(analyze(session).metrics.inputTokens).toBe(5);
  });
});
it('uses V2 exclusively when both schemas exist, avoiding migrated session duplicates', async () => {
  const f = fixture(); f.session('new'); f.db.exec("CREATE TABLE session(id TEXT); INSERT INTO session VALUES('old');");
  const adapter = new OpenCodeAdapter([f.root]), [source] = await adapter.discover([]);
  expect((await adapter.history(source, { limit: 10, offset: 0 })).map(s => s.id)).toEqual(['new']);
});
it('supports stable pagination, dates, exact directory and injection-safe session IDs', async () => {
  const f = fixture(); f.session("s' OR 1=1 --", 1000); f.session('b', 2000); f.session('c', 3000);
  const adapter = new OpenCodeAdapter([f.root]), [source] = await adapter.discover([]);
  expect((await adapter.history(source, { limit: 1, offset: 1, from: 1500, to: 4000, directory: '/fixture' }))[0].id).toBe('b');
  expect((await adapter.load(source, "s' OR 1=1 --")).summary.id).toBe("s' OR 1=1 --");
  expect(await adapter.history(source, { limit: 5, offset: 0, directory: "' OR 1=1 --" })).toEqual([]);
});
it('reports corrupt records and excludes child-session prompts from human metrics', async () => {
  const f = fixture(); f.session('child', 1000, 'parent'); f.message('u', 'child', 'user', 1, { text: 'delegated task' }); f.message('bad', 'child', 'assistant', 2, '{');
  const a = new OpenCodeAdapter([f.root]), [s] = await a.discover([]), result = analyze(await a.load(s, 'child'));
  expect(result.metrics.humanPrompts).toBe(0); expect(result.warnings).toHaveLength(1);
});
it('fails visibly for missing configured paths and unsupported schemas', async () => {
  const f = fixture(); f.db.exec('DROP TABLE session_v2'); const a = new OpenCodeAdapter([]);
  await expect(a.discover([f.path])).rejects.toThrow('Unsupported');
  await expect(a.discover(['/missing/coach.db'])).rejects.toThrow('Cannot access');
  expect(await a.discover([])).toEqual([]);
});
it('deduplicates source paths and honors XDG discovery', async () => {
  const f = fixture(), a = new OpenCodeAdapter([f.root, f.path]);
  expect(await a.discover([])).toHaveLength(1);
  expect(defaultRoots({ XDG_DATA_HOME: '/data' }, '/home/fixture')).toContain('/data/opencode');
});
it('reads sessions longer than the former 2000-message limit in bounded pages', async () => {
  const f = fixture(); f.session('long'); f.db.exec('BEGIN');
  for (let n = 0; n < 2001; n++) f.message(`m${n}`, 'long', 'user', n, { text: 'fixture' });
  f.db.exec('COMMIT');
  const a = new OpenCodeAdapter([f.root]), [s] = await a.discover([]), result = await a.load(s, 'long');
  expect(result.messages).toHaveLength(2001); expect(result.warnings).toEqual([]);
  expect(result.messages[0].id).toBe('m0'); expect(result.messages.at(-1)?.id).toBe('m2000');
});
it('requires absolute explicit paths', async () => { await expect(new OpenCodeAdapter([]).discover(['relative.db'])).rejects.toThrow('absolute'); });
