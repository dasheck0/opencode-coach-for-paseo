import { readdir, realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, isAbsolute, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { setImmediate } from 'node:timers/promises';
import type { HistoryQuery, Message, Session, SessionSummary, Source, ToolCall } from '../../shared/model';
import { literal, openDatabase, type Row } from '../sqlite';
import type { CoachAdapter } from './types';

const num = (x: unknown): number | null => typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : null;
const str = (x: unknown) => typeof x === 'string' ? x : '';
const record = (x: unknown): Row => x !== null && typeof x === 'object' && !Array.isArray(x) ? x as Row : {};
const array = (x: unknown): unknown[] => Array.isArray(x) ? x : [];
const decode = (x: unknown): Row => record(JSON.parse(str(x)));
export function defaultRoots(env = process.env, home = homedir()): string[] {
  return [...new Set([
    ...(env.XDG_DATA_HOME ? [join(env.XDG_DATA_HOME, 'opencode')] : []),
    join(home, '.local', 'share', 'opencode'), join(home, 'Library', 'Application Support', 'opencode'),
    ...(env.LOCALAPPDATA ? [join(env.LOCALAPPDATA, 'opencode')] : []),
  ])];
}
function summary(row: Row, source: Source): SessionSummary {
  return { id: str(row.id), adapterId: 'opencode-v2', sourceId: source.id,
    title: str(row.title) || str(row.slug) || 'Untitled session', directory: str(row.directory),
    activityStart: num(row.activity_start) ?? undefined, activityEnd: num(row.activity_end) ?? undefined,
    parentId: str(row.parent_id) || null, created: num(row.time_created) ?? 0, updated: num(row.time_updated) ?? 0,
    inputTokens: num(row.tokens_input), outputTokens: num(row.tokens_output), cost: num(row.cost) };
}
function message(row: Row, parts?: Row[]): Message {
  const data = decode(row.data);
  const content = parts ?? array(data.content).map(record);
  const tokens = record(data.tokens), cache = record(tokens.cache);
  const tools: ToolCall[] = content.filter(p => p.type === 'tool').map(p => {
    const state = record(p.state), input = record(state.input);
    return { id: str(p.id) || str(p.callID), name: str(p.name) || str(p.tool), status: str(state.status),
      command: str(input.command).slice(0, 4000), file: str(input.filePath) || str(input.file_path) || str(input.path) };
  });
  const role = str(row.type) || str(data.role);
  return { id: str(row.id), role: role === 'user' || role === 'synthetic' ? 'user' : role === 'assistant' ? 'assistant' : 'system',
    synthetic: role !== 'user' && role !== 'assistant' || data.synthetic === true || content.some(p => p.synthetic === true),
    text: (str(data.text) || content.filter(p => p.type === 'text').map(p => str(p.text)).join('\n')).slice(0, 20000),
    timestamp: num(record(data.time).created) ?? num(row.time_created) ?? 0,
    tools, model: str(record(data.model).id) || str(record(data.model).modelID) || str(data.modelID) || undefined,
    inputTokens: num(tokens.input), outputTokens: num(tokens.output), cacheRead: num(cache.read),
    cacheWrite: num(cache.write), cost: num(data.cost),
  };
}
export class OpenCodeAdapter implements CoachAdapter {
  readonly id = 'opencode-v2';
  readonly title = 'OpenCode V2';
  readonly description = 'Local V2 sessions and older SQLite sessions. Read-only, no OpenCode server required.';
  constructor(private readonly roots = defaultRoots(), private readonly forceCli = false) {}
  async discover(paths: string[]): Promise<Source[]> {
    const candidates: string[] = [], sources: Source[] = [];
    // Explicit configuration replaces automatic discovery.
    for (const root of paths.length ? paths : this.roots) {
      if (paths.length && !isAbsolute(root)) throw new Error('Configured database paths must be absolute');
      const path = resolve(root);
      try {
        const info = await stat(path);
        if (info.isFile()) candidates.push(path);
        else for (const entry of await readdir(path, { withFileTypes: true })) {
          if (entry.isFile() && /^opencode(?:-[\w.-]+)?\.db$/.test(entry.name)) candidates.push(join(path, entry.name));
        }
      } catch (error) {
        if (paths.length) throw new Error(`Cannot access configured OpenCode path: ${path}`);
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    const seen = new Set<string>();
    for (const candidate of candidates) {
      const path = await realpath(candidate);
      if (seen.has(path)) continue;
      seen.add(path);
      const db = await openDatabase(path, this.forceCli);
      try {
        const tables = await db.query("SELECT name FROM sqlite_master WHERE type='table'");
        const names = new Set(tables.map(t => t.name));
        const format = names.has('session_v2') && names.has('session_message') ? 'v2'
          : names.has('session') && names.has('message') && names.has('part') ? 'legacy-sqlite' : '';
        if (!format) throw new Error(`Unsupported OpenCode schema in ${basename(path)}`);
        sources.push({ id: createHash('sha256').update(path + ':' + (await stat(path)).ino + ':' + (await stat(path)).birthtimeMs).digest('hex').slice(0, 24), label: basename(path), path, format });
      } finally { db.close(); }
    }
    return sources;
  }
  async history(source: Source, query: HistoryQuery): Promise<SessionSummary[]> {
    const db = await openDatabase(source.path, this.forceCli);
    try {
      const table = source.format === 'v2' ? 'session_v2' : 'session';
      const messageTable = source.format === 'v2' ? 'session_message' : 'message';
      const bounds = [query.from === undefined ? '' : `m.time_created >= ${literal(query.from)}`,
        query.to === undefined ? '' : `m.time_created <= ${literal(query.to)}`].filter(Boolean);
      const emptyBounds = [query.from === undefined ? '' : `s.time_created >= ${literal(query.from)}`,
        query.to === undefined ? '' : `s.time_created <= ${literal(query.to)}`].filter(Boolean);
      // Select actual activity, including resumed sessions created before the requested period.
      // Empty sessions remain visible at their creation date so incomplete logs can be inspected.
      const conditions = [bounds.length ? `(EXISTS (SELECT 1 FROM ${messageTable} m WHERE m.session_id=s.id AND ${bounds.join(' AND ')})
        OR (NOT EXISTS (SELECT 1 FROM ${messageTable} m WHERE m.session_id=s.id) AND ${emptyBounds.join(' AND ')}))` : '',
        query.directory ? `s.directory = ${literal(query.directory)}` : ''].filter(Boolean);
      const activityWhere = `m.session_id=s.id${bounds.length ? ' AND ' + bounds.join(' AND ') : ''}`;
      const rows = await db.query(`SELECT s.*,
        (SELECT MIN(m.time_created) FROM ${messageTable} m WHERE ${activityWhere}) AS activity_start,
        (SELECT MAX(m.time_created) FROM ${messageTable} m WHERE ${activityWhere}) AS activity_end FROM ${table} s ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
        ORDER BY COALESCE(activity_end, s.time_created) DESC, s.id DESC LIMIT ${literal(query.limit)} OFFSET ${literal(query.offset)}`);
      return rows.map(r => summary(r, source));
    } finally { db.close(); }
  }
  async summary(source: Source, sessionId: string): Promise<SessionSummary> {
    const db = await openDatabase(source.path, this.forceCli);
    try {
      const [row] = await db.query(`SELECT * FROM ${source.format === 'v2' ? 'session_v2' : 'session'} WHERE id=${literal(sessionId)}`);
      if (!row) throw new Error('Session no longer exists');
      return summary(row, source);
    } finally { db.close(); }
  }
  async load(source: Source, sessionId: string): Promise<Session> {
    const db = await openDatabase(source.path, this.forceCli);
    try {
      const v2 = source.format === 'v2', id = literal(sessionId);
      const [row] = await db.query(`SELECT * FROM ${v2 ? 'session_v2' : 'session'} WHERE id=${id}`);
      if (!row) throw new Error('Session no longer exists');
      const table = v2 ? 'session_message' : 'message';
      const warnings: string[] = [];
      const messages: Message[] = [];
      let compactions = 0; const compactionTimes: number[] = [];
      const parts = new Map<string, Row[]>();
      if (!v2) {
        const partRows = await db.query(`WITH limited AS (SELECT * FROM part WHERE session_id=${id}
          ORDER BY time_created DESC, id DESC LIMIT 20001), budget AS (SELECT *,
          SUM(length(data)) OVER (ORDER BY time_created DESC, id DESC) AS bytes FROM limited)
          SELECT id, message_id, time_created, CASE WHEN length(data) <= 2097152 AND bytes <= 33554432 THEN data ELSE NULL END AS data
          FROM budget ORDER BY time_created, id`);
        if (partRows.length > 20000) warnings.push('Analysis is limited to 20000 content parts.');
        for (const p of partRows.slice(-20000)) {
          try {
            const value = { ...decode(p.data), id: p.id };
            if ((value as Row).type === 'compaction') { compactions++; compactionTimes.push(num(p.time_created) ?? 0); }
            parts.set(str(p.message_id), [...(parts.get(str(p.message_id)) ?? []), value]);
          } catch { warnings.push('An invalid content part or a record exceeding the 2 MiB record / 32 MiB read budget was skipped.'); }
        }
      }
      let cursor: Row | undefined, exhausted = false;
      // Small keyset pages bound raw payload memory while retaining old and resumed prompts.
      for (let count = 0; count < 100000; count += 8) {
        const before = !cursor ? '' : v2 ? ` AND seq < ${literal(cursor.seq as number)}`
          : ` AND (time_created < ${literal(cursor.time_created as number)} OR (time_created = ${literal(cursor.time_created as number)} AND id < ${literal(str(cursor.id))}))`;
        const rows = await db.query(`SELECT id, ${v2 ? 'type, seq,' : ''} time_created,
          CASE WHEN length(data) <= 2097152 THEN data ELSE NULL END AS data FROM ${table}
          WHERE session_id=${id}${before} ORDER BY ${v2 ? 'seq DESC' : 'time_created DESC, id DESC'} LIMIT 8`);
        for (const r of rows) {
          if (r.type === 'compaction') { compactions++; compactionTimes.push(num(r.time_created) ?? 0); }
          try { messages.push(message(r, v2 ? undefined : parts.get(str(r.id)))); }
          catch { warnings.push('An invalid message or a record exceeding the 2 MiB record budget was skipped.'); }
        }
        if (rows.length < 8) { exhausted = true; break; }
        cursor = rows.at(-1); await setImmediate();
      }
      if (!exhausted) warnings.push('Analysis is limited to the most recent 100000 messages; this report is incomplete.');
      messages.reverse();
      return { summary: summary(row, source), messages, compactions, compactionTimes, warnings: [...new Set(warnings)] };
    } finally { db.close(); }
  }
}
