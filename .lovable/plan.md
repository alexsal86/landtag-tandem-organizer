
Ziel: Den echten Erstellungsfehler beheben und die Fehlermeldung so reparieren, dass nicht mehr `[object Object]` angezeigt wird.

Diagnose
- Ich habe Code, DB-Schema, Constraints und RLS geprüft.
- Do I know what the issue is? Ja.

Das eigentliche Problem
1. `created_by` ist in den betroffenen Tabellen ein Fremdschlüssel auf `profiles.id`, nicht auf `auth.users.id`.
   - Betroffen: `topic_backlog`, `social_content_items`, `social_content_item_channels`
   - Der aktuelle Code schreibt aber überall `created_by: user.id`.
   - Für den aktuellen Nutzer ist `user.id` ungleich `profiles.id`.
   - Ergebnis: INSERTs scheitern mit Foreign-Key-Fehlern.
   - Das erklärt, warum sowohl Themenspeicher als auch Social Planner beim Erstellen kaputt sind.

2. Im Social Planner wird zusätzlich ein ungültiger `approval_state` geschrieben.
   - Code nutzt aktuell `open`.
   - DB erlaubt laut Constraint nur: `draft`, `pending_approval`, `approved`, `rejected`.
   - Ergebnis: Auch nach Fix von `created_by` würde Social-Planner-Erstellung weiter scheitern.

3. Die Meldung `[object Object]` kommt aus der Fehlerbehandlung.
   - Supabase gibt oft plain objects zurück, die nicht `instanceof Error` sind.
   - Der Code macht dann `String(error)` oder schluckt den Fehler ganz.
   - Deshalb sieht man keine brauchbare Fehlermeldung.

4. Nebenbei ist auch das Status-Mapping im Planner nicht sauber zur DB ausgerichtet.
   - UI nutzt: `ideas`, `in_progress`, `in_review`, `approved`, `scheduled`, `published`
   - DB erlaubt bei `workflow_status`: `idea`, `draft`, `approval`, `scheduled`, `published`
   - Das betrifft vor allem spätere Statuswechsel.

Wichtig
- RLS ist hier sehr wahrscheinlich nicht der Hauptfehler.
- Der Nutzer hat eine aktive Tenant-Rolle `abgeordneter`, und die Policies erlauben INSERTs.
- Das Problem liegt primär in FK-/Constraint-Mismatches und in der Fehlerdarstellung.

Umsetzungsplan
1. Profil-ID statt Auth-User-ID verwenden
- Eine kleine Hilfslogik einbauen, die für den aktuellen Tenant die passende `profiles.id` über `user_id + tenant_id` lädt.
- Diese Profil-ID dann für `created_by` verwenden.

2. Erstellungsflows korrigieren
- `src/hooks/useTopicBacklog.ts`
  - `createTopic()` auf `created_by = currentProfileId` umstellen.
- `src/hooks/useSocialPlannerItems.ts`
  - `createItem()` auf `created_by = currentProfileId` umstellen.
- `src/components/my-work/ThemenspeicherPanel.tsx`
  - `createFromTopic()` und die Kanal-Verknüpfung ebenfalls auf `created_by = currentProfileId` umstellen.

3. Social-Planner-Constraints an DB anpassen
- `approval_state` standardmäßig auf `draft` setzen statt `open`.
- UI/DB-Mapping für Planner-Status sauber vereinheitlichen:
  - `ideas -> idea`
  - `in_progress -> draft`
  - `in_review -> approval + pending_approval`
  - `approved -> approval + approved`
  - `scheduled -> scheduled`
  - `published -> published`
- Beim Laden der Daten den UI-Status aus `workflow_status` plus `approval_state` ableiten.

4. Fehlertexte robust machen
- Die bestehende Fehlernormalisierung erweitern, damit Supabase-Fehlerobjekte sinnvoll gelesen werden:
  - `message`
  - `details`
  - `hint`
  - `code`
- Keine Nutzung mehr von nacktem `String(error)` in diesen Flows.
- Catch-Blöcke, die aktuell den Fehler verschlucken, auf `catch (error)` umstellen.

5. Nutzerfreundliche Meldungen anzeigen
- Statt `[object Object]` dann z. B.:
  - „Thema konnte nicht erstellt werden: insert or update on table ... violates foreign key constraint ...“
  - oder bei Constraint-Problemen konkret:
    - „Ungültiger Statuswert für approval_state“
- Zusätzlich Konsole mit strukturiertem Kontext befüllen.

Betroffene Dateien
- `src/hooks/useTopicBacklog.ts`
- `src/hooks/useSocialPlannerItems.ts`
- `src/components/my-work/ThemenspeicherPanel.tsx`
- `src/components/my-work/MyWorkSocialPlannerBoard.tsx`
- `src/utils/errorHandler.ts`

Erwartetes Ergebnis nach Umsetzung
- Themen im Themenspeicher lassen sich wieder anlegen.
- Beiträge im Social Planner lassen sich wieder erstellen.
- Fehler werden verständlich angezeigt statt `[object Object]`.
- Statuswechsel im Planner passen endlich zur realen DB-Struktur.
