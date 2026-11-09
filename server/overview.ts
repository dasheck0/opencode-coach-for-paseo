import type { Report, SessionSummary } from '../shared/model';
import type { Overview, OverviewInput } from '../shared/overview';

type Insight = Overview['insights'][number];
const nullableAdd = (a: number | null, b: number | null) => b === null ? a : (a ?? 0) + b;
const percent = (n: number, total: number) => total ? Math.round(n / total * 1000) / 10 : 0;
const day = (timestamp: number) => new Date(timestamp).toISOString().slice(0, 10);
export class OverviewAccumulator {
  private readonly insights = new Map<string, Insight & { earlier: number; later: number }>();
  private readonly days = new Map<string, Overview['activity'][number]>();
  readonly result: Overview;
  constructor(input: OverviewInput, private readonly now: () => number = Date.now) {
    this.result = { status: 'discovering', generatedAt: now(), from: input.from ?? null, to: input.to, error: null,
      matched: 0, analyzed: 0, failed: 0, incomplete: 0, mainSessions: 0, delegatedSessions: 0,
      metrics: { humanPrompts: 0, assistantCalls: 0, toolCalls: 0, toolErrors: 0, edits: 0,
        editingSessions: 0, verifiedEditingSessions: 0, inputTokens: null, outputTokens: null, cacheRead: null,
        cost: null, usageSessions: 0, costSessions: 0 },
      periods: { midpoint: null, earlierSessions: 0, laterSessions: 0 }, insights: [], activity: [] };
  }
  discover(sessions: SessionSummary[]) {
    for (const session of sessions) {
      this.result.matched++;
      if (session.parentId) this.result.delegatedSessions++; else this.result.mainSessions++;
      const key = day(session.created);
      const bucket = this.days.get(key) ?? { day: key, sessions: 0, analyzed: 0, warningSessions: 0 };
      bucket.sessions++; this.days.set(key, bucket);
    }
  }
  start(sessions: SessionSummary[]) {
    const earliest = sessions.reduce((min, s) => Math.min(min, s.created), this.result.to);
    const from = this.result.from ?? (sessions.length ? earliest : null);
    this.result.periods.midpoint = from === null ? null : from + (this.result.to - from) / 2;
    this.result.status = 'analyzing';
  }
  add(report: Report) {
    const r = this.result, m = r.metrics, source = report.metrics;
    const earlier = report.session.created < (r.periods.midpoint ?? 0);
    r.analyzed++;
    if (report.warnings.length) r.incomplete++;
    if (earlier) r.periods.earlierSessions++; else r.periods.laterSessions++;
    for (const key of ['humanPrompts', 'assistantCalls', 'toolCalls', 'toolErrors', 'edits'] as const) m[key] += source[key];
    for (const key of ['inputTokens', 'outputTokens', 'cacheRead', 'cost'] as const) m[key] = nullableAdd(m[key], source[key]);
    if (source.inputTokens !== null || source.outputTokens !== null) m.usageSessions++;
    if (source.cost !== null) m.costSessions++;
    if (source.edits > 0) { m.editingSessions++; if (source.verificationCommands > 0) m.verifiedEditingSessions++; }
    // A rule counts at most once per session. Informational findings are not problems.
    const warnings = [...new Map(report.findings.filter(f => f.severity === 'warning').map(f => [f.rule, f])).values()];
    const bucket = this.days.get(day(report.session.created));
    if (bucket) { bucket.analyzed++; if (warnings.length) bucket.warningSessions++; }
    for (const finding of warnings) {
      const insight = this.insights.get(finding.rule) ?? { rule: finding.rule, title: finding.title, advice: finding.advice,
        affectedSessions: 0, percentage: 0, earlierPercentage: null, laterPercentage: null, changePoints: null,
        examples: [], earlier: 0, later: 0 };
      insight.affectedSessions++;
      if (earlier) insight.earlier++; else insight.later++;
      if (insight.examples.length < 3) insight.examples.push({ sessionId: report.session.id, title: report.session.title.slice(0, 200) });
      this.insights.set(finding.rule, insight);
    }
  }
  snapshot(): Overview {
    const r = this.result;
    const insights = [...this.insights.values()].map(({ earlier, later, ...i }) => {
      const earlierPercentage = r.periods.earlierSessions ? percent(earlier, r.periods.earlierSessions) : null;
      const laterPercentage = r.periods.laterSessions ? percent(later, r.periods.laterSessions) : null;
      return { ...i, examples: i.examples.map(e => ({ ...e })), percentage: percent(i.affectedSessions, r.analyzed), earlierPercentage, laterPercentage,
        changePoints: earlierPercentage !== null && laterPercentage !== null ? Math.round((laterPercentage - earlierPercentage) * 10) / 10 : null };
    }).sort((a, b) => b.affectedSessions - a.affectedSessions || a.rule.localeCompare(b.rule));
    // A fixed 14-calendar-day chart ending at the chosen cutoff, including inactive days.
    const end = Math.floor(r.to / 86400000) * 86400000;
    const activity = Array.from({ length: 14 }, (_, i) => {
      const key = day(end - (13 - i) * 86400000);
      return { ...(this.days.get(key) ?? { day: key, sessions: 0, analyzed: 0, warningSessions: 0 }) };
    }).filter(d => r.from === null || Date.parse(d.day) + 86400000 > r.from);
    return { ...r, generatedAt: this.now(), metrics: { ...r.metrics }, periods: { ...r.periods }, insights, activity };
  }
}
