

# Tageszettel: 7 Verbesserungen

## 1. HR-Linie: Gleichmaessiger Abstand oben und unten

**Problem:** Die horizontale Linie (`<hr>`) hat visuell ungleichen Abstand -- sie klebt zu nah am unteren Element.

**Loesung:** Die Lexical-Theme-Klasse `horizontalRule: "my-3 border-border/80"` wird angepasst. Zusaetzlich wird ein symmetrisches Padding/Margin ueber eine Custom-CSS-Regel sichergestellt, da die DaySlipLineNode (`mb-1.5`) den Abstand nach oben verkuerzt. Der Wert wird auf `my-4` erhoehen oder ein explizites `pt-2` auf die nachfolgende Zeile angewandt.

**Datei:** `src/components/GlobalDaySlipPanel.tsx` (editorTheme)

---

## 2. "In heute uebernehmen" zuverlaessig machen

**Problem:** `carryOverFromYesterday()` schreibt nur in den `store` (HTML), aber der Lexical-Editor ist bereits gemountet und zeigt den alten State. Die neuen Zeilen erscheinen erst nach einem Page-Refresh. Ausserdem wird `nodes: undefined` gesetzt, was beim naechsten Editor-Mount dazu fuehrt, dass der HTML-Pfad genutzt wird -- aber der Editor mountet nicht neu.

**Loesung:**
- Nach dem Store-Update wird der Editor direkt ueber `editorRef.current.update()` aktualisiert, indem die neuen Zeilen als `DaySlipLineNode`-Nodes an den Root angehaengt werden (analog zu `appendLinesToToday`).
- Tatsaechlich kann `carryOverFromYesterday` die bereits existierende `appendLinesToToday`-Funktion nutzen, die genau das tut: Zeilen dedupliziert in den laufenden Editor einfuegen.
- Der "Gestern noch offen"-Banner wird nach erfolgreicher Uebernahme ausgeblendet (z.B. ueber einen `carriedOver`-State).

**Datei:** `src/components/GlobalDaySlipPanel.tsx`

---

## 3. Labeled HR: `--- Mittag` erzeugt Trennlinie mit Beschriftung

**Problem:** Aktuell wird nur reines `---` erkannt. Der Nutzer moechte `--- Text` eingeben und eine HR-Linie mit zentriertem Label erhalten.

**Loesung:**
- Die `isRuleLine`-Pruefung wird erweitert: Ein neuer Helper `parseRuleLine(text)` gibt `{ isRule: boolean; label?: string }` zurueck. Pattern: `---` gefolgt von optionalem Text.
- Ein neuer Lexical `DecoratorNode` namens `LabeledHorizontalRuleNode` wird erstellt:
  - Speichert ein `label`-Feld (z.B. "Mittag")
  - Rendert als `<div>` mit einer Linie links, Text in der Mitte, Linie rechts (CSS: `flex items-center gap-2` mit `<hr class="flex-1" />` links und rechts)
  - Serialisiert/deserialisiert das Label in JSON
- Im `DaySlipEnterBehaviorPlugin` wird bei erkanntem `--- Mittag` statt `$createHorizontalRuleNode()` ein `$createLabeledHorizontalRuleNode("Mittag")` eingefuegt.
- Ohne Label (reines `---`) bleibt das Verhalten wie bisher.

**Neue Datei:** `src/components/LabeledHorizontalRuleNode.tsx`
**Bearbeitet:** `src/components/GlobalDaySlipPanel.tsx`

---

## 4. Drag-and-Drop-Aufgaben persistent mit Task verknuepfen

**Problem:** Aktuell wird beim Drop nur der Titel mit einem Checkmark-Emoji eingefuegt. Es gibt keine tatsaechliche Verknuepfung zur Aufgabe in der Datenbank.

**Loesung:**
- Beim Drop wird zusaetzlich die Task-ID aus `application/x-mywork-task-id` (muss im Drag-Source gesetzt werden) gelesen.
- Im `DaySlipLineNode` wird ein optionales Feld `linkedTaskId` hinzugefuegt, das in `exportJSON`/`importJSON` persistiert wird.
- Zeilen mit `linkedTaskId` behalten ihre Verknuepfung unabhaengig von Textaenderungen.
- Das Checkmark-Icon wird als visueller Indikator beibehalten und ggf. klickbar gemacht, um die Aufgabe zu oeffnen.
- Die Task-Drag-Source-Komponenten muessen `application/x-mywork-task-id` im `dataTransfer` setzen (falls noch nicht vorhanden).

**Bearbeitet:**
- `src/components/DaySlipLineNode.ts` (neues Feld `linkedTaskId`)
- `src/components/GlobalDaySlipPanel.tsx` (Drop-Handler liest Task-ID, uebergibt an Node)
- Task-Drag-Source-Komponenten (setzen `application/x-mywork-task-id`)

---

## 5. X-Button schliesst Panel ohne Tag zu beenden

**Problem:** Der X-Button ruft `handleClose` auf, das bei offenen Punkten den Resolve-Modus startet statt einfach zu schliessen.

**Loesung:**
- Der X-Button bekommt einen eigenen Handler, der einfach `animateClosePanel()` aufruft -- ohne Resolve-Logik.
- Die "Tag abschliessen"-Logik bleibt ausschliesslich beim Footer-Button.

**Datei:** `src/components/GlobalDaySlipPanel.tsx` (Zeile ~1081)

---

## 6. Placeholder verschwindet bei Fokus

**Problem:** Der Placeholder-Text "Was steht heute an?" bleibt auch bei Fokus sichtbar. Er sollte nur erscheinen, wenn der Editor leer ist UND keinen Fokus hat.

**Loesung:**
- Ein `isFocused`-State wird im Editor oder via Plugin (`FOCUS_COMMAND` / `BLUR_COMMAND`) getrackt.
- Der Placeholder bekommt eine zusaetzliche CSS-Klasse, die ihn bei Fokus ausblendet: `opacity-0` wenn fokussiert, `opacity-100` wenn nicht fokussiert und leer.
- Alternativ: Der Placeholder-`<div>` wird nur gerendert, wenn `!isFocused && isEmpty`.

**Datei:** `src/components/GlobalDaySlipPanel.tsx` (DaySlipEditor + neues FocusPlugin)

---

## 7. Weitere Feature-Ideen fuer den Tageszettel

Hier einige Ideen, die den Tageszettel weiter aufwerten koennten:

- **Zeitstempel pro Zeile**: Automatisch die Uhrzeit erfassen, wann ein Punkt hinzugefuegt oder abgehakt wurde -- nuetzlich fuer Zeitnachweise.
- **Pomodoro/Timer-Integration**: Ein kleiner Timer pro Zeile oder global, um fokussierte Arbeitszeiten zu tracken.
- **Prioritaets-Markierungen**: Zeilen mit `!` oder `!!` am Anfang farblich hervorheben (gelb/rot) als schnelle Priorisierung.
- **Tagesrueckblick/Statistik**: Am Ende des Tages eine kleine Zusammenfassung: X von Y erledigt, Y offene Punkte uebertragen, Z Minuten getrackt.
- **Vorlagen/Templates**: Neben wiederkehrenden Punkten auch ganze Tagesvorlagen (z.B. "Sitzungstag", "Homeoffice-Tag") mit vordefinierten Bloecken und HR-Trennlinien.
- **Drag-Reihenfolge**: Zeilen per Drag-and-Drop innerhalb des Tageszettels umsortieren.
- **Kontextmenu**: Rechtsklick auf eine Zeile fuer schnelle Aktionen (Aufgabe erstellen, Notiz, Snoozen, Loeschen).

---

## Technische Zusammenfassung

| Nr. | Aenderung | Dateien |
|-----|-----------|---------|
| 1 | HR-Spacing anpassen | `GlobalDaySlipPanel.tsx` |
| 2 | carryOver via appendLinesToToday | `GlobalDaySlipPanel.tsx` |
| 3 | LabeledHorizontalRuleNode | Neue Datei + `GlobalDaySlipPanel.tsx` |
| 4 | linkedTaskId in DaySlipLineNode | `DaySlipLineNode.ts` + `GlobalDaySlipPanel.tsx` + Drag-Sources |
| 5 | X-Button = einfach schliessen | `GlobalDaySlipPanel.tsx` |
| 6 | Placeholder bei Fokus ausblenden | `GlobalDaySlipPanel.tsx` |

