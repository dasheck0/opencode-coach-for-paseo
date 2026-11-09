import { expect, it, vi } from 'vitest';
vi.mock('react-native', () => ({ Text: 'Text' }));
import { translate } from '../client/i18n';
import { languagePacks } from '../client/locales';
import { viewPreferences, defaultOrigins } from '../shared/preferences';
it('offers German/English catalogs with matching keys and safe English fallback', () => {
  expect(languagePacks.map(p => p.code)).toEqual(['en', 'de']);
  for (const pack of languagePacks) {
    expect(Object.keys(pack.messages).sort()).toEqual(Object.keys(languagePacks[0].messages).sort());
    for (const [key, value] of Object.entries(pack.messages)) expect((value.match(/\{\w+\}/g) ?? []).sort()).toEqual((key.match(/\{\w+\}/g) ?? []).sort());
  }
  expect(translate('Dashboard', 'de')).toBe('Übersicht'); expect(translate('7 days', 'de')).toBe('7 Tage');
  expect(translate('  All history ', 'de')).toBe('  Gesamter Zeitraum ');
  expect(translate('Your coaching overview', 'unknown')).toBe('Your coaching overview');
});
it('keeps dynamic session titles and numbers intact in translated templates', () => {
  expect(translate('Analyze My workspace', 'de')).toBe('Auswerten: My workspace');
  expect(translate('3 workspaces selected', 'de')).toBe('3 Workspaces ausgewählt');
});
it('defaults and persisted view choices include per-page origin, period, language and multi-selection', () => {
  const values = viewPreferences.schema.parse({}); expect(values.origins).toEqual(defaultOrigins); expect(values.language).toBe('de');
  expect(viewPreferences.schema.parse({ ...values, language: 'en', days: 7, workspaceIds: ['w1', 'w2'] })).toMatchObject({ language: 'en', days: 7, workspaceIds: ['w1', 'w2'] });
});
