import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { SettingsSelect } from '@getpaseo/plugin/client/ui';
import type { SessionSummary } from '../shared/model';
import { Text, useI18n } from './i18n';
import { Action, type Surface } from './ui';
import { timelineLayout, timelineTicks } from './session-timeline-model';
/** A shared multi-day activity track with an inline inspector, independent of history pagination. */
export function SessionTimeline({ sessions, selectedId, onOpenSession, from, to, theme, layout }: Surface & {
  sessions: SessionSummary[]; selectedId?: string; onOpenSession: (id: string) => void; from?: number; to?: number;
}) {
  const [pinned, setPinned] = useState(''), [preview, setPreview] = useState(''), [width, setWidth] = useState(600);
  const { locale, t } = useI18n(), c = theme.colors;
  const model = timelineLayout(sessions, from, to), ticks = timelineTicks(model.start, model.end, layout.compact ? 3 : 5);
  const selected = model.segments.find(s => s.session.id === pinned) ?? model.segments.find(s => s.session.id === selectedId) ?? model.segments[0];
  const inspected = model.segments.find(s => s.session.id === preview) ?? selected;
  const date = (timestamp: number) => new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(timestamp);
  const time = (timestamp: number) => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }).format(timestamp);
  const stamp = (timestamp: number) => `${new Date(timestamp).getUTCFullYear()} · ${date(timestamp)} ${time(timestamp)}`;
  if (!model.segments.length) return <Text style={{ color: c.foregroundMuted }}>No sessions match this range and project.</Text>;
  const s = inspected!.session;
  return <View style={{ gap: 12 }}>
    <Text verbatim style={{ color: c.foregroundMuted, fontSize: 11 }}>{stamp(model.start)} — {stamp(model.end)} UTC</Text>
    <View accessibilityLabel={t('Session activity track')} onLayout={event => setWidth(Math.max(1, event.nativeEvent.layout.width))} style={{ gap: 5 }}>
      <View style={{ height: model.lanes * 16 + 8, borderRadius: 6, backgroundColor: c.surface2, position: 'relative' }}>
        {ticks.map((tick, i) => <View key={tick} pointerEvents="none" style={{ position: 'absolute', left: `${i / (ticks.length - 1) * 100}%`, top: 0, bottom: 0, borderLeftWidth: 1, borderColor: c.border }} />)}
        {model.segments.map(segment => {
          const active = segment.session.id === s.id, minWidth = Math.min(1, 6 / width), segmentWidth = Math.min(1, Math.max(minWidth, segment.width)), left = Math.min(segment.left, 1 - segmentWidth);
          return <Pressable key={segment.session.id} accessibilityRole="button" accessibilityLabel={`${t('Inspect session')}: ${segment.session.title}`} accessibilityState={{ selected: active }}
            onHoverIn={() => setPreview(segment.session.id)} onHoverOut={() => setPreview('')} onFocus={() => setPreview(segment.session.id)} onBlur={() => setPreview('')}
            onPress={() => { setPreview(''); setPinned(segment.session.id); }}
            style={{ position: 'absolute', left: `${left * 100}%`, width: `${segmentWidth * 100}%`, top: segment.lane * 16, height: 24, justifyContent: 'center', zIndex: active ? 2 : 1 }}>
            <View style={{ height: active ? 10 : 6, borderRadius: 4, backgroundColor: c.accent, opacity: active ? 1 : 0.65, borderWidth: active ? 1 : 0, borderColor: c.foreground }} />
          </Pressable>;
        })}
      </View>
      <View style={{ height: 32, position: 'relative' }}>{ticks.map((tick, i) => <View key={tick} style={{ position: 'absolute', left: `${i / (ticks.length - 1) * 100}%`, marginLeft: i === 0 ? 0 : i === ticks.length - 1 ? -80 : -40, width: 80, alignItems: i === 0 ? 'flex-start' : i === ticks.length - 1 ? 'flex-end' : 'center' }}>
        <Text verbatim style={{ color: c.foregroundMuted, fontSize: 10 }}>{date(tick)}</Text><Text verbatim style={{ color: c.foregroundMuted, fontSize: 10 }}>{time(tick)}</Text>
      </View>)}</View>
    </View>
    <Text style={{ color: c.foregroundMuted, fontSize: 11 }}>Hover or select a segment to inspect it below. Open analysis separately. Spans include idle time; very short sessions have a minimum visible width.</Text>
    {model.crowded && <Text style={{ color: c.foregroundMuted, fontSize: 11 }}>Some sessions overlap. Use the session selector to reach every session.</Text>}
    <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 6, padding: 12, gap: 8 }}>
      <SettingsSelect label={t('Selected session')} value={s.id} options={model.segments.map(({ session }) => ({ value: session.id, label: `${session.title}${session.projectName ? ` · ${session.projectName}` : ''}${session.workspaceName ? ` · ${session.workspaceName}` : ''}` }))} onValueChange={id => { setPreview(''); setPinned(id); }} />
      <Text verbatim style={{ color: c.foreground, fontSize: 13, fontWeight: '600' }}>{s.title}</Text>
      <Text verbatim style={{ color: c.foregroundMuted, fontSize: 11 }}>{stamp(inspected!.start)} — {stamp(inspected!.end)} UTC · {t(s.parentId ? 'Delegated' : 'Main')}</Text>
      <Text verbatim style={{ color: c.foregroundMuted, fontSize: 11 }}>{s.projectName ? `${s.projectName} · ` : ''}{s.workspaceName || s.directory}</Text>
      <Action theme={theme} layout={layout} label={`Analyze ${s.title}`} selected={selectedId === s.id} onPress={() => onOpenSession(s.id)} />
    </View>
  </View>;
}
