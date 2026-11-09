import type { PaseoApi } from '@getpaseo/client';
import type { SessionSummary } from '../shared/model';
import type { WorkspaceCatalog, Workspace, Project } from '../shared/workspaces';
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
  const { projects } = await paseo.projects.list();
  return { workspaces, projects: projects.map(p => ({ id: p.projectId, name: p.projectCustomName || p.projectDisplayName, directory: p.projectRootPath })) };
}
export function workspaceFor(directory: string, catalog: WorkspaceCatalog) {
  return catalog.workspaces.filter(w => inside(directory, w.directory)).sort((a, b) => b.directory.length - a.directory.length)[0];
}
export function enrichSummary(summary: SessionSummary, catalog: WorkspaceCatalog): SessionSummary {
  const workspace = workspaceFor(summary.directory, catalog);
  if (workspace) return { ...summary, projectId: workspace.projectId, workspaceId: workspace.id, workspaceName: workspace.name, projectName: workspace.projectName };
  // Other/archived worktrees alongside a known Paseo worktree retain their project identity.
  const sibling = catalog.workspaces.find(w => w.worktree && /[/\\]worktrees[/\\]/.test(w.directory) && inside(summary.directory, w.directory.replace(/[/\\][^/\\]+$/, '')));
  const project = projectsFor(catalog).filter(p => inside(summary.directory, p.directory)).sort((a, b) => b.directory.length - a.directory.length)[0];
  return { ...summary, workspaceName: normalized(summary.directory).split('/').pop() || 'Unknown workspace', projectId: sibling?.projectId ?? project?.id, projectName: sibling?.projectName ?? project?.name };
}
export function projectsFor(catalog: WorkspaceCatalog): Project[] {
  return catalog.projects ?? [...new Map(catalog.workspaces.map(w => [w.projectId, { id: w.projectId, name: w.projectName, directory: w.projectRoot }])).values()];
}
export function selectedProject(summary: SessionSummary, ids: string[] | undefined, catalog: WorkspaceCatalog) {
  return !ids?.length || ids.includes(enrichSummary(summary, catalog).projectId ?? '');
}
