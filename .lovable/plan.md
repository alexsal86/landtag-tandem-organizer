

# Fix: Labeled HR Rendering + Datenverlust beim Schliessen

## Problem 1: Labeled HR zeigt keine Linien

**Ursache:** `createDOM()` erzeugt einen Flex-Container, und `decorate()` gibt einen weiteren verschachtelten `<div>` mit eigenem Flex-Layout zurueck. Lexical mountet das React-Element von `decorate()` als Kind in den `createDOM()`-Container. Zwei verschachtelte Flex-Container verhindern, dass die `<hr>`-Elemente sich korrekt ausdehnen.

**Loesung (wie von Claude vorgeschlagen):**
- `createDOM()` wird zum vollstaendigen Flex-Container mit `alignItems: center` und `gap`
- `decorate()` gibt ein React Fragment (`<>...</>`) zurueck statt eines verschachtelten `<div>` -- so landen die `<hr>` und `<span>` direkt im Flex-Container von `createDOM()`
- Margin (`my-4`) wird ueber `createDOM()` inline gesetzt, da es der aeussere DOM-Knoten ist

**Datei:** `src/components/LabeledHorizontalRuleNode.tsx`

---

## Problem 2: Text verschwindet beim Schliessen/Oeffnen

**Ursache:** `editorKey` wird bei jedem `open`-Wechsel inkrementiert. Das erzwingt einen kompletten Remount des Editors. Da der Editor beim Remount `todayData.html`/`todayData.nodes` als Props bekommt, und `store` als React-State erhalten bleibt, sollte das eigentlich funktionieren -- ABER: der Remount passiert im gleichen Render-Zyklus wie `setOpen(true)`, und `animateClosePanel` flusht `store` in localStorage. Das eigentliche Problem ist subtiler:

Der `editorKey`-Increment beim Oeffnen ist unnoetig und schaedlich. Der Editor-State lebt im React-State (`store`), nicht nur in localStorage. Beim Schliessen bleibt `store` intakt. Beim Wiederoeffnen muss der Editor NICHT neu gemountet werden -- er kann einfach mit seinem bestehenden Lexical-State weiterleben.

**Loesung:** 
- `editorKey` wird auf `todayKey` gesetzt (stabiler String, aendert sich nur beim Tagwechsel)
- Der `useEffect` mit `setEditorKey` bei `open`-Aenderung wird entfernt
- Der Editor bleibt beim Oeffnen/Schliessen gemountet und behaelt seinen State
- Der `animateClosePanel`-Flush bleibt als Sicherheitsnetz fuer localStorage

**Datei:** `src/components/GlobalDaySlipPanel.tsx`

---

## Technische Details

### LabeledHorizontalRuleNode.tsx

```text
createDOM():
  div.style.display = "flex"
  div.style.alignItems = "center"
  div.style.width = "100%"
  div.style.gap = "12px"
  div.style.margin = "16px 0"
  div.style.userSelect = "none"
  div.contentEditable = "false"

decorate():
  return (
    <>
      <hr ... />
      <span ...>{label}</span>
      <hr ... />
    </>
  )
  // Kein umschliessendes <div> mehr
```

### GlobalDaySlipPanel.tsx

```text
Entfernen (Zeile 507-511):
  const [editorKey, setEditorKey] = useState(0);
  useEffect(() => { if (open) setEditorKey(k => k + 1); }, [open]);

DaySlipEditor (Zeile 1278):
  key={todayKey}   // statt key={editorKey}

parseEditorState Fehlerdiagnose (im InitialContentPlugin):
  catch-Block erhaelt console.warn fuer Debugging
```

