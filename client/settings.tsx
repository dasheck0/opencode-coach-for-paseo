import { useState } from 'react';
import { View } from 'react-native';
import { Text, I18nProvider, useI18n } from './i18n';
import { languagePacks } from './locales';
import { pages } from './navigation';
import { viewPreferences } from '../shared/preferences';
import { useQuery } from '@tanstack/react-query';
import { useRpc, useSettings, type PluginSurfaceProps } from '@getpaseo/plugin/client';
import { SettingsAction, SettingsCard, SettingsInput, SettingsSection, SettingsSwitch, SettingsSelect } from '@getpaseo/plugin/client/ui';
import { catalogRpc, preferences } from '../shared/contracts';

export function CoachSettings(props: PluginSurfaceProps) {
  const view = useSettings(viewPreferences);
  return <I18nProvider language={view.status === 'ready' ? view.values.language : 'en'}><ProviderSettings {...props} /></I18nProvider>;
}
function ProviderSettings({ theme }: PluginSurfaceProps) {
  const { t } = useI18n(), view = useSettings(viewPreferences);
  const settings = useSettings(preferences), call = useRpc(catalogRpc);
  const catalog = useQuery({ queryKey: ['coach', 'settings-catalog', settings.status === 'ready' ? settings.revision : 'loading'], queryFn: () => call({}), enabled: settings.status === 'ready' });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [draftRevision, setDraftRevision] = useState<string | null>(null);
  const text = { color: theme.colors.foreground };
  if (settings.status !== 'ready') return <View style={{ gap: 12 }}>
    <Text style={text}>{settings.status === 'loading' ? 'Loading…' : 'Provider settings could not be read. Reset restores defaults.'}</Text>
    {settings.status !== 'loading' && <SettingsAction label={t('Recover settings')} actionLabel={t('Reset')} onPress={() => settings.reset()} />}
  </View>;
  async function toggle(id: string, key: 'disabled' | 'hidden', value: boolean) {
    if (settings.status !== 'ready') return;
    const values = settings.values[key].filter(x => x !== id);
    if (value) values.push(id);
    await settings.save({ ...settings.values, [key]: values }, settings.revision);
  }
  return <View style={{ gap: 20 }}>
    {view.status === 'ready' && <SettingsSection title={t('View preferences')}><SettingsCard>
      <SettingsSelect label={t('Language')} value={view.values.language} options={languagePacks.map(p => ({ label: p.name, value: p.code }))} disabled={view.saving} onValueChange={language => { void view.save({ ...view.values, language }, view.revision); }} />
      <SettingsSelect label={t('Default period')} value={String(view.values.days)} options={[7, 30, 90, 0].map(days => ({ label: t(days ? `${days} days` : 'All history'), value: String(days) }))} disabled={view.saving} onValueChange={days => { void view.save({ ...view.values, days: Number(days) as 0 | 7 | 30 | 90 }, view.revision); }} />
    </SettingsCard></SettingsSection>}
    {view.status === 'ready' && <SettingsSection title={t('Origin defaults')}><SettingsCard>
      {pages.filter(p => p.id !== 'settings').map(p => { const id = p.id as keyof typeof view.values.origins; return <SettingsSelect key={id} label={t(p.title)} hint={t(p.description)} value={view.values.origins[id]} disabled={view.saving}
        options={[{ label: t('Main sessions (human-led)'), value: 'human' }, { label: t('Subagent sessions (AI-led)'), value: 'ai' }, { label: t('All sessions'), value: 'all' }]}
        onValueChange={origin => { void view.save({ ...view.values, origins: { ...view.values.origins, [id]: origin } }, view.revision); }} />; })}
    </SettingsCard></SettingsSection>}
    {view.saveError && <Text style={{ color: theme.colors.statusDanger }}>{view.saveError}</Text>}
    <Text style={text}>Enable providers for analysis, hide them from the selector, and choose local data paths. These settings apply to this Paseo host.</Text>
    {catalog.error && <Text style={{ color: theme.colors.statusDanger }}>{catalog.error.message}</Text>}
    {settings.saveError && <Text style={{ color: theme.colors.statusDanger }}>{String(settings.saveError)}</Text>}
    {draftRevision !== null && draftRevision !== settings.revision && <Text style={{ color: theme.colors.statusWarning }}>Settings changed while you were editing. Discard the draft and reload before saving.</Text>}
    {catalog.data?.adapters.map(adapter => <SettingsSection key={adapter.id} title={adapter.title}>
      <SettingsCard>
        <SettingsSwitch label={t('Enabled')} hint={t('Disabled providers are not read, including through RPC.')} value={adapter.enabled}
          disabled={settings.saving || draftRevision !== null} onValueChange={v => { void toggle(adapter.id, 'disabled', !v); }} />
        <SettingsSwitch label={t('Show in provider selector')} hint={t('Hidden providers remain available in settings.')} value={!adapter.hidden}
          disabled={settings.saving || draftRevision !== null} onValueChange={v => { void toggle(adapter.id, 'hidden', !v); }} />
        <SettingsInput key={`${adapter.id}-${settings.revision}`} label={t('Database paths')} hint={t('Absolute database file or data directory. One path per line; blank uses automatic discovery.')}
          initialValue={(settings.values.paths[adapter.id] ?? []).join('\n')}
          onChangeText={value => { setDraftRevision(rev => rev ?? settings.revision); setDrafts(current => ({ ...current, [adapter.id]: value })); }} />
        <SettingsAction label={t('Save database paths')} actionLabel={t('Save')} disabled={settings.saving || drafts[adapter.id] === undefined || draftRevision !== settings.revision}
          onPress={async () => {
            const paths = drafts[adapter.id].split('\n').map(p => p.trim()).filter(Boolean);
            const ok = await settings.save({ ...settings.values, paths: { ...settings.values.paths, [adapter.id]: paths } }, settings.revision);
            if (ok) { setDrafts({}); setDraftRevision(null); }
          }} />
        <SettingsAction label={t('Discard path edits')} actionLabel={t('Reload')} onPress={async () => { setDrafts({}); setDraftRevision(null); await settings.reload(); }} />
      </SettingsCard>
      {adapter.error && <Text style={{ color: theme.colors.statusDanger }}>{adapter.error}</Text>}
      <Text style={{ color: theme.colors.foregroundMuted }}>{adapter.description}</Text>
    </SettingsSection>)}
  </View>;
}
