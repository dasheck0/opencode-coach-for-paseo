/* Navigation grouping adapted from Microsoft's dashboard-shell.ts (MIT).
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Native implementation copyright (c) 2026 dasheck0. See NOTICE and licenses/.
 */
import { Pressable, ScrollView, View } from 'react-native';
import { Text, useI18n } from './i18n';
import type { PluginSurfaceProps } from '@getpaseo/plugin/client';
export const pages = [
  { id: 'dashboard', title: 'Dashboard', group: 'Observe', mark: '▥', description: 'Your coding practices at a glance' },
  { id: 'timeline', title: 'Timeline', group: 'Observe', mark: '━', description: 'Explore session history and evidence' },
  { id: 'output', title: 'Output', group: 'Measure', mark: '↗', description: 'Recorded usage, models, and edit activity' },
  { id: 'patterns', title: 'Patterns', group: 'Measure', mark: '▦', description: 'When and where your sessions happen' },
  { id: 'anti-patterns', title: 'Anti-Patterns', group: 'Improve', mark: '△', description: 'Recurring issues and practical next steps' },
  { id: 'context', title: 'Context Health', group: 'Improve', mark: '◇', description: 'Compaction and session hygiene signals' },
  { id: 'settings', title: 'Providers', group: 'Settings', mark: '⚙', description: 'Provider activation, visibility, and data sources' },
] as const;
export type CoachPage = typeof pages[number]['id'];
export function Navigation({ page, onChange, theme, layout }: Pick<PluginSurfaceProps, 'theme' | 'layout'> & { page: CoachPage; onChange: (page: CoachPage) => void }) {
  const c = theme.colors, { t } = useI18n();
  return <ScrollView horizontal={layout.compact} style={layout.compact ? { flexGrow: 0, backgroundColor: c.surface1 } : { width: 220, flexGrow: 0, backgroundColor: c.surface1, borderRightWidth: 1, borderColor: c.border }}
    contentContainerStyle={{ padding: layout.compact ? 8 : 16, gap: 16, flexDirection: layout.compact ? 'row' : 'column' }}>
    {!layout.compact && <View style={{ gap: 4, paddingBottom: 8 }}><Text style={{ color: c.foreground, fontWeight: '700', fontSize: 16 }}>OpenCode Coach</Text><Text style={{ color: c.foregroundMuted, fontSize: 11 }}>LOCAL SESSION ANALYTICS</Text></View>}
    {['Observe', 'Measure', 'Improve', 'Settings'].map(group => <View key={group} style={{ gap: 5 }}>
      <Text style={{ color: c.foregroundMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1, padding: 5 }}>{group.toUpperCase()}</Text>
      <View style={{ flexDirection: layout.compact ? 'row' : 'column', gap: 3 }}>{pages.filter(p => p.group === group).map(p => <Pressable key={p.id}
        accessibilityRole="button" accessibilityLabel={t(`Navigate to ${t(p.title)}`)} accessibilityState={{ selected: page === p.id }} onPress={() => onChange(p.id)}
        style={{ paddingHorizontal: 10, paddingVertical: 10, borderRadius: 6, backgroundColor: page === p.id ? c.surface2 : c.surface1, borderLeftWidth: 2, borderLeftColor: page === p.id ? c.accent : c.surface1 }}>
        <Text style={{ color: page === p.id ? c.accent : c.foreground, fontWeight: page === p.id ? '600' : '400', fontSize: 13 }}>{p.mark}  {p.title}</Text>
      </Pressable>)}</View>
    </View>)}
  </ScrollView>;
}
