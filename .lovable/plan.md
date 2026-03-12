
Ziel: Die beiden offenen Bugs stabil beheben, ohne Nebenwirkungen auf andere MyWork-Tabs.

1) Befund aus dem aktuellen Stand
- Jour-Fixe-Flackern betrifft den Bereich „Entscheidungen“ in `MyWorkJourFixeTab` + `useMyWorkJourFixeSystemData`.
- Team-Tab baut die Mitarbeiterliste derzeit über `user_roles` auf; das ist fragil (RLS/fehlende Rollenzeilen) und kann zu leerer Liste führen, obwohl aktive Mitgliedschaften existieren.
- In der DB sind Rollen bereits in `user_tenant_memberships.role` vorhanden (tenant-spezifisch) und sollten hier die Primärquelle sein.

2) Fix-Plan Jour Fixe (Flackern „Entscheidungen“)
- Datei: `src/components/my-work/MyWorkJourFixeTab.tsx`
  - `loadAgendaForMeeting` stabilisieren:
    - In-Flight-Guard pro `meetingId` (Ref/Set), damit dieselbe Agenda/Systemdaten nicht mehrfach parallel geladen werden.
    - „Schon geladen“-Prüfung auf stabilem Ref statt render-zeitabhängigem State-Snapshot.
    - `loadAgendaForMeeting` als `useCallback`, damit Handler stabil und race-resistenter sind.
- Datei: `src/hooks/useMyWorkJourFixeSystemData.ts`
  - Entscheidungen-Abfrage deterministischer machen:
    - bestehende Meeting-Daten nicht auf `[]` zurücksetzen, wenn ein temporärer Fehler/kurzer Leerlauf auftritt.
    - pro Meeting nur dann überschreiben, wenn eine valide Antwort vorliegt.
  - Optional (wenn weiterhin nötig): Query auf meeting-nahe Entscheidungen fokussieren (`meeting_id`/Jour-Fixe-relevante Flag-Logik), damit keine „springenden“ globalen Ergebnislisten entstehen.
- Ergebnis: kein „zeigen → verschwinden → neu laden“-Verhalten mehr beim gleichen geöffneten Meeting.

3) Fix-Plan Team-Tab (fehlende Mitarbeiter)
- Datei: `src/components/my-work/MyWorkTeamTab.tsx`
  - Mitarbeiterquelle umstellen:
    - `user_tenant_memberships` mit `select("user_id, role")` als Primärquelle.
    - Filter für Teamliste direkt auf Membership-Rollen (`mitarbeiter`, `praktikant`, `bueroleitung`).
  - Adminsicht robust machen:
    - Teamzugriff aus der aktuellen Tenant-Mitgliedschaft ableiten (`abgeordneter`/`bueroleitung`) statt nur aus `user_roles`.
    - `userRole` für `MyWorkExpenseWidget` ebenfalls aus Membership-Rolle setzen (Fallback auf `user_roles` nur falls nötig).
  - Defensive Fehlerbehandlung:
    - bei Teilfehlern nicht komplette Liste verwerfen; vorhandene Profile/Mitglieder weiterhin rendern.

4) Technische Details (kompakt)
- Betroffene Dateien:
  - `src/components/my-work/MyWorkJourFixeTab.tsx`
  - `src/hooks/useMyWorkJourFixeSystemData.ts`
  - `src/components/my-work/MyWorkTeamTab.tsx`
- Kernprinzipien:
  - keine doppelten parallelen Loads pro Meeting
  - keine destruktiven State-Resets bei transienten Fetch-Problemen
  - tenant-spezifische Rollen aus Membership statt globaler Rollenabhängigkeit

5) Abnahme-Check
- Jour Fixe:
  - Meeting aufklappen, „Entscheidungen“ beobachten: keine zyklischen Leerzustände/Neuladevorgänge.
  - Mehrfaches schnelles Öffnen/Schließen: weiterhin stabil.
- Team:
  - Als `abgeordneter` und `bueroleitung` prüfen: Mitarbeiterliste lädt konsistent.
  - Mitglieder mit vorhandener Membership, aber ohne/abweichender `user_roles`-Zeile erscheinen trotzdem.
- Network-Kontrolle:
  - keine wiederholten Endlosschleifen auf denselben Jour-Fixe-Systemqueries.
