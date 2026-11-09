import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text, useI18n } from './i18n';
import type { Overview } from '../shared/overview';
import type { CoachPage } from './navigation';
import { Action, Panel, Stat, type Surface } from './ui';
export type OverviewProps = Surface & { data: Overview; onOpenSession: (id: string) => void; onNavigate?: (page: CoachPage) => void };

export function AnalysisStatus({ data, theme }: OverviewProps) {
  const { locale } = useI18n();
  const c = theme.colors, busy = data.status === 'discovering' || data.status === 'analyzing';
  return <View style={{ gap: 6, padding: 12, borderWidth: 1, borderColor: c.border, borderRadius: 6, backgroundColor: c.surface1 }}>
    <Text style={{ color: c.foreground, fontSize: 12 }}>{data.status === 'discovering' ? 'Discovering sessions…' : [data.analyzed.toLocaleString(locale), ' / ', data.matched.toLocaleString(locale), ' sessions analyzed', busy ? ' · updating automatically' : ' · analysis complete']} · Local rules only · No model requests</Text>
    {busy && <><View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: Math.max(1, data.matched), now: data.analyzed + data.failed }} style={{ height: 3, backgroundColor: c.surface2 }}><View style={{ height: 3, width: `${(data.analyzed + data.failed) / Math.max(1, data.matched) * 100}%`, backgroundColor: c.accent }} /></View><Text style={{ color: c.foregroundMuted, fontSize: 11 }}>Totals and patterns are provisional until analysis finishes.</Text></>}
    {data.error && <Text style={{ color: c.statusDanger }}>{data.error} Use Refresh to retry.</Text>}
    {(data.failed > 0 || data.incomplete > 0) && <Text style={{ color: c.statusWarning, fontSize: 12 }}>{data.failed} unreadable sessions · {data.incomplete} incomplete reports. Findings cover available evidence.</Text>}
    {data.status === 'complete' && !data.matched && <Text style={{ color: c.foregroundMuted }}>No sessions match these filters. Widen the period or clear the workspace filter.</Text>}
  </View>;
}
export function ActivityChart(props: OverviewProps) {
  const { data, theme } = props, c = theme.colors, peak = Math.max(1, ...data.activity.map(d => d.sessions));
  return <Panel {...props} title="Daily Activity">
    <View style={{ height: 132, flexDirection: 'row', alignItems: 'flex-end', gap: 5 }}>{data.activity.map(d => <View key={d.day} accessibilityLabel={`${d.day}: ${d.sessions} sessions`} style={{ flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', gap: 5 }}>
      <Text style={{ color: c.foregroundMuted, fontSize: 10 }}>{d.sessions}</Text>
      <View style={{ width: '75%', height: Math.max(d.sessions ? 3 : 0, d.sessions / peak * 85), backgroundColor: c.accent, borderRadius: 3 }} />
      <Text style={{ color: c.foregroundMuted, fontSize: 9 }}>{d.day.slice(8)}</Text>
    </View>)}</View>
    <Text style={{ color: c.foregroundMuted, fontSize: 11 }}>Session starts · last {data.activity.length} calendar days in the selected range · UTC</Text>
  </Panel>;
}
export function OverviewPanel(props: OverviewProps) {
  const { data, theme, layout, onNavigate } = props, c = theme.colors, m = data.metrics;
  const groups = [
    { name: 'Prompt Quality', rules: ['short-prompts', 'acceptance-criteria'], hint: 'Clear task briefs and expected outcomes' },
    { name: 'Session Hygiene', rules: ['session-hygiene', 'context-pressure'], hint: 'Focused sessions and context continuity' },
    { name: 'Verification', rules: ['verification-gap', 'late-edits'], hint: 'Checks after the final edit' },
    { name: 'Tool Mastery', rules: ['tool-errors', 'retry-loop'], hint: 'Failures and repeated operations' },
  ];
  return <View style={{ gap: 18 }}>
    <View style={{ paddingVertical: 8, gap: 6 }}><Text accessibilityRole="header" style={{ color: c.foreground, fontSize: 21, fontWeight: '600' }}>Your coaching overview</Text><Text style={{ color: c.foregroundMuted }}>All matching sessions · {data.mainSessions} main · {data.delegatedSessions} delegated</Text></View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      <Stat {...props} label={data.origin === 'ai' ? 'AI prompts' : 'Human prompts'} value={data.origin === 'ai' ? m.aiPrompts : m.humanPrompts} hint={data.origin === 'ai' ? 'Delegated prompts only' : 'Delegated prompts excluded'} /><Stat {...props} label="Sessions" value={data.matched} hint={`${data.analyzed} analyzed`} />
      <Stat {...props} label="Edit operations" value={m.edits} hint="Successful logged edit calls" /><Stat {...props} label="Workspaces" value={data.breakdown.workspaces.length} hint="Distinct session directories" />
    </View>
    <View style={{ gap: 10 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text accessibilityRole="header" style={{ color: c.foreground, fontSize: 16, fontWeight: '600' }}>Anti-Patterns Summary</Text><Action {...props} label="View All Anti-Patterns" onPress={() => onNavigate?.('anti-patterns')} /></View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{groups.map(group => {
        const issues = data.insights.filter(i => group.rules.includes(i.rule));
        return <Pressable key={group.name} accessibilityRole="button" accessibilityLabel={`Review ${group.name}`} onPress={() => onNavigate?.('anti-patterns')} style={{ flexBasis: layout.compact ? '100%' : 220, minWidth: layout.compact ? 0 : 200, flexGrow: 1, backgroundColor: c.surface1, borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 18, gap: 9 }}>
          <Text style={{ color: c.foreground, fontWeight: '600', fontSize: 15 }}>{group.name}</Text><Text style={{ color: c.foregroundMuted, fontSize: 12 }}>{group.hint}</Text>
          {issues.map(i => <Text key={i.rule} style={{ color: c.statusWarning, fontSize: 12 }}>{i.title} · {i.affectedSessions} sessions ({i.percentage}%)</Text>)}
          {!issues.length && <Text style={{ color: c.foregroundMuted, fontSize: 12 }}>{data.status === 'complete' ? 'No warning rules triggered' : 'Analysis in progress'}</Text>}
        </Pressable>;
      })}</View>
    </View>
    <Panel {...props} title="Start here" action="Review recommendations" onAction={() => onNavigate?.('anti-patterns')}>
      {data.insights.slice(0, 3).map((i, n) => <View key={i.rule} style={{ gap: 5 }}><Text style={{ color: c.foreground, fontWeight: '600' }}>{n + 1}. {i.title}</Text><Text style={{ color: c.foregroundMuted, fontSize: 12 }}>{i.advice}</Text></View>)}
      {!data.insights.length && <Text style={{ color: c.foregroundMuted }}>Recommendations appear as sessions are analyzed. A lack of findings does not establish code quality.</Text>}
    </Panel>
    <ActivityChart {...props} />
    <Panel {...props} title="Top Workspaces by Sessions" action="Explore Patterns" onAction={() => onNavigate?.('patterns')}>
      {data.breakdown.workspaces.slice(0, 5).map(w => <View key={w.directory} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><Text verbatim numberOfLines={1} style={{ color: c.foreground, flex: 1, fontSize: 12 }}>{`${w.projectName ? w.projectName + ' · ' : ''}${w.workspaceName || w.directory.split(/[/\\]/).filter(Boolean).pop() || 'Unknown'}`}</Text><Text style={{ color: c.foregroundMuted, fontSize: 12 }}>{w.sessions} sessions · {w.humanPrompts} human prompts</Text></View>)}
    </Panel>
    <Text style={{ color: c.foregroundMuted, fontSize: 11 }}>Practice cards show observable rule findings. No synthetic quality score is assigned. Percentages use all analyzed sessions, including delegated work.</Text>
  </View>;
}
export function AntiPatternsPage(props: OverviewProps) {
  const { data, theme, onOpenSession } = props, c = theme.colors;
  return <View style={{ gap: 16 }}>
    <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}><Stat {...props} label="Active warning rules" value={data.insights.length} /><Stat {...props} label="Analyzed sessions" value={data.analyzed} /><Stat {...props} label="Incomplete reports" value={data.incomplete} /></View>
    <Text style={{ color: c.foregroundMuted, fontSize: 12 }}>Ranked by affected sessions. Each rule counts once per session. Trends compare the earlier and later halves of this period, with {data.periods.earlierSessions} and {data.periods.laterSessions} analyzed sessions respectively.</Text>
    {data.insights.map(i => <Panel key={i.rule} {...props} title={i.title}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><Text style={{ color: c.statusWarning, fontWeight: '600' }}>{i.affectedSessions} sessions · {i.percentage}%</Text><Text style={{ color: c.foregroundMuted, fontSize: 12 }}>{i.changePoints === null ? 'Trend: insufficient evidence' : `${i.earlierPercentage}% → ${i.laterPercentage}% (${i.changePoints > 0 ? '+' : ''}${i.changePoints} pp)`}</Text></View>
      <Text style={{ color: c.foreground }}>{i.advice}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{i.examples.map(e => <Pressable key={e.sessionId} accessibilityRole="button" accessibilityLabel={`Open evidence: ${e.title}`} onPress={() => onOpenSession(e.sessionId)} style={{ padding: 9, backgroundColor: c.surface2, borderRadius: 6 }}><Text verbatim style={{ color: c.accent, fontSize: 12 }}>{e.title}{e.projectName ? ` · ${e.projectName}` : ''}{e.workspaceName ? ` · ${e.workspaceName}` : ''} →</Text></Pressable>)}</View>
    </Panel>)}
    {!data.insights.length && <Text style={{ color: c.foregroundMuted }}>No warning patterns in the available evidence yet.</Text>}
  </View>;
}
export function OutputPage(props: OverviewProps) {
  const { data, theme } = props, c = theme.colors, m = data.metrics;
  return <View style={{ gap: 16 }}><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
    <Stat {...props} label="Input tokens" value={m.inputTokens ?? 'Unknown'} /><Stat {...props} label="Output tokens" value={m.outputTokens ?? 'Unknown'} /><Stat {...props} label="Cache read tokens" value={m.cacheRead ?? 'Unknown'} /><Stat {...props} label="Recorded cost" value={m.cost === null ? 'Unknown' : `$${m.cost.toFixed(2)}`} />
  </View><Panel {...props} title="Model Usage">
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: c.foregroundMuted }}>MODEL</Text><Text style={{ color: c.foregroundMuted }}>SESSIONS</Text></View>
    {data.breakdown.models.map(model => <View key={model.name} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderColor: c.border }}><Text verbatim style={{ color: c.foreground }}>{model.name}</Text><Text style={{ color: c.foreground }}>{model.sessions}</Text></View>)}
    {!data.breakdown.models.length && <Text style={{ color: c.foregroundMuted }}>No model identifiers recorded in analyzed sessions.</Text>}
  </Panel><Panel {...props} title="Edit Activity"><Text style={{ color: c.foreground }}>{m.edits} successful edit operations across {m.editingSessions} sessions.</Text><Text style={{ color: c.foregroundMuted, fontSize: 12 }}>These logs do not provide reliable generated-code line totals. Edit calls are not lines of code.</Text></Panel>
  <Text style={{ color: c.foregroundMuted, fontSize: 12 }}>Usage recorded in {m.usageSessions}/{data.analyzed} sessions; cost recorded in {m.costSessions}/{data.analyzed}. These are historical session costs, not Coach charges. A session using multiple models appears in multiple model rows.</Text></View>;
}
export function PatternsPage(props: OverviewProps) {
  const { data, theme, layout } = props, c = theme.colors;
  const [tab, setTab] = useState<'Work Hours' | 'Calendar' | 'Projects'>('Work Hours');
  const peak = Math.max(1, ...data.breakdown.hours);
  return <View style={{ gap: 16 }}><View style={{ flexDirection: 'row', gap: 8 }}>{(['Work Hours', 'Calendar', 'Projects'] as const).map(t => <Action key={t} {...props} label={t} selected={tab === t} onPress={() => setTab(t)} />)}</View>
    {tab === 'Work Hours' && <Panel {...props} title="Sessions by Day and Hour"><Text style={{ color: c.foregroundMuted, fontSize: 12 }}>Session start times in UTC. Higher intensity means more sessions; this is not a work-life score.</Text><View style={{ flexDirection: 'row', marginLeft: 35 }}>{[0, 6, 12, 18].map(h => <Text key={h} style={{ color: c.foregroundMuted, fontSize: 10, flex: 1 }}>{h}:00</Text>)}</View>
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, day) => <View key={label} style={{ flexDirection: 'row', gap: layout.compact ? 2 : 4, alignItems: 'center' }}><Text style={{ color: c.foregroundMuted, fontSize: 11, width: 30 }}>{label}</Text>{Array.from({ length: 24 }, (_, h) => <View key={h} accessibilityLabel={`${label} ${h}:00 UTC: ${data.breakdown.hours[day * 24 + h]} sessions`} style={{ flex: 1, height: layout.compact ? 13 : 20, borderRadius: 2, backgroundColor: c.accent, opacity: data.breakdown.hours[day * 24 + h] ? 0.2 + data.breakdown.hours[day * 24 + h] / peak * 0.8 : 0.06 }} />)}</View>)}
    </Panel>}
    {tab === 'Calendar' && <><ActivityChart {...props} /><Panel {...props} title="Calendar Activity"><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{data.breakdown.calendar.map(d => <View key={d.day} style={{ padding: 10, borderRadius: 6, backgroundColor: c.surface2 }}><Text style={{ color: c.foregroundMuted, fontSize: 11 }}>{d.day}</Text><Text style={{ color: c.foreground, fontWeight: '600' }}>{d.sessions} sessions</Text></View>)}</View></Panel></>}
    {tab === 'Projects' && <Panel {...props} title="Projects"><Text style={{ color: c.foregroundMuted, fontSize: 12 }}>All matched directories; prompt and tool totals cover analyzed sessions.</Text>{data.breakdown.workspaces.map(w => <View key={w.directory} style={{ paddingVertical: 10, borderTopWidth: 1, borderColor: c.border, gap: 5 }}><Text verbatim selectable style={{ color: c.foreground, fontSize: 12 }}>{w.projectName ? w.projectName + ' · ' : ''}{w.workspaceName || w.directory || 'Unknown directory'}</Text><Text style={{ color: c.foregroundMuted, fontSize: 12 }}>{w.sessions} sessions · {w.humanPrompts} human prompts · {w.toolCalls} tool calls</Text></View>)}</Panel>}
  </View>;
}
export function ContextPage(props: OverviewProps) {
  const { data, theme } = props, c = theme.colors;
  const issues = data.insights.filter(i => ['context-pressure', 'session-hygiene'].includes(i.rule));
  return <View style={{ gap: 16 }}><View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}><Stat {...props} label="Compactions" value={data.breakdown.compactions} /><Stat {...props} label="Compacted sessions" value={data.breakdown.compactedSessions} /><Stat {...props} label="Long sessions" value={data.breakdown.longSessions} hint="More than 30 selected prompts" /></View>
    <Panel {...props} title="Session Context Signals"><Text style={{ color: c.foregroundMuted }}>This view evaluates session history. Repository instruction-file audits and AI readiness scores are not included.</Text>{issues.map(i => <View key={i.rule} style={{ gap: 6 }}><Text style={{ color: c.foreground, fontWeight: '600' }}>{i.title} · {i.affectedSessions} sessions</Text><Text style={{ color: c.foregroundMuted }}>{i.advice}</Text></View>)}{!issues.length && <Text style={{ color: c.foregroundMuted }}>No session-hygiene warning rules triggered in analyzed evidence.</Text>}</Panel>
    <Panel {...props} title="Keep Context Useful"><Text style={{ color: c.foreground }}>Checkpoint the current goal, decisions, open questions, and verification status before compaction or a new session.</Text><Text style={{ color: c.foregroundMuted }}>Compaction counts alone do not prove context loss or poor results.</Text></Panel>
  </View>;
}
