
# Plan: FallAkten-Sichtbarkeit, Benachrichtigungs-Layout und Standard-Teilnehmer

## Uebersicht

| Nr | Thema | Loesung |
|----|-------|---------|
| 1 | FallAkten: Sichtbarkeit (oeffentlich / bestimmte Personen / privat) | Neue DB-Tabelle `case_file_participants` + Spalte `visibility` auf `case_files`, UI im Create/Edit-Dialog |
| 2 | Meine Arbeit: FallAkten-Tab filtert nach Sichtbarkeit | Query anpassen: oeffentlich ODER Teilnehmer ODER Ersteller |
| 3 | Benachrichtigungseinstellungen ohne Header/Navigation | `/notifications` Route in `Index.tsx` einbetten statt standalone in `App.tsx` |
| 4 | Benachrichtigungsposition und -groesse konfigurierbar | Einstellungen in `user_preferences` (localStorage), Sonner-Position dynamisch, zwei Groessen |
| 5 | Benachrichtigungston + individuelle Toene | Ton-Abspielen bei neuer Notification, Ton-Auswahl pro Kategorie |
| 6 | Standard-Benutzer fuer Entscheidungen | Settings-UI in MyWorkDecisionsTab und DecisionOverview, gespeichert in `user_preferences` |

---

## Technische Details

### 1. FallAkten: Sichtbarkeitsmodell

**Aktueller Zustand:** `case_files` hat nur `is_private: boolean`. Es gibt kein Teilnehmer-System.

**Neues Modell:** Drei Sichtbarkeits-Stufen:
- **`private`** -- Nur der Ersteller sieht die Akte
- **`shared`** -- Bestimmte Personen mit Rollen (viewer/editor) koennen die Akte sehen/bearbeiten
- **`public`** -- Alle Mandanten-Mitglieder koennen die Akte sehen

**DB-Migration:**

1. Neue Spalte `visibility` auf `case_files`:
```sql
ALTER TABLE public.case_files 
  ADD COLUMN visibility text NOT NULL DEFAULT 'private';

-- Bestehende Daten migrieren
UPDATE public.case_files SET visibility = CASE 
  WHEN is_private = true THEN 'private'
  ELSE 'public' 
END;
```

2. Neue Tabelle `case_file_participants`:
```sql
CREATE TABLE public.case_file_participants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  case_file_id uuid NOT NULL REFERENCES public.case_files(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'viewer', -- 'viewer' oder 'editor'
  created_at timestamptz DEFAULT now(),
  UNIQUE(case_file_id, user_id)
);

-- RLS
ALTER TABLE public.case_file_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view participants of accessible case files"
  ON public.case_file_participants FOR SELECT
  USING (case_file_id IN (
    SELECT id FROM public.case_files 
    WHERE tenant_id = ANY(get_user_tenant_ids(auth.uid()))
  ));

CREATE POLICY "Case file owners can manage participants"
  ON public.case_file_participants FOR ALL
  USING (case_file_id IN (
    SELECT id FROM public.case_files WHERE user_id = auth.uid()
  ));
```

3. RLS-Policy fuer `case_files` SELECT aktualisieren:
```sql
-- Alte Policy ersetzen
DROP POLICY "Users can view case files in their tenant" ON public.case_files;

CREATE POLICY "Users can view accessible case files"
  ON public.case_files FOR SELECT
  USING (
    tenant_id = ANY(get_user_tenant_ids(auth.uid()))
    AND (
      visibility = 'public'
      OR user_id = auth.uid()
      OR id IN (SELECT case_file_id FROM public.case_file_participants WHERE user_id = auth.uid())
    )
  );
```

**UI-Aenderungen:**

- `CaseFileCreateDialog.tsx`: `is_private`-Switch ersetzen durch Sichtbarkeits-Auswahl (RadioGroup: Privat / Geteilt / Oeffentlich) + Benutzerauswahl mit Rollen-Dropdown bei "Geteilt"
- `CaseFileEditDialog.tsx`: Gleiche Aenderungen
- `CaseFileFormData`: `is_private` durch `visibility` und `participants` ersetzen
- `useCaseFiles.tsx`: `createCaseFile` und `updateCaseFile` erweitern, um Teilnehmer zu speichern

**Dateien:**
- DB-Migration (neue Tabelle + Spalte + RLS)
- `src/hooks/useCaseFiles.tsx`
- `src/components/case-files/CaseFileCreateDialog.tsx`
- `src/components/case-files/CaseFileEditDialog.tsx`

---

### 2. Meine Arbeit: FallAkten-Tab

**Aktuell:** `MyWorkCaseFilesTab.tsx` filtert nur `.eq("user_id", user.id)` -- zeigt also nur eigene Akten.

**Neu:** Alle Akten anzeigen, die der Benutzer sehen darf:
```tsx
const { data, error } = await supabase
  .from("case_files")
  .select("*, case_file_participants!inner(user_id)")
  .or(`user_id.eq.${user.id},visibility.eq.public,case_file_participants.user_id.eq.${user.id}`)
  .in("status", ["active", "pending"])
  .order("updated_at", { ascending: false })
  .limit(20);
```

Da die OR-Verknuepfung mit einem inner join komplex ist, wird alternativ die RLS-Policy genutzt (die bereits filtert) und nur der `user_id`-Filter entfernt:
```tsx
const { data, error } = await supabase
  .from("case_files")
  .select("*")
  .in("status", ["active", "pending"])
  .order("updated_at", { ascending: false })
  .limit(20);
```
Die RLS-Policy stellt sicher, dass nur sichtbare Akten zurueckgegeben werden.

**Datei:** `src/components/my-work/MyWorkCaseFilesTab.tsx`

---

### 3. Benachrichtigungsseite mit Header/Navigation

**Problem:** `/notifications` ist in `App.tsx` (Zeile 82) als standalone Route definiert -- ausserhalb des Index-Layouts mit AppNavigation und AppHeader.

**Loesung:** 
- Route aus `App.tsx` entfernen
- In `Index.tsx` den Case `notifications` im `renderActiveSection` hinzufuegen
- Dadurch wird die Seite innerhalb des Layouts mit Sidebar und Header gerendert

**Dateien:**
- `src/App.tsx` (Route entfernen)
- `src/pages/Index.tsx` (`notifications` Case hinzufuegen)

---

### 4. Benachrichtigungsposition und -groesse

**Konzept:**
- In den Benachrichtigungseinstellungen (`NotificationsPage.tsx`, Tab "Einstellungen") einen neuen Bereich hinzufuegen
- **Position:** Oben rechts (`top-right`) oder Unten rechts (`bottom-right`)
- **Groesse:** Normal oder Gross (erweiterte Darstellung mit mehr Details)
- **Vorschau:** Live-Preview-Button, der eine Beispiel-Benachrichtigung in der gewaehlten Position und Groesse anzeigt
- Gespeichert in `localStorage` unter `notification_display_preferences`

**Sonner-Konfiguration:**
- `src/components/ui/sonner.tsx` liest die Position aus `localStorage` und setzt `position` entsprechend
- Fuer die grosse Variante: Custom CSS-Klassen auf den Toast anwenden (breitere Darstellung, groessere Schrift)

**Ergaenzungen:**
- Dauer der Benachrichtigung konfigurierbar (3s, 5s, 8s, 10s)
- Option "Benachrichtigungen nicht automatisch ausblenden" (persist)

**Dateien:**
- `src/components/ui/sonner.tsx` (dynamische Position + Groesse)
- `src/pages/NotificationsPage.tsx` (Einstellungs-UI mit Vorschau)
- Neuer Hook: `src/hooks/useNotificationDisplayPreferences.ts`

---

### 5. Benachrichtigungston + individuelle Toene

**Konzept:**
- Standard-Ton bei jeder neuen Benachrichtigung (sofern aktiviert)
- Verschiedene Toene zur Auswahl (z.B. "Ping", "Glocke", "Plopp", "Dezent")
- Pro Benachrichtigungs-Kategorie ein eigener Ton waehlbar
- Lautstaerke regelbar

**Technische Umsetzung:**
- Audio-Dateien als Data-URIs oder kurze synthetische Toene via Web Audio API
- Im `useNotifications.tsx` Hook: Bei neuer Notification (Realtime-Event) den konfigurierten Ton abspielen
- Einstellungen in `localStorage` unter `notification_sound_preferences`

**UI:**
- In `NotificationsPage.tsx` (Tab "Einstellungen"): Neuer Bereich "Toene"
- Master-Toggle: Ton ein/aus
- Ton-Auswahl mit Vorhoer-Button (Play-Icon)
- Optional: Pro Kategorie eigener Ton (Collapsible)
- Lautstaerke-Slider

**Dateien:**
- `src/hooks/useNotificationSounds.ts` (neuer Hook)
- `src/hooks/useNotifications.tsx` (Ton abspielen bei Realtime-Event)
- `src/pages/NotificationsPage.tsx` (UI in Einstellungen)
- `src/utils/notificationSounds.ts` (Ton-Definitionen via Web Audio API)

---

### 6. Standard-Benutzer fuer Entscheidungen

**Konzept:** Ein kleines Settings-Icon/Button in der Entscheidungs-Ansicht, das einen Dialog oeffnet, in dem man Standard-Teilnehmer festlegen kann. Diese werden dann beim Erstellen einer neuen Entscheidung automatisch vorausgewaehlt.

**Speicherung:** `localStorage` unter `default_decision_participants` (Array von User-IDs)

**UI-Platzierung:**
- `MyWorkDecisionsTab.tsx`: Settings-Icon neben dem "Neue Entscheidung"-Button
- `DecisionOverview.tsx`: Gleicher Settings-Bereich
- Ein kleiner Dialog/Popover mit MultiSelect fuer Benutzer

**Integration in StandaloneDecisionCreator:**
- Beim Oeffnen des Dialogs: Gespeicherte Standard-Teilnehmer laden und als `selectedUsers` vorauswaehlen
- Aktuell wird bereits der "Abgeordneter" vorselektiert -- die Standard-Teilnehmer haben Vorrang, falls konfiguriert

**Dateien:**
- Neuer Hook: `src/hooks/useDefaultDecisionParticipants.ts`
- `src/components/task-decisions/StandaloneDecisionCreator.tsx`
- `src/components/my-work/MyWorkDecisionsTab.tsx` (Settings-Button)
- `src/components/task-decisions/DecisionOverview.tsx` (Settings-Button)
- Neuer Dialog: `src/components/task-decisions/DefaultParticipantsDialog.tsx`

---

## Betroffene Dateien

| Aktion | Datei |
|--------|-------|
| DB-Migration | `visibility`-Spalte, `case_file_participants`-Tabelle, RLS-Policies |
| Bearbeiten | `src/hooks/useCaseFiles.tsx` (visibility + participants) |
| Bearbeiten | `src/components/case-files/CaseFileCreateDialog.tsx` (Sichtbarkeits-UI) |
| Bearbeiten | `src/components/case-files/CaseFileEditDialog.tsx` (Sichtbarkeits-UI) |
| Bearbeiten | `src/components/my-work/MyWorkCaseFilesTab.tsx` (Query anpassen) |
| Bearbeiten | `src/App.tsx` (notifications Route entfernen) |
| Bearbeiten | `src/pages/Index.tsx` (notifications Case hinzufuegen) |
| Bearbeiten | `src/pages/NotificationsPage.tsx` (Layout entfernen, Einstellungen erweitern) |
| Bearbeiten | `src/components/ui/sonner.tsx` (dynamische Position + Groesse) |
| Bearbeiten | `src/hooks/useNotifications.tsx` (Ton bei neuer Notification) |
| Bearbeiten | `src/components/task-decisions/StandaloneDecisionCreator.tsx` (Default-Teilnehmer) |
| Bearbeiten | `src/components/my-work/MyWorkDecisionsTab.tsx` (Settings-Button) |
| Bearbeiten | `src/components/task-decisions/DecisionOverview.tsx` (Settings-Button) |
| Neu | `src/hooks/useNotificationDisplayPreferences.ts` |
| Neu | `src/hooks/useNotificationSounds.ts` |
| Neu | `src/utils/notificationSounds.ts` |
| Neu | `src/hooks/useDefaultDecisionParticipants.ts` |
| Neu | `src/components/task-decisions/DefaultParticipantsDialog.tsx` |

## Reihenfolge

1. DB-Migration: `visibility`-Spalte + `case_file_participants`-Tabelle + RLS
2. FallAkten Create/Edit Dialoge mit Sichtbarkeitsmodell
3. Meine Arbeit FallAkten-Tab anpassen
4. Benachrichtigungsseite in Layout einbetten
5. Benachrichtigungs-Position und -Groesse konfigurierbar
6. Benachrichtigungstoene
7. Standard-Teilnehmer fuer Entscheidungen
