# Contributing a language pack

The Coach stores a host-scoped language selection independently of Paseo's app language. English and German ship initially. Language changes do not invalidate session analysis or call any model.

1. Copy `client/locales/en.json` to a new catalog, for example `fr.json`.
2. Translate the JSON values. Keep source keys unchanged: they are the English message identifiers.
3. Preserve every `{v0}`, `{v1}`, etc. placeholder exactly, including its spelling and count. Values inserted into templates, such as session titles, are data and remain literal. Preserve brand names, paths, identifiers, and UTC labels where appropriate.
4. Import the catalog in `client/locales/index.ts` and add `{ code: 'fr', name: 'Français', locale: 'fr-FR', messages: fr }` to `languagePacks`.
5. Run `npm run check`. Catalog tests validate key and placeholder parity. Try the compact and desktop UI with the new language, including provider settings, a progress state, errors, and a selected session.

`client/i18n.tsx` supplies the language context, template interpolation, an English fallback, and localized text rendering shared by all native pages. Host-owned controls receive translated labels via `useI18n().t()`. Numeric KPI formatting uses the registered locale. User-owned titles, model IDs, paths and workspace names use verbatim rendering where applicable.

New UI messages must be added to the English and German catalogs. A few numeric/UTC-only templates intentionally retain their spelling. Unknown user values are rendered as supplied; an unregistered saved language falls back to English. The runtime does not download translation files or call a translation service.
