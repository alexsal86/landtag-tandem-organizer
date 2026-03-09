
# Plan: Vorgang aus Quick Note erstellen

## Übersicht
Der Benutzer möchte die Möglichkeit haben, aus einer Quick Note einen Vorgang (case_item) zu erstellen, analog zu den bestehenden Funktionen "Als Aufgabe" und "Als Entscheidung".

## Aktuelle Implementierung
Nach Analyse des Codes:
- **NoteCard.tsx** enthält Buttons/Icons für "Als Aufgabe" (CheckSquare) und "Als Entscheidung" (Vote)
- **useQuickNotes.ts** hat die Funktion `createTaskFromNote()` die:
  - Eine Aufgabe in der `tasks` Tabelle erstellt
  - Die `task_id` in `quick_notes` speichert
  - Die Aufgabe mit Titel/Beschreibung aus der Notiz befüllt
- **NoteDialogs.tsx** enthält den `NoteDecisionCreator` für Entscheidungen
- Die `quick_notes` Tabelle hat bereits Felder für `task_id` und `decision_id`

## Benötigte Änderungen

### 1. Datenbankschema prüfen
Die `quick_notes` Tabelle hat **kein** `case_item_id` Feld. Dies muss hinzugefügt werden.

### 2. Migration erstellen
SQL-Migration für neues Feld in `quick_notes`:
```sql
ALTER TABLE quick_notes 
ADD COLUMN case_item_id uuid REFERENCES case_items(id) ON DELETE SET NULL;
```

### 3. UI-Komponenten erweitern

**NoteCard.tsx** (Zeilen 197-205):
- Neuen Button/Tooltip für "Als Vorgang" hinzufügen
- Icon: `FileText` oder `ListTree` (für case_item)
- Zwischen "Als Entscheidung" und "Wiedervorlage" platzieren
- Logik: `note.case_item_id ? onRemoveCaseItem(note) : onCreateCaseItem(note)`

**NoteCard.tsx** Dropdown-Menü (Zeilen 248-265):
- Neue Menüeinträge analog zu Task/Decision hinzufügen

**NoteCard.tsx** Bottom Bar (Zeilen 144-147):
- Neuer Indikator-Punkt für `case_item_id` (z.B. orange/teal Farbe)

**NoteCard.tsx** Linked Badges (Zeilen 150-153):
- Badge für verknüpften Vorgang anzeigen

### 4. Hook erweitern

**useQuickNotes.ts**:
- `createCaseItemFromNote(note: QuickNote)` Funktion hinzufügen:
  ```typescript
  const createCaseItemFromNote = async (note: QuickNote) => {
    if (!user || !currentTenant) return;
    
    const plainContent = stripHtml(note.content);
    const itemSubject = note.title 
      ? stripHtml(note.title) 
      : plainContent.substring(0, 100);
    
    const { data: caseItem, error } = await supabase
      .from('case_items')
      .insert({
        tenant_id: currentTenant.id,
        created_by: user.id,
        subject: itemSubject,
        description: note.content,
        source_channel: 'other',
        status: 'neu',
        priority: 'mittel',
        category: 'Allgemein'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    await supabase
      .from('quick_notes')
      .update({ case_item_id: caseItem.id })
      .eq('id', note.id);
    
    toast.success('Vorgang erstellt');
    loadNotes();
  };
  ```

- `removeCaseItemFromNote(note: QuickNote)` für Entfernung
- Confirmation-Dialog State für `confirmDeleteCaseItemNote`
- Export der neuen Funktionen

### 5. Props erweitern

**NoteCard.tsx** Interface:
- `onCreateCaseItem: (note: QuickNote) => void`
- `onRemoveCaseItem: (note: QuickNote) => void`

**QuickNotesList.tsx**:
- Props an NoteCard durchreichen

**NoteDialogs.tsx**:
- Confirmation-Dialog für Vorgang-Entfernung hinzufügen (ähnlich wie Task-Confirmation)

### 6. TypeScript Types

**QuickNote Interface** erweitern:
```typescript
interface QuickNote {
  // ... existing fields
  case_item_id?: string | null;
}
```

### 7. Optional: Link zu Vorgang-Details

**NoteLinkedBadge.tsx**:
- Neuer Type `'case_item'` hinzufügen
- Navigation zu `/my-work/cases/:id` implementieren

## Betroffene Dateien
1. `supabase/migrations/` - Neue Migration
2. `src/components/shared/NoteCard.tsx` - UI für Button/Badge
3. `src/hooks/useQuickNotes.ts` - Logik für Erstellung/Entfernung
4. `src/components/shared/NoteDialogs.tsx` - Confirmation-Dialog
5. `src/components/shared/QuickNotesList.tsx` - Props durchreichen
6. `src/components/shared/NoteLinkedBadge.tsx` - Badge-Link (optional)
7. `src/integrations/supabase/types.ts` - Auto-generiert nach Migration

## Reihenfolge
1. Migration ausführen (case_item_id Spalte hinzufügen)
2. Hook-Funktionen implementieren
3. UI-Komponenten erweitern
4. Dialoge hinzufügen
5. Props durchreichen
