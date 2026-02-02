
# Plan: RLS-Policy-Fix und Notizen-Verbesserungen

## Problem 1: Notizen verschwunden - KRITISCH

### Ursache
Die kürzlich erstellte Migration `20260202133351` hat eine **zirkuläre RLS-Policy-Abhängigkeit** verursacht:

1. **`meetings` SELECT Policy** prüft:
   ```sql
   EXISTS (SELECT 1 FROM meeting_participants mp WHERE mp.meeting_id = meetings.id AND mp.user_id = auth.uid())
   ```

2. **`meeting_participants` SELECT Policy** prüft:
   ```sql
   EXISTS (SELECT 1 FROM meetings m WHERE m.id = meeting_participants.meeting_id AND m.user_id = auth.uid())
   ```

3. Wenn `QuickNotesList` einen Join auf `meetings!meeting_id` macht, wird die `meetings` RLS-Policy ausgewertet, die wiederum `meeting_participants` prüft, was wiederum `meetings` prüft → **Endlosschleife!**

### Lösung
Eine korrigierte Migration erstellen, die die Rekursion bricht:

```sql
-- 1. Entferne die problematische Policy
DROP POLICY IF EXISTS "Users can view meetings they own, participate in, or are public" ON public.meetings;

-- 2. Erstelle eine nicht-rekursive Version für meetings
-- Nutze security_barrier view ODER vereinfache die Policy
CREATE POLICY "Users can view meetings they own or are public"
ON public.meetings FOR SELECT
USING (
  user_id = auth.uid()
  OR is_public = true
  OR tenant_id = ANY (get_user_tenant_ids(auth.uid()))
);

-- 3. Für Teilnehmer-Sichtbarkeit: Separate Abfrage im Code statt RLS
-- ODER: Nutze eine SECURITY DEFINER Funktion um die Rekursion zu brechen:

CREATE OR REPLACE FUNCTION is_meeting_participant(p_meeting_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM meeting_participants
    WHERE meeting_id = p_meeting_id
    AND user_id = auth.uid()
  );
$$;

-- Dann in der Policy:
CREATE POLICY "Users can view accessible meetings"
ON public.meetings FOR SELECT
USING (
  user_id = auth.uid()
  OR is_public = true
  OR is_meeting_participant(id)
);
```

---

## Problem 2: Verbesserungsvorschläge für Notizen

Nach Analyse des aktuellen Notizen-Systems (`QuickNotesList.tsx`) sehe ich folgende Verbesserungsmöglichkeiten:

### 2.1 Fehlende Features

| Feature | Status | Beschreibung |
|---------|--------|--------------|
| Tags/Labels | ❌ Nicht implementiert | `tags` Spalte existiert in DB, wird aber nicht genutzt |
| Kategorien | ❌ Nicht implementiert | `category` Spalte existiert in DB, wird aber nicht genutzt |
| Volltextsuche | ❌ Fehlt | Keine Suchfunktion für Notizen |
| Farben nutzen | ⚠️ Teilweise | `color` Spalte existiert, UI zum Setzen fehlt |
| Export | ❌ Fehlt | Keine Möglichkeit, Notizen zu exportieren |
| Duplikate | ❌ Fehlt | Keine Funktion zum Duplizieren von Notizen |
| Templates | ❌ Fehlt | Keine Vorlagen für häufige Notiztypen |

### 2.2 UX-Verbesserungen

| Bereich | Aktuelle Situation | Verbesserung |
|---------|-------------------|--------------|
| Suche | Keine Suche | Suchfeld mit Echtzeit-Filterung |
| Filter | Nur nach Priorität | Filter nach Tags, Datum, Meeting-Zuordnung |
| Sortierung | Fest (pinned → created_at) | Wählbare Sortierung (Datum, Titel, Priorität) |
| Bulk-Aktionen | Keine | Mehrfachauswahl für Löschen, Archivieren, Priorität |
| Schnellnotiz | Umständlich | Floating Action Button + Tastenkürzel (Strg+N) |
| Mobile | Scrollbereich | Optimierte Touch-Gesten für Swipe-Aktionen |

### 2.3 Konkrete Implementierungsvorschläge

**A. Tags-System aktivieren:**
```typescript
// Neuer State
const [selectedTags, setSelectedTags] = useState<string[]>([]);
const [availableTags, setAvailableTags] = useState<string[]>([]);

// Tag-Filter UI
<div className="flex flex-wrap gap-1">
  {availableTags.map(tag => (
    <Badge 
      key={tag} 
      variant={selectedTags.includes(tag) ? "default" : "outline"}
      onClick={() => toggleTag(tag)}
    >
      {tag}
    </Badge>
  ))}
</div>
```

**B. Suchfunktion:**
```typescript
const [searchQuery, setSearchQuery] = useState("");
const filteredNotes = notes.filter(n => 
  n.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
  n.content.toLowerCase().includes(searchQuery.toLowerCase())
);
```

**C. Farb-Picker:**
```typescript
const colors = ['#fef3c7', '#dbeafe', '#dcfce7', '#fce7f3', '#e9d5ff'];
// Im Dropdown-Menü
<DropdownMenuSub>
  <DropdownMenuSubTrigger>Farbe</DropdownMenuSubTrigger>
  <DropdownMenuSubContent>
    <div className="flex gap-1 p-1">
      {colors.map(c => (
        <button 
          key={c} 
          className="w-6 h-6 rounded-full" 
          style={{ backgroundColor: c }}
          onClick={() => setNoteColor(note.id, c)}
        />
      ))}
    </div>
  </DropdownMenuSubContent>
</DropdownMenuSub>
```

**D. Tastenkürzel für schnelle Notizen:**
```typescript
// Global keyboard shortcut
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      openQuickNoteDialog();
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

---

## Umsetzungsplan

### Phase 1: Kritisches Fix (SOFORT)
1. **DB-Migration** - RLS-Policy-Rekursion beheben
2. **Testen** - Notizen laden wieder für alle Benutzer

### Phase 2: Quick Wins (Optional)
3. **Suchfunktion** - Filterung nach Text
4. **Farb-Picker** - Nutzen der vorhandenen `color` Spalte
5. **Tags aktivieren** - Nutzen der vorhandenen `tags` Spalte

### Phase 3: Erweiterte Features (Optional)
6. **Tastenkürzel** - Strg+N für Schnellnotiz
7. **Export** - PDF/Markdown Export
8. **Vorlagen** - Notiz-Templates

---

## Technische Details

### Migration zur Behebung der Rekursion

```sql
-- Fix: Remove circular dependency between meetings and meeting_participants RLS policies

-- Step 1: Create a SECURITY DEFINER function to check participant status
-- This breaks the recursion because it runs with elevated privileges
CREATE OR REPLACE FUNCTION public.is_meeting_participant(p_meeting_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.meeting_participants
    WHERE meeting_id = p_meeting_id
    AND user_id = auth.uid()
  );
$$;

-- Step 2: Drop the problematic policy
DROP POLICY IF EXISTS "Users can view meetings they own, participate in, or are public" ON public.meetings;

-- Step 3: Create a non-recursive policy using the function
CREATE POLICY "Users can view accessible meetings"
ON public.meetings FOR SELECT
USING (
  user_id = auth.uid()
  OR is_public = true
  OR public.is_meeting_participant(id)
  OR tenant_id = ANY (get_user_tenant_ids(auth.uid()))
);

-- Note: The existing tenant-based policy might still work, but this explicit one
-- ensures participants can always see their meetings
```

### Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `supabase/migrations/[timestamp]_fix_rls_recursion.sql` | Neue Migration |
| `src/components/shared/QuickNotesList.tsx` | Suchfunktion, Tags, Farben (optional) |
| `src/components/widgets/QuickNotesWidget.tsx` | Tastenkürzel (optional) |

---

## Erwartete Ergebnisse

1. **Notizen funktionieren wieder** - Kein RLS-Rekursionsfehler mehr
2. **Optional: Bessere UX** - Suche, Tags, Farben für Notizen
