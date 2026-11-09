import { Pressable, Text, View } from 'react-native';
import type { PluginSurfaceProps } from '@getpaseo/plugin/client';
import type { Overview } from '../shared/overview';

export function OverviewPanel({ data, theme, layout, onOpenSession }: Pick<PluginSurfaceProps, 'theme' | 'layout'> & {
  data: Overview; onOpenSession: (id: string) => void;
}) {
  const c = theme.colors, text = { color: c.foreground }, muted = { color: c.foregroundMuted };
  const card = { backgroundColor: c.surface1, borderColor: c.border, borderWidth: 1, borderRadius: 12, padding: 18, gap: 10 };
  const busy = data.status === 'discovering' || data.status === 'analyzing';
  const metrics = data.metrics;
  const verification = metrics.editingSessions ? Math.round(metrics.verifiedEditingSessions / metrics.editingSessions * 100) : null;
  const peak = Math.max(1, ...data.activity.map(d => d.sessions));
  return <View style={{ gap: 16 }}>
    <View style={card}>
      <Text accessibilityRole="header" style={{ ...text, fontSize: 24, fontWeight: '700' }}>Your coaching overview</Text>
      <Text style={text}>{data.status === 'discovering' ? `Finding matching sessions… ${data.matched} found so far.`
        : `${data.analyzed.toLocaleString()} of ${data.matched.toLocaleString()} sessions analyzed${busy ? ' · analysis continues automatically' : ''}`}</Text>
      <Text style={muted}>Entire selected source and date range, across every history page. {data.mainSessions} main · {data.delegatedSessions} delegated sessions.</Text>
      {busy && <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: Math.max(1, data.matched), now: data.analyzed + data.failed }} style={{ height: 6, backgroundColor: c.surface2, borderRadius: 3 }}>
        <View style={{ height: 6, width: `${Math.min(100, (data.analyzed + data.failed) / Math.max(1, data.matched) * 100)}%`, backgroundColor: c.accent, borderRadius: 3 }} />
      </View>}
      {busy && <Text style={{ color: c.statusWarning }}>Findings and totals are provisional until analysis finishes. You can leave this screen and return.</Text>}
      {data.error && <Text style={{ color: c.statusDanger }}>{data.error} Use Refresh to retry.</Text>}
      {(data.failed > 0 || data.incomplete > 0) && <Text style={{ color: c.statusWarning }}>{data.failed} sessions could not be read · {data.incomplete} reports contain incomplete records. Findings cover readable evidence only.</Text>}
      {data.status === 'complete' && data.matched === 0 && <Text style={text}>No sessions match these filters. Widen the date range or clear the workspace filter.</Text>}
      <View style={{ flexDirection: layout.compact ? 'column' : 'row', flexWrap: 'wrap', gap: 18 }}>
        <Text style={text}>{metrics.humanPrompts.toLocaleString()} human prompts</Text>
        <Text style={text}>{metrics.toolCalls.toLocaleString()} tool calls · {metrics.toolErrors.toLocaleString()} errors</Text>
        <Text style={text}>{verification === null ? 'No editing sessions analyzed yet' : `${verification}% of editing sessions contain a verification command`}</Text>
      </View>
      <Text style={muted}>Input {metrics.inputTokens?.toLocaleString() ?? 'unknown'} · Output {metrics.outputTokens?.toLocaleString() ?? 'unknown'} · Cache read {metrics.cacheRead?.toLocaleString() ?? 'unknown'} tokens ({metrics.usageSessions}/{data.analyzed} sessions report usage)</Text>
      <Text style={muted}>Recorded cost {metrics.cost === null ? 'unknown' : `$${metrics.cost.toFixed(2)}`} ({metrics.costSessions}/{data.analyzed} sessions report cost). A verification command does not prove passing tests. Delegated prompts are excluded from human prompt counts.</Text>
    </View>
    <View style={card}>
      <Text accessibilityRole="header" style={{ ...text, fontSize: 20, fontWeight: '700' }}>Start here</Text>
      {data.insights.slice(0, 3).map((insight, index) => <View key={insight.rule} style={{ gap: 6 }}>
        <Text style={{ ...text, fontWeight: '700' }}>{index + 1}. {insight.title} · {insight.affectedSessions} sessions ({insight.percentage}%)</Text>
        <Text style={text}>{insight.advice}</Text>
      </View>)}
      {!data.insights.length && <Text style={text}>{busy ? 'Coaching priorities will appear as sessions are analyzed.' : data.analyzed ? 'No warning rules triggered in the available evidence. This does not establish code quality.' : 'There is not enough readable session evidence for recommendations yet.'}</Text>}
      <Text style={muted}>Priorities are ranked by affected sessions. Percentages use all {data.analyzed} analyzed sessions, including delegated work. These are log-pattern heuristics.</Text>
    </View>
    {data.insights.length > 0 && <View style={card}>
      <Text accessibilityRole="header" style={{ ...text, fontSize: 20, fontWeight: '700' }}>Patterns and change over time</Text>
      <Text style={muted}>Compare the earlier and later halves of the selected period{data.periods.midpoint === null ? '.' : `, split at ${new Date(data.periods.midpoint).toLocaleString()}.`} {data.periods.earlierSessions} earlier · {data.periods.laterSessions} later sessions analyzed. Rate changes describe this mix of sessions; they do not measure personal performance.</Text>
      {data.insights.map(insight => <View key={insight.rule} style={{ gap: 8, paddingVertical: 10, borderTopWidth: 1, borderColor: c.border }}>
        <Text style={{ ...text, fontWeight: '700' }}>{insight.title} · {insight.affectedSessions}/{data.analyzed} sessions ({insight.percentage}%)</Text>
        <Text style={muted}>{insight.changePoints === null ? 'Not enough evidence in both halves for a trend.' : `${insight.earlierPercentage}% → ${insight.laterPercentage}% · ${insight.changePoints > 0 ? '+' : ''}${insight.changePoints} percentage points`}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{insight.examples.map(example =>
          <Pressable key={example.sessionId} accessibilityRole="button" accessibilityLabel={`Open evidence: ${example.title}`} onPress={() => onOpenSession(example.sessionId)} style={{ padding: 10, borderRadius: 8, backgroundColor: c.surface2 }}>
            <Text style={text}>Example: {example.title}</Text>
          </Pressable>)}</View>
      </View>)}
    </View>}
    <View style={card}>
      <Text accessibilityRole="header" style={{ ...text, fontSize: 20, fontWeight: '700' }}>Session activity</Text>
      <Text style={muted}>Last {data.activity.length} calendar days of the selected range (UTC). Activity includes every matched session; warning counts update as analysis progresses.</Text>
      {data.activity.map(d => <View key={d.day} style={{ gap: 5 }}>
        <Text style={text}>{d.day} · {d.sessions} sessions · {d.warningSessions} with coaching warnings ({d.analyzed} analyzed)</Text>
        <View style={{ height: 6, backgroundColor: c.surface2, borderRadius: 3 }}><View style={{ height: 6, width: `${d.sessions / peak * 100}%`, backgroundColor: c.accent, borderRadius: 3 }} /></View>
      </View>)}
    </View>
  </View>;
}
