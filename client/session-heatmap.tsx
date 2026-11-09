import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text, useI18n } from './i18n';
import { Panel, type Surface } from './ui';
export function SessionHeatmap({ hours, ...surface }: Surface & { hours: number[] }) {
  const [active, setActive] = useState<number | null>(null), [pinned, setPinned] = useState(false), [width, setWidth] = useState(800);
  const c = surface.theme.colors, { locale, t } = useI18n(), gap = surface.layout.compact ? 2 : 4;
  const peak = Math.max(1, ...hours), cellWidth = Math.max(1, (width - 30 - 24 * gap) / 24);
  const weekday = (day: number) => new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 10, 8 + day)));
  const range = (hour: number) => `${String(hour).padStart(2, '0')}:00–${String(hour + 1).padStart(2, '0')}:00 UTC`;
  const countLabel = (count: number) => `${count.toLocaleString(locale)} ${t(count === 1 ? 'Session' : 'Sessions')}`;
  const inspect = (index: number) => { setActive(index); setPinned(false); };
  const close = () => { setActive(null); setPinned(false); };
  return <Panel {...surface} title="Sessions by Day and Hour" raised={active !== null}>
    <Text style={{ color: c.foregroundMuted, fontSize: 12 }}>Session activity in UTC. Each session counts once per active hour; this is not a work-life score.</Text>
    <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', marginLeft: 35 }}>{[0, 6, 12, 18].map(hour => <Text key={hour} style={{ color: c.foregroundMuted, fontSize: 10, flex: 1 }}>{hour}:00</Text>)}</View>
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, day) => <View key={label} style={{ flexDirection: 'row', gap, alignItems: 'center', zIndex: active !== null && Math.floor(active / 24) === day ? 2 : 0 }}>
        <Text style={{ color: c.foregroundMuted, fontSize: 11, width: 30 }}>{label}</Text>
        {Array.from({ length: 24 }, (_, hour) => {
          const index = day * 24 + hour, count = hours[index] ?? 0, open = active === index;
          const x = 30 + gap + hour * (cellWidth + gap), popoverLeft = Math.max(-x, Math.min(0, width - 168 - x));
          return <View key={hour} style={{ flex: 1, position: 'relative', zIndex: open ? 2 : 0 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${weekday(day)} ${range(hour)}: ${countLabel(count)}`} accessibilityState={{ expanded: open }}
              onHoverIn={() => inspect(index)} onHoverOut={() => { if (!pinned) setActive(null); }} onFocus={() => inspect(index)} onBlur={close} onAccessibilityEscape={close}
              onPress={() => { if (open && pinned) close(); else { setActive(index); setPinned(true); } }}
              style={{ height: surface.layout.compact ? 13 : 20, borderRadius: 2 }}>
              <View style={{ height: '100%', borderRadius: 2, backgroundColor: c.accent, opacity: count ? 0.2 + count / peak * 0.8 : 0.06 }} />
            </Pressable>
            {open && <View pointerEvents="none" accessibilityRole="text" accessibilityLabel={t('Cell details')} style={{ position: 'absolute', left: popoverLeft, top: (surface.layout.compact ? 13 : 20) + 6, width: 168, padding: 10, gap: 3, borderRadius: 6, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface0, zIndex: 10 }}>
              <Text verbatim style={{ color: c.foreground, fontSize: 12, fontWeight: '600' }}>{weekday(day)}</Text>
              <Text verbatim style={{ color: c.foregroundMuted, fontSize: 11 }}>{range(hour)}</Text>
              <Text verbatim style={{ color: c.foreground, fontSize: 12 }}>{countLabel(count)}</Text>
            </View>}
          </View>;
        })}
      </View>)}
    </View>
  </Panel>;
}
