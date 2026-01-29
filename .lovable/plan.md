

# Plan: Quick Notes Cards - Feinabstimmung der UI

## Übersicht der 4 Änderungen

| # | Problem | Lösung |
|---|---------|--------|
| 1 | Shared-Notizen werden nicht in Indikatoren angezeigt | `is_shared && owner` Prüfung korrigieren für geteilte Notizen von anderen |
| 2 | Indikatoren sollen am unteren Rand der Card kleben | Position von `mt-3` auf `absolute bottom-2 left-3` ändern |
| 3 | Expand-Pfeil losgelöst von Beschreibung | Pfeil inline im Text nach "..." eingliedern, nicht separat |
| 4 | Hover-Icons überlagern Text | Icons nach unten links verschieben, neben "> Details" mit Trennstrich |

---

## 1. Shared-Indikator für geteilte Notizen anzeigen

**Problem:** Bei der Notiz "Petitionen bearbeiten" (geteilt von Franziska) wird kein violettes Quadrat/Badge angezeigt.

**Ursache (Zeile 1058):** Die Bedingung prüft nur auf `share_count > 0` (für eigene geteilte Notizen) ODER `is_shared && owner` (für mit mir geteilte). Da die Notiz von Franziska geteilt wurde, muss `is_shared` true sein und `owner` gesetzt.

**Lösung:** Die Bedingung ist korrekt, aber die Darstellung zeigt das Quadrat nicht konsistent. Die Condition in Zeile 1035 muss erweitert werden:

```typescript
// Zeile 1035 - AKTUELL:
{(hasLinkedItems || (note.share_count || 0) > 0 || (note.is_shared && note.owner)) && (

// Bleibt gleich, aber sicherstellen dass is_shared-Notizen immer erkannt werden
const hasShared = (note.share_count || 0) > 0 || (note.is_shared === true);
```

Und in den Quadraten (Zeile 1057-1063):
```typescript
{/* Shared indicator as square - für BEIDE Fälle */}
{((note.share_count || 0) > 0 || note.is_shared) && (
  <div 
    className="w-1.5 h-1.5 bg-violet-500" 
    title={note.is_shared ? `Geteilt von ${note.owner?.display_name || 'Unbekannt'}` : "Geteilt"}
  />
)}
```

---

## 2. Indikatoren am unteren Rand der Card positionieren

**Problem:** Die Indikatoren haben nur `mt-3` Abstand, aber sollen am unteren Rand "kleben".

**Lösung:** Die Indikatoren-Sektion absolut am unteren Rand positionieren:

```typescript
// Zeile 1036 - AKTUELL:
<div className="flex items-center gap-2 mt-3">

// NACHHER: Absolute Positionierung unten links
{(hasLinkedItems || hasShared) && (
  <div className="absolute bottom-2 left-3 flex items-center gap-2">
    {/* Small squares */}
    <div className="flex items-center gap-1.5 group-hover:hidden">
      {/* ... squares ... */}
    </div>
    
    {/* Full badges on hover */}
    <div className="hidden group-hover:flex items-center gap-1.5 flex-wrap">
      {/* ... badges ... */}
    </div>
  </div>
)}
```

**Zusätzlich:** Die Card braucht etwas mehr Padding unten für die Indikatoren:
```typescript
// Zeile 988
<div className="p-3 pb-8 rounded-lg border...">
```

---

## 3. Expand-Pfeil inline in Beschreibung eingliedern

**Problem:** Der Pfeil steht losgelöst neben der Beschreibung. Er soll direkt nach "...nicht auf Beschwerden reagieren..." erscheinen.

**Aktuelle Struktur (Zeile 1007-1021):**
```typescript
<div className="flex items-start">
  <RichTextDisplay content={note.content} className="line-clamp-2" />
  {needsTruncation && (
    <button className="ml-0.5">
      <span>...</span>
      <ArrowRight />
    </button>
  )}
</div>
```

**Problem:** `RichTextDisplay` ist ein Block-Element und der Button steht daneben.

**Lösung:** Den Pfeil INNERHALB des Textflusses anzeigen, nicht als separates Element:

```typescript
{/* Description with INLINE expand arrow after text */}
{isExpanded ? (
  // ... expanded view ...
) : (
  <div className="text-sm text-muted-foreground/70">
    <span className="line-clamp-2">
      {getPreviewText(note.content, 150)}
      {needsTruncation && (
        <button 
          className="inline-flex items-center text-primary hover:underline ml-0"
          onClick={(e) => toggleNoteExpand(note.id, e)}
        >
          <ArrowRight className="h-3.5 w-3.5 inline" strokeWidth={2.5} />
        </button>
      )}
    </span>
  </div>
)}
```

Dabei wird `getPreviewText` angepasst um den Text bis zur Zeichengrenze zu liefern:
```typescript
const getPreviewText = (content: string, maxLength = 150) => {
  const text = content.replace(/<[^>]*>/g, '').trim();
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
};
```

**Visuelles Ergebnis:**
```
"...nicht auf Beschwerden reagieren..."→
                                       ↑ Pfeil direkt nach den drei Punkten
```

---

## 4. Hover-Icons nach unten links, neben "> Details"

**Problem:** Die Hover-Icons (Zeile 1376-1499) sind oben rechts und überlagern Text/Menü.

**Neue Positionierung:** Unten links, neben dem "Details"-Indikator, getrennt mit vertikalem Strich.

**Aktuelle Position (Zeile 1378-1379):**
```typescript
<div className={cn(
  "absolute top-2 right-8 flex items-center gap-1",
  ...
)}>
```

**Neue Position:**
```typescript
{/* Hover Quick Actions + Details - bottom right of card */}
<div className={cn(
  "absolute bottom-2 right-3 flex items-center gap-1",
  "opacity-0 group-hover:opacity-100 transition-opacity duration-200"
)}>
  {/* Details expand button */}
  {needsTruncation && !isExpanded && (
    <button 
      className="text-xs text-primary font-medium flex items-center"
      onClick={(e) => toggleNoteExpand(note.id, e)}
    >
      <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
      <span className="ml-0.5">Details</span>
    </button>
  )}
  
  {/* Vertical separator */}
  {note.user_id === user?.id && needsTruncation && !isExpanded && (
    <div className="h-4 w-px bg-border mx-1" />
  )}
  
  {/* Quick action icons */}
  {note.user_id === user?.id && (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-muted/80 rounded-full" onClick={...}>
              <Pencil className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Bearbeiten</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      {/* ... Task, Decision, Follow-up, Jour Fixe icons ... */}
      
      {/* Drag Handle - LAST */}
      {dragHandleProps && (
        <div {...dragHandleProps} className="cursor-grab p-1 hover:bg-muted/80 rounded-full">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      )}
    </>
  )}
</div>
```

---

## Visuelle Darstellung

**Ohne Hover:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│ [🔶]                                                              [⋮]  │
│ Notiz-Titel                                                            │
│ Beschreibung mit maximal zwei Zeilen und dann nicht auf               │
│ Beschwerden reagieren...→                                              │
│                                                                         │
│                                                                         │
│ ■ ■ ■ ■  (Quadrate unten links am Rand)                               │
└─────────────────────────────────────────────────────────────────────────┘
```

**Mit Hover:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│ [🔶]                                                              [⋮]  │
│ Notiz-Titel                                                            │
│ Beschreibung mit maximal zwei Zeilen und dann nicht auf               │
│ Beschwerden reagieren...→                                              │
│                                                                         │
│ [Aufgabe→] [Entsch.→] [JF:28.01.→] [Geteilt von Franziska]            │
│                           [→ Details | ✏️ ☑️ 🗳️ 🕐 📅 ≡]              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Zusammenfassung der Änderungen

| Datei | Zeilen | Änderung |
|-------|--------|----------|
| `QuickNotesList.tsx` | 1035-1063 | Shared-Indikator Bedingung für beide Fälle |
| `QuickNotesList.tsx` | 1036 | Indikatoren `absolute bottom-2 left-3` |
| `QuickNotesList.tsx` | 988 | Card Padding erhöhen `pb-8` |
| `QuickNotesList.tsx` | 1007-1021 | Expand-Pfeil inline nach Text |
| `QuickNotesList.tsx` | 1376-1499 | Icons nach `bottom-2 right-3`, mit `|` vor "> Details" |

---

## Geschätzter Aufwand

| Änderung | Zeit |
|----------|------|
| Shared-Indikator für beide Fälle | 5 Min |
| Indikatoren absolut unten | 10 Min |
| Expand-Pfeil inline | 15 Min |
| Hover-Icons unten links mit Separator | 15 Min |
| **Gesamt** | **~45 Min** |

