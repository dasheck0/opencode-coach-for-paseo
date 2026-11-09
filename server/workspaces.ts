import type { PaseoApi } from '@getpaseo/client';
import type { SessionSummary } from '../shared/model';
import type { WorkspaceCatalog, Workspace } from '../shared/workspaces';
const normalized = (path: string) => path.replaceAll('\\', '/').replace(/\/+$/, '');
const inside = (path: string, root: string) => normalized(path) === normalized(root) || normalized(path).startsWith(normalized(root) + '/');
export async function fetchWorkspaces(paseo: PaseoApi): Promise<WorkspaceCatalog> {
  const workspaces: Workspace[] = []; let cursor: string | undefined;
  do {
    const page = await paseo.workspaces.list({ includeBackground: true, page: { limit: 200, ...(cursor ? { cursor } : {}) } });
    for (const w of page.entries) workspaces.push({ id: w.id, name: w.title || w.name, projectId: w.projectId,
      projectName: w.projectCustomName || w.projectDisplayName, projectRoot: w.projectRootPath,
      directory: w.workspaceDirectory || w.projectRootPath, worktree: w.workspaceKind === 'worktree' });
    const next = page.pageInfo.nextCursor ?? undefined;
    if (next && next === cursor) throw new Error('Workspace pagination did not advance');
    cursor = next;
  } while (cursor);
  return { workspaces };
}
export function workspaceFor(directory: string, catalog: WorkspaceCatalog) {
  return catalog.workspaces.filter(w => inside(directory, w.directory)).sort((a, b) => b.directory.length - a.directory.length)[0];
}
export function enrichSummary(summary: SessionSummary, catalog: WorkspaceCatalog): SessionSummary {
  const workspace = workspaceFor(summary.directory, catalog);
  if (workspace) return { ...summary, workspaceId: workspace.id, workspaceName: workspace.name, projectName: workspace.projectName };
  // Other/archived worktrees alongside a known Paseo worktree retain their project identity.
  const sibling = catalog.workspaces.find(w => w.worktree && /[/\\]worktrees[/\\]/.test(w.directory) && inside(summary.directory, w.directory.replace(/[/\\][^/\\]+$/, '')));
  const project = sibling ?? catalog.workspaces.filter(w => inside(summary.directory, w.projectRoot)).sort((a, b) => b.projectRoot.length - a.projectRoot.length)[0];
  return { ...summary, workspaceName: normalized(summary.directory).split('/').pop() || 'Unknown workspace', projectName: project?.projectName };
}
export function selectedWorkspace(summary: SessionSummary, ids: string[] | undefined, catalog: WorkspaceCatalog) {
  if (!ids?.length) return true;
  const workspace = workspaceFor(summary.directory, catalog);
  // Local Paseo workspaces may share a directory. Their sessions cannot be separated by directory metadata alone.
  return !!workspace && catalog.workspaces.some(w => ids.includes(w.id) && normalized(w.directory) === normalized(workspace.directory));
}
