import type { Finding, Message, Report, Session } from '../shared/model';

const EDIT = /^(write|edit|create|patch|apply_patch|multiedit)$/i;
// Evidence means a command was issued. It does not establish that a test passed.
export function isVerification(command = '') {
  return /(?:^|[\s;&|])(?:npm\s+(?:run\s+)?(?:test|typecheck|lint|build|check)|pnpm\s+(?:run\s+)?(?:test|typecheck|lint|build|check)|yarn\s+(?:test|typecheck|lint|build|check)|(?:npx\s+)?(?:vitest|jest|tsc|eslint|pytest)|python(?:3)?\s+-m\s+(?:pytest|unittest)|go\s+test|cargo\s+test|dotnet\s+test|mvn\s+test)(?:\s|$)/i.test(command);
}
const total = (messages: Message[], key: 'inputTokens' | 'outputTokens' | 'cacheRead' | 'cacheWrite' | 'cost') => {
  const values = messages.map(m => m[key]).filter((n): n is number => n !== null);
  return values.length ? values.reduce((a, b) => a + b, 0) : null;
};
export function analyze(session: Session): Report {
  const { messages } = session;
  const human = messages.filter(m => m.role === 'user' && !m.synthetic && !session.summary.parentId);
  const assistant = messages.filter(m => m.role === 'assistant');
  const tools = assistant.flatMap(m => m.tools.map(tool => ({ ...tool, messageId: m.id })));
  const edits = tools.filter(t => EDIT.test(t.name) && t.status === 'completed');
  const errors = tools.filter(t => t.status === 'error');
  const checks = tools.filter(t => /bash|shell|exec|terminal/i.test(t.name) && isVerification(t.command));
  const findings: Finding[] = [];
  const add = (rule: string, title: string, evidence: string, advice: string, ids: string[], severity: 'info' | 'warning' = 'warning') =>
    findings.push({ rule, title, severity, evidence, advice, messageIds: [...new Set(ids)].slice(0, 20) });
  const vague = human.filter(m => m.text.trim().length > 0 && m.text.trim().length < 25);
  if (vague.length) add('short-prompts', 'Make brief prompts actionable', `${vague.length} human prompt(s) contain fewer than 25 characters. Short follow-ups can be appropriate.`,
    'For a new task, include the goal, relevant files, constraints, and a way to verify the result.', vague.map(m => m.id));
  const specific = human.filter(m => /\b(test|verify|acceptance|expected|must|constraint|prüf|erwart|akzeptanz)|\.[a-z]{1,5}\b|[/\\][\w.-]+/i.test(m.text));
  if (human.length >= 3 && specific.length / human.length < 0.34) add('acceptance-criteria', 'State the expected result',
    `${specific.length} of ${human.length} human prompts contain recognizable file, constraint, or verification cues. This is a language heuristic.`,
    'Include a concrete before/after example and acceptance criteria in the next task brief.', human.map(m => m.id));
  if (edits.length && !checks.length) add('verification-gap', 'Verify after editing',
    `${edits.length} successful edit call(s), with no recognized verification command in the available log.`,
    'Ask for relevant tests and a reported result. Logs may omit verification performed elsewhere.', edits.map(t => t.messageId));
  if (edits.length && checks.length) {
    const lastEdit = messages.findLastIndex(m => edits.some(t => t.messageId === m.id));
    const lastCheck = messages.findLastIndex(m => checks.some(t => t.messageId === m.id));
    if (lastEdit > lastCheck) add('late-edits', 'Check the final changes', 'The last recognized verification command precedes the final edit message.',
      'Run the relevant checks again after the final change. Ordering within one message is not evaluated.', [messages[lastEdit].id]);
  }
  if (errors.length >= 3) add('tool-errors', 'Investigate recurring tool failures', `${errors.length} of ${tools.length} tool calls ended in error.`,
    'Inspect the first failure and adjust the command, permissions, or assumptions before retrying.', errors.map(t => t.messageId));
  const repeated = new Map<string, typeof tools>();
  for (const tool of errors) {
    const key = `${tool.name}:${tool.command || tool.file || tool.id}`;
    repeated.set(key, [...(repeated.get(key) ?? []), tool]);
  }
  const loops = [...repeated.values()].filter(group => group.length >= 3).flat();
  if (loops.length) add('retry-loop', 'Change strategy before retrying', 'An identical tool command or file operation failed at least three times.',
    'Pause the loop, inspect the error, and try a different approach.', loops.map(t => t.messageId));
  if (human.length > 30) add('session-hygiene', 'Consider a focused follow-up session', `${human.length} human prompts in one session.`,
    'When the goal changes, summarize decisions, open questions, and test status before starting a focused session.', human.slice(-3).map(m => m.id));
  if (session.compactions >= 3) add('context-pressure', 'Preserve decisions across compaction', `${session.compactions} compaction events recorded.`,
    'Keep a concise project instruction file and checkpoint the current plan and verification results.', []);
  if (checks.length) add('verification-observed', 'Verification commands observed', `${checks.length} recognized verification command(s) were issued. A completed tool status alone does not prove tests passed.`,
    'Review the actual output and report failures or incomplete checks explicitly.', checks.map(t => t.messageId), 'info');
  if (session.summary.parentId) add('delegated-session', 'Delegated session', 'This session has a parent session; its user messages are excluded from human prompt metrics.',
    'Review the parent session to assess the human task brief.', [], 'info');
  if (!human.length && !assistant.length) add('no-evidence', 'No analyzable conversation', 'The available records contain no human prompts or assistant calls.',
    'Check the source database or choose another session.', [], 'info');
  return { session: session.summary, findings, warnings: session.warnings,
    metrics: { humanPrompts: human.length, assistantCalls: assistant.length, toolCalls: tools.length,
      toolErrors: errors.length, edits: edits.length, verificationCommands: checks.length, compactions: session.compactions,
      inputTokens: total(assistant, 'inputTokens'), outputTokens: total(assistant, 'outputTokens'),
      cacheRead: total(assistant, 'cacheRead'), cacheWrite: total(assistant, 'cacheWrite'), cost: total(assistant, 'cost'),
      models: [...new Set(assistant.flatMap(m => m.model ? [m.model] : []))],
      durationMinutes: Math.max(0, session.summary.updated - session.summary.created) / 60000,
      promptSpecificity: human.length ? Math.round(specific.length / human.length * 100) : null,
    } };
}
