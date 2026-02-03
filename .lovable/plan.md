
# Plan: Palette 2 und robuster Bugfix fuer "Ganze Card einfaerben"

## Zusammenfassung

| Aenderung | Beschreibung |
|-----------|--------------|
| 1. Farbpalette | Palette 2 (Balanced/Mittel) mit Tailwind-400 Farben implementieren |
| 2. Bugfix | Robusteres Pattern mit Lock-State und vereinfachter Query |

---

## 1. Farbpalette 2 implementieren

**Datei:** `src/components/shared/QuickNotesList.tsx` (Zeilen 158-169)

Aktuelle intensive Farben ersetzen durch die ausgewogene Palette 2:

```typescript
// Note colors for picker - Palette 2: Balanced/Mittel (ausgewogen und lesbar)
const noteColors = [
  { value: '#fbbf24', label: 'Gold' },      // amber-400 - balanced
  { value: '#60a5fa', label: 'Blau' },      // blue-400 - balanced
  { value: '#4ade80', label: 'Grün' },      // green-400 - balanced
  { value: '#f472b6', label: 'Pink' },      // pink-400 - balanced
  { value: '#a78bfa', label: 'Lila' },      // violet-400 - balanced
  { value: '#fb923c', label: 'Orange' },    // orange-400 - balanced
  { value: '#22d3ee', label: 'Türkis' },    // cyan-400 - balanced
  { value: '#f87171', label: 'Rot' },       // red-400 - balanced
  { value: null, label: 'Standard' }
];
```

---

## 2. Bugfix: "Ganze Card einfaerben"

### Root Cause
Das Problem tritt weiterhin auf wegen:
1. Ternary-Operator mit await kann Timing-Probleme verursachen
2. Kein Lock verhindert Doppelklicks
3. Eventuell RLS-Konflikt bei der Query mit user_id Filter

### Loesung: Lock-State + Vereinfachte Query

**Schritt 1:** State fuer Lock hinzufuegen (nach Zeile 169):
```typescript
// State to prevent double-clicks on color mode checkbox
const [colorModeUpdating, setColorModeUpdating] = useState<string | null>(null);
```

**Schritt 2:** handleSetColorMode komplett ersetzen (Zeilen 614-666):
```typescript
// Set color full card mode with optimistic UI and locking
const handleSetColorMode = async (noteId: string, fullCard: boolean) => {
  // Prevent double execution
  if (colorModeUpdating) {
    console.log("Color mode update already in progress, skipping");
    return;
  }
  
  if (!user?.id) {
    toast.error("Nicht angemeldet");
    return;
  }

  const note = notes.find(n => n.id === noteId);
  if (!note) {
    toast.error("Notiz nicht gefunden");
    return;
  }

  // Check permission: own note OR shared with edit rights
  const canModify = note.user_id === user.id || note.can_edit === true;
  if (!canModify) {
    toast.error("Keine Berechtigung zum Ändern dieser Notiz");
    return;
  }

  // Set lock FIRST
  setColorModeUpdating(noteId);
  
  // Optimistic update
  const previousValue = note.color_full_card;
  setNotes(prev => prev.map(n => 
    n.id === noteId ? { ...n, color_full_card: fullCard } : n
  ));

  try {
    // SIMPLIFIED QUERY - let RLS handle permissions
    // No ternary, no user_id filter - RLS policies already check this
    const { error } = await supabase
      .from("quick_notes")
      .update({ color_full_card: fullCard })
      .eq("id", noteId);

    if (error) {
      console.error("Update error:", error);
      // Rollback
      setNotes(prev => prev.map(n => 
        n.id === noteId ? { ...n, color_full_card: previousValue } : n
      ));
      toast.error("Fehler beim Setzen des Farbmodus");
    } else {
      toast.success(fullCard ? "Ganze Card eingefärbt" : "Nur Kante eingefärbt");
    }
  } catch (error) {
    console.error("Error setting color mode:", error);
    setNotes(prev => prev.map(n => 
      n.id === noteId ? { ...n, color_full_card: previousValue } : n
    ));
    toast.error("Fehler beim Setzen des Farbmodus");
  } finally {
    // Release lock after a small delay to prevent rapid re-clicks
    setTimeout(() => setColorModeUpdating(null), 300);
  }
};
```

**Schritt 3:** Checkbox UI robuster machen (Zeilen 1783-1805):
```typescript
{note.color && (
  <>
    <DropdownMenuSeparator />
    <div 
      className="px-2 py-1.5" 
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <label 
        className="flex items-center gap-2 text-xs cursor-pointer select-none"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Checkbox 
          checked={note.color_full_card === true}
          disabled={colorModeUpdating === note.id}
          onCheckedChange={(checked) => {
            if (colorModeUpdating !== note.id) {
              handleSetColorMode(note.id, checked === true);
            }
          }}
        />
        {colorModeUpdating === note.id ? "Wird gespeichert..." : "Ganze Card einfärben"}
      </label>
    </div>
  </>
)}
```

---

## Zusammenfassung der Code-Aenderungen

| Datei | Zeilen | Aenderung |
|-------|--------|-----------|
| `QuickNotesList.tsx` | 158-169 | Palette 2 Farben einsetzen |
| `QuickNotesList.tsx` | nach 169 | State `colorModeUpdating` hinzufuegen |
| `QuickNotesList.tsx` | 614-666 | handleSetColorMode mit Lock + vereinfachter Query |
| `QuickNotesList.tsx` | 1783-1805 | Checkbox mit disabled-State und Feedback-Text |

---

## Warum diese Loesung funktioniert

1. **Lock-State verhindert Doppelklicks**: Wenn ein Update laeuft, werden weitere Clicks ignoriert
2. **Vereinfachte Query**: Kein ternary-Operator, kein user_id Filter - RLS regelt die Berechtigung automatisch
3. **Visuelles Feedback**: Checkbox zeigt "Wird gespeichert..." waehrend des Updates
4. **Timeout beim Lock-Release**: 300ms Verzoegerung verhindert zu schnelle Folge-Clicks
5. **Robustes Error-Handling**: Rollback zur vorherigen Wert bei Fehler
