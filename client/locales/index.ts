import en from './en.json';
import de from './de.json';
export interface LanguagePack { code: string; name: string; locale: string; messages: Record<string, string> }
// Add a catalog import and one registry entry to contribute another language.
export const languagePacks: LanguagePack[] = [
  { code: 'en', name: 'English', locale: 'en-GB', messages: en },
  { code: 'de', name: 'Deutsch', locale: 'de-DE', messages: de },
];
