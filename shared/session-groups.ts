import type { SessionSummary } from './model';
export function workspaceTimelines(sessions: SessionSummary[]) {
  const groups = new Map<string, { key: string; projectName?: string; workspaceName: string; sessions: SessionSummary[] }>();
  for (const session of sessions) {
    const key = JSON.stringify([session.projectId ?? session.projectName ?? '', session.workspaceId ?? session.directory]);
    const group = groups.get(key) ?? { key, projectName: session.projectName, workspaceName: session.workspaceName || session.directory, sessions: [] };
    group.sessions.push(session); groups.set(key, group);
  }
  return [...groups.values()];
}
