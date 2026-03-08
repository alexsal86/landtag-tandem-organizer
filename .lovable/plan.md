
## Code-Qualität — Status

### Erledigt

- **strictNullChecks: true** — aktiviert, alle Build-Fehler behoben
- **noImplicitAny: true** — aktiviert, alle Build-Fehler behoben
- **DOMPurify** als zentraler HTML-Sanitizer — alle `dangerouslySetInnerHTML` nutzen jetzt `sanitizeRichHtml()`
- **Tenant-Access Guard** für Edge Functions — existiert in `supabase/functions/_shared/tenant-access.ts`

### Noch offen

1. **`strict: true` aktivieren** — beinhaltet `strictBindCallApply`, `strictFunctionTypes`, `strictPropertyInitialization`, `noImplicitThis`, `alwaysStrict`
2. **Lint-Regeln verschärfen** — `no-unused-vars` auf `warn` setzen, tote Importe entfernen; dann `no-explicit-any` schrittweise einführen
3. **Edge Functions `verify_jwt`-Audit** — ~20 Functions mit `verify_jwt = false` klassifizieren und absichern
4. **CORS einschränken** — `Access-Control-Allow-Origin: *` durch Allowlist ersetzen für sensible Operationen
