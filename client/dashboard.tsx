import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text, I18nProvider, useI18n } from './i18n';
import { ProjectPicker } from './project-picker';
import { viewPreferences, type ViewPreferences } from '../shared/preferences';
import { SettingsSelect } from '@getpaseo/plugin/client/ui';
import { useQuery } from '@tanstack/react-query';
import { useRpc, useSettings, type PluginScreenProps } from '@getpaseo/plugin/client';
import { analyzeRpc, catalogRpc, historyRpc, overviewRpc, preferences, workspacesRpc } from '../shared/contracts';
import { AnalysisStatus, AntiPatternsPage, ContextPage, OutputPage, OverviewPanel, PatternsPage } from './overview';
import { Navigation, pages, type CoachPage } from './navigation';
import { Action } from './ui';
import { TimelinePage } from './timeline';
import { CoachSettings } from './settings';

export function Dashboard(props: PluginScreenProps) {
  const view = useSettings(viewPreferences);
  return <I18nProvider language={view.status === 'ready' ? view.values.language : 'en'}><DashboardContent {...props} /></I18nProvider>;
}
function DashboardContent(props: PluginScreenProps) {
  const view = useSettings(viewPreferences), { t } = useI18n();
  const { theme, layout } = props, c = theme.colors;
  const settings = useSettings(preferences);
  const catalogCall = useRpc(catalogRpc), historyCall = useRpc(historyRpc), analyzeCall = useRpc(analyzeRpc), overviewCall = useRpc(overviewRpc);
  const catalog = useQuery({ queryKey: ['coach', 'catalog', settings.status === 'ready' ? settings.revision : 'loading'], queryFn: () => catalogCall({}), enabled: settings.status === 'ready' });
  const [page, setPage] = useState<CoachPage>('dashboard');
  const [sourceId, setSourceId] = useState(''), [sessionId, setSessionId] = useState('');
  const workspaceCall = useRpc(workspacesRpc);
  const workspaceCatalog = useQuery({ queryKey: ['coach', 'workspaces'], queryFn: () => workspaceCall({}), staleTime: 10000 });
  const [until, setUntil] = useState(() => Date.now());
  const [offset, setOffset] = useState(0);
  const [patternsTab, setPatternsTab] = useState<'Work Hours' | 'Calendar' | 'Projects'>('Work Hours');
  type Visit = { page: CoachPage; sessionId: string; offset: number; patternsTab: typeof patternsTab; scrollY: number };
  const [backStack, setBackStack] = useState<Visit[]>([]);
  const scroll = useRef<ScrollView>(null), scrollY = useRef(0), restoreY = useRef<number | null>(null), viewport = useRef(0);
  const navigate = (next: CoachPage, nextSession = '') => {
    if (next === page && nextSession === sessionId) return;
    const ancestor = backStack.findIndex(visit => visit.page === next && visit.sessionId === nextSession);
    if (ancestor >= 0) { returnTo(ancestor); return; }
    // Another session is a sibling detail, not a deeper level.
    if (!(page === 'timeline' && sessionId && next === 'timeline' && nextSession)) {
      const visit = { page, sessionId, offset, patternsTab, scrollY: scrollY.current };
      setBackStack(stack => [...stack, visit]);
    }
    restoreY.current = 0; scrollY.current = 0;
    setPage(next); setSessionId(nextSession); if (next !== page) setOffset(0);
  };
  const returnTo = (index: number) => {
    const visit = backStack[index]; if (!visit) return;
    setBackStack(stack => stack.slice(0, index));
    restoreY.current = visit.scrollY; scrollY.current = visit.scrollY;
    setPage(visit.page); setSessionId(visit.sessionId); setOffset(visit.offset); setPatternsTab(visit.patternsTab);
  };
  const openSection = (next: CoachPage) => {
    setBackStack([]); setPage(next); setSessionId(''); setOffset(0);
    restoreY.current = 0; scrollY.current = 0;
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  useEffect(() => { if (restoreY.current !== null) scroll.current?.scrollTo({ y: restoreY.current, animated: false }); }, [page, sessionId, offset]);
  const days = view.status === 'ready' ? view.values.days : 30;
  const since = days ? until - days * 86400000 : 0;
  const legacyIds = view.status === 'ready' ? view.values.workspaceIds : [];
  const projectIds = view.status === 'ready' ? (legacyIds.length ? [...new Set((workspaceCatalog.data?.workspaces ?? []).filter(w => legacyIds.includes(w.id)).map(w => w.projectId))] : view.values.projectIds) : [];
  const filterReady = !legacyIds.length || !!workspaceCatalog.data;
  useEffect(() => {
    if (view.status === 'ready' && !view.saving && legacyIds.length && workspaceCatalog.data) {
      void view.save({ ...view.values, projectIds, workspaceIds: [] }, view.revision);
    }
  }, [view.status === 'ready' ? view.revision : '', workspaceCatalog.data]);
  const origin = view.status === 'ready' && page !== 'settings' ? view.values.origins[page] : 'all';
  const filterKey = JSON.stringify(projectIds);
  const selected = settings.status === 'ready' ? settings.values.selected : '';
  const providers = catalog.data?.adapters.filter(a => a.enabled && !a.hidden) ?? [];
  const adapter = providers.find(a => a.id === selected);
  const source = adapter?.sources.find(s => s.id === sourceId) ?? adapter?.sources[0];
  useEffect(() => { setSourceId(''); setSessionId(''); setOffset(0); setBackStack([]); }, [selected]);
  useEffect(() => { setSessionId(''); setOffset(0); setBackStack([]); }, [source?.id, days, filterKey]);
  const history = useQuery({ queryKey: ['coach', 'history', selected, source?.id, since, until, filterKey, origin, offset],
    queryFn: () => historyCall({ adapterId: selected, sourceId: source!.id, from: days ? since : undefined, to: until, projectIds, origin, limit: 50, offset }), enabled: !!source && filterReady && view.status === 'ready' && page === 'timeline' });
  const overview = useQuery({ queryKey: ['coach', 'overview', selected, source?.id, since, until, filterKey, origin],
    queryFn: () => overviewCall({ adapterId: selected, sourceId: source!.id, from: days ? since : undefined, to: until, projectIds, origin }), enabled: !!source && filterReady && view.status === 'ready', retry: false,
    refetchInterval: query => query.state.data?.status === 'complete' || query.state.data?.status === 'error' ? false : 1500 });
  const report = useQuery({ queryKey: ['coach', 'report', selected, source?.id, sessionId, origin, since, until],
    queryFn: () => analyzeCall({ adapterId: selected, sourceId: source!.id, sessionId, origin, from: days ? since : undefined, to: until }), enabled: !!source && !!sessionId && page === 'timeline' });
  const openSession = (id: string) => navigate('timeline', id);
  const overviewProps = overview.data ? { ...props, data: overview.data, onOpenSession: openSession, onNavigate: (next: CoachPage) => navigate(next) } : null;
  const current = pages.find(p => p.id === page)!;
  const visitTitle = (visit: Pick<Visit, 'page' | 'sessionId'>) => visit.sessionId ? t('Session details') : t(pages.find(p => p.id === visit.page)!.title);
  const trail = [...backStack, { page, sessionId }];
  const saveView = (patch: Partial<ViewPreferences>) => { if (view.status === 'ready') void view.save({ ...view.values, ...patch }, view.revision); };
  const providerFilters = <View style={{ gap: 10 }}>
    <Text style={{ color: c.foregroundMuted, fontSize: 10, fontWeight: '600', letterSpacing: 1 }}>HARNESS / PROVIDER</Text>
    <View style={{ flexDirection: layout.compact ? 'row' : 'column', flexWrap: 'wrap', gap: 6 }}>{providers.map(a => <Action key={a.id} {...props} label={a.title} selected={a.id === selected} disabled={settings.saving} onPress={() => { if (settings.status === 'ready') void settings.save({ ...settings.values, selected: a.id }, settings.revision); }} />)}</View>
    {adapter?.sources.map(s => <Action key={s.id} {...props} label={`${s.label} · ${s.format}`} selected={s.id === source?.id} onPress={() => setSourceId(s.id)} />)}
    <Text style={{ color: c.foregroundMuted, fontSize: 10, fontWeight: '600', letterSpacing: 1 }}>PROJECT</Text>
    <ProjectPicker {...props} projects={workspaceCatalog.data?.projects ?? []} selected={projectIds} onChange={ids => saveView({ projectIds: ids, workspaceIds: [] })} disabled={view.status !== 'ready' || view.saving || workspaceCatalog.isPending} error={workspaceCatalog.error?.message} />
    <Text style={{ color: c.foregroundMuted, fontSize: 10 }}>Local rules · No API costs</Text>
  </View>;
  return <View style={{ flex: 1, width: '100%', height: '100%', minWidth: 0, alignSelf: 'stretch', flexDirection: layout.compact ? 'column' : 'row', backgroundColor: c.surface0 }}>
    {layout.compact ? <Navigation {...props} page={page} onChange={openSection} /> : <View style={{ width: 220, backgroundColor: c.surface1, borderRightWidth: 1, borderColor: c.border }}><Navigation {...props} page={page} onChange={openSection} /><View style={{ padding: 16, gap: 10, borderTopWidth: 1, borderColor: c.border }}>{providerFilters}</View></View>}
    <ScrollView ref={scroll} accessibilityLabel={t('Coach content')}
      onLayout={event => { viewport.current = event.nativeEvent.layout.height; }}
      onScroll={event => { if (restoreY.current === null) scrollY.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={32}
      onScrollBeginDrag={() => { restoreY.current = null; }}
      onContentSizeChange={(_width, height) => { if (restoreY.current !== null) {
        scroll.current?.scrollTo({ y: restoreY.current, animated: false });
        if (height >= restoreY.current + viewport.current) { scrollY.current = restoreY.current; restoreY.current = null; }
      } }} style={{ flex: 1, minWidth: 0 }} contentContainerStyle={{ padding: layout.compact ? 16 : 28, gap: 18, maxWidth: 1480, width: '100%', alignSelf: 'center' }}>
      <ScrollView horizontal accessibilityLabel={t('Navigation path')} style={{ flexGrow: 0 }} contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {trail.map((visit, index) => <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {index > 0 && <Text style={{ color: c.foregroundMuted, fontSize: 14 }}>›</Text>}
          {index < backStack.length ? <Pressable accessibilityRole="link" accessibilityLabel={`${t('Return to')} ${visitTitle(visit)}`} onPress={() => returnTo(index)} style={{ paddingVertical: 6, paddingHorizontal: 2 }}>
            <Text style={{ color: c.accent, fontSize: 12 }}>{visitTitle(visit)}</Text>
          </Pressable> : <Text accessibilityRole="text" style={{ color: c.foreground, fontSize: 12, fontWeight: '600' }}>{visitTitle(visit)}</Text>}
        </View>)}
      </ScrollView>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ gap: 5 }}><Text style={{ color: c.foregroundMuted, fontSize: 11 }}>{current.group} / OpenCode Coach</Text><Text accessibilityRole="header" style={{ color: c.foreground, fontSize: 28, fontWeight: '700' }}>{current.title}</Text><Text style={{ color: c.foregroundMuted, fontSize: 12 }}>{current.description}</Text></View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{[7, 30, 90, 0].map(n => <Action key={n} {...props} label={n ? `${n} days` : 'All history'} selected={n === days} onPress={() => { const now = Date.now(); saveView({ days: n as 0 | 7 | 30 | 90 }); setUntil(now); }} />)}<Action {...props} label="Refresh" onPress={() => { setUntil(Date.now()); void catalog.refetch(); if (sessionId) void report.refetch(); }} /></View>
      </View>
      {layout.compact && providerFilters}
      {page !== 'settings' && <SettingsSelect label={t('Session origin')} hint={t('Main sessions reflect your prompting; subagent sessions reflect delegated work. Synthetic prompts never count as human prompts.')} value={origin} disabled={view.status !== 'ready' || view.saving} options={[{ label: t('Main sessions (human-led)'), value: 'human' }, { label: t('Subagent sessions (AI-led)'), value: 'ai' }, { label: t('All sessions'), value: 'all' }]} onValueChange={value => { if (view.status === 'ready') { setSessionId(''); saveView({ origins: { ...view.values.origins, [page]: value as 'human' | 'ai' | 'all' } }); } }} />}
      {view.saveError && <Text style={{ color: c.statusDanger }}>{String(view.saveError)}</Text>}
      {settings.status !== 'ready' && <Text style={{ color: c.foregroundMuted }}>{settings.status === 'loading' ? 'Loading settings…' : 'Provider settings unavailable. Open Providers to recover.'}</Text>}
      {settings.saveError && <Text style={{ color: c.statusDanger }}>{String(settings.saveError)}</Text>}
      {catalog.error && <Text style={{ color: c.statusDanger }}>{catalog.error.message}</Text>}
      {adapter?.error && <Text style={{ color: c.statusDanger }}>{adapter.error}</Text>}
      {!adapter && catalog.data && <Text style={{ color: c.foregroundMuted }}>Choose a provider. Activation and visibility are available under Providers.</Text>}
      {adapter && !adapter.error && !adapter.sources.length && <Text style={{ color: c.foregroundMuted }}>No database found. Configure a source under Providers, then refresh.</Text>}
      {page === 'settings' ? <CoachSettings {...props} /> : <>
        {overview.isPending && source && <Text style={{ color: c.foregroundMuted }}>Preparing your coaching overview…</Text>}
        {overview.error && <Text style={{ color: c.statusDanger }}>{overview.error.message}</Text>}
        {overviewProps && <AnalysisStatus {...overviewProps} />}
        {page === 'dashboard' && overviewProps && <><OverviewPanel {...overviewProps} /><Action {...props} label="Browse individual sessions" onPress={() => navigate('timeline')} /></>}
        {page === 'output' && overviewProps && <OutputPage {...overviewProps} />}
        {page === 'patterns' && overviewProps && <PatternsPage {...overviewProps} tab={patternsTab} onTabChange={setPatternsTab} />}
        {page === 'anti-patterns' && overviewProps && <AntiPatternsPage {...overviewProps} />}
        {page === 'context' && overviewProps && <ContextPage {...overviewProps} />}
        {page === 'timeline' && source && <TimelinePage {...props} sessions={history.data?.sessions ?? []} sessionId={sessionId} onSelect={openSession} offset={offset} onOffset={setOffset} hasMore={!!history.data?.hasMore}
          loading={history.isPending} error={history.error?.message} report={report.data} reportLoading={!!sessionId && report.isPending} reportError={report.error?.message} />}
      </>}
      {source && <Text selectable numberOfLines={1} style={{ color: c.foregroundMuted, fontSize: 10 }}>Source: {source.path} · Message activity defines the selected period; metrics count only messages within it.</Text>}
    </ScrollView>
  </View>;
}
