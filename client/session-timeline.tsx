import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import type { SessionSummary } from '../shared/model';
import { Text, useI18n } from './i18n';
import { Action, type Surface } from './ui';
import { timelineLayout, timelineTicks } from './session-timeline-model';
/** A shared multi-day activity track with an inline inspector, independent of history pagination. */
export function SessionTimeline({ sessions, selectedId, onOpenSession, from, to, theme, layout, renderDetails }: Surface & {
  sessions: SessionSummary[]; selectedId?: string; onOpenSession: (id: string) => void; from?: number; to?: number; renderDetails?: (sessionId: string) => ReactNode;
}) {
  const [pinned, setPinned] = useState(''), [preview, setPreview] = useState(''), [width, setWidth] = useState(600);
  const { locale, t } = useI18n(), c = theme.colors;
  const mainColor = '#3b82f6', delegatedColor = '#16a34a';
  const model = timelineLayout(sessions, from, to), ticks = timelineTicks(model.start, model.end, layout.compact ? 3 : 5);
  const selected = model.segments.find(s => s.session.id === pinned) ?? model.segments.find(s => s.session.id === selectedId) ?? model.segments[0];
  const inspected = model.segments.find(s => s.session.id === preview) ?? selected;
  const date = (timestamp: number) => new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(timestamp);
  const time = (timestamp: number) => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }).format(timestamp);
  const stamp = (timestamp: number) => `${new Date(timestamp).getUTCFullYear()} · ${date(timestamp)} ${time(timestamp)}`;
  if (!model.segments.length) return <Text style={{ color: c.foregroundMuted }}>No sessions match this range and project.</Text>;
  const s = inspected!.session, index = model.segments.findIndex(segment => segment.session.id === s.id);
  const step = (next: number) => { setPreview(''); setPinned(model.segments[next].session.id); };
  return <View style={{ gap: 12 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
      {([['Main', mainColor], ['Delegated', delegatedColor]] as const).map(([label, color]) => <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 12, height: 8, borderRadius: 3, backgroundColor: color }} />
        <Text style={{ color: c.foregroundMuted, fontSize: 11 }}>{label}</Text>
      </View>)}
    </View>
    <Text verbatim style={{ color: c.foregroundMuted, fontSize: 11 }}>{stamp(model.start)} — {stamp(model.end)} UTC</Text>
    <View accessibilityLabel={t('Session activity track')} onLayout={event => setWidth(Math.max(1, event.nativeEvent.layout.width))} style={{ gap: 5 }}>
      <View style={{ height: 24, borderRadius: 6, backgroundColor: c.surface2, position: 'relative' }}>
        {ticks.map((tick, i) => <View key={tick} pointerEvents="none" style={{ position: 'absolute', left: `${i / (ticks.length - 1) * 100}%`, top: 0, bottom: 0, borderLeftWidth: 1, borderColor: c.border }} />)}
        {model.segments.map(segment => {
          const active = segment.session.id === s.id, minWidth = Math.min(1, 6 / width), segmentWidth = Math.min(1, Math.max(minWidth, segment.width)), left = Math.min(segment.left, 1 - segmentWidth);
          return <Pressable key={segment.session.id} accessibilityRole="button" accessibilityLabel={`${t('Inspect session')}: ${segment.session.title}`} accessibilityState={{ selected: active }}
            onHoverIn={() => setPreview(segment.session.id)} onHoverOut={() => { setPinned(segment.session.id); setPreview(''); }} onFocus={() => setPreview(segment.session.id)} onBlur={() => { setPinned(segment.session.id); setPreview(''); }}
            onPress={() => { setPreview(''); setPinned(segment.session.id); }}
            style={{ position: 'absolute', left: `${left * 100}%`, width: `${segmentWidth * 100}%`, top: 0, height: 24, justifyContent: 'center', zIndex: Math.round((1 - segment.width) * 1000) + 1 }}>
            <View style={{ height: active ? 10 : 6, borderRadius: 4, backgroundColor: segment.session.parentId ? delegatedColor : mainColor, borderWidth: 1, borderColor: active ? c.foreground : c.surface2 }} />
          </Pressable>;
        })}
      </View>
      <View style={{ height: 32, position: 'relative' }}>{ticks.map((tick, i) => <View key={tick} style={{ position: 'absolute', left: `${i / (ticks.length - 1) * 100}%`, marginLeft: i === 0 ? 0 : i === ticks.length - 1 ? -80 : -40, width: 80, alignItems: i === 0 ? 'flex-start' : i === ticks.length - 1 ? 'flex-end' : 'center' }}>
        <Text verbatim style={{ color: c.foregroundMuted, fontSize: 10 }}>{date(tick)}</Text><Text verbatim style={{ color: c.foregroundMuted, fontSize: 10 }}>{time(tick)}</Text>
      </View>)}</View>
    </View>
    <Text style={{ color: c.foregroundMuted, fontSize: 11 }}>Hover or select a segment to inspect it below. Open analysis separately. Spans include idle time; very short sessions have a minimum visible width.</Text>
    {model.crowded && <Text style={{ color: c.foregroundMuted, fontSize: 11 }}>Some sessions overlap. Use the arrows beside the title to reach every session.</Text>}
    <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 6, padding: 12, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text verbatim style={{ color: c.foreground, fontSize: 13, fontWeight: '600', flex: 1 }}>{s.title}</Text>
        {model.segments.length > 1 && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Action theme={theme} layout={layout} label="‹" accessibilityLabel="Previous session" disabled={index === 0} onPress={() => step(index - 1)} />
          <Text verbatim style={{ color: c.foregroundMuted, fontSize: 11 }}>{index + 1}/{model.segments.length}</Text>
          <Action theme={theme} layout={layout} label="›" accessibilityLabel="Next session" disabled={index === model.segments.length - 1} onPress={() => step(index + 1)} />
        </View>}
      </View>
      <Text verbatim style={{ color: c.foregroundMuted, fontSize: 11 }}>{stamp(inspected!.start)} — {stamp(inspected!.end)} UTC · {t(s.parentId ? 'Delegated' : 'Main')}</Text>
      <Text verbatim style={{ color: c.foregroundMuted, fontSize: 11 }}>{s.projectName ? `${s.projectName} · ` : ''}{s.workspaceName || s.directory}</Text>
      <Action theme={theme} layout={layout} label={`Analyze ${s.title}`} selected={selectedId === s.id} onPress={() => onOpenSession(s.id)} />
      {renderDetails?.(s.id)}
    </View>
  </View>;
}
