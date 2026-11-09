import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export function database(v2 = true) {
  const root = mkdtempSync(join(tmpdir(), 'coach-test-')), path = join(root, 'opencode.db');
  const db = new DatabaseSync(path);
  const table = v2 ? 'session_v2' : 'session';
  db.exec(`CREATE TABLE ${table}(id TEXT PRIMARY KEY,title TEXT,slug TEXT,directory TEXT,parent_id TEXT,time_created INTEGER,time_updated INTEGER,tokens_input INTEGER,tokens_output INTEGER,cost REAL);
    CREATE TABLE ${v2 ? 'session_message' : 'message'}(id TEXT PRIMARY KEY,session_id TEXT,type TEXT,seq INTEGER,time_created INTEGER,data TEXT);
    CREATE TABLE part(id TEXT PRIMARY KEY,session_id TEXT,message_id TEXT,time_created INTEGER,data TEXT);`);
  const session = (id: string, created = 1000, parent: string | null = null) => db.prepare(`INSERT INTO ${table} VALUES(?,?,?,?,?,?,?,?,?,?)`).run(id, 'Fixture session', '', '/fixture', parent, created, created + 10000, 10, 20, 0.01);
  const message = (id: string, sessionId: string, type: string, seq: number, data: unknown) => db.prepare(`INSERT INTO ${v2 ? 'session_message' : 'message'} VALUES(?,?,?,?,?,?)`).run(id, sessionId, type, seq, 1000 + seq, typeof data === 'string' ? data : JSON.stringify({ role: type, ...data as object }));
  return { root, path, db, session, message, close: () => { db.close(); rmSync(root, { recursive: true, force: true }); } };
}
