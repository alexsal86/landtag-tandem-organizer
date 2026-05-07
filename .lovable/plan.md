## Live-Vorschau aufräumen (`AppointmentPreparationDataTab.tsx`, Zeilen 611–637)

Aktuell hat die Vorschau einen eigenen Scrollcontainer (`max-h-[calc(100vh-8rem)] overflow-y-auto`) und ist auf `scale-[0.85]` zusammengestaucht — dadurch wirkt sie eng und „klemmt" beim Scrollen.

### Änderungen

1. **Eigener Scroll entfernen.** `max-h-…` und `overflow-y-auto` entfallen. Die Vorschau wächst natürlich und scrollt mit der Seite.
2. **Sticky bleibt, aber „losgelöst", wenn länger als der Viewport.** Wrapper bekommt `sticky top-4 self-start` und die Karte zusätzlich `max-h-[calc(100vh-2rem)] overflow-y-auto` **nur dann sichtbar, wenn der Inhalt länger ist** — als Fallback. Alternative (besser zum Referenzbild): kein eigenes Sticky, sondern nur `self-start` — die Vorschau scrollt komplett mit. → **Wir nehmen die zweite Variante**, denn das Referenzbild zeigt die Vorschau ohne eigenen Scrollstatus.
3. **Skalierung entfernen.** `text-xs origin-top scale-[0.85]` raus. Standard-Schriftgrößen, dezenter Rahmen.
4. **Mehr Breite geben.** Grid `xl:grid-cols-12` → linke Spalte `col-span-4`, mittlere `col-span-4`, Vorschau **`col-span-4`** (statt 3). Dadurch wirkt die Vorschau wie im Referenz-Mockup nicht mehr eng.
5. **Visuelles Tuning passend zum Referenzbild:**
   - Card: weißer Hintergrund (`bg-card`), normaler Rahmen statt `border-dashed`.
   - Header der Vorschau: Mini-Caption „LIVE-VORSCHAU" + dezente „autosave"-Hinweis (`saving` State) rechts.
6. **Ab `xl` einblenden bleibt** (auf kleinen Screens hidden).

### Resultat

- Kein doppelter Scroll mehr.
- Vorschau in normaler Lesegröße, nutzt ~⅓ der Breite.
- Layout entspricht dem Referenz-Mockup (Bild 1).

### Betroffene Datei

- `src/components/appointment-preparations/AppointmentPreparationDataTab.tsx` — Grid-Klassen + Vorschau-Block (Zeilen 422 und 611–637).
