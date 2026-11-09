import { View } from 'react-native';
import { SettingsSelect } from '@getpaseo/plugin/client/ui';
import { Text, useI18n } from './i18n';
import { Action, type Surface } from './ui';
export function pageNumbers(current: number, total: number, radius = 2): (number | 'gap')[] {
  const shown = new Set(total <= 7 ? Array.from({ length: total }, (_, i) => i + 1) : [1, total, ...Array.from({ length: radius * 2 + 1 }, (_, i) => current - radius + i).filter(n => n > 0 && n <= total)]);
  const result: (number | 'gap')[] = []; let previous = 0;
  for (const n of [...shown].sort((a, b) => a - b)) { if (previous && n - previous > 1) result.push('gap'); result.push(n); previous = n; }
  return result;
}
export function Pagination({ offset, total, pageSize, onOffset, onPageSize, loading, ...surface }: Surface & {
  offset: number; total: number; pageSize: number; onOffset: (offset: number) => void; onPageSize: (size: number) => void; loading?: boolean;
}) {
  const { t } = useI18n(), pages = Math.max(1, Math.ceil(total / pageSize)), current = Math.min(pages, Math.floor(offset / pageSize) + 1);
  return <View style={{ gap: 10 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
      <Action {...surface} label="First" disabled={loading || current === 1} onPress={() => onOffset(0)} />
      <Action {...surface} label="Previous" disabled={loading || current === 1} onPress={() => onOffset((current - 2) * pageSize)} />
      {pageNumbers(current, pages, surface.layout.compact ? 1 : 2).map((n, i) => n === 'gap' ? <Text key={`gap${i}`} style={{ color: surface.theme.colors.foregroundMuted }}>…</Text> : <Action key={n} {...surface} label={String(n)} accessibilityLabel={`${t('Page')} ${n}`} selected={n === current} disabled={loading || !total} onPress={() => onOffset((n - 1) * pageSize)} />)}
      <Action {...surface} label="Next" disabled={loading || current === pages} onPress={() => onOffset(current * pageSize)} />
      <Action {...surface} label="Last" disabled={loading || current === pages} onPress={() => onOffset((pages - 1) * pageSize)} />
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <Text style={{ color: surface.theme.colors.foregroundMuted, fontSize: 12 }}>{`${total ? (current - 1) * pageSize + 1 : 0}–${Math.min(current * pageSize, total)} of ${total} workspaces`}</Text>
      <View style={{ minWidth: 200 }}><SettingsSelect label={t('Workspaces per page')} value={String(pageSize)} disabled={loading} options={[5, 10, 25].map(n => ({ label: String(n), value: String(n) }))} onValueChange={size => onPageSize(Number(size))} /></View>
    </View>
  </View>;
}
