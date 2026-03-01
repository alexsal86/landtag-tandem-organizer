

# Fix: Brieftext wird nach Refresh nicht im Editor angezeigt

## Ursache

Ein React-Timing-Problem: Die `draftContentNodes` werden per `useEffect` gesetzt, aber `useEffect` laeuft NACH dem ersten Render. Auf dem ersten Render ist `draftContentNodes` noch `null`, der Editor mountet mit leerem Inhalt, und `ContentPlugin` markiert sich als "schon geladen". Wenn dann `useEffect` die richtigen Daten setzt, ignoriert das Plugin sie.

```text
Render 1:  draftContentNodes = null  →  Editor mountet mit leerem Content  →  hasLoadedRef = true
Effect:    draftContentNodes = letter.content_nodes  →  aber Editor ignoriert (schon geladen)
Render 2:  Editor bekommt neue Props, aber ContentPlugin tut nichts mehr
```

## Loesung

Im `contentNodes`-Prop des Editors direkt auf `letter?.content_nodes` zurueckfallen, falls `draftContentNodes` noch leer ist. Gleich fuer `content`:

### Aenderung in `src/components/LetterEditor.tsx` (Zeile ~1912-1913)

```typescript
// Vorher:
content={draftContent}
contentNodes={draftContentNodes}

// Nachher:
content={draftContent || letter?.content || ''}
contentNodes={draftContentNodes ?? letter?.content_nodes ?? undefined}
```

Damit bekommt der Editor schon beim ersten Render die richtigen Daten direkt aus dem `letter`-Prop, unabhaengig davon ob der `useEffect` schon gelaufen ist.

### Betroffene Datei

| Datei | Aenderung |
|---|---|
| `src/components/LetterEditor.tsx` | Zeile 1912-1913: Fallback auf `letter?.content` und `letter?.content_nodes` |

### Warum sicher

- Sobald `useEffect` laeuft und `draftContentNodes` befuellt, wird der Fallback nicht mehr benoetigt (OR/Nullish-Coalescing greift nur bei leerem Wert)
- Kein Feedback-Loop, da ContentPlugin weiterhin nur einmal beim Mount laedt
- `key={letter?.id || 'new'}` erzwingt bei Briefwechsel weiterhin einen Neuaufbau

