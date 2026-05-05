## Schritt 1: Drei neue Selbsttest-Szenarien

### A) Brief-Lifecycle (`scenarios/letter-lifecycle.ts`)
Schritte:
1. **Brief anlegen** in `letters` mit `status='draft'`, Marker im Titel/Subject, `created_by=ctx.userId`, `tenant_id`, `content` und `content_html` mit Marker.
2. **Anhang ergänzen** in `letter_attachments` (`file_name`, `file_path` unter `${userId}/selftest/...`, `file_type='application/pdf'`).
3. **Empfänger setzen** via Update auf `letters` (`recipient_name`, `recipient_address`).
4. **Workflow: zur Prüfung einreichen** – Update `status='review'`, `submitted_for_review_at=now()`, `submitted_for_review_by=userId`, `submitted_to_user=userId`.
5. **Genehmigen** – Update `status='approved'`, `approved_at=now()`, `approved_by=userId`.
6. **Verknüpfte Entscheidung** anlegen (`task_decisions`, ohne `task_id`) mit `case_item_id=null`, Marker, `created_by=userId`. Optional: Self-Participant via `task_decision_participants`. Step ist `critical:false`.
7. **Senden** – Update `status='sent'`, `sent_at`, `sent_by`, `sent_method='email'`, `sent_date=heute`.
8. **Verifikation** – Read-Back: status='sent', Anhang vorhanden, recipient gesetzt.
9. **Archivieren** (Status bleibt 'sent'; in DB kein zusätzliches Archiv-Flag nötig).

### B) Vorgangs-Lifecycle (`scenarios/case-item-lifecycle.ts`)
Tabelle: `case_items` (Enums: status `neu|in_klaerung|antwort_ausstehend|erledigt|archiviert`, source_channel `phone|email|social|in_person|other`, priority `low|medium|high|urgent`).

Wichtige Constraint: Bei `status='erledigt'` muss `completion_note` (nicht leer) UND `completed_at` gesetzt sein.

Schritte:
1. **Vorgang anlegen** mit `subject` (mit Marker), `summary` mit Marker, `source_channel='email'`, `status='neu'`, `priority='medium'`, `user_id`, `tenant_id`, `contains_personal_data=false`, `pending_for_jour_fixe=false`, `visible_to_all=false`.
2. **Interaktion loggen** in `case_item_interactions` (`case_item_id`, `tenant_id`, `interaction_type='note'` (oder anderer gültiger Enum-Wert; wird per Read aus Schema bestimmt – falls Enum unbekannt, `direction='in'`, `summary` mit Marker, `created_by`, `visibility='internal'` (oder gültig)).
   - Da Enums `interaction_type` und `visibility` USER-DEFINED sind, lese ich vor Implementation die gültigen Labels via `pg_enum` aus und nutze konkrete Werte.
3. **Status-Wechsel** auf `in_klaerung`.
4. **Folge-Status** auf `antwort_ausstehend` mit `follow_up_at=now()+1d`.
5. **Entscheidung anhängen**: `task_decisions` mit `case_item_id=ctx.data.caseItemId`. Critical false.
6. **Vorgang abschließen**: Update `status='erledigt'`, `completion_note='[SELFTEST] erledigt'`, `completed_at=now()`, `resolution_summary` mit Marker.
7. **Verifikation**: Read zurück; Interaktion-Anzahl ≥1, Status erledigt, completion_note nicht null.

### C) Entscheidungs-Lifecycle (`scenarios/decision-lifecycle.ts`)
Tabellen: `task_decisions`, `task_decision_participants`.

Schritte:
1. **Entscheidung anlegen** in `task_decisions` mit `title` (Marker), `description` (Marker), `status='active'`, `created_by=userId`, `tenant_id`, `visible_to_all=false`, `priority=1`, `response_deadline=now()+3d`. (kein `task_id` notwendig – nullable.)
2. **Teilnehmer (sich selbst) hinzufügen** in `task_decision_participants` (`decision_id`, `user_id`, default token wird gesetzt).
3. **Antwort-Optionen prüfen**: Read `response_options` → erwarte default JSON mit drei Keys (yes/no/question).
4. **Status `open`** setzen (Wert ist im CHECK-Constraint erlaubt: `active|open|archived`).
5. **Auto-Archiv simulieren**: Update `status='archived'`, `archived_at=now()`, `archived_by=userId`.
6. **Verifikation**: Read-Back.

### Cleanup-Anpassung in `runner.ts`
- `CLEANUP_ORDER` erweitern (Reihenfolge Kind→Eltern):
  `task_decision_participants → task_decisions → case_item_interactions → case_items → letter_attachments → letters → tasks → meeting_agenda_documents → meeting_agenda_items → meeting_participants → appointments → meetings`.
- `purgeAllSelftestData` um folgende Tabellen ergänzen (mit korrektem `hasTenant`-Flag):
  - `letters` (Spalte `title`, hasTenant=true)
  - `letter_attachments` (Spalte `file_name`, hasTenant=false)
  - `case_items` (Spalte `subject`, hasTenant=true)
  - `case_item_interactions` (Spalte `summary`, hasTenant=true)
  - `task_decisions` (Spalte `title`, hasTenant=true)

### Registry
`src/features/selftest/registry.ts` um die drei neuen Szenarien ergänzen.

---

## Schritt 2: Coverage-Manifest + CI-Check

### Manifest pro Szenario
Erweiterung von `TestScenario` in `src/features/selftest/types.ts` um:
```ts
touches: string[];        // Tabellen, die das Szenario berührt
features: string[];       // Domänen-Tags wie "letters", "case-items", "meetings"
```
Alle bestehenden und neuen Szenarien füllen das Feld:
- meeting-lifecycle: `["meetings","meeting_agenda_items","meeting_agenda_documents","meeting_participants","appointments","tasks"]`
- task-lifecycle: `["tasks"]`
- letter-lifecycle: `["letters","letter_attachments","task_decisions"]`
- case-item-lifecycle: `["case_items","case_item_interactions","task_decisions"]`
- decision-lifecycle: `["task_decisions","task_decision_participants"]`

### Allowlist für „nicht zu testende" Tabellen
Neue Datei `src/features/selftest/coverage-config.ts`:
- `IGNORED_TABLES`: Konfig/Lookup-Tabellen, RLS-Helper, Audit, Push-Subscriptions, Migrations etc. – werden nicht in der Coverage gefordert.
- Begründung als Kommentar pro Eintrag.

### CI-Check-Script
Neue Datei `scripts/check-selftest-coverage.mjs`:
- Liest `IGNORED_TABLES` und alle Szenario-Dateien per Regex-Scan über `touches:` Arrays (kein TS-Compile nötig, läuft mit Node/`fs`).
- Holt alle Tabellen aus `public` über die Supabase REST-Introspection. Wenn `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` nicht gesetzt sind, fällt das Script auf eine eingecheckte Snapshot-Datei `src/features/selftest/__schema-snapshot__/public-tables.json` zurück.
- Snapshot-Datei wird einmalig generiert und als Quelle der Wahrheit für CI verwendet (driftet erst, wenn Migrationen sie aktualisieren).
- Output: Markdown-Tabelle „Tabelle → abgedeckt von Szenario X / FEHLT". Exit-Code 1, wenn ungetestete und nicht-ignorierte Tabellen existieren.

### NPM-Skript
`package.json` um Eintrag erweitern:
```
"check:selftest-coverage": "node scripts/check-selftest-coverage.mjs"
```

### Living Doc
`scripts/check-selftest-coverage.mjs` schreibt zusätzlich `docs/selftest-coverage.md` mit der aktuellen Tabelle (Feature → Szenario → Tabellen) – das Doc wird eingecheckt.

### UI-Hinweis
`SelftestView.tsx` erhält pro Szenario einen kleinen Tag-Bereich, der `features` als Badge anzeigt – damit der Nutzer im UI sieht, welche Domäne abgedeckt ist.

### Memory-Eintrag
Neue `mem://selftest/coverage-policy`: „Jedes neue Workflow-Feature braucht ein Selbsttest-Szenario in `src/features/selftest/scenarios/` mit `touches`-Manifest. CI-Check `scripts/check-selftest-coverage.mjs` blockiert bei Lücken." Im Index unter „Memories" referenzieren.

---

## Betroffene/Neue Dateien

Neu:
- `src/features/selftest/scenarios/letter-lifecycle.ts`
- `src/features/selftest/scenarios/case-item-lifecycle.ts`
- `src/features/selftest/scenarios/decision-lifecycle.ts`
- `src/features/selftest/coverage-config.ts`
- `src/features/selftest/__schema-snapshot__/public-tables.json`
- `scripts/check-selftest-coverage.mjs`
- `docs/selftest-coverage.md` (auto-generiert, eingecheckt)
- `mem://selftest/coverage-policy`

Bearbeitet:
- `src/features/selftest/types.ts` – `touches` und `features` ergänzen
- `src/features/selftest/runner.ts` – CLEANUP_ORDER + Purge-Tabellen erweitern
- `src/features/selftest/registry.ts` – neue Szenarien registrieren
- `src/features/selftest/scenarios/meeting-lifecycle.ts` + `task-lifecycle.ts` – `touches`/`features` ergänzen
- `src/features/selftest/components/SelftestView.tsx` – Feature-Tags anzeigen
- `package.json` – neues npm-Skript
- `mem://index.md` – neuen Memory-Eintrag verlinken

## Bewusst ausgeklammert (für später)
- Schema-Fingerprint-Hash (Punkt 3 aus dem vorigen Vorschlag) – kann sauber als zweiter CI-Check nachgezogen werden, sobald die Coverage-Logik produktiv ist.
- Tatsächlicher CI-Workflow (`.github/workflows/...`) – wird nach Approval ergänzt, falls gewünscht; das Skript ist aber sofort manuell ausführbar.
