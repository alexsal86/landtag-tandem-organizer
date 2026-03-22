

## Briefing-PDF Redesign

### Build-Fehler beheben

**Zeile 399** in `briefingPdfGenerator.ts`: Der Cast `(doc.internal as { getCurrentPageInfo: ... })` funktioniert nicht mit dem jsPDF-Typ. Fix: `(doc.internal as unknown as { getCurrentPageInfo: ... })` — analog zu Zeile 507 wo bereits `as unknown as` verwendet wird.

### Logo einbinden

Das hochgeladene `logo_fraktion.png` wird nach `public/assets/logo_fraktion.png` kopiert, damit es im PDF per `loadImageElement("/assets/logo_fraktion.png")` geladen werden kann.

### PDF-Layout-Redesign (orientiert am Screenshot)

**Header (weiß, keine Hintergrundfarbe):**
- Logo links oben (ca. 18mm)
- Daneben: "GRÜNE Fraktion · Landtag Baden-Württemberg" (klein)
- Grüne Trennlinie darunter
- "BRIEFING" klein und zentriert unter der Linie
- Termintitel groß und fett (16pt)
- Datum · Uhrzeit · Ort darunter (11pt)

**Zwei-Spalten-Layout mit Card-Design:**

Jede Sektion bekommt einen leichten grünen Hintergrund (`GREEN_BG`) mit abgerundeten Ecken — wie Cards in der Grafik. Section-Labels in dunklem Grün, uppercase.

**Reihenfolge und Spalten-Zuordnung:**

| Links | Rechts |
|---|---|
| Gesprächspartner (1. Stelle) | Ziel des Termines (objectives) |
| Kernbotschaft (hervorgehoben) | Begleitpersonen |
| Hintergrund (audience + facts) | Anlass des Besuchs |
| Gesprächspunkte (talking_points + key_topics) | Ablauf (program) |
| Meine Position / Linie | Todos vor Termin (checklist) |
| Kritische Fragen | Öffentlichkeitsarbeit (Social Media / Presse Badges) |
| Weitere Notizen | Notizen-Bereich (leer, liniert) |

**Neue Design-Elemente:**
- Cards: `GREEN_BG` Hintergrund mit 2mm Radius, kein Rahmen
- Kernbotschaft: eigene Card über volle Breite mit Magenta-Akzentlinie
- Öffentlichkeitsarbeit: Social Media / Presse als Badges in einer Card
- "Todos nach Termin": leere Checkboxen (wie im Screenshot) — statischer Block
- Notizen-Bereich: linierter leerer Bereich für handschriftliche Notizen
- Footer: "Vertraulich – Nur zur internen Verwendung" + Seitenzahl

### Dateien

| Datei | Aktion |
|---|---|
| `public/assets/logo_fraktion.png` | Logo kopieren |
| `src/components/appointment-preparations/briefingPdfGenerator.ts` | Komplett überarbeiten |

