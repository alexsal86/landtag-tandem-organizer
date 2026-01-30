

# Plan: 5 Fehler in Aufgaben und Notizen beheben

## Übersicht der Probleme

| # | Problem | Ursache | Lösung |
|---|---------|---------|--------|
| 1 | Fehlermeldung beim Speichern (Änderungen werden trotzdem gespeichert) | onTaskUpdate-Callback führt zu Re-Render-Problemen oder es wird ein Toast angezeigt bevor die UI aktualisiert ist | Fehlerbehandlung verbessern |
| 2 | Checkbox-Fehler beim Erledigen, keine Archivierung | Zwei DB-Fehler: (a) `text @>` Operator ungültig für TEXT-Spalte, (b) `task_decision_participants.created_at` existiert nicht | Falsche `.cs.` Operatoren durch `.eq.` und `.ilike.` ersetzen; Query für `created_at` auf `invited_at` umstellen |
| 3 | HTML wird als Text angezeigt in Aufgaben-Details | `Textarea` statt Rich-Text-Editor/Display | Textarea durch SimpleRichTextEditor ersetzen |
| 4 | HTML-Vorschau in Meine Notizen zeigt HTML-Tags | Vorschau-Funktion entfernt Tags korrekt, aber HTML-Entitäten werden nicht dekodiert | HTML-Content vor Tag-Entfernung erst durch temporäres Element parsen |
| 5 | Pfeil `→` sichtbar ohne Hover | Designentscheidung: Pfeil wird bei `hasLinkedItems` ohne Hover angezeigt | Pfeil nur auf Hover sichtbar machen |

---

## Detaillierte Analyse

### Problem 1: Fehlermeldung beim Speichern

Die `handleSave` Funktion in `TaskDetailSidebar.tsx` (Zeile 202-244) funktioniert korrekt. Das Problem könnte sein:
- Der Toast erscheint als "Fehler", obwohl die Speicherung erfolgreich ist
- Das UI wird nicht korrekt aktualisiert nach dem Speichern

Ich muss die Konsolenausgabe prüfen oder den Fehler reproduzieren. Die wahrscheinlichste Ursache ist ein Seiteneffekt bei `onTaskUpdate`.

### Problem 2: Checkbox-Fehler beim Erledigen

**Gefundene DB-Fehler in den Analytics-Logs:**
```
ERROR: operator does not exist: text @> unknown
ERROR: column task_decision_participants.created_at does not exist
```

**Ursachen:**
1. In `useMyWorkNewCounts.tsx` Zeile 94:
   ```typescript
   .or(`assigned_to.cs.{${user.id}},user_id.eq.${user.id}`)
   ```
   Der `.cs.` Operator ist für ARRAY-Spalten, aber `assigned_to` ist TEXT.

2. In `useMyWorkNewCounts.tsx` Zeile 104:
   ```typescript
   .gt('created_at', decisionsLastVisit);
   ```
   Die Tabelle `task_decision_participants` hat keine `created_at` Spalte, nur `invited_at`.

Diese Fehler verursachen, dass die Seite nicht korrekt lädt und andere Operationen fehlschlagen können.

### Problem 3: HTML in Aufgaben-Details

In `TaskDetailSidebar.tsx` Zeile 620-627:
```typescript
<Textarea
  id="description"
  value={editFormData.description || ''}
  onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
  rows={3}
/>
```

Es wird ein einfaches Textarea verwendet. Die Lösung ist, `SimpleRichTextEditor` zu verwenden (wie bei Quick Notes).

### Problem 4: HTML-Vorschau in Meine Notizen

In `QuickNotesList.tsx` Zeile 1072-1076:
```typescript
const getPreviewText = (content: string, maxLength = 150) => {
  const text = content.replace(/<[^>]*>/g, '').trim();
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
};
```

Diese Funktion entfernt nur HTML-Tags mit Regex, dekodiert aber keine HTML-Entitäten wie `&lt;`, `&gt;`, `&nbsp;` etc. Wenn der Editor HTML-Entitäten speichert, werden diese als Klartext angezeigt.

### Problem 5: Pfeil `→` ohne Hover sichtbar

In `QuickNotesList.tsx` Zeile 1217-1218:
```typescript
{hasLinkedItems && (
  <span className="text-sm text-muted-foreground group-hover:hidden">→</span>
)}
```

Der Pfeil ist immer sichtbar wenn `hasLinkedItems` wahr ist und wird nur beim Hover ausgeblendet. Das sollte umgekehrt sein: nur beim Hover sichtbar.

---

## Lösung

### 1. useMyWorkNewCounts.tsx - DB-Query korrigieren

**Zeile 94:** `.cs.` durch `.eq.` und `.ilike.` ersetzen:
```typescript
// VORHER:
.or(`assigned_to.cs.{${user.id}},user_id.eq.${user.id}`)

// NACHHER:
.or(`assigned_to.eq.${user.id},assigned_to.ilike.%${user.id}%,user_id.eq.${user.id}`)
```

**Zeile 104:** `created_at` durch `invited_at` ersetzen:
```typescript
// VORHER:
.gt('created_at', decisionsLastVisit);

// NACHHER:
.gt('invited_at', decisionsLastVisit);
```

### 2. TaskDetailSidebar.tsx - Rich-Text-Editor einbauen

**Import hinzufügen:**
```typescript
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
```

**Textarea durch Editor ersetzen (Zeile 620-627):**
```typescript
<div>
  <Label htmlFor="description">Beschreibung</Label>
  <SimpleRichTextEditor
    content={editFormData.description || ''}
    onChange={(html) => setEditFormData(prev => ({ ...prev, description: html }))}
    placeholder="Beschreibung eingeben..."
  />
</div>
```

### 3. QuickNotesList.tsx - HTML-Vorschau korrigieren

**Zeile 1072-1076 - getPreviewText verbessern:**
```typescript
const getPreviewText = (content: string, maxLength = 150) => {
  // Create a temporary element to properly decode HTML entities
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = content;
  const text = tempDiv.textContent || tempDiv.innerText || '';
  const trimmedText = text.trim();
  if (trimmedText.length <= maxLength) return trimmedText;
  return trimmedText.substring(0, maxLength).trim() + '...';
};
```

### 4. QuickNotesList.tsx - Pfeil nur auf Hover

**Zeile 1215-1219 - Pfeil mit Hover-Visibility:**
```typescript
{/* RIGHT: Icons on hover only */}
<div className="flex items-center gap-1 flex-shrink-0">
  {/* Simple "→" - visible on hover when linked items exist */}
  {hasLinkedItems && (
    <span className="text-sm text-muted-foreground hidden group-hover:inline">→</span>
  )}
  
  {/* Rest bleibt gleich */}
```

Oder alternativ den Pfeil komplett entfernen, da der "Details"-Button bereits auf Hover erscheint:
```typescript
{/* Remove the arrow entirely - Details button shows on hover */}
```

---

## Zusammenfassung der Änderungen

| Datei | Zeile | Änderung |
|-------|-------|----------|
| `src/hooks/useMyWorkNewCounts.tsx` | 94 | `.cs.` durch `.eq.` und `.ilike.` ersetzen |
| `src/hooks/useMyWorkNewCounts.tsx` | 104 | `created_at` → `invited_at` |
| `src/components/TaskDetailSidebar.tsx` | 2 | Import SimpleRichTextEditor |
| `src/components/TaskDetailSidebar.tsx` | 620-627 | Textarea → SimpleRichTextEditor |
| `src/components/shared/QuickNotesList.tsx` | 1072-1076 | getPreviewText mit DOM-Parser |
| `src/components/shared/QuickNotesList.tsx` | 1217-1218 | Pfeil entfernen oder auf Hover beschränken |

---

## Erwartete Ergebnisse

1. **Aufgaben bearbeiten:** Keine Fehlermeldung mehr, reibungsloses Speichern
2. **Checkbox zum Erledigen:** Aufgabe wird korrekt archiviert und aus der Liste entfernt
3. **Aufgaben-Details:** Rich-Text-Editor zum Bearbeiten der Beschreibung
4. **Notizen-Vorschau:** HTML wird korrekt als lesbarer Text dargestellt
5. **Notizen-Pfeil:** Nur sichtbar beim Hovern oder komplett entfernt

