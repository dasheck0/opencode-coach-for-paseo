import { useState } from 'react';
import { Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRpc, useSettings, type PluginSurfaceProps } from '@getpaseo/plugin/client';
import { SettingsAction, SettingsCard, SettingsInput, SettingsSection, SettingsSwitch } from '@getpaseo/plugin/client/ui';
import { catalogRpc, preferences } from '../shared/contracts';

export function CoachSettings({ theme }: PluginSurfaceProps) {
  const settings = useSettings(preferences), call = useRpc(catalogRpc);
  const catalog = useQuery({ queryKey: ['coach', 'settings-catalog', settings.status === 'ready' ? settings.revision : 'loading'], queryFn: () => call({}), enabled: settings.status === 'ready' });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [draftRevision, setDraftRevision] = useState<string | null>(null);
  const text = { color: theme.colors.foreground };
  if (settings.status !== 'ready') return <View style={{ gap: 12 }}>
    <Text style={text}>{settings.status === 'loading' ? 'Loading…' : 'Provider settings could not be read. Reset restores defaults.'}</Text>
    {settings.status !== 'loading' && <SettingsAction label="Recover settings" actionLabel="Reset" onPress={() => settings.reset()} />}
  </View>;
  async function toggle(id: string, key: 'disabled' | 'hidden', value: boolean) {
    if (settings.status !== 'ready') return;
    const values = settings.values[key].filter(x => x !== id);
    if (value) values.push(id);
    await settings.save({ ...settings.values, [key]: values }, settings.revision);
  }
  return <View style={{ gap: 20 }}>
    <Text style={text}>Enable providers for analysis, hide them from the selector, and choose local data paths. These settings apply to this Paseo host.</Text>
    {catalog.error && <Text style={{ color: theme.colors.statusDanger }}>{catalog.error.message}</Text>}
    {settings.saveError && <Text style={{ color: theme.colors.statusDanger }}>{String(settings.saveError)}</Text>}
    {draftRevision !== null && draftRevision !== settings.revision && <Text style={{ color: theme.colors.statusWarning }}>Settings changed while you were editing. Discard the draft and reload before saving.</Text>}
    {catalog.data?.adapters.map(adapter => <SettingsSection key={adapter.id} title={adapter.title}>
      <SettingsCard>
        <SettingsSwitch label="Enabled" hint="Disabled providers are not read, including through RPC." value={adapter.enabled}
          disabled={settings.saving || draftRevision !== null} onValueChange={v => { void toggle(adapter.id, 'disabled', !v); }} />
        <SettingsSwitch label="Show in provider selector" hint="Hidden providers remain available in settings." value={!adapter.hidden}
          disabled={settings.saving || draftRevision !== null} onValueChange={v => { void toggle(adapter.id, 'hidden', !v); }} />
        <SettingsInput key={`${adapter.id}-${settings.revision}`} label="Database paths" hint="Absolute database file or data directory. One path per line; blank uses automatic discovery."
          initialValue={(settings.values.paths[adapter.id] ?? []).join('\n')}
          onChangeText={value => { setDraftRevision(rev => rev ?? settings.revision); setDrafts(current => ({ ...current, [adapter.id]: value })); }} />
        <SettingsAction label="Save database paths" actionLabel="Save" disabled={settings.saving || drafts[adapter.id] === undefined || draftRevision !== settings.revision}
          onPress={async () => {
            const paths = drafts[adapter.id].split('\n').map(p => p.trim()).filter(Boolean);
            const ok = await settings.save({ ...settings.values, paths: { ...settings.values.paths, [adapter.id]: paths } }, settings.revision);
            if (ok) { setDrafts({}); setDraftRevision(null); }
          }} />
        <SettingsAction label="Discard path edits" actionLabel="Reload" onPress={async () => { setDrafts({}); setDraftRevision(null); await settings.reload(); }} />
      </SettingsCard>
      {adapter.error && <Text style={{ color: theme.colors.statusDanger }}>{adapter.error}</Text>}
      <Text style={{ color: theme.colors.foregroundMuted }}>{adapter.description}</Text>
    </SettingsSection>)}
  </View>;
}
