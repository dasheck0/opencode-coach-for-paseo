import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { Text, useI18n } from './i18n';
import type { Workspace } from '../shared/workspaces';
import type { Surface } from './ui';
export function WorkspacePicker({ theme, workspaces, selected, onChange, disabled, error }: Surface & {
  workspaces: Workspace[]; selected: string[]; onChange: (ids: string[]) => void; disabled?: boolean; error?: string;
}) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState(''); const { t } = useI18n(), c = theme.colors;
  const visible = workspaces.filter(w => `${w.projectName} ${w.name}`.toLowerCase().includes(query.toLowerCase()));
  return <View style={{ gap: 6 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={t('Choose workspaces')} accessibilityState={{ expanded: open, disabled: !!disabled }} disabled={disabled} onPress={() => setOpen(value => !value)} style={{ padding: 10, borderWidth: 1, borderColor: c.border, borderRadius: 6, backgroundColor: c.surface2 }}>
      <Text style={{ color: c.foreground, fontSize: 12 }}>{selected.length ? `${selected.length} workspaces selected` : 'All workspaces'} ▾</Text>
    </Pressable>
    {open && <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 6, padding: 8, gap: 8 }}>
      <TextInput accessibilityLabel={t('Search workspaces')} placeholder={t('Search workspaces')} placeholderTextColor={c.foregroundMuted} value={query} onChangeText={setQuery} style={{ padding: 8, color: c.foreground, backgroundColor: c.surface2, borderRadius: 4 }} />
      <Pressable accessibilityRole="button" accessibilityLabel={t('All workspaces')} disabled={disabled} onPress={() => onChange([])}><Text style={{ color: c.accent, fontSize: 12 }}>All workspaces</Text></Pressable>
      <ScrollView style={{ maxHeight: 250 }} contentContainerStyle={{ gap: 4 }}>{visible.map(w => <Pressable key={w.id} accessibilityRole="checkbox" accessibilityState={{ checked: selected.includes(w.id), disabled: !!disabled }} accessibilityLabel={`${w.projectName} · ${w.name}`} disabled={disabled}
        onPress={() => onChange(selected.includes(w.id) ? selected.filter(id => id !== w.id) : [...selected, w.id])} style={{ padding: 8, borderRadius: 4, backgroundColor: selected.includes(w.id) ? c.surface2 : c.surface1 }}>
        <Text verbatim style={{ color: c.foreground, fontSize: 12 }}>{selected.includes(w.id) ? '☑ ' : '☐ '}{w.projectName} · {w.name}</Text>
      </Pressable>)}</ScrollView>
      {!visible.length && <Text style={{ color: c.foregroundMuted, fontSize: 12 }}>No workspaces found.</Text>}
    </View>}
    {selected.map(id => { const w = workspaces.find(w => w.id === id); return <Text verbatim key={id} style={{ color: c.foregroundMuted, fontSize: 10 }}>{w ? `${w.projectName} · ${w.name}` : id}</Text>; })}
    {error && <Text style={{ color: c.statusDanger, fontSize: 12 }}>{error}</Text>}
  </View>;
}
