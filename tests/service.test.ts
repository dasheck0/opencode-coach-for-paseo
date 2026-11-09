import { expect, it, vi } from 'vitest';
import { AdapterRegistry, type CoachAdapter } from '../server/adapters/types';
import { CoachService, type Preferences } from '../server/service';
import { historyRpc } from '../shared/contracts';
const source = { id: 'db', label: 'Fixture', path: '/fixture.db', format: 'fixture' };
function fixture() {
  const adapter: CoachAdapter = { id: 'claude-code', title: 'Claude Code fixture', description: 'Contract test only', discover: vi.fn(async () => [source]), history: vi.fn(async () => []), load: vi.fn() };
  const prefs: Preferences = { disabled: [], hidden: [], selected: adapter.id, paths: {} };
  return { adapter, prefs, service: new CoachService(new AdapterRegistry([adapter]), async () => prefs) };
}
it('a third-party adapter automatically appears and resolves through the same service', async () => {
  const { adapter, service } = fixture(); expect((await service.catalog()).adapters[0].id).toBe('claude-code');
  await service.history(adapter.id, source.id, { limit: 50, offset: 0 }); expect(adapter.history).toHaveBeenCalledWith(source, { from: undefined, to: undefined, directory: undefined, limit: 200, offset: 0 });
});
it('disabled providers cannot be read and are not probed by discovery', async () => {
  const { adapter, prefs, service } = fixture(); prefs.disabled.push(adapter.id);
  expect((await service.catalog()).adapters[0].enabled).toBe(false); expect(adapter.discover).not.toHaveBeenCalled();
  await expect(service.analyze(adapter.id, source.id, 's')).rejects.toThrow('disabled'); expect(adapter.load).not.toHaveBeenCalled();
});
it('hidden providers remain in catalog and source IDs cannot access arbitrary files', async () => {
  const { adapter, prefs, service } = fixture(); prefs.hidden.push(adapter.id);
  expect((await service.catalog()).adapters[0].hidden).toBe(true);
  await expect(service.analyze(adapter.id, '/etc/passwd', 's')).rejects.toThrow('Source no longer');
});
it('rejects duplicate adapters and reports discovery errors', async () => {
  const { adapter, service } = fixture(); expect(() => new AdapterRegistry([adapter, adapter])).toThrow('Duplicate');
  vi.mocked(adapter.discover).mockRejectedValue(new Error('fixture failure'));
  expect((await service.catalog()).adapters[0].error).toBe('fixture failure');
});
it('registers typed history contracts', () => { expect(historyRpc).toBeDefined(); });
