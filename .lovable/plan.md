

# Globale Suche verbessern

## Probleme & Lösungen

### 1. Navigation im Dialog entfernen
Die Navigation-Gruppe (Zeilen 609-624, `navigationItems`) wird angezeigt wenn kein Suchbegriff eingegeben ist. Das ist redundant, da die Navigation bereits in der Sidebar existiert. Diese Gruppe wird komplett entfernt — stattdessen bleiben nur "Zuletzt gesucht" und "Beliebte Suchen" als leerer Zustand.

### 2. Dialog verbreitern
Die `CommandDialog` nutzt `DialogContent` mit `max-w-lg` (32rem). In `command.tsx` wird die `CommandDialog`-Klasse auf `max-w-2xl` (42rem) geändert, um mehr Platz für Ergebnisse zu schaffen.

### 3. Ergebnisse erscheinen erst beim zweiten Öffnen
Das Problem liegt im Debounce-Timing zusammen mit `cmdk`. Wenn der Dialog mit einer Query via `openGlobalSearch` geöffnet wird, wird `searchQuery` per `queueMicrotask` gesetzt — aber `debouncedQuery` hinkt 500ms hinterher. Zusätzlich: `cmdk` filtert intern nach dem `value`-Prop der Items, aber die Items existieren noch nicht (queries laufen noch). 

Lösung: Wenn der Dialog mit einer Query geöffnet wird, wird `debouncedQuery` sofort synchron mitgesetzt (kein Debounce nötig bei programmatischer Öffnung). Der Debounce-Timer wird nur für Tastatureingaben verwendet.

### 4. Highlight beim Navigieren zu Ergebnissen
Aktuell navigiert `runCommand` zu Routes mit Query-Parametern (z.B. `?section=contacts&contact=ID`). Damit das Ergebnis auf der Zielseite visuell hervorgehoben wird:

- Ein neuer Query-Parameter `highlight=ID` wird an die Navigation-URLs angehängt
- Ein kleiner shared Hook `useHighlightedItem()` liest `highlight` aus den URL-Params
- Die relevanten Views (Kontakte, Aufgaben, Fallakten, Dokumente, etc.) nutzen diesen Hook, um das Element mit einem temporären Highlight-Ring (`ring-2 ring-primary animate-pulse`) zu versehen und automatisch dorthin zu scrollen (`scrollIntoView`)
- Das Highlight verschwindet nach 3 Sekunden automatisch

## Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/components/GlobalSearchCommand.tsx` | Navigation entfernen, debouncedQuery sofort setzen bei programmatischer Öffnung, `highlight`-Param an URLs |
| `src/components/ui/command.tsx` | `max-w-lg` → `max-w-2xl` in CommandDialog |
| `src/hooks/useHighlightedItem.ts` | Neuer Hook: liest `highlight` aus URL, gibt `isHighlighted(id)` + Ref-Callback zurück |
| Diverse Views (Kontakte-Liste, Aufgaben-Liste, Fallakten-Liste, etc.) | `useHighlightedItem` integrieren für Scroll + Ring-Animation |

## Umsetzungsreihenfolge

1. Navigation-Gruppe entfernen + Dialog verbreitern
2. Debounce-Bug fixen (sofortige Query bei programmatischer Öffnung)
3. `useHighlightedItem` Hook erstellen
4. Highlight-Integration in den wichtigsten Views

