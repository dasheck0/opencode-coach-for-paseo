import { expect, it } from 'vitest';
import { build } from 'esbuild';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, resolve } from 'node:path';
import { database } from './fixtures';
import { rmSync } from 'node:fs';
it('uses native SQLite from a bundled CommonJS plugin even without a CLI on PATH', async () => {
  const f = database(); f.session('native');
  const out = join(f.root, 'plugin.cjs');
  try {
    await build({ stdin: { contents: `import {openDatabase} from ${JSON.stringify(resolve('server/sqlite.ts'))}; openDatabase(process.argv[2]).then(async db=>{const rows=await db.query('SELECT id FROM session_v2'); db.close(); console.log(JSON.stringify(rows));}).catch(e=>{console.error(e);process.exitCode=1;});`, resolveDir: process.cwd(), loader: 'ts' }, outfile: out, bundle: true, platform: 'node', format: 'cjs' });
    const { stdout } = await promisify(execFile)(process.execPath, [out, f.path], { env: { ...process.env, PATH: '' } });
    expect(stdout).toContain('Driver: native'); expect(stdout).toContain('"id":"native"');
  } finally { f.close(); rmSync(out, { force: true }); }
});
