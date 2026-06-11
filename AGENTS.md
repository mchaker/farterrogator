# AGENTS.md — Guidance for AI Agents Working in This Repo

**Farterrogator** is a client-side React SPA that interrogates images to produce Danbooru-style tags (and artist style matches). It talks to tagger backends (gpu.garden or a local service on port 8000) and is deployed on Cloudflare Pages. Read `README.md` for the product overview and backend setup; this file covers how to write code that fits the project.

## Tech stack

- **React 19 + TypeScript + Vite 6** — SPA, no router, no server-side rendering.
- **Tailwind CSS 4** (via `@tailwindcss/postcss`) — utility classes only, no CSS modules. `index.css` is the single stylesheet.
- **Konsta UI** (`konsta/react`) for app shell primitives, **lucide-react** for icons.
- **i18next + react-i18next + i18next-browser-languagedetector** for i18n (see below).
- **pnpm** is the package manager. CI builds with `--frozen-lockfile`: any `package.json` change must be accompanied by a matching `pnpm-lock.yaml` update.

There is no test runner or linter configured. Verify changes with `pnpm build` (type-checks via Vite) and `pnpm dev` (port 3000).

## Repository structure

```
App.tsx                  Root component: all app state, interrogation flow, settings persistence
index.tsx                Entry point; imports ./i18n/config and wraps <App /> in <Suspense>
types.ts                 ALL shared types live here (Tag, TaggingSettings, BackendConfig, AppState, …)
components/              Presentational components, one per file, named exports (export const Foo: React.FC)
hooks/                   Custom hooks (useTheme)
services/                Pure logic / API clients, no React imports
  taggerService.ts         Tag generation, batch processing, backend requests
  kaloscopeService.ts      Artist style similarity matching
  pngMetadata.ts           "NAI Ready" PNG metadata embedding
i18n/
  config.ts                i18next init (custom dynamic-import backend, language detection)
  locales/*.json           One file per language; en.json is the source of truth
functions/               Cloudflare Pages Functions — CORS proxies that mirror the Vite dev proxies
                           (currently functions/interrogate/gpu-garden/[[path]].ts)
vite.config.ts           Dev/preview proxies, manualChunks, @ → repo-root alias
public/                  Static assets, including danbooru_tags.csv
```

Conventions to follow:

- **State lives in `App.tsx`** and is passed down via props. Don't introduce a state library or context unless asked.
- **Shared types go in `types.ts`**, not inline in components or services.
- **Services are framework-free**: plain async functions, no hooks, no JSX. Components never call `fetch` directly.
- **Persistence**: user settings are saved to `localStorage` (`taggingSettings`, `backendConfig`). When changing the shape of a persisted object, add a migration in the `useState` initializer like the existing `triggerPhrase → whitelist` migration in `App.tsx`.
- **Styling**: stone palette (`stone-100`/`stone-800` etc.) with red accents; every color utility needs a `dark:` counterpart. Match the existing class patterns rather than inventing new ones.
- **Backend routing**: requests go through path prefixes (`/interrogate/gpu-garden`, `/kaloscope`, `/tag`, …). Adding a new backend route means updating **three places**: `vite.config.ts` `server.proxy`, the duplicated `preview.proxy` block, and a Cloudflare Pages function in `functions/`.

## i18n — required practice

This app is fully internationalized into 12 languages. **Every user-visible string must go through i18next.** Hardcoded UI strings are a bug.

### Files and loading

- Locale files: `i18n/locales/{en,de,es,fr,hi,it,ja,ko,pt,ru,zh-CN,zh-TW}.json`.
- `en.json` is the canonical source of truth; `fallbackLng` is `en`.
- Locales are loaded lazily via a dynamic `import('./locales/${language}.json')` in `i18n/config.ts` (code splitting). **File names must exactly match the language codes** used by the detector and `LanguageSelector` (`zh-CN`, `zh-TW` keep their region suffix; all others are bare two-letter codes).
- Language detection order: querystring → cookie → localStorage → navigator → htmlTag. `App.tsx` syncs `document.documentElement.lang` on language change — don't duplicate that elsewhere.

### Key structure

Keys are nested by feature/screen, mirroring the component that uses them:

```
app.*       title, subtitle, copyright
common.*    shared strings (close, changeLanguage, …)
header.*    upload.*    results.*    status.*    settings.*    errors.*    info.*    theme.*
```

- Add new keys to the section matching the consuming component; create a new top-level section only for a genuinely new screen/feature.
- Use camelCase leaf keys (`troubleshootTagger`, `naiReady`).
- Never reuse one key for two different meanings just because the English happens to match — translations may diverge.

### The cardinal rule: key parity across all 12 locales

All locale files currently have **identical key sets** (95 keys each). Keep it that way:

1. Adding a string → add the key to `en.json` **and all 11 other locale files** in the same change, with real translations (not English copies, not machine-garbled placeholders — write the best native translation you can).
2. Removing/renaming a key → apply to all 12 files.
3. Before finishing any change that touches locales, verify parity, e.g.:
   ```bash
   python3 -c "
   import json,glob
   def keys(o,p=''):
       s=set()
       for k,v in o.items():
           s |= keys(v,p+k+'.') if isinstance(v,dict) else {p+k}
       return s
   en=keys(json.load(open('i18n/locales/en.json')))
   for f in sorted(glob.glob('i18n/locales/*.json')):
       d=keys(json.load(open(f)))
       assert d==en, (f, en-d, d-en)
   print('parity OK')
   "
   ```

### Using translations in components

- Use the `useTranslation` hook: `const { t } = useTranslation();` then `t('results.copyAll')`.
- **Interpolation** uses `{{var}}`: `t('app.copyright', { year })`. Placeholder names must be identical in every locale file — translators may reorder them but never rename them.
- **Inline markup** (e.g. `<strong>`) inside a translation must use the `<Trans>` component, never string concatenation or `dangerouslySetInnerHTML`:
  ```tsx
  <Trans i18nKey="info.description" components={{ strong: <strong /> }} />
  ```
  Keep the same tags present in every locale's version of the string. `<strong>` is the only tag currently used in locale files (the `info.*` keys); prefer keeping it that way.
- Never build sentences by concatenating `t()` fragments or embedding English words around a `t()` call — word order differs across languages. Put the whole sentence in one key and interpolate.
- Strings produced in non-component code (e.g. status/error messages flowing out of services) should be passed back as data and translated at the component layer, or selected from `errors.*` / `status.*` keys by the caller.

### What NOT to translate

- Brand and product names: **Farterrogator**, **NAI**, **NovelAI**, **GPU Garden** / `gpu.garden`, **Kaloscope**.
- Tagger model identifiers (`wd`, `pixai`, `camie`, `taggerine`) and Danbooru tags/categories as data — category *labels* shown in the UI come from `settings.categories.*` and ARE translated.
- URLs, endpoints, code, and file formats (PNG, JPG, WEBP, GIF).

### Adding a new language

1. Create `i18n/locales/<code>.json` as a full translation of `en.json` (every key).
2. Add an entry to the `languages` array in `components/LanguageSelector.tsx`. The first two entries (`en`, `es`) and the divider are pinned; entries below the divider are sorted alphabetically by the romanization of the endonym (see the existing comments).
3. If the code has a region suffix, check the `displayLang` logic in `LanguageSelector.tsx` (currently only `zh-*` keeps its suffix).
4. No config change needed — the dynamic-import backend picks the file up by name.

## Commit hygiene

- Match the existing concise commit style (see `git log`): one line, present tense, scoped to what changed.
- Keep diffs minimal; don't reformat untouched code.
