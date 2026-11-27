# Audit-Schreibpfad: Prüfung und Grenzen

Stand: 2026-11-28 · Migrationen `supabase/migrations/20261128110000_audit_writepath_security_events.sql`
und `supabase/migrations/20261128120000_audit_gdpr_request_events.sql`

Diese Seite beschreibt, wie der Audit-Schreibpfad geprüft wird und was die Prüfung
**nicht** abdeckt. Der Anlass war ein Befund am Security-Cockpit: Die Aktion lag nur
in `payload->>'action'`, mehrere Schreibpfade setzten keine `tenant_id`, und
DSGVO-Freigaben sowie verweigerte Zugriffe hinterließen kein Ereignis.

## Was die Migration ändert

- `audit_log_entries.action` ist eine eigene Spalte (`NOT NULL`, `DEFAULT 'unknown'`,
  Format-CHECK `NOT VALID`, Index `(tenant_id, action, created_at DESC)`); Bestands-
  zeilen werden aus `payload->>'action'` nachgezogen.
- `audit_entry_default_action()` füllt `action` beim Insert aus dem Payload, damit
  ältere Aufrufer unverändert funktionieren.
- `log_audit_event()` (generischer Tabellen-Trigger) schreibt `action` und liest
  `tenant_id` über `to_jsonb(NEW/OLD)` aus der Zeile.
- `audit_user_role_changes()` schreibt eine Zeile je aktivem Büro der betroffenen
  Person; ohne Mitgliedschaft bleibt `tenant_id` NULL.
- `approve_gdpr_delete()` protokolliert `security.gdpr.delete_approved` nach
  erfolgreicher Statusänderung (Freigabelogik unverändert, weiter Invoker-Recht).
- `audit_gdpr_request_changes()` protokolliert **Anlegen**
  (`security.gdpr.request_created`, `ON INSERT`) und **Zurückziehen**
  (`security.gdpr.request_withdrawn`, `ON DELETE`) eines Antrags mit Büro und
  Urheber – ohne E-Mail, Name oder Kontaktbezug. Diese beiden Ereignisse fehlten
  zuvor, obwohl die Filtergruppe „DSGVO-Löschanträge“ sie versprach.
- `record_audit_entry(_action, _tenant_id, _payload)` ist der einzige Client-
  Schreibpfad für Sicherheitsereignisse: nur `security.*`, nur eigenes Büro (oder
  Superadmin), Urheber immer der Aufrufer, Details ≤ 4 KB.
- `audit_request_ip()` liest die Client-IP aus den PostgREST-Kopfzeilen und bleibt
  ohne Kopfzeilen leer, statt das Ereignis zu verhindern.

Schreibpfade außerhalb der Datenbank: `log-audit-event` (setzt `action` und löst
`tenant_id` über `resolveTenantMembership` auf), `log-auth-failure` (fehlgeschlagene
Anmeldungen vor der Sitzung, `verify_jwt = false`), `gdpr-process` (Abschluss von
Export/Löschung), `manage-tenant-user` sowie `src/integrations/supabase/securityEventFetch.ts`
für beobachtete `42501`-Ablehnungen.

## Anzeige im Security-Cockpit

Der Reiter „Audit-Trail“ zeigt die Ereignisart als eigene Spalte und filtert über
`src/components/administration/auditSecurityFilter.ts` nach vier Gruppen: DSGVO,
Rollen/Rechte, fehlgeschlagene Anmeldungen und verweigerte Zugriffe (plus „Sicherheit“
als Summe). Die DSGVO-Gruppe heißt „DSGVO-Anträge: angelegt, zurückgezogen,
freigegeben, ausgeführt“ und enthält genau diese fünf Aktionen:
`security.gdpr.request_created`, `…request_withdrawn`, `…delete_approved`,
`…delete_completed`, `…export_completed`.

Der Filter wird als `action`-Bedingung an die Datenbank gegeben und wirkt damit
**vor** dem Limit von 100 Zeilen – sonst fände er nur, was zufällig unter den zuletzt
geladenen Einträgen liegt. Die Zuordnung ist eine feste Liste; eine neue Aktion muss
dort ergänzt werden, sonst erscheint sie nur unter „Alle“.

## Prüfweg

```bash
npm ci --prefix tests/database      # PGlite, gepinnt in tests/database/package.json
node scripts/test-audit-writepath.mjs
npm --prefix tests/database test    # alle PGlite-Prüfungen, inklusive dieser
```

`@electric-sql/pglite` ist **nicht** im Wurzel-`package.json` deklariert. Es steht als
`devDependency` in `tests/database/package.json` (Version `0.5.15`) und wird – wie in
allen PGlite-Skripten dieses Repos – über den Pfad
`tests/database/node_modules/@electric-sql/pglite/dist/index.js` importiert. Fehlt der
Ordner, bricht `scripts/test-audit-writepath.mjs` mit Exitcode 2 und dem Installations-
hinweis ab. Ohne Installation im Repo funktioniert der Lauf über
`PGLITE_MODULE_PATH=/pfad/.../dist/index.js`. Als Alternative ohne Repo-Installation
ist das Muster aus `docs/quick-notes/offline-and-security.md` dokumentiert.

Der Harness baut ein Minimalumfeld (Rollen `anon`/`authenticated`/`service_role`,
`auth.uid()`/`auth.role()` als GUC-Stubs, `is_superadmin()`-Stub, nur die berührten
Tabellen), führt die Migration **zweimal** aus und prüft danach: Backfill/Default/
Index, Formatgrenze, `record_audit_entry` (Büro, Urheber, Aktionsart, Größe,
Payload-Überschreibung), Rollen-Trigger je Büro, DSGVO-Freigabe samt Ereignis und
Abweisung einer unbekannten Anfrage, generischer Trigger und den IP-Helfer.

## Nicht abgedeckt

1. **Vier-Augen-Trigger.** `gdpr_check_four_eyes()` und `guard_gdpr_request_subject()`
   werden nicht geladen. Der Harness belegt den Statuswechsel und das Ereignis, aber
   nicht, dass eine Selbstfreigabe weiterhin abgewiesen wird und dann **kein** Ereignis
   entsteht. Die Regel selbst prüfen `scripts/test-gdpr-personal-approval.sql` und
   `scripts/test-gdpr-subject-rule.mjs`; die Kombination „Freigabe + Audit-Ereignis"
   gegen den echten Trigger prüft derzeit nichts.
2. **RLS.** Die Policies auf `audit_log_entries` (Superadmin sieht alles,
   Büro-Admins nur `tenant_id = ANY(get_user_tenant_ids(...))`) laufen nicht mit: Der
   Harness arbeitet als Superuser ohne Rollentrennung. Ungeprüft ist damit
   insbesondere, dass die neue Spalte und der Index die Sichtbarkeit nicht verändern
   und dass `tenant_id IS NULL` für Büro-Admins unsichtbar bleibt (das betrifft die
   Pre-Auth-Ereignisse aus `log-auth-failure`).
3. **Grants.** `REVOKE`/`GRANT` werden ausgeführt, weil die Rollen existieren; ihre
   Wirkung ist nicht geprüft. Offen ist damit die zentrale Zusicherung, dass
   `authenticated` **nicht** direkt in `audit_log_entries` schreiben darf (nur über
   `record_audit_entry`) und `anon`/`service_role` die Funktion nicht ausführen dürfen.
   Das braucht `SET ROLE` in einem erweiterten Harness oder eine echte Instanz
   (`supabase db reset` plus RLS-Prüfung).
4. **Echtes JWT und PostgREST.** `auth.uid()`/`auth.role()` sind GUC-Stubs, es gibt
   keine `request.headers`. Die IP-Ermittlung in `audit_request_ip()` ist deshalb nur
   im Leerfall geprüft, und die Mandantenauflösung von `log-audit-event` läuft nicht.
5. **Edge Functions und Client.** `log-auth-failure` (Ratelimits, Aktionsliste),
   `gdpr-process` (Abschlussereignisse) und `securityEventFetch.ts` (Drosselung,
   Meldung nur bei aktivem Büro) sind nicht Teil dieses Harness; für
   `securityEventFetch.ts` gibt es `src/integrations/supabase/securityEventFetch.test.ts`.
6. **Betrieb.** Keine Aussage zu Nebenläufigkeit, Laufzeit von Backfill und
   Indexanlage auf großen Tabellen, Aufbewahrung/Anonymisierung (existiert weiterhin
   nicht) und zur Speichergröße durch `to_jsonb(NEW/OLD)` im generischen Trigger.

Die Grenzen 1–3 sind der Grund, warum eine grüne Ausgabe dieses Skripts **kein**
Nachweis für Mandantentrennung oder Berechtigungswirkung ist – nur für die
Schreiblogik der Funktionen.
