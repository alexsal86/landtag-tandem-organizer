## 1. Selbsttest unter Administration verlinken

In `src/components/administration/AdminSidebar.tsx`:
- In der Gruppe **„System & Sicherheit“** einen neuen Eintrag ergänzen:
  `{ id: "selftest", label: "Selbsttest", icon: ClipboardCheck }` (Icon ist bereits importiert).

In `src/pages/Administration.tsx`:
- `SelftestView` aus `@/features/selftest/components/SelftestView` importieren.
- Im Switch des Bereichs `security` einen neuen Case ergänzen:
  `case "selftest": return <SelftestView />;`

Dadurch erreichbar via `/administration?adminSection=security&adminSubSection=selftest`. Die bestehende eigenständige Route `/selbsttest` bleibt zusätzlich erhalten.

## 2. Bugfix Teilnehmer-Schritt

Ursache: `meeting_participants.status` ist per CHECK-Constraint auf `pending | confirmed | declined` beschränkt. Das Szenario nutzt aktuell `"accepted"` → Insert schlägt fehl.

Fix in `src/features/selftest/scenarios/meeting-lifecycle.ts`: `status: "accepted"` → `status: "confirmed"`.

## 3. Meeting-Lifecycle: Vollständige Funktionsabdeckung

Das Szenario wird so erweitert, dass alle realen Meeting-Bausteine getestet und am Ende sauber entfernt werden. Reihenfolge der Schritte:

1. **Meeting anlegen** (wie bisher).
2. **Verknüpften Termin** im Kalender erzeugen (wie bisher).
3. **Teilnehmer hinzufügen** (organizer, confirmed) – Bugfix oben.
4. **Reguläre Agenda-Punkte** (3 Stück, mit `order_index 0..2`).
5. **System-Agenda-Punkte** für jeden tatsächlich genutzten `system_type`:
   `birthdays`, `upcoming_appointments`, `quick_notes`, `tasks`, `case_items`, `decisions`. Jeweils `is_visible=true`, `is_optional=true`.
6. **Sub-Agenda-Punkt** mit `parent_id` auf Punkt 4.0 (Hierarchie-Test).
7. **Agenda-Dokument** in `meeting_agenda_documents` (file_path mit SELFTEST-Prefix, file_name, file_type='application/pdf') anhängen, um die Document-Verknüpfung abzudecken.
8. **Aufgabe** anlegen und mit dem Sub-Agenda-Punkt verknüpfen (`meeting_agenda_items.task_id` setzen).
9. **Agenda-Punkt abschließen** (`is_completed=true`, `result_text` setzen, `notes` setzen).
10. **Carry-Over markieren** (`carry_over_to_next=true`, `carryover_notes` setzen) – simuliert Übertrag in nächstes Jour fixe.
11. **Wiederkehrendes Folge-Meeting** anlegen mit `parent_meeting_id` & `is_recurring_instance=true`, dann den Carry-Over-Punkt als neues Agenda-Item mit `carried_over_from`, `original_meeting_date`, `original_meeting_title` in das Folge-Meeting kopieren.
12. **Verifikationsschritt**: Per Select prüfen, dass je `system_type` mindestens 1 Eintrag existiert, dass das Folge-Meeting den Carry-Over enthält, dass der Termin verknüpft ist und dass die Aufgabe verknüpft ist.
13. **Aufgabe abschließen** (`status='completed'`).
14. **Meeting archivieren** (`status='archived'`) und ebenso das Folge-Meeting.

### Cleanup-Erweiterung

`src/features/selftest/runner.ts`:
- `CLEANUP_ORDER` um `"meeting_agenda_documents"` (vor `meeting_agenda_items`) ergänzen.
- `purgeAllSelftestData` zusätzlich um `meeting_agenda_documents` (Spalte `file_name`) erweitern, damit der Notfall-Purge auch Dokumente erfasst.
- Beim Anlegen aller Records-IDs in `ctx.created` registrieren – Aufräumreihenfolge stellt sicher, dass Kindtabellen vor Eltern gelöscht werden. Da Cascade-Deletes auf `meeting_id` und `parent_id` gesetzt sind, bleibt das Aufräumen robust selbst wenn ein Schritt ausfällt.

### Robustheit

- Jeder Insert prüft Fehler und gibt eine sprechende Meldung zurück.
- Sub-Item- und Document-Schritte sind `critical: false`, damit ein Einzelfehler den restlichen Lauf nicht abbricht, der Cleanup aber dennoch alle bereits angelegten IDs erfasst.
- Verifikation vergleicht `expected vs actual counts` und liefert ein Detail-Objekt für die UI.

### Geltungsbereich (was NICHT im DB-Test abgedeckt wird)

- UI-Interaktionen (Dialoge, Drag&Drop) – das Test-Center bleibt datenorientiert.
- Externe Edge-Functions wie E-Mail-Versand und ICS-Generierung – würden echten Versand erzeugen; bewusst ausgespart, kann später als separates Szenario mit Dry-Run-Flag ergänzt werden.

## Betroffene Dateien

- edit `src/components/administration/AdminSidebar.tsx`
- edit `src/pages/Administration.tsx`
- edit `src/features/selftest/scenarios/meeting-lifecycle.ts`
- edit `src/features/selftest/runner.ts`
