import { View } from 'react-native';
import { Text } from './i18n';
import type { Report, SessionSummary } from '../shared/model';
import { Action, Panel, type Surface } from './ui';
export function SessionDetail({ report, theme, layout }: Surface & { report: Report }) {
  const c = theme.colors, m = report.metrics;
  return <Panel theme={theme} layout={layout} title={report.session.title} verbatimTitle>
    <Text verbatim style={{ color: c.foregroundMuted, fontSize: 12 }}>{report.session.projectName} · {report.session.workspaceName}</Text>
    <Text style={{ color: c.foreground }}>{m.humanPrompts} human prompts · {m.aiPrompts} AI prompts · {m.assistantCalls} model calls · {m.toolCalls} tool calls</Text>
    <Text style={{ color: c.foregroundMuted, fontSize: 12 }}>{m.edits} edits · {m.toolErrors} tool errors · {m.verificationCommands} verification commands · {Math.round(m.durationMinutes)} min elapsed span</Text>
    <Text style={{ color: c.foregroundMuted, fontSize: 12 }}>Input {m.inputTokens?.toLocaleString() ?? 'unknown'} · Output {m.outputTokens?.toLocaleString() ?? 'unknown'} · Models: {m.models.join(', ') || 'not recorded'}</Text>
    {report.warnings.map(w => <Text key={w} style={{ color: c.statusWarning }}>{w}</Text>)}
    {report.findings.map(f => <View key={f.rule} style={{ gap: 6, paddingTop: 12, borderTopWidth: 1, borderColor: c.border }}><Text style={{ color: c.foreground, fontWeight: '600' }}>{f.title}</Text><Text style={{ color: c.foregroundMuted, fontSize: 12 }}>{f.evidence}</Text><Text style={{ color: c.foreground }}>{f.advice}</Text>{f.messageIds.length > 0 && <Text selectable style={{ color: c.foregroundMuted, fontSize: 11 }}>Evidence IDs: {f.messageIds.join(', ')}</Text>}</View>)}
    {!report.findings.length && <Text style={{ color: c.foregroundMuted }}>No warning rules triggered. This does not establish code quality.</Text>}
  </Panel>;
}
export function TimelinePage(props: Surface & { sessions: SessionSummary[]; sessionId: string; onSelect: (id: string) => void; offset: number; hasMore: boolean; onOffset: (offset: number) => void;
  loading: boolean; error?: string; report?: Report; reportLoading: boolean; reportError?: string }) {
  const { theme, sessions, onSelect } = props, c = theme.colors;
  return <View style={{ gap: 16 }}>
    {props.reportLoading && <Text style={{ color: c.foregroundMuted }}>Analyzing selected session…</Text>}
    {props.reportError && <Text style={{ color: c.statusDanger }}>{props.reportError}</Text>}
    {props.report && <SessionDetail {...props} report={props.report} />}
    <Panel {...props} title="Session Timeline"><Text style={{ color: c.foregroundMuted, fontSize: 12 }}>UTC activity times within the selected period. Idle time is included; bars crossing midnight stop at the day boundary. Showing {props.offset + (sessions.length ? 1 : 0)}–{props.offset + sessions.length} in this history page.</Text>
      {props.loading && <Text style={{ color: c.foregroundMuted }}>Loading history…</Text>}{props.error && <Text style={{ color: c.statusDanger }}>{props.error}</Text>}
      {!props.loading && !sessions.length && <Text style={{ color: c.foregroundMuted }}>No sessions match this range and project.</Text>}
      {sessions.map((s, index) => {
        const date = new Date(s.activityStart ?? s.created), day = date.toISOString().slice(0, 10), previousDay = index ? new Date(sessions[index - 1].activityStart ?? sessions[index - 1].created).toISOString().slice(0, 10) : '';
        const start = (date.getUTCHours() * 60 + date.getUTCMinutes()) / 1440 * 100;
        const width = Math.min(100 - start, Math.max(0.5, ((s.activityEnd ?? s.updated) - (s.activityStart ?? s.created)) / 86400000 * 100));
        return <View key={s.id} style={{ gap: 8 }}>{day !== previousDay && <Text style={{ color: c.foregroundMuted, fontWeight: '600', marginTop: 12 }}>{day} · 00:00 — 12:00 — 24:00 UTC</Text>}
          <Action {...props} label={`Analyze ${s.title}`} selected={s.id === props.sessionId} onPress={() => onSelect(s.id)} />
          <View style={{ height: 7, backgroundColor: c.surface2, borderRadius: 3 }}><View style={{ marginLeft: `${start}%`, width: `${width}%`, height: 7, backgroundColor: c.accent, borderRadius: 3 }} /></View>
          <Text numberOfLines={1} style={{ color: c.foregroundMuted, fontSize: 11 }}>{date.toISOString().slice(11, 16)} UTC · {s.parentId ? 'Delegated' : 'Main'} · {s.projectName ? s.projectName + ' · ' : ''}{s.workspaceName || s.directory}</Text>
        </View>;
      })}
      <View style={{ flexDirection: 'row', gap: 8 }}><Action {...props} label="Previous" disabled={props.offset === 0} onPress={() => props.onOffset(Math.max(0, props.offset - 50))} /><Action {...props} label="Next" disabled={!props.hasMore} onPress={() => props.onOffset(props.offset + 50)} /></View>
    </Panel>
  </View>;
}
