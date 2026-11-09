import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRpc, useSettings, type PluginScreenProps } from '@getpaseo/plugin/client';
import { analyzeRpc, catalogRpc, historyRpc, preferences } from '../shared/contracts';

export function Dashboard({ theme, layout }: PluginScreenProps) {
  const settings = useSettings(preferences);
  const catalogCall = useRpc(catalogRpc), historyCall = useRpc(historyRpc), analyzeCall = useRpc(analyzeRpc);
  const catalog = useQuery({ queryKey: ['coach', 'catalog', settings.status === 'ready' ? settings.revision : 'loading'], queryFn: () => catalogCall({}), enabled: settings.status === 'ready' });
  const [sourceId, setSourceId] = useState(''), [sessionId, setSessionId] = useState('');
  const [days, setDays] = useState(30), [offset, setOffset] = useState(0), [directory, setDirectory] = useState('');
  const [since, setSince] = useState(() => Date.now() - 30 * 86400000);
  const selected = settings.status === 'ready' ? settings.values.selected : '';
  const providers = catalog.data?.adapters.filter(a => a.enabled && !a.hidden) ?? [];
  const adapter = providers.find(a => a.id === selected);
  const source = adapter?.sources.find(s => s.id === sourceId) ?? adapter?.sources[0];
  useEffect(() => { setSourceId(''); setSessionId(''); setOffset(0); }, [selected]);
  useEffect(() => { setSessionId(''); setOffset(0); }, [source?.id, days, directory]);
  const history = useQuery({ queryKey: ['coach', 'history', selected, source?.id, since, directory, offset],
    queryFn: () => historyCall({ adapterId: selected, sourceId: source!.id, from: days ? since : undefined, directory: directory.trim() || undefined, limit: 50, offset }), enabled: !!source });
  const report = useQuery({ queryKey: ['coach', 'report', selected, source?.id, sessionId],
    queryFn: () => analyzeCall({ adapterId: selected, sourceId: source!.id, sessionId }), enabled: !!source && !!sessionId });
  const c = theme.colors;
  const text = { color: c.foreground }, muted = { color: c.foregroundMuted };
  const card = { backgroundColor: c.surface1, borderColor: c.border, borderWidth: 1, borderRadius: 12, padding: 16, gap: 10 };
  const button = (label: string, onPress: () => void, active = false, disabled = false) => (
    <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected: active, disabled }} disabled={disabled} onPress={onPress}
      style={{ padding: 10, borderRadius: 8, backgroundColor: active ? c.accent : c.surface2, opacity: disabled ? 0.5 : 1 }}>
      <Text style={{ color: active ? c.accentForeground : c.foreground }}>{label}</Text>
    </Pressable>);
  const sessions = history.data?.sessions ?? [];
  const cost = sessions.reduce((sum, s) => sum + (s.cost ?? 0), 0);
  const activity = new Map<string, number>();
  for (const s of sessions) { const day = new Date(s.created).toLocaleDateString(); activity.set(day, (activity.get(day) ?? 0) + 1); }
  return <ScrollView contentContainerStyle={{ padding: layout.compact ? 16 : 28, gap: 18, backgroundColor: c.surface0 }}>
    <Text style={{ ...text, fontSize: layout.compact ? 24 : 32, fontWeight: '700' }}>OpenCode Coach</Text>
    <Text style={muted}>Historical sessions, observable practices, and concrete next steps. Analysis stays on your Paseo host.</Text>
    {settings.status !== 'ready' && <Text style={text}>{settings.status === 'loading' ? 'Loading provider settings…' : 'Settings unavailable. Open Coach settings to recover.'}</Text>}
    {catalog.isPending && settings.status === 'ready' && <Text style={text}>Discovering providers…</Text>}
    {catalog.error && <Text style={{ color: c.statusDanger }}>{catalog.error.message}</Text>}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {providers.map(a => button(a.title, () => { if (settings.status === 'ready') void settings.save({ ...settings.values, selected: a.id }, settings.revision); }, a.id === selected, settings.saving))}
      {button('Refresh', () => { void catalog.refetch(); void history.refetch(); if (sessionId) void report.refetch(); })}
    </View>
    {settings.saveError && <Text style={{ color: c.statusDanger }}>{String(settings.saveError)}</Text>}
    {!adapter && catalog.data && <Text style={text}>Choose an enabled provider above. Manage activation and visibility in Settings → Plugins → OpenCode Coach.</Text>}
    {adapter?.error && <Text style={{ color: c.statusDanger }}>{adapter.error}</Text>}
    {adapter && !adapter.error && !adapter.sources.length && <Text style={text}>No database found. Run OpenCode once or configure its database path in Coach settings, then refresh.</Text>}
    {adapter?.sources.map(s => button(`${s.label} · ${s.format}`, () => setSourceId(s.id), s.id === source?.id))}
    {source && <>
      <Text style={muted}>Source: {source.path}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[7, 30, 90, 0].map(n => button(n ? `${n} days` : 'All history', () => { setDays(n); setSince(n ? Date.now() - n * 86400000 : 0); }, n === days))}</View>
      <TextInput accessibilityLabel="Filter by exact workspace directory" placeholder="Exact workspace directory (optional)" placeholderTextColor={c.foregroundMuted}
        value={directory} onChangeText={setDirectory} style={{ ...text, padding: 12, backgroundColor: c.surface2, borderRadius: 8 }} />
      {history.isPending && <Text style={text}>Loading history…</Text>}
      {history.error && <Text style={{ color: c.statusDanger }}>{history.error.message}</Text>}
      <View style={card}>
        <Text style={{ ...text, fontWeight: '700' }}>{sessions.length} sessions on this page · {sessions.some(s => s.cost !== null) ? `$${cost.toFixed(2)} recorded cost` : 'Cost not recorded'}</Text>
        <Text style={muted}>Page totals only. Session dates use your device timezone. Recorded cost may include free or provider-specific pricing.</Text>
        {[...activity].slice(0, 10).map(([day, count]) => <Text key={day} style={text}>{day} · {count} session{count === 1 ? '' : 's'}</Text>)}
      </View>
      {history.data && !sessions.length && <Text style={text}>No sessions match this date range and directory.</Text>}
      <View style={{ flexDirection: layout.compact ? 'column' : 'row', gap: 16 }}>
        <View style={{ flex: 1, gap: 8 }}>
          {sessions.map(s => <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={`Analyze ${s.title}`} onPress={() => setSessionId(s.id)} style={{ ...card, borderColor: s.id === sessionId ? c.accent : c.border }}>
            <Text style={{ ...text, fontWeight: '600' }}>{s.title}</Text>
            <Text style={muted}>{new Date(s.created).toLocaleString()} · {s.parentId ? 'Delegated' : 'Main session'}</Text>
            <Text style={muted} numberOfLines={1}>{s.directory}</Text>
          </Pressable>)}
          <View style={{ flexDirection: 'row', gap: 8 }}>{button('Previous', () => setOffset(Math.max(0, offset - 50)), false, offset === 0)}{button('Next', () => setOffset(offset + 50), false, !history.data?.hasMore)}</View>
        </View>
        <View style={{ flex: 1, gap: 12 }}>
          {!sessionId && <Text style={muted}>Select a session to inspect coaching evidence.</Text>}
          {sessionId && report.isPending && <Text style={text}>Analyzing session…</Text>}
          {report.error && <Text style={{ color: c.statusDanger }}>{report.error.message}</Text>}
          {report.data && <View style={card}>
            <Text style={{ ...text, fontSize: 20, fontWeight: '700' }}>{report.data.session.title}</Text>
            <Text style={text}>{report.data.metrics.humanPrompts} human prompts · {report.data.metrics.assistantCalls} model calls · {report.data.metrics.toolCalls} tool calls</Text>
            <Text style={text}>{report.data.metrics.edits} edits · {report.data.metrics.toolErrors} tool errors · {report.data.metrics.verificationCommands} verification commands</Text>
            <Text style={muted}>Input {report.data.metrics.inputTokens?.toLocaleString() ?? 'unknown'} · Output {report.data.metrics.outputTokens?.toLocaleString() ?? 'unknown'} · Cache read {report.data.metrics.cacheRead?.toLocaleString() ?? 'unknown'}</Text>
            <Text style={muted}>Models: {report.data.metrics.models.join(', ') || 'not recorded'} · {Math.round(report.data.metrics.durationMinutes)} min elapsed span</Text>
            {report.data.warnings.map(w => <Text key={w} style={{ color: c.statusWarning }}>{w}</Text>)}
            {report.data.findings.map(f => <View key={f.rule} style={{ gap: 6, paddingVertical: 10, borderTopWidth: 1, borderColor: c.border }}>
              <Text style={{ ...text, fontWeight: '700' }}>{f.title}</Text><Text style={muted}>{f.evidence}</Text><Text style={text}>{f.advice}</Text>
              {f.messageIds.length > 0 && <Text selectable style={muted}>Evidence IDs: {f.messageIds.join(', ')}</Text>}
            </View>)}
            {!report.data.findings.length && <Text style={text}>No rules triggered. This does not establish code quality or successful delivery.</Text>}
          </View>}
        </View>
      </View>
    </>}
  </ScrollView>;
}
