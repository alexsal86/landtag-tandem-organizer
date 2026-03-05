

# Plan: Vorgangssystem (Ticketsystem) funktionsfähig machen

## Problemanalyse

Das Vorgangssystem hat zahlreiche Build-Fehler, die durch Diskrepanzen zwischen Datenbankschema und Code verursacht werden. Die Hauptprobleme:

### Datenbankprobleme
1. **`case_files` fehlt `case_scale`-Spalte** — Code erwartet sie, DB hat sie nicht
2. **`case_item_interactions` fehlen Spalten** — Code erwartet `subject`, `details`, `is_resolution`, `source_type`, `source_id`, die nicht existieren. Zudem nutzt `interaction_type` den Enum `case_item_source_channel` (phone/email/social/in_person/other), aber Code erwartet call/email/social/meeting/note/letter/system
3. **`tasks` fehlen `source_type`/`source_id`** — Code in TasksView referenziert diese

### Code-Probleme
4. **MyWorkCaseItemsTab.tsx**: Doppelte `items`-Variable (Zeile 73 + 91), `caseItems`/`getAssigneeId`/`createCaseItem` undefiniert
5. **MyWorkCasesWorkspace.tsx**: `linkedCaseFileIds` undefiniert (Zeile 129), `case_items as any`-Cast schlägt fehl
6. **Doppelter Export**: `CaseItemInteraction` wird aus `items/hooks` UND `files/hooks` exportiert → Konflikt in `features/cases/index.ts`
7. **Type-Mismatches**: `case_scale` ist `string` in DB-Rückgabe aber `"small" | "large"` im Interface

## Umsetzungsplan

### Schritt 1: Datenbank-Migrationen

SQL-Migration mit folgenden Änderungen:

1. **`case_files`**: Spalte `case_scale` (text, nullable) hinzufügen
2. **`case_item_interactions`**: Spalten `subject` (text), `details` (text), `is_resolution` (boolean, default false), `source_type` (text), `source_id` (uuid) hinzufügen. Den `interaction_type`-Enum erweitern oder auf Text umstellen, da der bestehende Enum (phone/email/social/in_person/other) nicht zu den benötigten Werten (call/email/social/meeting/note/letter/system) passt
3. **`tasks`**: Spalten `source_type` (text) und `source_id` (uuid) hinzufügen

### Schritt 2: Export-Konflikt auflösen

- In `features/cases/index.ts` den Doppel-Export von `CaseItemInteraction` auflösen — entweder eines der Interfaces umbenennen oder explizit re-exportieren

### Schritt 3: MyWorkCaseItemsTab.tsx reparieren

- Doppelte `items`-Deklaration entfernen (Zeile 91-109 entfernen, da Zeile 73 die richtige ist)
- `loadCaseItems`-Funktion korrigieren: statt `getAssigneeId` direkt `owner_user_id` verwenden, DB-Spaltenreferenzen anpassen (z.B. `row.subject` statt `row.title`, `row.source_channel` statt `row.channel`)
- `createCaseItem` aus dem `useCaseItems`-Hook importieren und verwenden

### Schritt 4: MyWorkCasesWorkspace.tsx reparieren

- `linkedCaseFileIds` berechnen bevor es bei der Abfrage verwendet wird (es wird auf Zeile 129 referenziert, aber erst auf Zeile 214 in einem `useMemo` berechnet)
- `case_items as any`-Cast durch korrektes Typing ersetzen

### Schritt 5: Type-Casting für `case_scale` korrigieren

- In `useCaseFiles.tsx`, `useCaseFileDetails.tsx`, `CaseFileCreateDialog.tsx`, `MyWorkCaseFilesTab.tsx`: `case_scale` als `string` casten und dann validieren, oder das Interface auf `string` erweitern

### Schritt 6: useCaseItems Hook reparieren

- Die `CaseItemInteraction`-Interface und Insert-Logik an das tatsächliche DB-Schema anpassen (nach Migration)
- `intake_payload`-Type-Kompatibilität mit Supabase Json-Typ sicherstellen
- `tenant_id` aus Interaction-Insert entfernen, falls die Tabelle es nicht hat (aber sie hat es — das Problem ist der TypeScript-Typ)

### Schritt 7: Interaktionstypen harmonisieren

- Einen neuen Enum oder Text-basierte Spalte für `interaction_type` verwenden, der sowohl die alten als auch neuen Werte unterstützt: call, email, social, meeting, note, letter, system, phone, in_person, other

## Technische Details

```text
Aktuelle DB-Struktur case_item_interactions:
  id, case_item_id, tenant_id, interaction_type (enum: phone/email/social/in_person/other),
  interaction_at, direction (text), summary, payload, created_by, created_at, visibility

Benötigte Struktur:
  + subject (text)
  + details (text)  
  + is_resolution (boolean, default false)
  + source_type (text, nullable)
  + source_id (uuid, nullable)
  interaction_type → text statt Enum (für erweiterte Werte)
```

Die Migration wird so gestaltet, dass bestehende Daten erhalten bleiben. Der Enum wird zu einem Text-Typ konvertiert, da die neuen Interaction-Types (call, meeting, note, letter, system) nicht im bestehenden Enum enthalten sind.

