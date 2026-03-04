
Ziel: Rückmeldungs-Feed stabil sichtbar machen und gleichzeitig die aktuellen Build-Blocker entfernen, damit die Fixes überhaupt wieder ausgeliefert werden.

1) Diagnose (aus Code + DB)
- Do I know what the issue is? Ja.
- Es gibt aktuell 2 Ebenen von Problemen:
  1. Build ist kaputt (TypeScript):
     - `src/components/ui/calendar.tsx`: doppelte Keys im `classNames`-Objekt (`caption_label`, `dropdowns`, `dropdown`) → TS1117.
     - `src/components/task-decisions/DecisionOverview.tsx`: `ResponseOption`-Typ ohne `requires_comment` → TS2339.
  2. Feed-Logik ist instabil/zu restriktiv:
     - `src/components/my-work/MyWorkFeedbackFeedTab.tsx` übergibt `completedTo: new Date().toISOString()` bei jedem Render.
       Dadurch ändert sich der React-Query-Key permanent (`useTeamFeedbackFeed`), was zu dauerndem Neu-Laden bzw. instabilem Feed führt.
     - `useTeamFeedbackFeed` filtert hart auf `.not('notes','is',null)`. Damit verschwinden abgeschlossene Rückmeldungen ohne Notiz (z. B. nur Anhang/Aufgabe), obwohl sie fachlich oft relevant sind.
- DB-Check:
  - `appointment_feedback` hat Daten (u. a. completed in den letzten 7 Tagen vorhanden).
  - RLS auf `appointment_feedback` erlaubt tenant-basiertes Lesen (`tenant_id = ANY(get_user_tenant_ids(auth.uid()))`), also kein offensichtlicher RLS-Blocker für Team-Feed im Tenant.

2) Umsetzungsplan (in Reihenfolge)
A. Build sofort reparieren (Blocker)
- `calendar.tsx`: doppelte Objekt-Keys entfernen, nur eine konsistente Definition für `caption_label`, `dropdowns`, `dropdown` behalten.
- `DecisionOverview.tsx`: lokalen `ResponseOption`-Typ um `requires_comment?: boolean` ergänzen (oder auf den zentralen Typ aus `decisionTemplates` umstellen).

B. Feed-Query stabilisieren
- `MyWorkFeedbackFeedTab.tsx`:
  - `completedTo` nicht mehr bei jedem Render neu erzeugen.
  - Entweder:
    - `completedTo` ganz weglassen (nur `completedFrom` + order/limit), oder
    - `completedTo` per `useMemo/useState` nur bei Filterwechsel neu setzen.
- `useTeamFeedbackFeed.ts`:
  - Query-Key nur mit stabilen Filterwerten.
  - Zeitfilter robust halten (kein per-render Drift).

C. Sichtbarkeit der Rückmeldungen fachlich korrigieren
- `useTeamFeedbackFeed.ts`:
  - Notiz-Pflicht entfernen oder erweitern:
    - statt nur `notes is not null` auch Einträge mit `has_documents = true` oder `has_tasks = true` zulassen.
  - Ergebnis: auch „abgeschlossen ohne Notiz, aber mit Anhang/Aufgabe“ erscheint im Feed.

D. Fehler nicht mehr als „keine Daten“ maskieren
- `MyWorkFeedbackFeedTab.tsx`:
  - `isError` + `error` aus Query auslesen.
  - Bei Fehler einen klaren Error-State anzeigen (statt „Keine passenden Rückmeldungen gefunden“), inkl. Retry-Button (`refetch`).

E. Quercheck auf Seiteneffekte
- `useMyWorkNewCounts.tsx` zählt derzeit ebenfalls nur `completed + notes not null`; ggf. auf dieselbe fachliche Logik angleichen, damit Badge und Feed konsistent sind.

3) Validierung nach Umsetzung
- Build grün ohne TS-Fehler.
- Im Tab „Meine Arbeit > Rückmeldungen“:
  - Keine Endlos-Ladeanzeige.
  - Team-Einträge der letzten 7/14 Tage sichtbar.
  - Filter (Sicht/Zeitraum/Anhänge/Aufgaben) funktionieren.
  - Bei absichtlichem Query-Fehler erscheint Error-State statt Empty-State.
- Schneller Datenabgleich:
  - Feed-Anzahl grob konsistent mit SQL-Count für completed im Zeitraum (unter Berücksichtigung der Filter).

4) Warum das den aktuellen Zustand löst
- Solange Build fehlschlägt, werden vorherige Fixes teils nicht wirksam.
- Selbst bei laufendem Build kann der Feed durch den „beweglichen“ `completedTo`-Key instabil bleiben.
- Zusätzlich blendet der harte Notiz-Filter valide Rückmeldungen aus.
- Mit den vier Korrekturen (Build, stabiler Query-Key, fachlich korrekter Filter, echter Error-State) wird die Ursachekette vollständig geschlossen.
