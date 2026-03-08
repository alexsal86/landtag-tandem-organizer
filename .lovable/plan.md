

# Speech-Diktat auf Profi-Niveau — Analyse und Plan

## Ist-Zustand

Das System ist bereits solide aufgebaut:
- Web Speech API Adapter mit Session-Reconnect und Delta-Deduplication
- Interim-Nodes (halbtransparent, kursiv) als Live-Preview im Editor
- Sprachbefehle: Formatierung (fett/kursiv/unterstrichen), Listen, Undo/Redo, Neue Zeile, Stopp
- Zeichensetzung per Sprache (Punkt, Komma, Fragezeichen etc.)
- Push-to-Talk (Strg+Shift+M) und Toggle-Klick
- Filler-Wort-Filterung (ähm, äh, hm, bitte, okay...)
- Unit-Tests für Adapter und Command-Parser

## Was fehlt für Profi-Niveau

### 1. Erweiterte Sprachbefehle
Aktuell nur 8 Befehle. Für professionelles Diktieren fehlen:
- **"Alles markieren"** / **"Markierung aufheben"** — `select-all` / `deselect`
- **"Letztes Wort löschen"** / **"Letzten Satz löschen"** — gezieltes Korrigieren per Sprache
- **"Überschrift 1/2/3"** — Heading-Formatierung
- **"Zitat einfügen"** — Block-Quote
- **"Leerzeichen"** — explizites Whitespace (für Fälle wo Punkt+Leerzeichen nicht reicht)
- **"Bindestrich"** / **"Gedankenstrich"** — Sonderzeichen per Sprache
- **"Klammer auf"** / **"Klammer zu"** — `(` / `)`
- **"Anführungszeichen"** / **"Anführungszeichen zu"** — `„` / `"`

### 2. Audio-Feedback / Bestätigungstöne
Professionelle Diktiersoftware gibt akustisches Feedback:
- Kurzer Ton beim Start der Aufnahme
- Kurzer Ton beim Stopp
- Optionaler Bestätigungston bei erkanntem Befehl
- Implementierung: Kleine Audio-Dateien oder `AudioContext.oscillator` für synthetische Töne

### 3. Sprachbefehl-Bestätigung in der UI
Wenn ein Befehl erkannt wird (z.B. "fett"), fehlt visuelles Feedback:
- Kurze Toast-artige Einblendung "✓ Fett" in der Toolbar-Nähe
- Dauer: ~1s, dann ausblenden
- Hilft dem Nutzer zu verstehen, dass der Befehl angekommen ist

### 4. "Ersetze X durch Y"-Befehl
Profi-Diktiersoftware erlaubt Korrekturen per Sprache:
- "Ersetze [Wort] durch [Wort]" — sucht im letzten Absatz und ersetzt
- Neuer Command-Typ `replace-text` mit `search` und `replacement` Feldern
- Pattern: `/^ersetze\s+(.+?)\s+durch\s+(.+)$/`

### 5. Automatische Großschreibung nach Satzzeichen (verbessert)
`formatDictatedText` macht bereits Uppercase nach Punkt. Fehlt:
- Großschreibung nach `!` und `?`
- Großschreibung nach `\n` (Absatzanfang)
- Nomen-Erkennung ist unrealistisch ohne NLP, aber Satzanfänge sind machbar

### 6. Sprachkommando-Palette / Cheat-Sheet Dialog
Der Tooltip mit Befehlen ist klein. Professionelle Lösung:
- Ein aufrufbarer Dialog (über `?`-Button oder Sprachbefehl "Hilfe") mit allen verfügbaren Befehlen
- Gruppiert nach Kategorie (Navigation, Formatierung, Satzzeichen, Korrektur)
- Durchsuchbar

### 7. Diktat-Session-Statistik
Kleines Widget während der Aufnahme:
- Dauer der aktuellen Session (Timer)
- Anzahl erkannter Wörter
- Zeigt dem Nutzer, dass das System aktiv arbeitet

## Priorisierter Implementierungsplan

| Prio | Feature | Aufwand | Dateien |
|------|---------|---------|---------|
| 1 | Erweiterte Sprachbefehle (Sonderzeichen, Löschen, Headings) | Klein | `speechCommandUtils.ts`, beide Toolbars |
| 2 | Visuelles Befehl-Feedback ("✓ Fett") | Klein | `useSpeechDictation.ts`, beide Toolbars |
| 3 | Audio-Feedback (Start/Stopp-Töne) | Klein | `speechToTextAdapter.ts` oder neues `speechAudioFeedback.ts` |
| 4 | "Ersetze X durch Y" | Mittel | `speechCommandUtils.ts`, `useSpeechDictation.ts` |
| 5 | Verbessertes Auto-Capitalize (nach !, ?, Absatz) | Klein | `speechCommandUtils.ts` |
| 6 | Sprachbefehl-Dialog statt Tooltip | Klein | Neue Komponente `SpeechCommandsDialog.tsx` |
| 7 | Session-Timer / Wort-Zähler | Klein | `useSpeechDictation.ts`, beide Toolbars |

### Technische Details

**Erweiterte Befehle** — Neue Einträge in `COMMAND_MATCHERS` und `PUNCTUATION_REPLACEMENTS`:
```text
SpeechCommand union erweitern um:
  | { type: 'delete-last-word' }
  | { type: 'delete-last-sentence' }
  | { type: 'select-all' }
  | { type: 'insert-heading'; level: 1 | 2 | 3 }
  | { type: 'insert-quote' }
  | { type: 'replace-text'; search: string; replacement: string }
```

**Audio-Feedback** — Neues Utility `speechAudioFeedback.ts`:
```text
playTone('start')  → 440Hz, 100ms
playTone('stop')   → 330Hz, 100ms
playTone('command') → 520Hz, 80ms
```
Aufgerufen im Adapter bei `onStateChange('listening')` und `onStateChange('idle')`.

**Befehl-Feedback** — Neuer State `lastRecognizedCommand` im Hook, der nach 1.2s auf `null` zurückgesetzt wird. In den Toolbars als Badge neben dem Mikrofon angezeigt.

**Replace-Befehl** — Neuer Regex-Matcher in `parseSpeechInput`, der vor den normalen Befehlen geprüft wird. `dispatchCommand` im Editor sucht rückwärts im aktuellen Paragraph-Node nach dem Suchtext.

