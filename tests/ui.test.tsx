import { afterEach, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const mocks = vi.hoisted(() => ({
  save: vi.fn(async () => true), values: { disabled: [] as string[], hidden: [] as string[], selected: 'opencode-v2', paths: {} },
  catalog: vi.fn(), history: vi.fn(), analyze: vi.fn(), overview: vi.fn(),
}));
vi.mock('react-native', () => ({ View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', TextInput: 'TextInput' }));
vi.mock('@getpaseo/plugin/client', () => ({
  useRpc: (contract: { name: string }) => contract.name === 'coach.catalog' ? mocks.catalog : contract.name === 'coach.history' ? mocks.history : contract.name === 'coach.overview' ? mocks.overview : mocks.analyze,
  useSettings: () => ({ status: 'ready', values: mocks.values, revision: 'r1', saving: false, saveError: null, save: mocks.save, reload: vi.fn(), reset: vi.fn() }),
}));
vi.mock('@getpaseo/plugin/client/ui', () => Object.fromEntries(['SettingsAction','SettingsCard','SettingsInput','SettingsSection','SettingsSwitch'].map(n => [n, n])));
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
  await act(async () => { r = create(createElement(QueryClientProvider, { client }, createElement(Component, p))); }); mounted.push(r);
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  return r;
}
function setup(error = false) {
  mocks.catalog.mockResolvedValue({ adapters: [{ id: 'opencode-v2', title: 'OpenCode V2', description: 'Fixture adapter', enabled: true, hidden: false,
    sources: error ? [] : [{ id: 'db', path: '/fixture.db', label: 'Fixture', format: 'v2' }], error: error ? 'Fixture source unavailable' : null }] });
  const acc = new OverviewAccumulator({ adapterId: 'opencode-v2', sourceId: 'db', to: Date.now() });
  acc.discover([summary]); acc.start([summary]); acc.result.status = 'complete';
  mocks.overview.mockResolvedValue(acc.snapshot());
  mocks.history.mockResolvedValue({ sessions: [summary], hasMore: false });
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
  expect(mocks.analyze).toHaveBeenCalledWith({ adapterId: 'opencode-v2', sourceId: 'db', sessionId: 's' });
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
  expect(mocks.analyze).toHaveBeenCalledWith({ adapterId: 'opencode-v2', sourceId: 'db', sessionId: 's' });
});
it('waits for a workspace filter to be applied instead of launching a job on each keystroke', async () => {
  setup(); const r = await render(Dashboard, props(false, false));
  const count = mocks.overview.mock.calls.length;
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Filter by exact workspace directory' }).props.onChangeText('/fixture'));
  expect(mocks.overview).toHaveBeenCalledTimes(count);
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Apply workspace filter' }).props.onPress());
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  expect(mocks.overview.mock.calls.at(-1)?.[0]).toMatchObject({ directory: '/fixture' });
});
it.each([[false, false], [true, true]])('keeps shared filters and analysis while navigating native coach pages (%s,%s)', async (compact, dark) => {
  setup(); const r = await render(Dashboard, props(compact, dark));
  const overviewCalls = mocks.overview.mock.calls.length;
  for (const [page, content] of [['Output', 'Model Usage'], ['Patterns', 'Sessions by Day and Hour'], ['Context Health', 'Session Context Signals'], ['Anti-Patterns', 'Ranked by affected sessions.']] as const) {
    await act(async () => r.root.findByProps({ accessibilityLabel: `Navigate to ${page}` }).props.onPress());
    expect(JSON.stringify(r.toJSON())).toContain(content);
    expect(r.root.findAllByProps({ accessibilityLabel: 'Filter by exact workspace directory' })).toHaveLength(1);
    for (const node of r.root.findAllByType('Text' as never)) expect(node.props.style.color).toBeTruthy();
  }
  expect(mocks.overview).toHaveBeenCalledTimes(overviewCalls);
  expect(mocks.analyze).not.toHaveBeenCalled();
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Navigate to Patterns' }).props.onPress());
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Calendar' }).props.onPress());
  expect(JSON.stringify(r.toJSON())).toContain('Calendar Activity');
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Projects' }).props.onPress());
  expect(JSON.stringify(r.toJSON())).toContain('All matched directories');
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Navigate to Providers' }).props.onPress());
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  expect(r.root.findAllByType('SettingsSwitch' as never)).toHaveLength(2);
});
