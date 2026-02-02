
# Plan: Teilnehmer-Verwaltung bei Meetings reparieren

## Problem-Analyse

Nach gründlicher Untersuchung habe ich folgende Probleme identifiziert:

### 1. RLS-Policy-Problem (KRITISCH)
Die Tabelle `meeting_participants` hat **4 redundante Policies** mit fehlerhafter Konfiguration:
- 2x "Users can manage..." (cmd: ALL)
- 2x "Users can view..." (cmd: SELECT)

**Kritisches Problem**: Die `ALL`-Policies haben **keine `WITH CHECK`-Klausel**, was bedeutet dass INSERT-Operationen stillschweigend fehlschlagen!

Aktuelle Policy-Logik:
```sql
EXISTS (SELECT 1 FROM meetings m WHERE m.id = meeting_id AND m.user_id = auth.uid())
```

Diese prüft nur ob man Meeting-Ersteller ist, aber INSERT braucht zusätzlich `WITH CHECK`.

### 2. Datenbank ist leer
Die Tabelle `meeting_participants` enthält **0 Einträge**, obwohl Meetings erstellt wurden und Teilnehmer ausgewählt wurden.

### 3. UI funktioniert prinzipiell
Der Code in `InlineMeetingParticipantsEditor.tsx` und `MeetingsView.tsx` ist korrekt implementiert - das Problem liegt bei der Datenbank-Berechtigung.

---

## Lösung

### Schritt 1: RLS-Policies korrigieren (DB-Migration)

```sql
-- Entferne alle bestehenden Policies
DROP POLICY IF EXISTS "Users can manage meeting participants for their meetings" ON meeting_participants;
DROP POLICY IF EXISTS "Users can manage participants of their meetings" ON meeting_participants;
DROP POLICY IF EXISTS "Users can view meeting participants for their meetings" ON meeting_participants;
DROP POLICY IF EXISTS "Users can view participants of their meetings" ON meeting_participants;

-- Neue, korrekte Policies erstellen

-- 1. SELECT: Meeting-Ersteller, Teilnehmer selbst, oder wenn Meeting öffentlich
CREATE POLICY "Users can view meeting participants"
ON meeting_participants FOR SELECT
USING (
  user_id = auth.uid() -- Eigene Teilnahme immer sichtbar
  OR EXISTS (
    SELECT 1 FROM meetings m 
    WHERE m.id = meeting_participants.meeting_id 
    AND (m.user_id = auth.uid() OR m.is_public = true)
  )
);

-- 2. INSERT: Nur Meeting-Ersteller kann Teilnehmer hinzufügen
CREATE POLICY "Meeting creators can add participants"
ON meeting_participants FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM meetings m 
    WHERE m.id = meeting_id 
    AND m.user_id = auth.uid()
  )
);

-- 3. UPDATE: Meeting-Ersteller oder der Teilnehmer selbst (für Status-Updates)
CREATE POLICY "Users can update participant records"
ON meeting_participants FOR UPDATE
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM meetings m 
    WHERE m.id = meeting_participants.meeting_id 
    AND m.user_id = auth.uid()
  )
)
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM meetings m 
    WHERE m.id = meeting_id 
    AND m.user_id = auth.uid()
  )
);

-- 4. DELETE: Nur Meeting-Ersteller
CREATE POLICY "Meeting creators can remove participants"
ON meeting_participants FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM meetings m 
    WHERE m.id = meeting_participants.meeting_id 
    AND m.user_id = auth.uid()
  )
);
```

### Schritt 2: InlineMeetingParticipantsEditor verbessern

Bessere Fehlerbehandlung und Feedback:

```typescript
const handleAddParticipant = async (user: { id: string; display_name: string }) => {
  if (!meetingId) {
    toast({ title: "Fehler", description: "Keine Meeting-ID", variant: "destructive" });
    return;
  }
  
  console.log('🔄 Adding participant:', user.id, 'to meeting:', meetingId, 'with role:', selectedRole);
  
  const { data, error } = await supabase
    .from('meeting_participants')
    .insert({
      meeting_id: meetingId,
      user_id: user.id,
      role: selectedRole,
      status: 'pending'
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Error adding participant:', error);
    toast({
      title: "Fehler beim Hinzufügen",
      description: error.message || "Teilnehmer konnte nicht hinzugefügt werden.",
      variant: "destructive"
    });
    return;
  }
  
  console.log('✅ Participant added successfully:', data);
  toast({
    title: "Teilnehmer hinzugefügt",
    description: `${user.display_name} wurde hinzugefügt.`,
  });
  
  setParticipants(prev => [...prev, {
    id: data.id,
    user_id: user.id,
    role: selectedRole,
    user: { display_name: user.display_name, avatar_url: null }
  }]);
};
```

### Schritt 3: Sicherstellen dass UI nur bei vorhandener Meeting-ID angezeigt wird

Der Editor wird bereits nur bei `meeting.id && ...` gerendert - das ist korrekt.

### Schritt 4: Test-Szenario nach Implementation

1. **Neues Meeting erstellen** mit Vorlage die Standard-Teilnehmer hat
2. **Prüfen** dass Teilnehmer in `meeting_participants` gespeichert wurden
3. **Meeting bearbeiten** und Teilnehmer hinzufügen/entfernen
4. **Prüfen** dass Änderungen persistiert werden

---

## Zusammenfassung der Änderungen

| Datei | Änderung |
|-------|----------|
| `supabase/migrations/[timestamp]_fix_meeting_participants_rls.sql` | Neue RLS-Policies |
| `src/components/meetings/InlineMeetingParticipantsEditor.tsx` | Bessere Fehlerbehandlung, Toast-Feedback |

---

## Erwartete Ergebnisse

Nach dieser Korrektur:
1. **Teilnehmer werden bei der Erstellung gespeichert** - Template-Teilnehmer werden korrekt übernommen
2. **Teilnehmer können in Details bearbeitet werden** - Hinzufügen, Rolle ändern, Entfernen
3. **Teilnehmer werden korrekt angezeigt** - Auf Meeting-Karten und in der Detail-Ansicht
4. **Klares Feedback bei Fehlern** - Toast-Nachrichten zeigen den Erfolg/Misserfolg
