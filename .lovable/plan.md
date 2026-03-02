
# Speech Recognition Reparatur und Verbesserungen

## Problem: Mikrofon blockiert

In `vite.config.ts` (Zeile 11) steht:
```
'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
```

`microphone=()` blockiert den Mikrofonzugriff komplett -- die Web Speech API kann deshalb nicht starten. Der Button ist entweder deaktiviert (`speechSupported = false`) oder die Erkennung schlagt sofort mit einem Fehler fehl.

## Losung

Die `Permissions-Policy` muss das Mikrofon erlauben:
```
'Permissions-Policy': 'camera=(), microphone=(self), geolocation=()'
```

## Qualitatsanalyse der bestehenden Implementierung

Die Architektur ist insgesamt solide aufgebaut:

**Gut umgesetzt:**
- Saubere Trennung: `WebSpeechToTextAdapter` (Low-Level API) -> `useSpeechDictation` (Hook) -> Toolbar-Komponenten
- Deduplizierung kumulativer Transkripte (`consumeFinalTranscriptDelta`)
- Automatischer Neustart bei Browser-Session-Timeout
- Interim-Vorschau (kursiv/halbtransparent) im Editor
- Deutsche Sprachbefehle (Stopp, Fett, Kursiv, etc.)
- Interpunktions-Ersetzung ("Punkt" -> ".", "Komma" -> ",")
- Unit-Tests fur Adapter und Command-Parser

**Verbesserungspotenzial:**

1. **Fehlende visuelle Ruckmeldung bei Blockierung**: Wenn `speechSupported` false ist (z.B. wegen Permissions-Policy), wird der Button einfach deaktiviert ohne Erklarung. Ein Tooltip oder Toast ware hilfreicher.

2. **Kein visuelles Feedback beim Aufnehmen im SimpleRichTextEditor**: Der `SimpleRichTextEditor` zeigt keinen "Aufnahme lauft..."-Text wie der `EnhancedLexicalToolbar`. Nur das Button-Variant wechselt.

3. **Mikrofon-Icon zeigt keinen aktiven Zustand**: Ein animiertes oder farbiges Mic-Icon (z.B. rot pulsierend) ware intuitiver als nur der Button-Variant-Wechsel.

## Umsetzungsplan

### Schritt 1: Permissions-Policy korrigieren
- In `vite.config.ts` Zeile 11: `microphone=()` zu `microphone=(self)` andern

### Schritt 2: Visuelles Feedback verbessern
- Pulsierender roter Punkt oder Animation am Mic-Button wenn `isListening`
- "Aufnahme lauft..." Text auch im `SimpleRichTextEditor` hinzufugen (analog zu `EnhancedLexicalToolbar`)

### Schritt 3: Bessere Fehlermeldung bei fehlender Unterstutzung
- Toast-Nachricht wenn der Nutzer auf den deaktivierten Button klickt, statt nur disabled

---

### Technische Details

**Betroffene Dateien:**
- `vite.config.ts` -- Permissions-Policy Fix (Hauptursache)
- `src/components/ui/SimpleRichTextEditor.tsx` -- Visuelles Feedback angleichen
- Optional: Tailwind-Animation fur pulsierenden Aufnahme-Indikator
