
Ziel: Die Bereiche „Fallakte“ und „Team“ wieder zuverlässig öffnbar machen, indem die verbleibenden Supabase-Realtime-Kollisionen beseitigt und die „+ Neu“-Flows in „Meine Arbeit“ vollständig im Kontext gehalten werden.

1. Ursache klar eingrenzen
- Der aktuelle Fehler ist nicht mehr nur `navigation_visits_only`, sondern jetzt konkret `realtime:case-files-changes`.
- In der Codebasis gibt es noch mehrere Realtime-Abos mit statischen Channel-Namen. Das passt exakt zum bekannten Supabase/React-Strict-Mode-Problem: `supabase.channel("same-name")` liefert denselben Channel zurück, und beim nächsten Mount werden `.on(...).subscribe()` erneut auf einem bereits subscribten Channel ausgeführt.
- Das erklärt auch die Symptome:
  - Fallakte öffnet nicht: `useCaseFiles.tsx` verwendet noch `channel('case-files-changes')`
  - Team kann ebenfalls crashen, weil `MyWorkTeamTab` `TeamAnnouncementsManager` rendert und `useTeamAnnouncements.ts` noch `channel('team-announcements-changes')` nutzt

2. Konkrete Dateien anpassen
- `src/features/cases/files/hooks/useCaseFiles.tsx`
  - statischen Channel-Namen `case-files-changes` auf eindeutigen Namen umstellen
  - Muster analog zu den bereits gefixten Hooks:
    - `case-files-changes-${tenantId}-${userId}-${crypto.randomUUID()}`
  - Cleanup beibehalten
- `src/hooks/useTeamAnnouncements.ts`
  - statischen Channel-Namen `team-announcements-changes` ebenfalls auf eindeutigen Namen umstellen
  - Filter/Callbacks unverändert lassen
- `src/features/cases/files/components/MyWorkCaseFilesTab.tsx`
  - Channel ist derzeit nur halb-dynamisch (`my-work-casefiles-${user.id}`); auch dieser sollte pro Mount eindeutig werden
  - zusätzlich Tenant in den Namen aufnehmen
- Danach gezielt weitere statische Postgres-Realtime-Abos härten, damit der nächste Bereich nicht direkt wieder ausfällt:
  - `src/hooks/useCounts.tsx`
  - `src/components/dashboard/AppointmentFeedbackWidget.tsx`
  - `src/components/meetings/PendingJourFixeNotes.tsx`
  - `src/components/knowledge/hooks/useKnowledgeData.ts`

3. Einheitliches Robustheitsmuster anwenden
- Für alle betroffenen Hooks dasselbe Muster nutzen:
  - eindeutiger `channelName`
  - alle `.on(...)` vor `.subscribe()`
  - sauberes `removeChannel(channel)` im Cleanup
  - Debounce/Refresh-Logik unverändert lassen
- Optional zur Stabilität:
  - bei `subscribe((status) => ...)` auf `SUBSCRIBED` einmal aktiv nachladen, falls Daten zwischen Initial-Load und Kanalaufbau geändert wurden

4. „+ Neu“ in „Meine Arbeit“ vervollständigen
- Der Kontext soll laut Wunsch vollständig in „Meine Arbeit“ bleiben.
- Bereits geprüft: Aufgaben und Jour Fixe laufen schon inline.
- Noch offen ist „Akte erstellen“:
  - `src/features/cases/files/components/MyWorkCaseFilesTab.tsx` navigiert bei `action=create-casefile` noch nach `/casefiles?action=create`
- Umsetzung:
  - in `MyWorkCaseFilesTab` eine Inline-Erstellung für neue Akten ergänzen
  - den `action=create-casefile` Parameter lokal im Tab verarbeiten, statt per `navigate(...)` die Ansicht zu verlassen
- Zusätzlich prüfen:
  - ob „Anliegen erstellen“ im Cases-Workspace bereits inline startet; falls nicht, denselben Kontext-Ansatz dort ebenfalls anwenden

5. Erwartetes Ergebnis
- Fallakten öffnen wieder ohne Blank Screen
- Team-Tab öffnet wieder stabil, inklusive Team-Mitteilungen
- Weitere Bereiche brechen nicht mehr an derselben Realtime-Ursache weg
- „+ Neu“ bleibt vollständig in „Meine Arbeit“, ohne Sprung auf andere Seiten

Technische Details
- Wahrscheinliche Root Cause:
  - statische Supabase-Realtime-Channel-Namen in React 18/Strict Mode
- Bereits bestätigte Problemstellen im Code:
  - `useCaseFiles.tsx` → `channel('case-files-changes')`
  - `useTeamAnnouncements.ts` → `channel('team-announcements-changes')`
- Bereits erfolgreiche Gegenbeispiele im Projekt:
  - `useNavigationNotifications.tsx`
  - `useMyWorkTeamData.ts`
- Implementierungsprinzip:
  ```text
  const channelName = `feature-${tenantId}-${userId}-${crypto.randomUUID()}`
  const channel = supabase
    .channel(channelName)
    .on(...)
    .subscribe()
  return () => supabase.removeChannel(channel)
  ```

Abgrenzung
- Es sieht aktuell nicht nach einem Routing-Problem des Team-Tabs aus.
- Der sichtbare Fehler spricht klar für Realtime-Kanal-Kollisionen als primäre Ursache der nicht öffnenden Bereiche.
- Ich würde daher zuerst die Realtime-Abos systematisch bereinigen und danach erst tiefer in Tab-/Routing-Logik gehen, falls noch etwas übrig bleibt.
