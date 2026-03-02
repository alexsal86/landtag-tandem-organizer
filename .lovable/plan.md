
Ziel: Speech Recognition in den Editoren (insb. Quick Notes mit `SimpleRichTextEditor`) wieder zuverlässig aktivierbar machen und die Implementierung robuster + besser diagnostizierbar machen.

## Befund aus der Analyse

Ich habe die relevanten Pfade geprüft:

- `src/hooks/useSpeechDictation.ts`
- `src/lib/speechToTextAdapter.ts`
- `src/components/ui/SimpleRichTextEditor.tsx`
- `src/components/EnhancedLexicalToolbar.tsx`
- Quick-Notes-Flows (`GlobalQuickNoteDialog`, `MyWorkQuickCapture`, `QuickNotesWidget`)

Wichtige Erkenntnisse:

1. **Hauptursache (Regression): Effekt-Reset im Hook**
   - In `useSpeechDictation` hängt der zentrale `useEffect` von `dispatchCommand` und `insertText` ab.
   - Diese Funktionen werden in den Toolbars aktuell nicht durchgehend stabil referenziert (teils inline).
   - Ergebnis: Bei Re-Renders läuft Cleanup (`speechAdapter.destroy()`), wodurch die Aufnahme sofort wieder auf `idle` kippt.
   - Symptom passt exakt: **Mic-Button wirkt „ohne Effekt“ / wird nicht aktiv**.

2. **CSP/Permissions sind bereits korrekt**
   - `vite.config.ts` hat `microphone=(self)`; der frühere Blocker ist damit nicht mehr der primäre Grund.

3. **Quick Notes ist nicht überall gleich**
   - In manchen Quick-Notes-Varianten wird `SimpleRichTextEditor` genutzt (mit Mic).
   - In `QuickNotesWidget` ist der Body aktuell noch `Textarea` (ohne Speech-Button). Das ist kein Defekt, aber uneinheitlich.

4. **Fehlersichtbarkeit ist inkonsistent**
   - `SimpleRichTextEditor` zeigt Toasts.
   - `EnhancedLexicalToolbar` hat aktuell schlechteres Fehlerverhalten (z. B. disabled ohne klare Interaktion).

## Umsetzungsplan (konkret)

### 1) Hook stabilisieren (kritischer Fix)
Datei: `src/hooks/useSpeechDictation.ts`

- `insertText` und `dispatchCommand` über `useRef` stabilisieren:
  - `insertTextRef.current = insertText`
  - `dispatchCommandRef.current = dispatchCommand`
- Event-Handler des Adapters so umbauen, dass sie **Refs** verwenden statt volatile Closures.
- Den Setup-Effekt von volatilen Callback-Dependencies entkoppeln, damit `speechAdapter.destroy()` **nicht** bei jedem Render feuert.
- Cleanup nur bei tatsächlichem Unmount/Editor-Wechsel.

Erwarteter Effekt:
- `speechState` bleibt beim Start auf `listening`.
- Mic-Button bleibt sichtbar aktiv.
- Keine sofortige „silent stop“-Schleife mehr.

### 2) Aufrufstellen härten (Stabilität + Lesbarkeit)
Dateien:
- `src/components/ui/SimpleRichTextEditor.tsx`
- `src/components/EnhancedLexicalToolbar.tsx`

- `dispatchCommand` und `insertText` in beiden Komponenten mit `useCallback` stabilisieren.
- In `EnhancedLexicalToolbar` das Speech-Button-Verhalten an `SimpleRichTextEditor` angleichen:
  - Klick auch bei „nicht unterstützt“ erlaubt, dann klare Toast-Meldung statt reinem `disabled`.
  - Sichtbarer aktiver Zustand (bereits vorhanden, bei Bedarf vereinheitlichen).

### 3) Schnell-Diagnostik einbauen (für echte Geräteprobleme)
Datei: `src/lib/speechToTextAdapter.ts`

- Präziseres Fehler-Mapping erweitern (z. B. iframe/policy-Hinweis bei `not-allowed`/`service-not-allowed`).
- Optionale, leichtgewichtige Debug-Logs (nur development), damit klar ist:
  - `start()` aufgerufen?
  - `onstart/onend/onerror` Reihenfolge?
  - welcher Fehlercode kam zurück?

### 4) Quick-Notes UX konsistent machen (optional, aber empfohlen)
Datei: `src/components/widgets/QuickNotesWidget.tsx`

- Aktuell ist der Body dort `Textarea` (ohne Speech).
- Optional auf `SimpleRichTextEditor` umstellen, damit Speech-Funktion in allen Quick-Notes-Einstiegen konsistent verfügbar ist.

## Testplan (nach Umsetzung)

1. **My Work → Quick Notes (SimpleRichTextEditor)**
   - Mic klicken → Button wird aktiv (rot/pulsierend), „Aufnahme läuft…“ sichtbar.
   - Diktat erscheint als Interim und final als Text.
   - „Stopp“ per Sprache beendet sauber.

2. **Global Quick Note Dialog**
   - Gleiches Verhalten wie oben.
   - Öffnen/Schließen des Dialogs während/zwischen Aufnahmen darf nichts „hängen“ lassen.

3. **Enhanced Toolbar Screen**
   - Start/Stop per Klick + Sprachkommando.
   - Format-Kommandos (z. B. „fett“, „neue zeile“) funktionieren weiterhin.

4. **Negativtests**
   - Browser ohne Web Speech API: klare Fehlermeldung statt scheinbar toter UI.
   - Mikrofonberechtigung verweigert: verständliche Toast-Meldung.
   - Mehrfaches Start/Stop hintereinander: kein Dead-State.

## Risiken und Gegenmaßnahmen

- Risiko: Hook-Refactor kann Nebenwirkungen auf Command-Dispatch haben.
  - Gegenmaßnahme: gezielte Smoke-Tests für alle vorhandenen Sprachkommandos.
- Risiko: Unterschiede zwischen Browsern (Chrome/Edge/Safari).
  - Gegenmaßnahme: Fehlertexte browserneutral + konkrete Handlungsanweisung.

## Zusätzliche Feature-Ideen (nach Stabilisierung)

1. **Sprachsprache konfigurierbar** (`de-DE`, `en-US`, …) pro User-Setting.
2. **Push-to-talk Modus** als Alternative zu Toggle-Aufnahme.
3. **Mini-Debug-Panel** (nur Dev/optional) mit State, letztem Error, letztem Transcript-Event.
4. **Auto-Punctuation Modus** konfigurierbar (konservativ vs. aggressiv).
5. **QuickNotesWidget auf Rich Editor migrieren**, damit Speech überall gleich nutzbar ist.
