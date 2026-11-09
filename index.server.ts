import type { PaseoApi } from '@getpaseo/client';
import { DiskReportCache, defaultCacheDirectory } from './server/cache';
import { fetchWorkspaces } from './server/workspaces';
import { viewPreferences } from './shared/preferences';
import type { PluginServerContext } from '@getpaseo/plugin/server';
import { preferences, catalogRpc, historyRpc, analyzeRpc, overviewRpc, workspacesRpc } from './shared/contracts';
import { CoachService } from './server/service';
import { createRegistry } from './server/registry';
export default function contribute(server: PluginServerContext) {
  const settings = server.registerSettings(preferences);
  server.registerSettings(viewPreferences);
  let api: PaseoApi | undefined;
  let workspaceSnapshot: Awaited<ReturnType<typeof fetchWorkspaces>> | undefined, workspaceTime = 0;
  const workspaceCatalog = async () => {
    if (!api) throw new Error('Paseo connection unavailable');
    if (!workspaceSnapshot || Date.now() - workspaceTime > 10000) { workspaceSnapshot = await fetchWorkspaces(api); workspaceTime = Date.now(); }
    return workspaceSnapshot;
  };
  const service = new CoachService(createRegistry(), async () => {
    const current = await settings.read();
    if (current.status !== 'ready') throw new Error('Coach settings are invalid. Open plugin settings to recover them.');
    return current.values;
  }, new DiskReportCache(defaultCacheDirectory()), workspaceCatalog);
  server.handle(catalogRpc, () => service.catalog());
  server.handle(historyRpc, ({ adapterId, sourceId, ...query }, { paseo }) => { api = paseo; return service.history(adapterId, sourceId, query); });
  server.handle(analyzeRpc, ({ adapterId, sourceId, sessionId, origin }, { paseo }) => { api = paseo; return service.analyze(adapterId, sourceId, sessionId, origin); });
  server.handle(overviewRpc, (input, { paseo }) => { api = paseo; return service.overview(input); });
  server.handle(workspacesRpc, (_input, { paseo }) => { api = paseo; return service.workspaces(); });
  return () => service.dispose();
}
