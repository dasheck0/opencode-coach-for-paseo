import { afterEach, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { ViewPreferences } from '../shared/preferences';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const mocks = vi.hoisted(() => ({
  save: vi.fn(async () => true), values: { disabled: [] as string[], hidden: [] as string[], selected: 'opencode-v2', paths: {} },
  scrollTo: vi.fn(), catalog: vi.fn(), history: vi.fn(), analyze: vi.fn(), overview: vi.fn(), workspaces: vi.fn(), saveView: vi.fn(async (_values: unknown, _revision: string) => true),
  view: { language: 'en', days: 30, historyPageSize: 5, projectIds: [], workspaceIds: [], origins: { dashboard: 'human', timeline: 'all', output: 'all', patterns: 'all', 'anti-patterns': 'human', context: 'all' } } as ViewPreferences,
}));
vi.mock('react-native', () => ({ View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', TextInput: 'TextInput' }));
vi.mock('@getpaseo/plugin/client', () => ({
  useRpc: (contract: { name: string }) => contract.name === 'coach.catalog' ? mocks.catalog : contract.name === 'coach.history' ? mocks.history : contract.name === 'coach.overview' ? mocks.overview : contract.name === 'coach.workspaces' ? mocks.workspaces : mocks.analyze,
  useSettings: (definition: { id: string }) => ({ status: 'ready', values: definition.id === 'view' ? mocks.view : mocks.values, revision: 'r1', saving: false, saveError: null, save: definition.id === 'view' ? mocks.saveView : mocks.save, reload: vi.fn(), reset: vi.fn() }),
}));
vi.mock('@getpaseo/plugin/client/ui', () => Object.fromEntries(['SettingsAction','SettingsCard','SettingsInput','SettingsSection','SettingsSwitch','SettingsSelect'].map(n => [n, n])));
import { OverviewAccumulator } from '../server/overview';
import { Dashboard } from '../client/dashboard';
import { CoachSettings } from '../client/settings';
import type { PluginScreenProps } from '@getpaseo/plugin/client';
const mounted: ReactTestRenderer[] = [];
afterEach(async () => { await act(async () => { mounted.splice(0).forEach(r => r.unmount()); }); vi.clearAllMocks(); });
const summary = { id: 's', adapterId: 'opencode-v2', sourceId: 'db', title: 'Fixture session', directory: '/fixture', parentId: null, created: Date.now(), updated: Date.now(), inputTokens: null, outputTokens: null, cost: null };
function props(compact: boolean, dark: boolean): PluginScreenProps {
  const base = dark ? '#eeeeee' : '#111111';
  return { theme: { colors: { foreground: base, foregroundMuted: base, surface0: dark ? '#111111' : '#ffffff', surface1: '#777777', surface2: '#888888', accent: '#008800', accentForeground: '#ffffff', border: '#777777', statusDanger: '#ff0000', statusWarning: '#ffaa00' } }, layout: { compact, platform: 'web' } } as PluginScreenProps;
}
async function render(Component: typeof Dashboard | typeof CoachSettings, p: PluginScreenProps) {
  // React's test environment flag is intentionally test-only.
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  let r!: ReactTestRenderer;
  await act(async () => { r = create(createElement(QueryClientProvider, { client }, createElement(Component, p)), { createNodeMock: element => element.type === 'ScrollView' ? { scrollTo: mocks.scrollTo } : null }); }); mounted.push(r);
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  return r;
}
function setup(error = false) {
  mocks.saveView.mockImplementation(async () => true);
  mocks.view = { language: 'en', days: 30, historyPageSize: 5, projectIds: [], workspaceIds: [], origins: { dashboard: 'human', timeline: 'all', output: 'all', patterns: 'all', 'anti-patterns': 'human', context: 'all' } };
  mocks.workspaces.mockResolvedValue({ projects: [{ id: 'p1', name: 'Fixture Project', directory: '/fixture' }, { id: 'p2', name: 'Other Project', directory: '/other' }], workspaces: [{ id: 'w1', name: 'Human workspace', projectName: 'Fixture Project', projectId: 'p1', directory: '/fixture', projectRoot: '/fixture', worktree: false }, { id: 'w2', name: 'Worktree', projectName: 'Fixture Project', projectId: 'p1', directory: '/worktree', projectRoot: '/fixture', worktree: true }] });
  mocks.catalog.mockResolvedValue({ adapters: [{ id: 'opencode-v2', title: 'OpenCode V2', description: 'Fixture adapter', enabled: true, hidden: false,
    sources: error ? [] : [{ id: 'db', path: '/fixture.db', label: 'Fixture', format: 'v2' }], error: error ? 'Fixture source unavailable' : null }] });
  const acc = new OverviewAccumulator({ adapterId: 'opencode-v2', sourceId: 'db', to: Date.now() });
  acc.discover([summary]); acc.start([summary]); acc.result.status = 'complete';
  mocks.overview.mockResolvedValue(acc.snapshot());
  mocks.history.mockResolvedValue({ sessions: [summary], hasMore: false, total: 1, totalSessions: 1, offset: 0 });
  mocks.analyze.mockRejectedValue(new Error('Fixture analysis failed'));
}
it.each([[false, false], [true, true]])('renders desktop/light and compact/dark without uncolored text (%s,%s)', async (compact, dark) => {
  setup(); const r = await render(Dashboard, props(compact, dark));
  expect(JSON.stringify(r.toJSON())).toContain('Your coaching overview');
  expect(mocks.overview).toHaveBeenCalled();
  expect(mocks.history).not.toHaveBeenCalled();
  expect(mocks.analyze).not.toHaveBeenCalled();
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Browse individual sessions' }).props.onPress());
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  expect(JSON.stringify(r.toJSON())).toContain('Fixture session');
  for (const node of r.root.findAllByType('Text' as never)) expect(node.props.style.color).toBeTruthy();
  const analyzeButton = r.root.findByProps({ accessibilityLabel: 'Analyze Fixture session' });
  await act(async () => analyzeButton.props.onPress());
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  expect(mocks.analyze).toHaveBeenCalledWith({ adapterId: 'opencode-v2', sourceId: 'db', sessionId: 's', origin: 'all', from: expect.any(Number), to: expect.any(Number) });
  expect(JSON.stringify(r.toJSON())).toContain('Fixture analysis failed');
});
it('shows discovery errors with a recovery action', async () => {
  setup(true); const r = await render(Dashboard, props(true, true));
  expect(JSON.stringify(r.toJSON())).toContain('Fixture source unavailable');
  expect(r.root.findAllByProps({ accessibilityRole: 'button' }).length).toBeGreaterThan(0);
});
it('provider controls save activation, visibility and paths without provider-specific UI', async () => {
  setup(); const r = await render(CoachSettings, props(false, false));
  const switches = r.root.findAllByType('SettingsSwitch' as never);
  await act(async () => switches[0].props.onValueChange(false));
  expect(mocks.save).toHaveBeenLastCalledWith({ ...mocks.values, disabled: ['opencode-v2'] }, 'r1');
  await act(async () => switches[1].props.onValueChange(false));
  expect(mocks.save).toHaveBeenLastCalledWith({ ...mocks.values, hidden: ['opencode-v2'] }, 'r1');
  await act(async () => r.root.findByType('SettingsInput' as never).props.onChangeText('/fixture/opencode.db'));
  const save = r.root.findByProps({ label: 'Save database paths' });
  await act(async () => save.props.onPress());
  expect(mocks.save).toHaveBeenLastCalledWith({ ...mocks.values, paths: { 'opencode-v2': ['/fixture/opencode.db'] } }, 'r1');
});
it('shows actionable cross-session insights immediately without opening any session', async () => {
  setup(); const overview = new OverviewAccumulator({ adapterId: 'opencode-v2', sourceId: 'db', to: Date.now() }).snapshot();
  overview.status = 'complete'; overview.matched = overview.analyzed = 251;
  overview.insights = [{ rule: 'verification-gap', title: 'Verify after editing', advice: 'Run relevant checks after the final edit.', affectedSessions: 100, percentage: 39.8,
    earlierPercentage: 50, laterPercentage: 25, changePoints: -25, examples: [{ sessionId: 's', title: 'Fixture session' }] }];
  mocks.overview.mockResolvedValue(overview);
  const r = await render(Dashboard, props(true, true));
  expect(JSON.stringify(r.toJSON())).toContain('Run relevant checks after the final edit.');
  expect(JSON.stringify(r.toJSON())).toContain('39.8');
  expect(mocks.history).not.toHaveBeenCalled(); expect(mocks.analyze).not.toHaveBeenCalled();
  await act(async () => r.root.findByProps({ accessibilityLabel: 'View All Anti-Patterns' }).props.onPress());
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Open evidence: Fixture session' }).props.onPress());
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  expect(mocks.analyze).toHaveBeenCalledWith({ adapterId: 'opencode-v2', sourceId: 'db', sessionId: 's', origin: 'all', from: expect.any(Number), to: expect.any(Number) });
});
it('selects multiple named Paseo projects using a dropdown without accepting arbitrary paths', async () => {
  setup(); const r = await render(Dashboard, props(false, false));
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Choose projects' }).props.onPress());
  const options = r.root.findAllByProps({ accessibilityRole: 'checkbox' }); expect(options).toHaveLength(2);
  await act(async () => options[0].props.onPress());
  expect(mocks.saveView).toHaveBeenLastCalledWith({ ...mocks.view, projectIds: ['p1'] }, 'r1');
  expect(r.root.findAllByProps({ accessibilityLabel: 'Filter by exact workspace directory' })).toHaveLength(0);
});
it.each([[false, false], [true, true]])('keeps shared filters and analysis while navigating native coach pages (%s,%s)', async (compact, dark) => {
  setup(); const r = await render(Dashboard, props(compact, dark));
  const overviewCalls = mocks.overview.mock.calls.length;
  for (const [page, content] of [['Output', 'Model Usage'], ['Patterns', 'Sessions by Day and Hour'], ['Context Health', 'Session Context Signals'], ['Anti-Patterns', 'Ranked by affected sessions.']] as const) {
    await act(async () => r.root.findByProps({ accessibilityLabel: `Navigate to ${page}` }).props.onPress());
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
    expect(JSON.stringify(r.toJSON())).toContain(content);
    expect(r.root.findAllByProps({ accessibilityLabel: 'Choose projects' })).toHaveLength(1);
    for (const node of r.root.findAllByType('Text' as never)) expect(node.props.style.color).toBeTruthy();
  }
  expect(mocks.overview.mock.calls.length).toBeLessThanOrEqual(overviewCalls + 2);
  expect(mocks.analyze).not.toHaveBeenCalled();
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Navigate to Patterns' }).props.onPress());
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Calendar' }).props.onPress());
  expect(JSON.stringify(r.toJSON())).toContain('Calendar Activity');
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Projects' }).props.onPress());
  expect(JSON.stringify(r.toJSON())).toContain('All matched directories');
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Navigate to Providers' }).props.onPress());
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  expect(r.root.findAllByType('SettingsSwitch' as never)).toHaveLength(2);
});
it('saves and restores language, period and the per-page origin preference', async () => {
  setup(); let r = await render(Dashboard, props(false, false));
  mocks.saveView.mockImplementation(async values => { mocks.view = values as ViewPreferences; return true; });
  await act(async () => r.root.findByProps({ accessibilityLabel: '7 days' }).props.onPress());
  expect(mocks.view.days).toBe(7);
  expect(r.root.findAllByProps({ label: 'Language' })).toHaveLength(0);
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Navigate to Providers' }).props.onPress());
  await act(async () => r.root.findByProps({ label: 'Language' }).props.onValueChange('de'));
  r = await render(Dashboard, props(false, false));
  expect(r.root.findByProps({ accessibilityLabel: '7 Tage' }).props.accessibilityState.selected).toBe(true);
  expect(JSON.stringify(r.toJSON())).toContain('Deine Coaching-Übersicht');
  expect(JSON.stringify(r.toJSON())).toContain('MENSCHLICHE PROMPTS');
  const origin = r.root.findByProps({ label: 'Herkunft der Sessions' });
  expect(origin.props.value).toBe('human');
  await act(async () => origin.props.onValueChange('all'));
  expect(mocks.view.origins.dashboard).toBe('all');
  expect(mocks.view.origins['anti-patterns']).toBe('human');
});

it('migrates saved workspace choices to their projects while preserving other preferences', async () => {
  setup(); mocks.view.workspaceIds = ['w1', 'w2']; mocks.view.days = 7;
  await render(Dashboard, props(false, false));
  expect(mocks.saveView).toHaveBeenCalledWith({ ...mocks.view, projectIds: ['p1'], workspaceIds: [] }, 'r1');
});

it.each([[false, false], [true, true]])('reverses the evidence drill-down step by step with its scroll position (%s,%s)', async (compact, dark) => {
  setup(); const overview = new OverviewAccumulator({ adapterId: 'opencode-v2', sourceId: 'db', to: Date.now() }).snapshot();
  overview.status = 'complete'; overview.matched = overview.analyzed = 1;
  overview.insights = [{ rule: 'verification-gap', title: 'Verify after editing', advice: 'Run checks', affectedSessions: 1, percentage: 100,
    earlierPercentage: null, laterPercentage: null, changePoints: null, examples: [{ sessionId: 's', title: 'Fixture session' }] }];
  mocks.overview.mockResolvedValue(overview);
  const r = await render(Dashboard, props(compact, dark));
  const content = () => r.root.findByProps({ accessibilityLabel: 'Coach content' });
  await act(async () => content().props.onScroll({ nativeEvent: { contentOffset: { y: 240 } } }));
  await act(async () => r.root.findByProps({ accessibilityLabel: 'View All Anti-Patterns' }).props.onPress());
  await act(async () => content().props.onContentSizeChange(1000, 2000));
  await act(async () => content().props.onScroll({ nativeEvent: { contentOffset: { y: 650 } } }));
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Open evidence: Fixture session' }).props.onPress());
  expect(r.root.findAllByProps({ accessibilityRole: 'link' }).map(n => n.props.accessibilityLabel)).toEqual(['Return to Dashboard', 'Return to Anti-Patterns']);
  const calls = mocks.analyze.mock.calls.length;
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Return to Anti-Patterns' }).props.onPress());
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  await vi.waitFor(async () => {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    expect(JSON.stringify(r.toJSON())).toContain('Ranked by affected sessions.');
  });
  expect(mocks.scrollTo).toHaveBeenLastCalledWith({ y: 650, animated: false });
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Return to Dashboard' }).props.onPress());
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  expect(JSON.stringify(r.toJSON())).toContain('Your coaching overview');
  expect(mocks.scrollTo).toHaveBeenLastCalledWith({ y: 240, animated: false });
  expect(r.root.findAllByProps({ accessibilityRole: 'link' })).toHaveLength(0);
  expect(mocks.analyze.mock.calls.length).toBe(calls);
});
it('restores the patterns tab and paginated session list when returning from details', async () => {
  setup(); mocks.history.mockImplementation(async (q: { offset: number }) => ({ sessions: [summary], hasMore: q.offset < 10, total: 11, totalSessions: 11, offset: q.offset })); const r = await render(Dashboard, props(false, false));
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Navigate to Patterns' }).props.onPress());
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Calendar' }).props.onPress());
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Navigate to Timeline' }).props.onPress());
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Next' }).props.onPress());
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Analyze Fixture session' }).props.onPress());
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Return to Timeline' }).props.onPress());
  expect(mocks.history).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 5 }));
  expect(r.root.findAllByProps({ accessibilityLabel: 'Return to Session details' })).toHaveLength(0);
  expect(r.root.findAllByProps({ accessibilityRole: 'link' })).toHaveLength(0);
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Navigate to Patterns' }).props.onPress());
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  expect(JSON.stringify(r.toJSON())).toContain('Calendar Activity');
  expect(r.root.findByProps({ accessibilityLabel: 'Calendar' }).props.accessibilityState.selected).toBe(true);
});

it('lets a breadcrumb skip directly to an earlier visit and discards the abandoned branch', async () => {
  setup(); const r = await render(Dashboard, props(false, false));
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Browse individual sessions' }).props.onPress());
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Analyze Fixture session' }).props.onPress());
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Return to Dashboard' }).props.onPress());
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  expect(JSON.stringify(r.toJSON())).toContain('Your coaching overview');
  expect(r.root.findAllByProps({ accessibilityRole: 'link' })).toHaveLength(0);
  await act(async () => r.root.findByProps({ accessibilityLabel: 'View All Anti-Patterns' }).props.onPress());
  expect(r.root.findAllByProps({ accessibilityRole: 'link' }).map(n => n.props.accessibilityLabel)).toEqual(['Return to Dashboard']);
});

it.each([[false, false], [true, true]])('resets breadcrumbs on section navigation instead of collecting browsing history (%s,%s)', async (compact, dark) => {
  setup(); mocks.history.mockResolvedValue({ sessions: [summary, { ...summary, id: 's2', title: 'Second session' }], hasMore: false, total: 1, totalSessions: 1, offset: 0 });
  const r = await render(Dashboard, props(compact, dark));
  const links = () => r.root.findAllByProps({ accessibilityRole: 'link' }).map(n => n.props.accessibilityLabel);
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Browse individual sessions' }).props.onPress());
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Analyze Fixture session' }).props.onPress());
  await act(async () => r.root.findByProps({ label: 'Selected session' }).props.onValueChange('s2'));
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Analyze Second session' }).props.onPress());
  expect(links()).toEqual(['Return to Dashboard', 'Return to Timeline']);
  for (const section of ['Output', 'Patterns', 'Anti-Patterns', 'Anti-Patterns']) {
    await act(async () => r.root.findByProps({ accessibilityLabel: `Navigate to ${section}` }).props.onPress());
    expect(links()).toEqual([]);
  }
});

it('shows one shared track per workspace with separate session selectors', async () => {
  setup(); mocks.history.mockResolvedValue({ sessions: [
    { ...summary, id: 'a', workspaceId: 'w1', projectName: 'Project', workspaceName: 'One' },
    { ...summary, id: 'b', workspaceId: 'w1', projectName: 'Project', workspaceName: 'One' },
    { ...summary, id: 'c', directory: '/other', workspaceId: 'w2', projectName: 'Project', workspaceName: 'Two' },
  ], hasMore: false, total: 1, totalSessions: 1, offset: 0 });
  const r = await render(Dashboard, props(false, false));
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Browse individual sessions' }).props.onPress());
  await vi.waitFor(async () => {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    expect(r.root.findAllByProps({ accessibilityLabel: 'Session activity track' })).toHaveLength(2);
  });
  expect(r.root.findAllByType('Text' as never).filter(n => n.props.accessibilityLabel === 'Session count: 2')).toHaveLength(1);
  expect(r.root.findAllByType('Text' as never).filter(n => n.props.accessibilityLabel === 'Session count: 1')).toHaveLength(1);
  const one = r.root.findByProps({ title: 'Project · One' });
  const two = r.root.findByProps({ title: 'Project · Two' });
  expect(one.findAllByProps({ accessibilityLabel: 'Session activity track' })).toHaveLength(1);
  expect(two.findAllByProps({ accessibilityLabel: 'Session activity track' })).toHaveLength(1);
  expect(one.findAllByType('Text' as never).filter(n => n.props.accessibilityLabel === 'Session count: 2')).toHaveLength(1);
  const selectors = r.root.findAllByProps({ label: 'Selected session' });
  expect(selectors.map(s => s.props.options.map((o: { value: string }) => o.value))).toEqual([['a', 'b'], ['c']]);
});
it('navigates numbered workspace pages, shows real totals and saves the page size', async () => {
  setup(); mocks.history.mockImplementation(async (q: { offset: number }) => ({ sessions: [summary], hasMore: q.offset < 10, total: 12, totalSessions: 90, offset: q.offset }));
  const r = await render(Dashboard, props(false, false));
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Browse individual sessions' }).props.onPress());
  await vi.waitFor(async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); }); expect(r.root.findByProps({ accessibilityLabel: 'Page 1', accessibilityRole: 'button' }).props.accessibilityState.disabled).toBe(false); });
  expect(JSON.stringify(r.toJSON())).toContain('1–5 of 12 workspaces');
  expect(r.root.findByProps({ accessibilityLabel: 'Previous' }).props.accessibilityState.disabled).toBe(true);
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Page 3', accessibilityRole: 'button' }).props.onPress());
  await vi.waitFor(async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); }); expect(r.root.findByProps({ accessibilityLabel: 'Page 3', accessibilityRole: 'button' }).props.accessibilityState.disabled).toBe(false); });
  expect(mocks.history).toHaveBeenLastCalledWith(expect.objectContaining({ groupBy: 'workspace', limit: 5, offset: 10 }));
  expect(JSON.stringify(r.toJSON())).toContain('11–12 of 12 workspaces');
  expect(r.root.findByProps({ accessibilityLabel: 'Next' }).props.accessibilityState.disabled).toBe(true);
  await act(async () => r.root.findByProps({ label: 'Workspaces per page' }).props.onValueChange('10'));
  expect(mocks.saveView).toHaveBeenLastCalledWith({ ...mocks.view, historyPageSize: 10 }, 'r1');
});
