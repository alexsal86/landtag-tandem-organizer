

# Status: Code-Qualitat -- Was steht noch aus?

`strictNullChecks` ist jetzt aktiv -- ein grosser Meilenstein. Hier ist eine Ubersicht der verbleibenden Qualitats-Baustellen, geordnet nach Prioritat.

---

## Erledigt (durch die letzten Iterationen)

- **strictNullChecks: true** -- aktiviert, alle Build-Fehler behoben
- **DOMPurify** als zentraler HTML-Sanitizer -- bereits eingefuhrt (`src/utils/htmlSanitizer.ts`), wird an den meisten Stellen genutzt
- **Tenant-Access Guard** fur Edge Functions -- existiert in `supabase/functions/_shared/tenant-access.ts`

---

## Noch offen

### 1. TypeScript weiter verscharfen (nachster logischer Schritt)

| Flag | Status | Aufwand |
|------|--------|---------|
| `strictNullChecks` | **done** | -- |
| `noImplicitAny` | **false** | mittel (~50-100 Dateien) |
| `strict` (beinhaltet alle) | **false** | gross, nach noImplicitAny |

**Plan:** `noImplicitAny: true` aktivieren -- gleiche Vorgehensweise wie bei strictNullChecks: schrittweise Dateien fixen, dann global einschalten.

### 2. Lint-Fehler systematisch abbauen

ESLint-Config existiert, aber mehrere wichtige Regeln sind deaktiviert:
- `@typescript-eslint/no-explicit-any: off`
- `@typescript-eslint/no-unused-vars: off`

**Plan:** Erst `no-unused-vars` auf `warn` setzen und tote Importe/Variablen entfernen. Dann `no-explicit-any` schrittweise einfuhren.

### 3. Sicherheit: Edge Functions mit `verify_jwt = false`

Aktuell haben **~20 Edge Functions** `verify_jwt = false` in `config.toml`. Einige sind berechtigt (Cron-Jobs, Webhooks), aber viele brauchen entweder:
- JWT-Validierung aktivieren, oder
- Einen alternativen Schutz (shared secret, Signatur-Prufung)

Betroffen u.a.: `yjs-collaboration`, `knowledge-collaboration`, `log-audit-event`, `manage-tenant-user`, `geocode-contact-address`

### 4. Sicherheit: 1 unsanitized `dangerouslySetInnerHTML`

`LetterEditorCanvas.tsx` (Zeile 441) rendert `renderedHtml` **ohne** `sanitizeRichHtml()`. Alle anderen 15 Stellen nutzen DOMPurify korrekt. Ausserdem nutzt `MyWorkCasesWorkspace.tsx` DOMPurify direkt statt der zentralen Utility -- sollte vereinheitlicht werden.

### 5. CORS: `Access-Control-Allow-Origin: *` einschranken

Laut Security Assessment verwenden viele Edge Functions `*` als Origin. Fur sensible Operationen sollte eine Allowlist eingefuhrt werden.

---

## Empfohlene Reihenfolge

1. **Quick-Fix (klein):** `LetterEditorCanvas` sanitizen + `MyWorkCasesWorkspace` auf zentrale Utility umstellen
2. **Mittel:** `noImplicitAny: true` aktivieren (gleiche Strategie wie strictNullChecks)
3. **Mittel:** Edge Functions `verify_jwt`-Inventar erstellen und absichern
4. **Laufend:** Lint-Regeln verscharten und toten Code entfernen

Welchen Block soll ich als nachstes angehen?

