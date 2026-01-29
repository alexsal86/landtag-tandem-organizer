

# Plan: Meine Notizen - Verbesserungen

## Übersicht der Änderungen

| # | Problem | Lösung |
|---|---------|--------|
| 1 | Wiederherstellung aus Archiv/Papierkorb braucht Seiten-Reload | `archiveRefreshTrigger` an `QuickNotesList` weitergeben |
| 2 | "→ Details" Button erscheint separat, nicht in der gleichen Zeile | Unified Bottom-Bar mit ">" standardmäßig, "→ Details \| Icons" bei Hover |
| 3 | Verbesserungsvorschläge | Diverse UX-Verbesserungen |

---

## 1. Archiv/Papierkorb Wiederherstellung aktualisiert die Liste sofort

**Problem:** Der `handleArchiveRestore` Callback in `MyWorkNotesList.tsx` inkrementiert `archiveRefreshTrigger`, aber dieser Wert wird NUR an `NotesArchiveDialog` weitergegeben - nicht an `QuickNotesList`. Die Notizenliste hat also keine Kenntnis davon, dass etwas wiederhergestellt wurde.

**Aktuelle Implementierung (MyWorkNotesList.tsx, Zeile 53-57):**
```typescript
<QuickNotesList 
  refreshTrigger={refreshTrigger}  // ← Nur das externe Trigger
  showHeader={false}
  maxHeight="none"
/>
```

**Lösung:** Den `archiveRefreshTrigger` kombinieren, damit die `QuickNotesList` auch bei Wiederherstellung neu lädt:

```typescript
// Zeile 16 anpassen:
const [localRefreshTrigger, setLocalRefreshTrigger] = useState(0);

const handleArchiveRestore = () => {
  // Trigger refresh of the notes list
  setLocalRefreshTrigger(prev => prev + 1);
};

// Zeile 53-57 anpassen:
<QuickNotesList 
  refreshTrigger={(refreshTrigger || 0) + localRefreshTrigger}  // ← KOMBINIERT!
  showHeader={false}
  maxHeight="none"
/>
```

**Hinweis:** `QuickNotesList` hat auch einen Supabase Realtime-Channel (Zeile 300-317), der bei Änderungen an `quick_notes` automatisch `loadNotes()` aufruft. ABER: Der Filter ist `filter: user_id=eq.${user.id}`, was bedeutet, dass Änderungen an archivierten Notizen (die ja dem User gehören) eigentlich erkannt werden sollten. Das Problem könnte sein, dass die Realtime-Subscription nicht bei UPDATE-Events mit geänderten Filterbedingungen triggert. Die sicherste Lösung ist die manuelle Aktualisierung über `refreshTrigger`.

---

## 2. Bottom-Bar: ">" und "→ Details" mit Icons in einer Zeile

**Gewünschtes Layout:**

**Ohne Hover:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│ Titel                                                             [⋮]  │
│ Beschreibung mit Text und dann...→                                     │
│                                                                         │
│ ■ ■ ■ ■ (Quadrate)                                              [>]    │
└─────────────────────────────────────────────────────────────────────────┘
```

**Mit Hover:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│ Titel                                                             [⋮]  │
│ Beschreibung mit Text und dann...→                                     │
│                                                                         │
│ [Aufgabe→] [Entsch.→] [JF→]    [→ Details | ✏️ ☑️ 🗳️ 🕐 📅 ≡]        │
└─────────────────────────────────────────────────────────────────────────┘
```

**Aktuelle Struktur (separiert):**
- Zeile 1113-1204: Status-Indikatoren mit `absolute bottom-2 left-3`
- Zeile 1454-1580: Hover Quick Actions mit `absolute bottom-2 right-3`

**Lösung:** Eine einheitliche Bottom-Bar-Komponente:

```typescript
{/* UNIFIED BOTTOM BAR - all elements in one row */}
<div className="absolute bottom-2 left-3 right-3 flex items-center justify-between">
  {/* LEFT: Status indicators/badges */}
  <div className="flex items-center gap-2 flex-1 min-w-0">
    {/* Small squares - visible when NOT hovering */}
    <div className="flex items-center gap-1.5 group-hover:hidden">
      {note.task_id && <div className="w-1.5 h-1.5 bg-blue-500" title="Aufgabe" />}
      {note.decision_id && <div className="w-1.5 h-1.5 bg-purple-500" title="Entscheidung" />}
      {note.meeting_id && <div className="w-1.5 h-1.5 bg-emerald-500" title="Jour Fixe" />}
      {hasShared && <div className="w-1.5 h-1.5 bg-violet-500" title="Geteilt" />}
    </div>
    
    {/* Full badges - visible on hover */}
    <div className="hidden group-hover:flex items-center gap-1.5 flex-wrap">
      {note.task_id && <NoteLinkedBadge type="task" id={note.task_id} label="Aufgabe" />}
      {/* ... other badges ... */}
    </div>
  </div>
  
  {/* RIGHT: ">" / "→ Details" + Quick Actions */}
  <div className="flex items-center gap-1 flex-shrink-0">
    {/* Simple ">" - visible when NOT hovering, only if linked items exist */}
    {hasLinkedItems && (
      <span className="text-xs text-muted-foreground group-hover:hidden">›</span>
    )}
    
    {/* "→ Details" + separator + icons - visible on hover */}
    <div className={cn(
      "flex items-center gap-1",
      "opacity-0 group-hover:opacity-100 transition-opacity duration-200"
    )}>
      {/* "→ Details" button only if linked items */}
      {hasLinkedItems && (
        <>
          <button className="text-xs text-primary flex items-center">
            <ArrowRight className="h-3 w-3" strokeWidth={2.5} />
            <span className="ml-0.5">Details</span>
          </button>
          {note.user_id === user?.id && (
            <div className="h-4 w-px bg-border mx-1" />
          )}
        </>
      )}
      
      {/* Quick action icons (nur für eigene Notizen) */}
      {note.user_id === user?.id && (
        <>
          {/* Edit, Task, Decision, Follow-up, Jour Fixe, Drag Handle */}
        </>
      )}
    </div>
  </div>
</div>
```

---

## 3. Verbesserungsvorschläge

Basierend auf meiner Analyse des Codes gibt es einige Verbesserungsmöglichkeiten:

### UX-Verbesserungen

| Verbesserung | Beschreibung | Aufwand |
|--------------|--------------|---------|
| **Keyboard Shortcuts** | `Ctrl+N` für neue Notiz, `Ctrl+E` zum Bearbeiten der ausgewählten Notiz, `Delete` zum Löschen | Mittel |
| **Bulk-Aktionen** | Mehrere Notizen auswählen und gemeinsam archivieren/löschen/priorisieren | Hoch |
| **Such-/Filterfunktion** | Notizen nach Titel, Inhalt, oder Verknüpfungen durchsuchen | Mittel |
| **Sortieroptionen** | Sortierung nach Datum, Titel, Priorität umschalten | Gering |
| **Undo-Funktion** | "Rückgängig" nach Löschen/Archivieren (Toast mit Undo-Button) | Mittel |
| **Export-Funktion** | Notizen als Markdown/Text exportieren | Gering |

### Performance-Verbesserungen

| Verbesserung | Beschreibung | Aufwand |
|--------------|--------------|---------|
| **Virtualisierung** | Bei vielen Notizen (>50) eine virtualisierte Liste verwenden (`react-virtual`) | Mittel |
| **Optimistic Updates** | Statt `loadNotes()` nach jeder Aktion lieber lokalen State sofort aktualisieren | Mittel |
| **Pagination** | Bei sehr vielen Notizen "Mehr laden" Button oder Infinite Scroll | Mittel |

### Weitere Features

| Feature | Beschreibung | Aufwand |
|---------|--------------|---------|
| **Kategorien/Tags** | Notizen mit Tags versehen und danach filtern | Hoch |
| **Schnell-Eingabe mit @** | `@Aufgabe` oder `@JF` direkt im Text um Verknüpfungen zu erstellen | Hoch |
| **Spracheingabe** | Notiz per Mikrofon diktieren | Mittel |
| **Rich-Media-Anhänge** | Bilder/Dateien an Notizen anhängen | Hoch |
| **Reminder/Benachrichtigungen** | Push-Benachrichtigung bei Wiedervorlage-Datum | Hoch |
| **Farbliche Gruppierung** | Notizen nach Farbe gruppieren oder Farbe als Filter | Gering |

---

## Zusammenfassung der Dateien

| Datei | Änderungen |
|-------|------------|
| `src/components/my-work/MyWorkNotesList.tsx` | `refreshTrigger` kombinieren für Archiv-Restore |
| `src/components/shared/QuickNotesList.tsx` | Bottom-Bar mit ">" und "→ Details \| Icons" vereinheitlichen |

---

## Geschätzter Aufwand

| Änderung | Zeit |
|----------|------|
| Archiv-Restore sofortige Aktualisierung | 5 Min |
| Bottom-Bar Vereinheitlichung | 25 Min |
| **Gesamt** | **~30 Min** |

