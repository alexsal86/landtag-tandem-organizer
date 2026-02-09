
# Plan: 7 Korrekturen und Verbesserungen am Entscheidungssystem

## Uebersicht

| Nr | Problem | Root Cause | Loesung |
|----|---------|-----------|---------|
| 1 | Archivierung zeigt Fehler, funktioniert aber | CHECK-Constraint `task_decisions_status_check` erlaubt nur `active` und `archived`. Der Code setzt `status: 'archived'` korrekt, aber die RLS UPDATE-Policy hat `WITH CHECK (created_by = auth.uid())` -- redundante Policies erzeugen Konflikte, und `select()` nach Update ohne `.select('*')` kann leere Ergebnisse liefern, was als Fehler interpretiert wird | Redundante RLS UPDATE-Policies bereinigen, Fehlerbehandlung bei leerem Ergebnis verbessern |
| 2 | Wiederherstellen von Entscheidungen scheitert | `restoreDecision()` setzt `status: 'open'` -- aber der CHECK-Constraint erlaubt NUR `active` und `archived`. `open` ist kein gueltiger Status | Status auf `'active'` statt `'open'` setzen und CHECK-Constraint um `open` erweitern oder konsequent `active` verwenden |
| 3 | Bearbeiten zeigt Fehler beim Speichern | Drei redundante UPDATE-Policies auf `task_decisions`: zwei mit `WITH CHECK (created_by = auth.uid())`, eine ohne. Postgres evaluiert alle Policies mit OR fuer USING, aber WITH CHECK muss bei ALLEN Policies erfuellt sein, die matchen. Die `onUpdated`/`onClose` Callbacks im `DecisionEditDialog` werden innerhalb eines `setTimeout` aufgerufen, was Race Conditions erzeugen kann | RLS-Policies konsolidieren: nur EINE UPDATE-Policy behalten |
| 4 | Rueckfragen/Kommentare in der Card anzeigen | Aktuell werden Kommentare nur im Sheet und offene Rueckfragen nur fuer den Ersteller angezeigt | Kompakte Anzeige der letzten 1-2 Responses/Kommentare direkt in der Card |
| 5 | Antworten auf Rueckfragen/Kommentare scheitert | Die UPDATE-RLS-Policy auf `task_decision_responses` prueft nur ob der User der Teilnehmer oder Ersteller der *Entscheidung* ist. Der Ersteller muss die `creator_response`-Spalte updaten, was durch die Policy gedeckt sein sollte -- aber die redundanten Policies auf `task_decisions` (fuer den Sub-Select) und moegliche `WITH CHECK`-Konflikte blockieren den Zugriff | RLS-Policies bereinigen |
| 6 | Kommentare zur Abstimmung vs. Kommentare zur Sache unterscheiden | Zwei verschiedene Systeme: `task_decision_responses` (Abstimmung mit Kommentar) und `task_decision_comments` (Diskussion). Beide werden in der UI als "Kommentar" bezeichnet | Klare Bezeichnungen: "Abstimmungskommentar" vs. "Diskussionsbeitrag" einfuehren |
| 7 | Meine Notizen: Standard-Teilnehmer bei Entscheidungserstellung nicht vorausgewaehlt | `NoteDecisionCreator` liest Standard-Teilnehmer nicht aus `localStorage` -- stattdessen werden nur Abgeordnete auto-selektiert | `useDefaultDecisionParticipants` in `NoteDecisionCreator` integrieren |

---

## Technische Details

### 1 + 2 + 3 + 5: RLS-Policies bereinigen und CHECK-Constraint korrigieren (KRITISCH)

**Root Cause aller Fehler:** Es gibt drei redundante UPDATE-Policies auf `task_decisions`:

```
1. "Users can update their decisions"     - USING: tenant + created_by   WITH CHECK: (none)
2. "Users can update their own decisions" - USING: created_by            WITH CHECK: created_by = auth.uid()
3. "task_decisions_update_policy"          - USING: created_by            WITH CHECK: created_by = auth.uid()
```

Wenn Postgres mehrere Policies evaluiert, muessen ALLE `WITH CHECK`-Bedingungen der matchenden Policies erfuellt sein. Da Policy 1 kein `WITH CHECK` hat, aber Policy 2 und 3 schon, kann es zu Konflikten kommen je nach PostgreSQL-Version und Evaluierungsreihenfolge.

Zusaetzlich: Der CHECK-Constraint `task_decisions_status_check` erlaubt nur `active` und `archived`. Bei `restoreDecision()` wird `status: 'open'` gesetzt, was der Constraint ablehnt.

**Loesung via DB-Migration:**

```sql
-- 1. Redundante UPDATE-Policies entfernen
DROP POLICY IF EXISTS "Users can update their own decisions" ON public.task_decisions;
DROP POLICY IF EXISTS "task_decisions_update_policy" ON public.task_decisions;

-- 2. Verbleibende Policy beibehalten: "Users can update their decisions"
-- (hat tenant + created_by als USING, kein WITH CHECK)

-- 3. CHECK-Constraint anpassen: 'open' als gueltigen Status hinzufuegen
ALTER TABLE public.task_decisions DROP CONSTRAINT IF EXISTS task_decisions_status_check;
ALTER TABLE public.task_decisions ADD CONSTRAINT task_decisions_status_check
  CHECK (status = ANY (ARRAY['active', 'open', 'archived']));

-- 4. Redundante SELECT-Policies bereinigen
DROP POLICY IF EXISTS "task_decisions_select_policy" ON public.task_decisions;

-- 5. Redundante DELETE-Policies bereinigen
DROP POLICY IF EXISTS "task_decisions_delete_policy" ON public.task_decisions;
DROP POLICY IF EXISTS "Users can delete their own decisions" ON public.task_decisions;
```

**Code-Aenderungen:**

In `DecisionOverview.tsx` und `MyWorkDecisionsTab.tsx` - `restoreDecision()`:
- Status von `'open'` auf `'active'` aendern (konsistent mit dem Erstellungsprozess)

In `DecisionOverview.tsx` - `archiveDecision()`:
- Die redundante Pruefung auf leeres Ergebnis nach `.select()` entfernen oder vereinfachen
- Optimistic UI: Sofort aus der Liste entfernen, dann Server-Antwort abwarten

In `DecisionEditDialog.tsx`:
- `setTimeout`-Workaround entfernen, direkt `onUpdated()` und `onClose()` aufrufen

**Dateien:**
- DB-Migration (Policies + Constraint)
- `src/components/task-decisions/DecisionOverview.tsx`
- `src/components/my-work/MyWorkDecisionsTab.tsx`
- `src/components/task-decisions/DecisionEditDialog.tsx`

---

### 4: Rueckfragen und Kommentare direkt in der Card anzeigen

**Konzept:** Unter dem Footer der Entscheidungskarte werden bis zu 2 aktuelle Interaktionen kompakt angezeigt:
- Offene Rueckfragen (response_type = 'question', ohne creator_response)
- Letzte Abstimmungskommentare (responses mit Kommentar)
- Letzte Diskussionskommentare (task_decision_comments)

Das sieht so aus:

```text
+------------------------------------------+
| [Badge: Rueckfrage]           [Actions]   |
| Titel der Entscheidung                    |
| Beschreibung...                           |
| Creator | 01.02.26 | Y:2/Q:1/N:0 | AVA  |
|-------------------------------------------|
| Letzte Aktivitaet:                        |
| [orange] Erwin: "Was ist mit Budget?"     |
|          -> Antwort: "Wird noch geklaert" |
| [gruen]  Carla: Ja - "Gute Idee!"        |
+------------------------------------------+
```

**Implementierung:**
- In `DecisionOverview.tsx` (`renderCompactCard`): Nach dem Footer-Bereich einen neuen Abschnitt "Letzte Aktivitaet" einfuegen
- Zeige max. 2 Eintraege: Prioritaet auf offene Rueckfragen, dann letzte Kommentare
- Kompaktes Format: Avatar-Mini + Name + Typ-Icon + Kommentar (1 Zeile truncated)
- Wenn creator_response vorhanden: darunter eingerueckt anzeigen

In `MyWorkDecisionCard.tsx`: Gleiche Logik anwenden - die `participants`-Daten enthalten bereits die Responses.

**Dateien:**
- `src/components/task-decisions/DecisionOverview.tsx` (renderCompactCard erweitern)
- `src/components/my-work/decisions/MyWorkDecisionCard.tsx` (Card erweitern)

---

### 6: Kommentare zur Abstimmung vs. Diskussionsbeitraege unterscheiden

**Zwei Systeme im Ueberblick:**

| System | Tabelle | Zweck | Neue Bezeichnung |
|--------|---------|-------|-----------------|
| Abstimmungskommentar | `task_decision_responses.comment` | Begruendung der Abstimmung (z.B. "Ja, weil...") oder Rueckfrage | **"Begruendung"** oder **"Rueckfrage"** |
| Diskussionsbeitrag | `task_decision_comments` | Allgemeine Diskussion zur Entscheidung | **"Diskussion"** |

**UI-Aenderungen:**

In der Card und im Detail-Dialog:
- Abstimmungskommentare werden neben dem Vote-Badge angezeigt mit Label "Begruendung:" (fuer Ja/Nein) oder "Rueckfrage:" (fuer question)
- Das Kommentar-Icon und Sheet-Trigger wird umbenannt zu "Diskussion" mit einem eigenen Icon (z.B. `MessageSquare`)
- Im `DecisionViewerComment`: Button-Text aendern von "Kommentar hinzufuegen" zu "Diskussionsbeitrag schreiben" oder "Hinweis hinterlassen"

Im `TaskDecisionResponse`:
- Der optionale Kommentar-Button wird umbenannt von "Kommentar" zu "Begruendung hinzufuegen"
- Bei Rueckfragen bleibt "Rueckfrage" als Label

Im `DecisionComments` Sheet:
- Titel aendern von "Kommentare" zu "Diskussion"
- Platzhalter aendern von "Kommentar schreiben..." zu "Diskussionsbeitrag schreiben..."

**Dateien:**
- `src/components/task-decisions/DecisionComments.tsx`
- `src/components/task-decisions/DecisionViewerComment.tsx`
- `src/components/task-decisions/TaskDecisionResponse.tsx`
- `src/components/task-decisions/DecisionOverview.tsx` (Labels)
- `src/components/my-work/decisions/MyWorkDecisionCard.tsx` (Labels)

---

### 7: Standard-Teilnehmer in NoteDecisionCreator

**Problem:** `NoteDecisionCreator.tsx` liest die Standard-Teilnehmer nicht aus localStorage. Stattdessen werden nur Abgeordnete auto-selektiert (Zeile 111-122).

**Loesung:** Die gleiche Logik wie in `StandaloneDecisionCreator` verwenden:

```typescript
// In loadProfiles():
// 1. Zuerst localStorage pruefen
let defaultIds: string[] = [];
try {
  const stored = localStorage.getItem('default_decision_participants');
  if (stored) defaultIds = JSON.parse(stored);
} catch (e) {}

if (defaultIds.length > 0) {
  setSelectedUsers(defaultIds);
} else {
  // Fallback: Abgeordnete auto-selektieren (bestehende Logik)
}
```

**Datei:** `src/components/shared/NoteDecisionCreator.tsx`

---

## Betroffene Dateien

| Aktion | Datei |
|--------|-------|
| DB-Migration | RLS-Policies bereinigen, CHECK-Constraint erweitern |
| Bearbeiten | `src/components/task-decisions/DecisionOverview.tsx` (archiveDecision, restoreDecision, Card-Erweiterung, Labels) |
| Bearbeiten | `src/components/my-work/MyWorkDecisionsTab.tsx` (archiveDecision fix) |
| Bearbeiten | `src/components/task-decisions/DecisionEditDialog.tsx` (setTimeout entfernen) |
| Bearbeiten | `src/components/my-work/decisions/MyWorkDecisionCard.tsx` (Card-Erweiterung, Labels) |
| Bearbeiten | `src/components/task-decisions/DecisionComments.tsx` (Labels) |
| Bearbeiten | `src/components/task-decisions/DecisionViewerComment.tsx` (Labels) |
| Bearbeiten | `src/components/task-decisions/TaskDecisionResponse.tsx` (Labels) |
| Bearbeiten | `src/components/task-decisions/DecisionSidebar.tsx` (Labels) |
| Bearbeiten | `src/components/shared/NoteDecisionCreator.tsx` (Standard-Teilnehmer) |

## Reihenfolge

1. **KRITISCH: DB-Migration** - RLS-Policies bereinigen + CHECK-Constraint erweitern (behebt Punkte 1, 2, 3, 5)
2. **restoreDecision** auf `status: 'active'` aendern (Punkt 2)
3. **archiveDecision** Fehlerbehandlung verbessern (Punkt 1)
4. **DecisionEditDialog** setTimeout entfernen (Punkt 3)
5. Rueckfragen/Kommentare in Cards anzeigen (Punkt 4)
6. Bezeichnungen differenzieren (Punkt 6)
7. Standard-Teilnehmer in NoteDecisionCreator (Punkt 7)
