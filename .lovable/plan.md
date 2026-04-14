
Ziel: Die leere Ansicht in "Meine Arbeit → Entscheidungen" gezielt beheben. Nach Sichtung des Codes ist die wahrscheinlichste Ursache nicht mehr der Type-Shim, sondern die neue Datenquelle selbst.

1. Wahrscheinliche Root Cause beheben
- `MyWorkDecisionsTab` lädt Daten ausschließlich über `useMyWorkDecisionsData`.
- Dieser Hook nutzt nur noch das RPC `get_my_work_decisions`.
- Das alte Laden in `useDecisionOverviewData` hatte zusätzlich eine Sichtbarkeit über `tasks.assigned_to`.
- Das neue RPC berücksichtigt aktuell nur:
  - Ersteller
  - explizite Teilnehmer
  - `visible_to_all`
- Dadurch verschwinden task-gebundene Entscheidungen für Nutzer, die über die Aufgabenzuweisung Zugriff hatten, aber nicht als Teilnehmer eingetragen sind.

2. RPC und Frontend angleichen
- `get_my_work_decisions` erweitern, damit auch Entscheidungen für zugewiesene Aufgaben zurückkommen, wie es der alte Code gemacht hat.
- Dabei die bestehende Logik aus `useDecisionOverviewData` als Referenz verwenden, damit "Meine Arbeit" und die alte Entscheidungen-Ansicht dieselben Zugriffsregeln haben.
- Falls nötig zusätzlich `task_id` bzw. aufgabenbezogene Infos im RPC mitgeben, damit die UI später dieselbe Filterlogik sauber anwenden kann.

3. Robuste ID-/Sichtbarkeitsprüfung machen
- Prüfen und korrigieren, ob `created_by` und Teilnehmer-IDs überall mit demselben Identitätsmodell verglichen werden.
- Falls die Daten inzwischen teils auf Profil-IDs und teils auf `auth.users.id` basieren, die Vergleiche im Hook/RPC vereinheitlichen.
- Dabei besonders `isCreator`, `isParticipant`, `hasResponded` und `pendingCount` absichern.

4. Leere Liste besser absichern
- Wenn das RPC fehlschlägt oder wegen RLS leer bleibt, soll die UI nicht stillschweigend nur "keine Entscheidungen" zeigen.
- Stattdessen eine sichtbare Fehler-/Hinweisbehandlung für den Datenladefall ergänzen, damit echte Ladeprobleme von einer wirklich leeren Liste unterscheidbar sind.

5. Datenbank-/RLS-Check
- Die bestehende RLS auf `task_decisions`, `task_decision_participants`, `profiles` gegen das neue RPC prüfen.
- Falls das RPC zusätzliche Tabellenpfade nutzt, die durch RLS eingeschränkt sind, gezielt anpassen statt die Policies allgemein zu öffnen.
- Besonders wichtig: tenant-basierte Sichtbarkeit und `visible_to_all` innerhalb desselben Tenants beibehalten.

6. Verifikation
- Nach Umsetzung gezielt testen mit mindestens diesen Fällen:
  - Nutzer ist Ersteller
  - Nutzer ist Teilnehmer
  - Nutzer sieht öffentliche Entscheidung
  - Nutzer sieht Entscheidung nur über zugewiesene Aufgabe
  - Nutzer ohne Zugriff sieht die Entscheidung nicht
- Zusätzlich prüfen, dass im Tab nicht mehr nur der Leerzustand erscheint.

Technische Notizen
- Betroffene Hauptdateien:
  - `src/hooks/useMyWorkDecisionsData.ts`
  - `supabase/migrations/20260413120000_get_my_work_decisions_rpc.sql`
  - ggf. `src/components/my-work/MyWorkDecisionsTab.tsx`
- Stärkster Hinweis aus dem Code: Der alte Loader filtert explizit über `tasks.assigned_to`, das neue RPC aber nicht.
- Ihr aktuelles Symptom "Leere Liste" passt exakt zu so einem Sichtbarkeitsverlust ohne Runtime-Fehler.
