
# Plan: 3 Bugfixes fuer Meine Notizen

## Zusammenfassung der identifizierten Probleme

| # | Problem | Root Cause | Loesung |
|---|---------|------------|---------|
| 1 | GlobalQuickNoteDialog speichert nicht (tenant_id Fehler) | Die `quick_notes` Tabelle hat **keine** `tenant_id` Spalte, aber der Code versucht sie zu setzen | `tenant_id` aus dem Insert entfernen |
| 2a | Card leicht eingefaerbt obwohl nur Rand | Hintergrund `${note.color}20` wird immer gesetzt wenn `note.color` existiert | Nur Rand-Farbe ohne Hintergrund wenn `color_full_card` false |
| 2b | Farb-Kontrast-Unterschied zwischen eigenen und geteilten Notizen | Globale Shares laden `color_full_card` nicht im SELECT | `color_full_card` zur globalen Shares-Abfrage hinzufuegen |
| 2c | Farbe bei geteilten Notizen nicht aenderbar | `handleSetColor` und `handleSetColorMode` filtern nach `user_id` | RLS-basierte Updates fuer geteilte Notizen mit edit-Recht |
| 2d | "Ganze Card einfaerben" Checkbox erzeugt Fehler | RLS blockiert Updates bei Shared Notes ohne user_id match | Updates ueber RLS statt user_id Filter |
| 3 | NoteDecisionCreator zeigt neue Features nicht | Code ist vorhanden - moeglicherweise Caching-Problem oder nicht deployed | Build-Verification und ggf. Props/Imports pruefen |

---

## Problem 1: GlobalQuickNoteDialog - tenant_id existiert nicht

### Analyse
Die Datenbank-Abfrage zeigt, dass `quick_notes` **keine `tenant_id` Spalte hat**:
```
Spalten: id, user_id, title, content, category, color, is_pinned, tags, 
         created_at, updated_at, task_id, is_archived, archived_at, 
         meeting_id, meeting_result, added_to_meeting_at, priority_level,
         follow_up_date, deleted_at, permanent_delete_at, pending_for_jour_fixe,
         decision_id, task_archived_info, decision_archived_info, 
         meeting_archived_info, color_full_card
```

Der Code in `GlobalQuickNoteDialog.tsx` (Zeilen 58-66) versucht faelschlicherweise:
```typescript
const insertData = {
  user_id: user.id,
  tenant_id: currentTenant.id,  // FEHLER: Spalte existiert nicht!
  ...
};
```

### Loesung
**Datei:** `src/components/GlobalQuickNoteDialog.tsx`

```typescript
// Zeilen 52-66 aendern
const insertData = {
  user_id: user.id,
  // tenant_id entfernen - existiert nicht in quick_notes
  title: title.trim() || null,
  content: content.trim() || title.trim(),
  is_pinned: false,
  priority_level: 0,
  is_archived: false
};
```

Ausserdem die tenant-bezogene Logik vereinfachen:
- Entferne `useTenant` Hook wenn nicht benoetigt
- Entferne `tenantLoading` und `currentTenant` Checks

---

## Problem 2: Farbmodus-Probleme (mehrere Issues)

### 2a: Card wird immer eingefaerbt obwohl nur Rand gewuenscht

**Aktuelle Logik (QuickNotesList.tsx Zeilen 1257-1264):**
```typescript
backgroundColor: note.color && note.color_full_card 
  ? `${note.color}40` // 25% opacity for full card
  : note.color 
    ? `${note.color}20` // 12% opacity for accent  <-- PROBLEM!
    : undefined
```

**Problem:** Wenn `color_full_card` false ist, wird trotzdem `20%` Opacity gesetzt.

**Loesung:**
```typescript
backgroundColor: note.color && note.color_full_card === true
  ? `${note.color}40` // 25% opacity for full card mode
  : undefined  // Kein Hintergrund wenn nur Rand
```

### 2b: Global geteilte Notizen laden color_full_card nicht

**Aktuelle Abfrage (Zeilen 279-286):**
```typescript
.select(`
  id, title, content, color, is_pinned, created_at, updated_at, user_id,
  is_archived, task_id, meeting_id, priority_level, follow_up_date, pending_for_jour_fixe,
  meetings!meeting_id(title, meeting_date)
`)  // FEHLT: color_full_card, decision_id, task_archived_info, decision_archived_info, meeting_archived_info
```

**Loesung:** SELECT erweitern wie bei individuell geteilten Notizen (Zeilen 248-252).

### 2c + 2d: Farbe bei geteilten Notizen nicht aenderbar

**Problem:** Die Funktionen `handleSetColor` und `handleSetColorMode` filtern mit `.eq("user_id", user.id)`, was bei geteilten Notizen fehlschlaegt.

**Loesung 1: UI anpassen**
- Farbmenue nur fuer eigene Notizen ODER geteilte Notizen mit `can_edit` anzeigen
- Wenn `can_edit` true: Updates ohne `user_id` Filter (RLS regelt Berechtigung)

**Loesung 2: Update-Funktionen anpassen**
```typescript
const handleSetColor = async (noteId: string, color: string | null) => {
  // Finde die Notiz um Besitzer zu pruefen
  const note = notes.find(n => n.id === noteId);
  if (!note) return;
  
  try {
    let updateQuery = supabase
      .from("quick_notes")
      .update({ color })
      .eq("id", noteId);
    
    // Nur bei eigenen Notizen user_id Filter
    if (note.user_id === user?.id) {
      updateQuery = updateQuery.eq("user_id", user.id);
    }
    // Bei geteilten Notizen mit can_edit: RLS regelt es
    
    const { data, error } = await updateQuery.select();
    // ... rest
  }
};
```

Gleiche Logik fuer `handleSetColorMode`.

---

## Problem 3: NoteDecisionCreator Features nicht sichtbar

### Analyse
Der Code in `NoteDecisionCreator.tsx` enthaelt alle Features:
- Zeilen 365-376: Oeffentlich-Checkbox mit `Globe` Icon
- Zeilen 378-387: TopicSelector
- Zeilen 389-400: DecisionFileUpload mit `Paperclip` Icon

**Moegliche Ursachen:**
1. Build/Deploy nicht aktualisiert
2. Browser-Cache
3. Fehler beim Laden der Sub-Komponenten

**Loesung:**
1. Hard-Refresh des Browsers (Cmd+Shift+R)
2. Sicherstellen dass alle Imports vorhanden sind
3. Pruefen ob `TopicSelector` und `DecisionFileUpload` korrekt geladen werden

Falls das nicht hilft: Die Komponente-Struktur validieren und ggf. neu bauen.

---

## Zusammenfassung der Dateiaenderungen

| Datei | Aenderung |
|-------|-----------|
| `src/components/GlobalQuickNoteDialog.tsx` | `tenant_id` aus Insert entfernen, Tenant-Checks vereinfachen |
| `src/components/shared/QuickNotesList.tsx` | 1) Background nur bei `color_full_card === true`; 2) Global Shares SELECT erweitern; 3) Update-Funktionen fuer Shared Notes anpassen |

---

## Detaillierte Code-Aenderungen

### GlobalQuickNoteDialog.tsx

```typescript
// Zeilen 8-9: useTenant kann entfernt werden
import { useAuth } from "@/hooks/useAuth";
// import { useTenant } from "@/hooks/useTenant"; // Nicht benoetigt

// Zeile 19: Entfernen
// const { currentTenant } = useTenant();
// const tenantLoading = !currentTenant;

// Zeilen 44-47: Entfernen
// if (!currentTenant?.id) {
//   toast.error("Mandant wird geladen, bitte erneut versuchen");
//   return;
// }

// Zeilen 52-66: Vereinfachen
const insertData = {
  user_id: user.id,
  title: title.trim() || null,
  content: content.trim() || title.trim(),
  is_pinned: false,
  priority_level: 0,
  is_archived: false
};

// Zeile 132: Button vereinfachen
<Button onClick={handleSave} disabled={saving}>
  {saving ? (
    <>
      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      Speichern...
    </>
  ) : (
    "Speichern"
  )}
</Button>
```

### QuickNotesList.tsx

**1. Card-Hintergrund korrigieren (Zeilen 1257-1264):**
```typescript
style={{ 
  borderLeftColor: note.color || "#3b82f6",
  backgroundColor: note.color && note.color_full_card === true
    ? `${note.color}40` // 25% opacity for full card mode only
    : undefined  // Kein Hintergrund wenn nur Rand
}}
```

**2. Global Shares SELECT erweitern (Zeilen 279-286):**
```typescript
const { data: globallySharedData } = await supabase
  .from("quick_notes")
  .select(`
    id, title, content, color, color_full_card, is_pinned, created_at, updated_at, user_id,
    is_archived, task_id, meeting_id, decision_id, priority_level, follow_up_date, pending_for_jour_fixe,
    task_archived_info, decision_archived_info, meeting_archived_info,
    meetings!meeting_id(title, meeting_date)
  `)
  .in("user_id", globalShareUserIds)
  .eq("is_archived", false)
  .is("deleted_at", null);
```

**3. handleSetColor anpassen (Zeilen 553-579):**
```typescript
const handleSetColor = async (noteId: string, color: string | null) => {
  if (!user?.id) {
    toast.error("Nicht angemeldet");
    return;
  }

  const note = notes.find(n => n.id === noteId);
  if (!note) {
    toast.error("Notiz nicht gefunden");
    return;
  }

  // Pruefe Berechtigung
  const canModify = note.user_id === user.id || note.can_edit === true;
  if (!canModify) {
    toast.error("Keine Berechtigung zum Aendern dieser Notiz");
    return;
  }

  try {
    let updateQuery = supabase
      .from("quick_notes")
      .update({ color })
      .eq("id", noteId);
    
    // Nur bei eigenen Notizen user_id Filter hinzufuegen
    if (note.user_id === user.id) {
      updateQuery = updateQuery.eq("user_id", user.id);
    }
    
    const { data, error } = await updateQuery.select();

    if (error) throw error;
    
    if (!data || data.length === 0) {
      toast.error("Farbe konnte nicht geaendert werden");
      return;
    }
    
    toast.success(color ? "Farbe gesetzt" : "Farbe entfernt");
    loadNotes();
  } catch (error) {
    console.error("Error setting color:", error);
    toast.error("Fehler beim Setzen der Farbe");
  }
};
```

**4. handleSetColorMode anpassen (Zeilen 583-613):**
```typescript
const handleSetColorMode = async (noteId: string, fullCard: boolean) => {
  if (!user?.id) {
    toast.error("Nicht angemeldet");
    return;
  }

  const note = notes.find(n => n.id === noteId);
  if (!note) {
    toast.error("Notiz nicht gefunden");
    return;
  }

  // Pruefe Berechtigung
  const canModify = note.user_id === user.id || note.can_edit === true;
  if (!canModify) {
    toast.error("Keine Berechtigung zum Aendern dieser Notiz");
    return;
  }

  // Optimistic update
  setNotes(prev => prev.map(n => 
    n.id === noteId ? { ...n, color_full_card: fullCard } : n
  ));

  try {
    let updateQuery = supabase
      .from("quick_notes")
      .update({ color_full_card: fullCard })
      .eq("id", noteId);
    
    // Nur bei eigenen Notizen user_id Filter
    if (note.user_id === user.id) {
      updateQuery = updateQuery.eq("user_id", user.id);
    }

    const { error } = await updateQuery;

    if (error) {
      // Rollback on error
      setNotes(prev => prev.map(n => 
        n.id === noteId ? { ...n, color_full_card: !fullCard } : n
      ));
      throw error;
    }
    
    toast.success(fullCard ? "Ganze Card eingefaerbt" : "Nur Kante eingefaerbt");
  } catch (error) {
    console.error("Error setting color mode:", error);
    toast.error("Fehler beim Setzen des Farbmodus");
  }
};
```

**5. Farbmenue fuer geteilte Notizen mit can_edit anzeigen (Zeilen 1686-1740):**
```typescript
{/* Color Submenu - auch fuer geteilte Notizen mit edit-Recht */}
{(note.user_id === user?.id || note.can_edit === true) && (
  <DropdownMenuSub>
    <DropdownMenuSubTrigger>
      <Palette className="h-3 w-3 mr-2" />
      Farbe
      {note.color && (
        <span 
          className="ml-auto w-3 h-3 rounded-full border"
          style={{ backgroundColor: note.color }}
        />
      )}
    </DropdownMenuSubTrigger>
    {/* ... rest bleibt gleich */}
  </DropdownMenuSub>
)}
```

---

## Umsetzungsreihenfolge

1. **GlobalQuickNoteDialog** - tenant_id entfernen (kritischer Bug)
2. **QuickNotesList** - Card-Hintergrund korrigieren
3. **QuickNotesList** - Global Shares SELECT erweitern
4. **QuickNotesList** - Update-Funktionen fuer Shared Notes anpassen
5. **NoteDecisionCreator** - Browser-Cache leeren und validieren
