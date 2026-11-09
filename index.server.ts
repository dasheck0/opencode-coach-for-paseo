import type { PluginServerContext } from '@getpaseo/plugin/server';
import { preferences, catalogRpc, historyRpc, analyzeRpc, overviewRpc } from './shared/contracts';
import { CoachService } from './server/service';
import { createRegistry } from './server/registry';
export default function contribute(server: PluginServerContext) {
  const settings = server.registerSettings(preferences);
  const service = new CoachService(createRegistry(), async () => {
    const current = await settings.read();
    if (current.status !== 'ready') throw new Error('Coach settings are invalid. Open plugin settings to recover them.');
    return current.values;
  });
  server.handle(catalogRpc, () => service.catalog());
  server.handle(historyRpc, ({ adapterId, sourceId, ...query }) => service.history(adapterId, sourceId, query));
  server.handle(analyzeRpc, ({ adapterId, sourceId, sessionId }) => service.analyze(adapterId, sourceId, sessionId));
  server.handle(overviewRpc, input => service.overview(input));
  return () => service.dispose();
}
