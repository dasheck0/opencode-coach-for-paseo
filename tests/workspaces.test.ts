import { expect, it } from 'vitest';
import { enrichSummary, selectedProject, fetchWorkspaces } from '../server/workspaces';
import type { SessionSummary } from '../shared/model';
import type { WorkspaceCatalog } from '../shared/workspaces';
const catalog: WorkspaceCatalog = { workspaces: [
  { id: 'w1', name: 'NAM-13 Aufnahme', projectName: 'Meeting app', projectId: 'p', directory: '/home/.paseo/worktrees/hash/dirty-albatross', projectRoot: '/project', worktree: true },
  { id: 'w2', name: 'Develop', projectName: 'Meeting app', projectId: 'p', directory: '/project', projectRoot: '/project', worktree: false },
] };
const summary = { directory: catalog.workspaces[0].directory } as SessionSummary;
it('maps random worktree names to the actual Paseo project and workspace', () => {
  expect(enrichSummary(summary, catalog)).toMatchObject({ projectName: 'Meeting app', workspaceName: 'NAM-13 Aufnahme', workspaceId: 'w1' });
  expect(enrichSummary({ ...summary, directory: '/home/.paseo/worktrees/hash/old-worktree' }, catalog)).toMatchObject({ projectName: 'Meeting app', workspaceName: 'old-worktree' });
});
it('filters projects across main, active and historical worktrees with path boundaries', () => {
  for (const directory of ['/project', '/project/subdir', summary.directory, '/home/.paseo/worktrees/hash/old-worktree']) {
    expect(selectedProject({ ...summary, directory }, ['p'], catalog)).toBe(true);
    expect(selectedProject({ ...summary, directory }, ['other'], catalog)).toBe(false);
  }
  expect(selectedProject({ ...summary, directory: '/project-other' }, ['p'], catalog)).toBe(false);
  expect(selectedProject(summary, ['other', 'p'], catalog)).toBe(true);
  expect(selectedProject(summary, [], catalog)).toBe(true);
});
it('includes projects without active workspaces and resolves nested project roots', async () => {
  const projects = [{ projectId: 'empty', projectDisplayName: 'Empty', projectRootPath: '/empty' }];
  const paseo = { workspaces: { list: async () => ({ entries: [], pageInfo: {} }) }, projects: { list: async () => ({ projects }) } };
  const result = await fetchWorkspaces(paseo as unknown as Parameters<typeof fetchWorkspaces>[0]);
  expect(result.projects).toEqual([{ id: 'empty', name: 'Empty', directory: '/empty' }]);
  expect(selectedProject({ ...summary, directory: '/empty/subdir' }, ['empty'], result)).toBe(true);
  const nested = { ...result, projects: [...result.projects!, { id: 'nested', name: 'Nested', directory: '/empty/nested' }] };
  expect(selectedProject({ ...summary, directory: '/empty/nested' }, ['empty'], nested)).toBe(false);
  expect(selectedProject({ ...summary, directory: '/empty/nested' }, ['nested'], nested)).toBe(true);
});
