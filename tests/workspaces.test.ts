import { expect, it } from 'vitest';
import { enrichSummary, selectedWorkspace } from '../server/workspaces';
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
it('supports multi-selection with path boundaries instead of accidental prefix matches', () => {
  expect(selectedWorkspace(summary, ['w1', 'w2'], catalog)).toBe(true);
  expect(selectedWorkspace(summary, ['w2'], catalog)).toBe(false);
  expect(selectedWorkspace({ ...summary, directory: '/project-other' }, ['w2'], catalog)).toBe(false);
  expect(selectedWorkspace({ ...summary, directory: '/project/subdir' }, ['w2'], catalog)).toBe(true);
});
it('includes a selected local workspace alias sharing the same directory', () => {
  const aliases = { workspaces: [...catalog.workspaces, { ...catalog.workspaces[1], id: 'local-alias', name: 'Another local workspace' }] };
  expect(selectedWorkspace({ ...summary, directory: '/project' }, ['local-alias'], aliases)).toBe(true);
});
