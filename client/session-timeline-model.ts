import type { SessionSummary } from '../shared/model';
export function timelineLayout(sessions: SessionSummary[], from?: number, to?: number) {
  const intervals = sessions.map(session => ({ session, start: session.activityStart ?? session.created, end: Math.max(session.activityStart ?? session.created, session.activityEnd ?? session.updated) }));
  let start = from ?? Math.min(...intervals.map(i => i.start));
  let end = to ?? Math.max(...intervals.map(i => i.end));
  if (!Number.isFinite(start)) start = 0;
  if (!Number.isFinite(end) || end <= start) end = start + 3600000;
  let previousEnd = -Infinity, crowded = false;
  const segments = intervals.filter(i => i.end >= start && i.start <= end).sort((a, b) => a.start - b.start || a.end - b.end || a.session.id.localeCompare(b.session.id)).map(i => {
    if (previousEnd > i.start) crowded = true;
    previousEnd = Math.max(previousEnd, i.end);
    const left = (Math.max(start, i.start) - start) / (end - start);
    return { ...i, lane: 0, left, width: (Math.min(end, i.end) - Math.max(start, i.start)) / (end - start) };
  });
  return { start, end, segments, lanes: 1, crowded };
}
export function timelineTicks(start: number, end: number, count: number) {
  return Array.from({ length: count }, (_, i) => start + (end - start) * i / (count - 1));
}

export function workspaceTimelines(sessions: SessionSummary[]) {
  const groups = new Map<string, { key: string; projectName?: string; workspaceName: string; sessions: SessionSummary[] }>();
  for (const session of sessions) {
    const key = JSON.stringify([session.projectId ?? session.projectName ?? '', session.workspaceId ?? session.directory]);
    const group = groups.get(key) ?? { key, projectName: session.projectName, workspaceName: session.workspaceName || session.directory, sessions: [] };
    group.sessions.push(session); groups.set(key, group);
  }
  return [...groups.values()];
}
