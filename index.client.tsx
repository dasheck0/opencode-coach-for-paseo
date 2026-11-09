import type { PluginClientContext, PluginSidebarItemProps } from '@getpaseo/plugin/client';
import { SidebarRow } from '@getpaseo/plugin/client/ui';
import { Dashboard } from './client/dashboard';
import { CoachSettings } from './client/settings';
function CoachItem({ currentScreen, openScreen }: PluginSidebarItemProps) {
  return <SidebarRow icon="ChartNoAxesCombined" active={currentScreen?.screenId === 'coach'} onPress={() => openScreen({ screenId: 'coach' })} />;
}
export default function contribute(client: PluginClientContext) {
  client.addScreen({ id: 'coach', title: 'OpenCode Coach', Component: Dashboard });
  client.addSidebarHeaderItem({ id: 'coach', title: 'OpenCode Coach', Component: CoachItem });
  client.addSettingsScreen({ id: 'providers', title: 'Providers', icon: 'Settings', Component: CoachSettings });
  client.addCommandCenterItem({ id: 'open-coach', title: 'OpenCode Coach: Open history', icon: 'ChartNoAxesCombined',
    context: 'global', onSelect({ openScreen }) { openScreen({ screenId: 'coach' }); } });
  return () => {};
}
