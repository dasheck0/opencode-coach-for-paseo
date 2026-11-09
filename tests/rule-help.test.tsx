import { expect, it, vi } from 'vitest';
import { act, create } from 'react-test-renderer';
import { createElement } from 'react';
vi.mock('react-native', () => ({ View: 'View', Text: 'Text', Pressable: 'Pressable' }));
import { RuleHelp, ruleHelp } from '../client/rule-help';
import { I18nProvider } from '../client/i18n';
import type { Surface } from '../client/ui';
it.each(['en', 'de'])('explains every warning rule and supports hover, focus and touch (%s)', async language => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  const surface = { theme: { colors: { foreground: '#111', foregroundMuted: '#555', surface0: '#fff', border: '#ccc', accent: '#080' } }, layout: { compact: true } } as Surface;
  for (const rule of Object.keys(ruleHelp)) {
    let r!: ReturnType<typeof create>;
    await act(async () => { r = create(createElement(I18nProvider, { language, children: createElement(RuleHelp, { ...surface, rule }) })); });
    const trigger = () => r.root.findAllByType('Pressable' as never)[0];
    expect(trigger().props.accessibilityState.expanded).toBe(false);
    await act(async () => trigger().props.onHoverIn());
    expect(JSON.stringify(r.toJSON())).toContain(language === 'de' ? 'Bedeutung und Erkennung' : 'Meaning and detection');
    await act(async () => r.root.findAllByType('View' as never)[0].props.onPointerLeave());
    expect(trigger().props.accessibilityState.expanded).toBe(false);
    await act(async () => trigger().props.onFocus());
    expect(trigger().props.accessibilityState.expanded).toBe(true);
    await act(async () => trigger().props.onBlur());
    await act(async () => trigger().props.onPress());
    await act(async () => r.root.findAllByType('View' as never)[0].props.onPointerLeave());
    expect(trigger().props.accessibilityState.expanded).toBe(true);
    await act(async () => r.root.findAllByType('Pressable' as never)[1].props.onPress());
    expect(trigger().props.accessibilityState.expanded).toBe(false);
    await act(async () => r.unmount());
  }
});
