import { createContext, useContext, type ReactNode, type ComponentProps } from 'react';
import { Text as NativeText } from 'react-native';
import { languagePacks } from './locales';
const LanguageContext = createContext('en');
export function I18nProvider({ language, children }: { language: string; children: ReactNode }) {
  return <LanguageContext.Provider value={language}>{children}</LanguageContext.Provider>;
}
function escape(text: string) { return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
export function translate(value: string, language: string): string {
  const pack = languagePacks.find(p => p.code === language) ?? languagePacks[0];
  if (pack.code === 'en') return value;
  const key = value.trim();
  const direct = pack.messages[key] ?? (key === key.toUpperCase() ? Object.entries(pack.messages).find(([source]) => source.toUpperCase() === key)?.[1].toUpperCase() : undefined);
  if (direct !== undefined) return value.replace(key, direct);
  // Catalog templates preserve dynamic counts and user-owned values as literal substitutions.
  for (const [source, target] of Object.entries(pack.messages)) {
    if (!source.includes('{')) continue;
    const names: string[] = [];
    const pattern = source.split(/(\{\w+\})/g).map(part => {
      if (/^\{\w+\}$/.test(part)) { names.push(part.slice(1, -1)); return '(.+?)'; }
      return escape(part);
    }).join('');
    const match = new RegExp('^' + pattern + '$').exec(key);
    if (match) return value.replace(key, target.replace(/\{(\w+)\}/g, (token, name: string) => match[names.indexOf(name) + 1] ?? token));
  }
  return value;
}
export function useI18n() {
  const language = useContext(LanguageContext);
  return { language, locale: languagePacks.find(p => p.code === language)?.locale ?? 'en', t: (value: string) => translate(value, language) };
}
export function Text({ children, verbatim = false, ...props }: ComponentProps<typeof NativeText> & { verbatim?: boolean }) {
  const { t } = useI18n();
  const localize = (child: ReactNode): ReactNode => typeof child === 'string' && !verbatim ? t(child) : Array.isArray(child) ? child.map(localize) : child;
  return <NativeText {...props}>{localize(children)}</NativeText>;
}
