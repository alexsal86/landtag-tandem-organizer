## Redesign „Deine Termine heute" im Dashboard

### Meinung zum Konzept

Das Mockup ist eine deutliche Verbesserung — die Tabellenform (Zeit links, Titel mittig, Briefing-Badge rechts) ist viel ruhiger als die aktuelle Inline-Liste mit `HH:mm – Titel`. Drei Punkte halte ich für besonders gut:

1. **Mono-Zeitspalte** schafft eine klare visuelle Achse — Termine werden auf einen Blick scanbar.
2. **Punkt + beiger Background + grüne Mono-Zeit** für den laufenden Termin ist subtiler als alles, was wir aktuell haben (wir hervorheben laufende Termine bisher gar nicht).
3. **Header-Meta** rechts oben (`6 Termine · nächster 10:30`) ist nützlich und ersetzt das aktuelle Emoji-Heading.

**Zum Tagestext:** Den Motivationsspruch (aus `selectMessage`) würde ich **behalten** — er macht das Dashboard menschlich und ist bereits Teil des etablierten UX-Tons. Idee: **Briefing zuerst, dann Spruch** als zweite Zeile in muted color. Wenn kein Briefing existiert, bleibt nur der Spruch — kein Loch im Layout. Wenn mehrere Briefings vorhanden sind, zeigen wir das erste ungelesene (Rest bleibt im bestehenden `TodayBriefingPanel` darüber sichtbar).

„Landespolitik BW" steht im aktuellen Code nicht — das war reiner Mockup-Text und wird nicht übernommen.

### Geltungsbereich

Geändert wird ausschließlich der **Termine-Block innerhalb von `DashboardGreetingSection`**. Konkret:

- `DashboardAppointmentList.tsx` → komplettes Layout-Refactoring (Tabellen-Style)
- `DashboardGreetingSection.tsx` → Termine-Header (`📅 Deine Termine heute:`) wird durch neuen strukturierten Header ersetzt; Tagestext-Block bekommt einen Briefing-Snippet davor
- **Keine** Änderungen an: `TodaySchedule.tsx` (alte Komponente, woanders verwendet), `TodayBriefingPanel`, Datenmodell, RPC, Hooks für Daten

### Visuelle Spezifikation (am Mockup orientiert, mit unseren Tokens)

**Container**
- Eingerahmter Card-Look: `border border-border rounded-lg p-5 bg-card`
- Ersetzt das bisherige unstrukturierte Inline-Rendering

**Header-Zeile**
```
Deine Termine heute        6 Termine · nächster 10:30
```
- Links: `text-base font-semibold text-foreground`
- Rechts: `font-mono text-xs text-muted-foreground`
- "nächster 10:30" wird aus `appointments` berechnet (erster Termin mit `start_time > now`); fehlt → nur „6 Termine"
- Bei `isShowingTomorrow`: „Deine Termine morgen"

**Briefing- + Spruch-Block (zwischen Header und Liste)**
- Erste Zeile: erstes ungelesenes Tagesbriefing (Auszug aus `content`, Plaintext, `line-clamp-2`) — Daten via `useTodayBriefings()`
- Zweite Zeile: vorhandener `selectMessage`-Spruch in `text-muted-foreground`
- Beide Zeilen `text-sm leading-relaxed`, Abstand `mb-4`
- Wenn kein Briefing: nur der Spruch (kein leerer Platz)

**Listen-Zeilen** (eine Zeile pro Termin)
```
[Zeit-Spalte 60px]  [Titel + Ort]                 [BRIEFING-Badge]
```
- Grid: `grid grid-cols-[60px_1fr_auto] gap-4 items-center py-3`
- Trenner: `divide-y divide-border` am Container
- **Zeit**: `font-mono text-sm text-muted-foreground` — bei laufendem Termin → `text-primary font-semibold`
- **Titel**: `text-[15px] text-foreground`, darunter `location` als `text-xs text-muted-foreground`
- **Bei laufendem Termin**: kleiner gefüllter `<span className="inline-block h-2 w-2 rounded-full bg-primary mr-2 animate-pulse">` direkt vor dem Titel
- **Hintergrund laufender Termin**: `bg-muted/40` (das beige im Mockup) und `-mx-2 px-2 rounded` damit der Rahmen unter den Trennlinien zu sehen ist
- **Briefing-Badge** (rechts): `<span className="font-mono text-[10px] tracking-wider text-primary border border-primary/40 rounded px-2 py-1">BRIEFING</span>` — klickbar, öffnet das bestehende Briefing-Panel inline darunter (gleiche Logik wie heute mit `openBriefings` Set)

**Laufend-Erkennung**
```ts
const now = new Date();
const isOngoing = (apt) =>
  !apt.is_all_day &&
  new Date(apt.start_time) <= now &&
  new Date(apt.end_time ?? new Date(apt.start_time).getTime() + 3600000) > now;
```

**Briefing-Inline-Expansion (bestehendes Verhalten beibehalten)**
- Klick auf BRIEFING-Badge togglet `openBriefings` Set
- Aufgeklappt: bestehender `<AppointmentBriefingView ... compact />` + Quick-Action-Buttons (Notiz/Aufgabe/Gelesen) bleiben funktional unverändert, nur visuell unterhalb der Tabellenzeile mit `pl-[60px]` (eingerückt unter die Zeitspalte)

**Live-Briefing-Icon (ExternalLink)**
- Wandert zu kleinem Icon-Button rechts neben dem BRIEFING-Badge, nur bei `hasBriefing` sichtbar (Hover-only: `opacity-0 group-hover:opacity-100`)

### Grünton

Aktueller `--primary` ist `#57ab27` (Heitlinger-Grün). Der Mockup-Grünton ist etwas dunkler/sattuierter (~`#3a8a3a`). Wir nutzen weiterhin `text-primary` / `border-primary` — damit fügt sich die Komponente konsistent ins Design ein. Das BRIEFING-Badge mit `border-primary/40` und `text-primary` reproduziert die Mockup-Optik gut, ohne neue Farbtokens einzuführen.

### Umsetzungsschritte

1. **Helper hinzufügen** in `DashboardAppointmentList.tsx`:
   - `getNextUpcomingTime(appointments)` → `HH:mm` oder `null`
   - `isOngoing(apt)` → `boolean`

2. **Layout neu schreiben** in `DashboardAppointmentList.tsx`:
   - Card-Container, Header-Zeile, Grid-basierte Termin-Zeilen
   - Briefing-Badge ersetzt aktuelles `ClipboardList` + `ChevronDown`
   - Quick-Action-Buttons + Dialoge (Notiz, Aufgabe, Gelesen) bleiben strukturell identisch — nur Container der Expansion wird angepasst (eingerückte Position)

3. **`DashboardGreetingSection.tsx` anpassen**:
   - `useTodayBriefings()` aufrufen, ersten ungelesenen Briefing-Auszug extrahieren
   - Bestehenden Termine-Header (`📅 **Deine Termine heute:**`) aus `fullText` entfernen
   - `DashboardAppointmentList` erhält zusätzlich Props: `briefingSnippet?: string`, `motivationalText: string` — beide rendert die Liste oben im neuen Card-Header

4. **Briefing-Snippet erzeugen**:
   - HTML aus `content` zu Plaintext (vorhandener Pattern: `.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()`)
   - Mit `line-clamp-2`
   - Optional: Autorname als `<strong>` voran (analog `BriefingComposerCard`)

### Was unverändert bleibt

- `useDashboardAppointmentsData` (Datenfluss)
- `useTodayBriefings` (nur lesend genutzt)
- `TodayBriefingPanel` über dem Grid (zeigt weiterhin alle Briefings im Detail)
- Quick-Actions Notiz/Aufgabe/Gelesen + zugehörige Mutationen
- Live-Briefing-Navigation (`/briefing-live`)
- Externe Termine, All-Day-Logik, „morgen statt heute" Fallback

### Verifikation nach Fix

- 1+ heutiger Termin → Tabelle wird gerendert, Header zeigt Anzahl & nächste Uhrzeit
- Termin mit `start_time ≤ now < end_time` → beige Background, grüne Zeit, pulsender Punkt
- Termin mit Briefing → BRIEFING-Badge sichtbar, Klick expandiert Inline-Briefing wie bisher
- Mitarbeiter-Briefing existiert → erscheint als Auszug über der Liste, Spruch in Zeile 2
- Kein Mitarbeiter-Briefing → nur Spruch, keine Lücke
- `isShowingTomorrow` → „Deine Termine morgen", keine Laufend-Hervorhebung (alle in Zukunft)
- Keine Termine heute → bestehender Empty-State-Pfad bleibt erhalten

### Betroffene Dateien

- `src/components/dashboard/DashboardAppointmentList.tsx` — Hauptarbeit (~80% neu)
- `src/components/dashboard/DashboardGreetingSection.tsx` — Termine-Header aus Text entfernen, Briefing-Snippet weiterreichen (~15 Zeilen)
