
## Code-Qualität — Status

### Erledigt

- **strictNullChecks: true** — aktiviert, alle Build-Fehler behoben
- **noImplicitAny: true** — aktiviert, alle Build-Fehler behoben
- **DOMPurify** als zentraler HTML-Sanitizer — alle `dangerouslySetInnerHTML` nutzen jetzt `sanitizeRichHtml()`
- **Tenant-Access Guard** für Edge Functions — existiert in `supabase/functions/_shared/tenant-access.ts`
- **ESLint `no-unused-vars: warn`** — aktiviert mit `argsIgnorePattern: '^_'`, erste Bereinigungsrunde in Pages/Hooks abgeschlossen
- **Standalone `React`-Imports entfernt** — ~60 Dateien bereinigt
- **State-Mutation fix** — `existingContacts.push()` → immutables Update in `useContactImport.ts`
- **Non-null Assertion Guards** — `user!.id` / `currentTenant!.id` durch Early-Return-Guards ersetzt (~11 Dateien)
- **Leere catch-Blöcke** — kritische Stellen in MatrixContext & DaySlipStore mit `debugConsole.warn` versehen
- **JSON-Protocol Speaker-Normalisierung** — `speaker: string | { name }` korrekt normalisiert

### Noch offen

1. **`strict: true` aktivieren** — beinhaltet `strictBindCallApply`, `strictFunctionTypes`, `strictPropertyInitialization`, `noImplicitThis`, `alwaysStrict`
2. **Tote Imports weiter bereinigen** — ~65 standalone `React`-Imports in Components prüfen, weitere lucide-Icons und ungenutzte Variablen entfernen (ESLint-Regel zeigt Warnungen)
3. **`no-explicit-any` schrittweise einführen** — nach Abschluss der `no-unused-vars`-Bereinigung
4. **Edge Functions `verify_jwt`-Audit** — ~20 Functions mit `verify_jwt = false` klassifizieren und absichern
5. **CORS einschränken** — `Access-Control-Allow-Origin: *` durch Allowlist ersetzen für sensible Operationen

---

## No-Code Automations-Hub — Status

### Erledigt

- 4-Step Wizard (Grundlagen → Trigger → Bedingungen → Aktionen)
- 10 Templates, Template-Galerie mit Suche/Filter
- Kill-Switch, Dry-Run, Run-Now, Run-Historie mit Step-Logs
- Error-Dashboard mit Retry, Regel-Versionierung, Import/Export
- Rate Limiting, Idempotency, Audit-Trail
- 5 Action-Typen, 5 Condition-Operators, 4 Trigger-Typen (inkl. Webhook)
- Rollenbasierte Zugriffskontrolle
- **Regel duplizieren** — Copy-Button pro Regel-Karte
- **Nächste geplante Ausführung** — Badge für schedule-Regeln
- **Regel-Statistiken** — Erfolgsrate (%) + Ø Laufzeit als Tooltip-Badge
- **Notification-Kontext** — `rule_name`, `trigger_reason`, `run_id` in Notification-Payload
- **Webhook-Trigger** — neue Edge Function `automation-webhook`, Secret-Authentifizierung, URL-Anzeige im Wizard
- **Verschachtelte Condition-Gruppen** — rekursives AND/OR-Nesting bis 3 Ebenen im Wizard, backward-kompatible DB-Serialisierung
