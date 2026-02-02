
# Plan: Foreign Key Inkonsistenz bei Meeting-Teilnehmern beheben

## Problem identifiziert

Die Fehlermeldung `violates foreign key constraint "meeting_participants_user_id_fkey"` zeigt ein **Datenmodell-Problem**:

| Tabelle | Spalte | Wert (Beispiel) |
|---------|--------|-----------------|
| `profiles.id` | Primary Key | `d1beada0-5501-45a9-...` |
| `profiles.user_id` | Auth User ID | `ff0e6d83-94ca-42a5-...` |
| `meeting_participants.user_id` | Foreign Key | zeigt auf `profiles(id)` |

**Das Problem**: 
- `UserSelector` gibt `profile.user_id` (auth.users ID) zurück
- `meeting_participants.user_id` Foreign Key verweist auf `profiles.id` (profiles Primary Key)
- Diese IDs sind unterschiedlich!

## Lösung

Es gibt zwei Optionen:

### Option A: Foreign Key ändern (empfohlen)
Ändern des Foreign Keys, damit er auf `profiles(user_id)` statt `profiles(id)` zeigt. Dies ist konsistenter mit dem Rest der Anwendung.

```sql
-- Drop existing foreign key
ALTER TABLE meeting_participants 
DROP CONSTRAINT meeting_participants_user_id_fkey;

-- Add new foreign key referencing user_id instead of id
ALTER TABLE meeting_participants 
ADD CONSTRAINT meeting_participants_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE;
```

### Option B: UserSelector anpassen
Den `UserSelector` so ändern, dass er `profiles.id` statt `profiles.user_id` zurückgibt.

**Problem dabei**: Alle anderen Stellen, die den `UserSelector` verwenden, erwarten die `auth.users` ID. Dies würde zu weiteren Problemen führen.

## Empfohlene Umsetzung: Option A

### Schritt 1: DB-Migration
```sql
-- Fix: Change meeting_participants.user_id to reference profiles(user_id) instead of profiles(id)

-- Step 1: Drop existing constraint
ALTER TABLE public.meeting_participants 
DROP CONSTRAINT IF EXISTS meeting_participants_user_id_fkey;

-- Step 2: Add correct constraint referencing profiles.user_id
ALTER TABLE public.meeting_participants 
ADD CONSTRAINT meeting_participants_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
```

### Schritt 2: Keine Code-Änderungen nötig
Der `UserSelector` und `InlineMeetingParticipantsEditor` sind bereits korrekt implementiert - sie verwenden `profile.user_id`, was nach der Migration funktionieren wird.

## Zusammenfassung

| Datei | Änderung |
|-------|----------|
| `supabase/migrations/[timestamp]_fix_meeting_participants_fkey.sql` | Foreign Key korrigieren |

## Erwartetes Ergebnis

Nach der Migration:
1. **Teilnehmer können hinzugefügt werden** - Kein Foreign Key Fehler mehr
2. **Rollen werden korrekt gespeichert** - Alle CRUD-Operationen funktionieren
3. **Konsistentes Datenmodell** - `user_id` referenziert überall die `auth.users` ID
