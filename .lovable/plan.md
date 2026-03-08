
## Code-Qualität — Status

### Erledigt

- **strictNullChecks: true** — aktiviert, alle Build-Fehler behoben
- **noImplicitAny: true** — aktiviert, alle Build-Fehler behoben
- **DOMPurify** als zentraler HTML-Sanitizer — alle `dangerouslySetInnerHTML` nutzen jetzt `sanitizeRichHtml()`
- **Tenant-Access Guard** für Edge Functions — existiert in `supabase/functions/_shared/tenant-access.ts`
- **ESLint `no-unused-vars: warn`** — aktiviert mit `argsIgnorePattern: '^_'`, erste Bereinigungsrunde in Pages/Hooks abgeschlossen

### Noch offen

1. **`strict: true` aktivieren** — beinhaltet `strictBindCallApply`, `strictFunctionTypes`, `strictPropertyInitialization`, `noImplicitThis`, `alwaysStrict`
2. **Tote Imports weiter bereinigen** — ~65 standalone `React`-Imports in Components prüfen, weitere lucide-Icons und ungenutzte Variablen entfernen (ESLint-Regel zeigt Warnungen)
3. **`no-explicit-any` schrittweise einführen** — nach Abschluss der `no-unused-vars`-Bereinigung
4. **Edge Functions `verify_jwt`-Audit** — ~20 Functions mit `verify_jwt = false` klassifizieren und absichern
5. **CORS einschränken** — `Access-Control-Allow-Origin: *` durch Allowlist ersetzen für sensible Operationen
