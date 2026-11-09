import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Text, useI18n } from './i18n';
import type { PluginSurfaceProps } from '@getpaseo/plugin/client';
export type Surface = Pick<PluginSurfaceProps, 'theme' | 'layout'>;
export function Panel({ theme, title, children, action, onAction, verbatimTitle, trailing, raised }: Surface & { title: string; children: ReactNode; action?: string; onAction?: () => void; verbatimTitle?: boolean; trailing?: ReactNode; raised?: boolean }) {
  const c = theme.colors; const { t, locale } = useI18n();
  return <View style={{ zIndex: raised ? 20 : 0, borderWidth: 1, borderColor: c.border, borderRadius: 8, backgroundColor: c.surface1, padding: 18, gap: 14 }}>
    <View style={{ zIndex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}><Text verbatim={verbatimTitle} accessibilityRole="header" style={{ color: c.foreground, fontSize: 15, fontWeight: '600' }}>{title}</Text>
      {trailing}
      {action && onAction && <Pressable accessibilityRole="button" accessibilityLabel={t(action)} onPress={onAction}><Text style={{ color: c.accent, fontSize: 12 }}>{action} →</Text></Pressable>}
    </View>{children}
  </View>;
}
export function Stat({ theme, label, value, hint }: Surface & { label: string; value: string | number; hint?: string }) {
  const c = theme.colors; const { t, locale } = useI18n();
  return <View style={{ flexGrow: 1, flexBasis: 145, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface1, borderRadius: 8, padding: 16, gap: 5 }}>
    <Text style={{ color: c.foregroundMuted, fontSize: 11, letterSpacing: 0.6 }}>{label.toUpperCase()}</Text>
    <Text style={{ color: c.foreground, fontSize: 28, fontWeight: '700' }}>{typeof value === 'number' ? value.toLocaleString(locale) : value}</Text>
    {hint && <Text style={{ color: c.foregroundMuted, fontSize: 11 }}>{hint}</Text>}
  </View>;
}
export function Action({ theme, label, onPress, selected, disabled, accessibilityLabel }: Surface & { label: string; onPress: () => void; selected?: boolean; disabled?: boolean; accessibilityLabel?: string }) {
  const c = theme.colors; const { t, locale } = useI18n();
  return <Pressable accessibilityRole="button" accessibilityLabel={t(accessibilityLabel ?? label)} accessibilityState={{ selected: !!selected, disabled: !!disabled }} disabled={disabled} onPress={onPress}
    style={{ padding: 9, paddingHorizontal: 12, borderWidth: 1, borderColor: selected ? c.accent : c.border, borderRadius: 6, backgroundColor: c.surface2, opacity: disabled ? 0.45 : 1 }}>
    <Text style={{ color: selected ? c.accent : c.foreground, fontSize: 12 }}>{label}</Text>
  </Pressable>;
}
