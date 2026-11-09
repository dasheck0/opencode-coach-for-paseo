import { expect, it } from 'vitest';
import { analyze, isVerification } from '../server/analyze';
import type { Message, Session } from '../shared/model';
function assistant(id: string, tools: Message['tools']): Message { return { id, role: 'assistant', text: '', synthetic: false, timestamp: 0, tools,
  inputTokens: null, outputTokens: null, cacheRead: null, cacheWrite: null, cost: null }; }
const edit = { id: 'e', name: 'edit', status: 'completed' };
const check = { id: 'c', name: 'bash', status: 'completed', command: 'npm test' };
function session(messages: Message[]): Session { return { summary: { id: 's', adapterId: 'fixture', sourceId: 'db', title: '', directory: '', parentId: null, created: 0, updated: 0, inputTokens: null, outputTokens: null, cost: null }, messages, compactions: 0, warnings: [] }; }
it('distinguishes verification commands from passing results and detects later edits', () => {
  const report = analyze(session([assistant('a', [check]), assistant('b', [edit])]));
  expect(report.findings.map(f => f.rule)).toEqual(['late-edits', 'verification-observed']);
  expect(report.findings[1].evidence).toContain('does not prove');
  expect(report.metrics.inputTokens).toBeNull();
});
it('does not count failed edits as successful edits', () => { expect(analyze(session([assistant('a', [{ ...edit, status: 'error' }])])).metrics.edits).toBe(0); });
it('recognizes common test runners and ignores unrelated commands', () => {
  for (const command of ['npm run typecheck', 'npx vitest run', 'pytest -q', 'go test ./...', 'cargo test', 'pnpm test']) expect(isVerification(command)).toBe(true);
  for (const command of ['echo hello', 'cat test.log', 'git status']) expect(isVerification(command)).toBe(false);
});
it('finds identical retry loops and context pressure with message evidence', () => {
  const s = session([1, 2, 3].map(n => assistant(`a${n}`, [{ id: String(n), name: 'bash', status: 'error', command: 'bad-command' }]))); s.compactions = 3;
  expect(analyze(s).findings.map(f => f.rule)).toEqual(['tool-errors', 'retry-loop', 'context-pressure']);
});
