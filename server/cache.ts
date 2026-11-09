import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { gzip, gunzip } from 'node:zlib';
import { promisify } from 'node:util';
import { z } from 'zod';
import { reportSchema } from '../shared/model';
import { factsSchema } from './facts';
import type { Report, Session } from '../shared/model';
import type { Origin } from '../shared/preferences';
const zip = promisify(gzip), unzip = promisify(gunzip);
// Change only when normalization or analysis semantics change, not for UI/translation updates.
export const ANALYSIS_VERSION = 4;
export const defaultCacheDirectory = () => process.env.COACH_CACHE_DIR || join(process.env.PASEO_HOME || join(homedir(), '.paseo'), 'plugin-data', 'opencode-coach-for-paseo', 'cache-v4');
const bundleSchema = z.object({ human: reportSchema, ai: reportSchema, all: reportSchema, facts: factsSchema.optional(), factsVersion: z.number().optional() });
export type ReportBundle = Record<Origin, Report> & { facts?: Session; factsVersion?: number };
export interface ReportCache { persistent: boolean; get(key: string): Promise<ReportBundle | undefined>; put(key: string, value: ReportBundle): Promise<void> }
export class MemoryReportCache implements ReportCache {
  persistent = false; private readonly entries = new Map<string, ReportBundle>();
  async get(key: string) { return this.entries.get(key); }
  async put(key: string, value: ReportBundle) { this.entries.set(key, value); }
}
export class DiskReportCache implements ReportCache {
  persistent = true;
  constructor(readonly directory: string) {}
  private path(key: string) { return join(this.directory, createHash('sha256').update(key).digest('hex') + '.json.gz'); }
  async get(key: string) {
    let bytes: Buffer;
    try { bytes = await readFile(this.path(key)); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
    return bundleSchema.parse(JSON.parse((await unzip(bytes, { maxOutputLength: 32 * 1024 * 1024 })).toString('utf8')));
  }
  async put(key: string, value: ReportBundle) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const target = this.path(key), temp = target + '.' + randomUUID() + '.tmp';
    try { await writeFile(temp, await zip(JSON.stringify(bundleSchema.parse(value))), { mode: 0o600 }); await rename(temp, target); }
    finally { await unlink(temp).catch(() => {}); }
  }
}
