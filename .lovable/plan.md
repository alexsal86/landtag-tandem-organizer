## Ziel

1. Den RLS-Fehler bei `case_items` im Selbsttest beheben — inkl. besserer Fehlerdiagnose.
2. Die Selbsttests so umbauen, dass sie nicht nur "Insert ging durch" prüfen, sondern alle eingetragenen Felder **nach dem Schreiben aus der DB lesen und Wert für Wert vergleichen** — damit z.B. Geburtstags-Systempunkte oder andere Felder nicht stillschweigend verloren gehen.

---

## Teil 1 — RLS bei `case_items`

### Befund

Die INSERT-Policy lautet:
```
WITH CHECK (tenant_id = ANY(get_user_tenant_ids(auth.uid())) AND user_id = auth.uid())
```
`get_user_tenant_ids` liefert nur Tenants mit `user_tenant_memberships.is_active = true`. Das Meeting-Insert hat dieselbe Tenant-Bedingung und funktioniert — also ist auth + Tenant-Membership grundsätzlich ok. Die zusätzliche Bedingung bei `case_items` ist `user_id = auth.uid()`. Häufigste Ursachen, dass das in der Praxis fehlschlägt:

- Die Session ist abgelaufen (auf der aktuellen Route `/auth` ist genau das der Fall) → `auth.uid()` ist `NULL`. Die Aktion wirkt erst beim nächsten Test wieder.
- Eine ältere Session wird zwar im Browser gehalten, aber der JWT ist nicht mehr gültig — Postgrest sieht keinen User.
- (Theoretisch) `useAuth().user.id` und `auth.uid()` driften, falls ein Impersonate-/Switch-Mechanismus verwendet wird.

### Maßnahmen

1. **Preflight-Step pro Szenario** (`runner.ts` / Szenario-Header):
   - `await supabase.auth.getSession()` → wenn keine Session: Abbruch mit klarer Meldung "Bitte erneut anmelden".
   - SELECT auf `user_tenant_memberships` mit `eq('user_id', userId).eq('tenant_id', tenantId).eq('is_active', true)` — abbrechen, falls leer ("Tenant-Membership nicht aktiv").
   - SELECT auf eine geschützte Funktion (`select auth.uid()` über RPC oder Vergleich mit `getUser()`), damit JWT-Drift sofort sichtbar wird.

2. **Bessere Fehlermeldung im Step**: bei `error.code === '42501'` (RLS) zusätzlich anhängen, welche Bedingung typischerweise greift (Tenant-ID, user_id, oder fehlende Auth).

3. **Defaults im Insert vereinheitlichen**: Felder, die DB-Defaults haben (z.B. `source_channel='other'`, `status='neu'`, `priority='medium'`, alle `false`-Booleans) werden weggelassen — das Szenario testet absichtlich die Defaults, nicht die Übergabe.

---

## Teil 2 — Echte Datenintegritäts-Verifikation

Heute prüfen die Szenarien überwiegend nur "Insert OK" und am Ende grobe Vorhandenseins-Counts. Geburtstage usw. werden zwar in `meeting_agenda_items.system_type` geschrieben — aber niemand schaut nach, **was** dort steht. Das ändern wir.

### Neues Hilfs-Modul `src/features/selftest/verify.ts`

```ts
expectFields<T>(actual: T, expected: Partial<T>, label: string): StepResult
```
- Liest pro Insert das gerade geschriebene Objekt zurück (`select('*').eq('id', …).single()`).
- Vergleicht jedes Feld aus `expected` mit dem DB-Wert — Mismatches werden mit Feldname + Wert in `details` gemeldet.
- Liefert ein `StepResult`, das wir am Ende jedes "Create"-Steps zurückgeben.

### Anwendung pro Szenario

- **meeting-lifecycle**:
  - Nach `add-system-agenda`: für jeden System-Typ (`birthdays`, `upcoming_appointments`, `quick_notes`, `tasks`, `case_items`, `decisions`) prüfen, dass `system_type`, `is_visible`, `is_optional`, `order_index`, `meeting_id`, `title`, `description` exakt zurückkommen.
  - Zusätzlich Verifikation, dass die Renderer-Helfer (`getSystemEntries` / `getSystemItemIcon`) den Typ kennen — Sicherheitsnetz gegen "Typ in DB, aber UI zeigt nichts".
  - Für Sub-Item zusätzlich `parent_id` und Hierarchie-Konsistenz prüfen.
  - Carry-Over: nach Anlegen des Folge-Meetings die Felder `carried_over_from`, `original_meeting_date`, `original_meeting_title` lesen und vergleichen.
  - Termin/Aufgabe/Dokument: alle gesetzten Felder zurücklesen.
- **case-item-lifecycle**, **letter-lifecycle**, **decision-lifecycle**, **task-lifecycle**: identisches Muster — jedes Insert/Update durchläuft `expectFields`.

### Strict-Coverage-Hinweis

Die `touches`/`features`-Manifeste werden um eine Liste der Felder ergänzt, die das Szenario aktiv setzt (`writes: { table: string; columns: string[] }[]`). Der bestehende Check-Script (`scripts/check-selftest-coverage.mjs`) bekommt eine zusätzliche Warnung, wenn eine Tabelle Spalten besitzt, die kein Szenario je schreibt (Hinweis auf untestete Felder — ohne Hard-Fail).

---

## Geplante Datei-Änderungen

```
src/features/selftest/runner.ts
  • runScenario: Preflight (Session + Membership) vor erstem Step
  • Fehler-Mapping für Postgrest-RLS-Codes

src/features/selftest/verify.ts                     (neu)
  • expectFields, expectRowExists Helfer

src/features/selftest/scenarios/meeting-lifecycle.ts
  • Field-by-Field Verifikation für alle Steps
  • Renderer-Sanity (SYSTEM_TYPES vs. utils.tsx Map)

src/features/selftest/scenarios/case-item-lifecycle.ts
src/features/selftest/scenarios/letter-lifecycle.ts
src/features/selftest/scenarios/decision-lifecycle.ts
src/features/selftest/scenarios/task-lifecycle.ts
  • Insert-Defaults reduzieren, expectFields nach jedem Schreibschritt

src/features/selftest/types.ts
  • TestScenario.writes?: { table; columns }[]

scripts/check-selftest-coverage.mjs
  • Spalten-Coverage-Warnung
```

Keine DB-Migration nötig — alle Erkenntnisse fließen in die Test-Schicht.

## Offene Frage

Ich kann die Renderer-Sanity (Schritt: System-Typen die im UI tatsächlich gerendert werden) optional auch als eigenständiges "UI-Drift"-Szenario umsetzen. Sage Bescheid, falls das gewünscht ist — sonst bleibt die Prüfung als Mini-Step im Meeting-Lifecycle.
