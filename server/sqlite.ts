import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
const run = promisify(execFile);
export type Row = Record<string, unknown>;
export function literal(value: string | number): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Invalid SQL number');
    return String(value);
  }
  if (value.includes('\0')) throw new Error('Invalid SQL string');
  return "'" + value.replaceAll("'", "''") + "'";
}
interface Database { prepare(sql: string): { all(): Row[] }; close(): void }
export async function openDatabase(path: string, forceCli = false) {
  if (!isAbsolute(path) || !(await stat(path)).isFile()) throw new Error('Choose an existing absolute database path');
  let native: Database | undefined;
  if (!forceCli) {
    try {
      const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');
      native = new DatabaseSync(path, { readOnly: true });
    } catch { /* Electron may omit node:sqlite. The system CLI is a read-only fallback. */ }
  }
  return {
    async query(sql: string): Promise<Row[]> {
      if (native) return native.prepare(sql).all();
      try {
        const { stdout } = await run('sqlite3', ['-readonly', '-json', '-cmd', '.timeout 3000', path, sql],
          { maxBuffer: 64 * 1024 * 1024, timeout: 20000 });
        return stdout.trim() ? JSON.parse(stdout) : [];
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') throw new Error('SQLite unavailable. Use Node 22.13+ or install sqlite3 on the daemon PATH.');
        throw new Error('Cannot read OpenCode database. Check schema, file permissions, or database lock.');
      }
    },
    close() { native?.close(); },
  };
}
