import type { Source, HistoryQuery } from '../shared/model';
import { analyze } from './analyze';
import type { AdapterRegistry } from './adapters/types';
export interface Preferences { disabled: string[]; hidden: string[]; selected: string; paths: Record<string, string[]> }
export class CoachService {
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
  async analyze(adapterId: string, sourceId: string, sessionId: string) {
    const { adapter, source } = await this.resolve(adapterId, sourceId);
    return analyze(await adapter.load(source, sessionId));
  }
}
