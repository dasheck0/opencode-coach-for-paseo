import { expect, it, vi } from 'vitest';
vi.mock('react-native', () => ({ View: 'View', Text: 'Text', Pressable: 'Pressable' }));
vi.mock('@getpaseo/plugin/client/ui', () => ({ SettingsSelect: 'SettingsSelect' }));
import { pageNumbers } from '../client/pagination';
import { CoachService } from '../server/service';
import { AdapterRegistry, type CoachAdapter } from '../server/adapters/types';
import type { SessionSummary } from '../shared/model';
it('uses conventional numbered pages with endpoint links and gaps for long ranges', () => {
  expect(pageNumbers(2, 5)).toEqual([1, 2, 3, 4, 5]);
  expect(pageNumbers(101, 125)).toEqual([1, 'gap', 99, 100, 101, 102, 103, 'gap', 125]);
  expect(pageNumbers(1, 25)).toEqual([1, 2, 3, 'gap', 25]);
  expect(pageNumbers(25, 25)).toEqual([1, 'gap', 23, 24, 25]);
});
it('paginates complete workspace groups with exact totals across all adapter pages and clamps the last page', async () => {
  const rows: SessionSummary[] = Array.from({ length: 257 }, (_, n) => ({ id: String(n), adapterId: 'f', sourceId: 's', directory: `/workspace/${n % 12}`, created: 1, updated: 1, title: '', parentId: n % 3 ? null : 'parent', inputTokens: null, outputTokens: null, cost: null }));
  const adapter: CoachAdapter = { id: 'f', title: '', description: '', discover: async () => [{ id: 's', label: '', path: '/fixture', format: '' }], history: vi.fn(async (_source, q) => rows.slice(q.offset, q.offset + q.limit)), load: vi.fn() };
  const service = new CoachService(new AdapterRegistry([adapter]), async () => ({ selected: 'f', disabled: [], hidden: [], paths: {} }));
  try {
    const pages = await Promise.all([0, 5, 10].map(offset => service.history('f', 's', { groupBy: 'workspace', limit: 5, offset })));
    expect(pages.map(p => new Set(p.sessions.map(s => s.directory)).size)).toEqual([5, 5, 2]);
    for (const page of pages) {
      expect(page.total).toBe(12); expect(page.totalSessions).toBe(257);
      const dirs = new Set(page.sessions.map(s => s.directory));
      expect(page.sessions).toHaveLength(rows.filter(s => dirs.has(s.directory)).length);
    }
    expect(new Set(pages.flatMap(p => p.sessions.map(s => s.id))).size).toBe(257);
    expect(pages[0].hasMore).toBe(true); expect(pages[2].hasMore).toBe(false);
    expect((await service.history('f', 's', { groupBy: 'workspace', limit: 5, offset: 100 })).offset).toBe(10);
    const human = await service.history('f', 's', { groupBy: 'workspace', origin: 'human', limit: 5, offset: 0 });
    expect(human.totalSessions).toBe(rows.filter(s => !s.parentId).length);
    expect(human.sessions.every(s => !s.parentId)).toBe(true);
    expect(adapter.load).not.toHaveBeenCalled();
  } finally { service.dispose(); }
});
