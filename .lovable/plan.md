

# Verbesserungen der Kommentar-Threading-Linien

## Probleme im aktuellen Zustand

1. **Aussetzer/Luecken**: Die vertikale Linie hat Unterbrechungen zwischen Kommentaren, weil `space-y-2` Gaps erzeugt, die die absolut positionierten Linien nicht ueberbruecken
2. **Linienstaerke**: Aktuell nur 1px -- soll auf 2px verdoppelt werden
3. **Abstand zu Avataren**: Linien beginnen/enden direkt am Avatar -- soll etwas Luft haben (ca. 4px)
4. **Harte Ecken**: Der L-Konnektor besteht aus zwei geraden Linien -- soll einen weichen, abgerundeten Uebergang haben (wie bei Facebook)

## Loesung

### 1. Durchgaengige Linien ohne Aussetzer

- Die vertikale Linie des Eltern-Kommentars (die von dessen Avatar nach unten geht) muss aus dem `group flex`-Container heraus in den aeusseren `relative`-Container verschoben werden, damit sie ueber die gesamte Hoehe inkl. `space-y-2` Gaps laeuft
- Die vertikale Fortsetzungslinie bei nicht-letzten Replies muss ebenfalls `bottom: 0` korrekt referenzieren und ueber den vollen Bereich gehen

### 2. Linienstaerke verdoppeln

- Alle `width: '1px'` und `height: '1px'` Angaben auf `2px` aendern

### 3. Abstand zu Avataren

- Vertikale Linie beginnt nicht direkt am Avatar-Rand, sondern mit ~4px Abstand (`top: AVATAR_SIZE + 4` statt `AVATAR_SIZE`)
- L-Konnektor endet nicht direkt am Avatar, sondern mit ~4px Abstand (horizontale Linie 4px kuerzer)

### 4. Weicher L-Uebergang (abgerundete Ecke)

- Den L-Konnektor durch ein einzelnes `div` mit `border-left` + `border-bottom` und `border-radius` auf der unteren linken Ecke ersetzen
- Das erzeugt eine weiche, abgerundete Kurve wie bei Facebook
- Radius ca. 8px fuer einen natuerlichen Uebergang

## Technische Details

**Datei: `src/components/task-decisions/CommentThread.tsx`**

Aenderungen im Detail:

- **L-Konnektor** (depth > 0): Die zwei separaten divs (vertikal + horizontal) werden durch ein einziges div ersetzt:
  - `border-left: 2px solid` + `border-bottom: 2px solid` mit `border-bottom-left-radius: 8px`
  - Hoehe vom oberen Rand bis zum Avatar-Center, Breite bis 4px vor dem Avatar
  - Farbe: `border-border/70`

- **Vertikale Linie bei Replies** (depth > 0, nicht letztes Element): Breite auf 2px, Position bleibt gleich

- **Vertikale Linie des Elternkommentars** (hasReplies): 
  - Aus dem inneren flex-Container herausnehmen und in den aeusseren Container verschieben
  - Start: `AVATAR_SIZE + 4` px von oben (4px Abstand vom Avatar)
  - Breite: 2px
  - `bottom: 0` damit sie bis zum Ende des Containers (inkl. Replies) laeuft

- **Replies-Container**: `space-y-2` beibehalten, aber die Linien laufen jetzt korrekt durch, da sie im uebergeordneten Container positioniert sind

Keine anderen Dateien muessen geaendert werden.
