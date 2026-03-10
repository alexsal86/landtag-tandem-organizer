

## Analyse: Speech Recognition Bugs

Ich habe die drei Kernkomponenten (`speechToTextAdapter.ts`, `useSpeechDictation.ts`, `speechCommandUtils.ts`) intensiv analysiert und zwei konkrete Bugs sowie mehrere Verbesserungsmöglichkeiten identifiziert.

---

### Bug 1: "Stopp" stoppt die Aufnahme nicht (kritisch)

**Ursache in `useSpeechDictation.ts`, Zeilen 200-205:**

```text
onFinalTranscript handler:
  if (command.type === 'stop-listening') {
    if (!contentText) {        ← NUR wenn kein Text davor steht
      speechAdapter.stop();    ← wird stop() aufgerufen
    }
    return;                    ← sonst wird NICHT gestoppt
  }
```

Wenn der Nutzer z.B. "Etwas Text Stopp" sagt, wird `contentText = "etwas text"` erkannt und committed — aber `speechAdapter.stop()` wird **nie aufgerufen**, weil `!contentText` false ist. Die Aufnahme läuft weiter.

**Fix:** `speechAdapter.stop()` immer aufrufen, unabhängig ob contentText vorhanden ist.

---

### Bug 2: Text wird doppelt/dreifach eingefügt (kritisch)

**Ursache: Sowohl der Interim- als auch der Final-Handler committen denselben Text.**

Ablauf bei "Hallo Stopp":
1. `onInterimTranscript("Hallo Stopp")` → erkennt Stop-Kommando → `commitContentText("hallo")` → `speechAdapter.stop()`
2. Bevor der Browser die Recognition tatsächlich stoppt, feuert `onFinalTranscript("Hallo Stopp")` → erkennt Stop-Kommando → `commitContentText("hallo")` erneut

Der Dedup-Guard `lastInsertedSegmentRef` schützt nur den Pfad ohne Interim-Node (Zeile 135). Wenn der erste Commit über den Interim-Node-Pfad (Zeile 124-133) läuft und der zweite Commit keinen Interim-Node mehr findet, wird der Text ein zweites Mal über `insertTextRef.current()` eingefügt.

**Zusätzlich:** Auch ohne Stop-Kommando kann bei `continuous: true` der Browser denselben finalen Transkript-Abschnitt erneut liefern, wenn die `consumeFinalTranscriptDelta`-Logik bei abweichendem Wortlaut den vollen Text zurückgibt (Zeile 222-223 im Adapter).

**Fix:**
- Nach dem Commit über den Interim-Node-Pfad ebenfalls `lastInsertedSegmentRef` setzen (passiert bereits, aber der Guard muss auch den Interim-Pfad abdecken)
- Im Stop-Kommando-Pfad: Wenn der Interim-Handler bereits committed hat, den Final-Handler abbrechen lassen. Dazu einen `stoppingRef` einführen, der gesetzt wird wenn interim-stop feuert, und im final-handler geprüft wird.
- Alternative: Interim-Handler sollte bei Stop-Erkennung **nicht** selbst committen, sondern nur den Adapter stoppen. Der Final-Handler committed dann als einzige Stelle.

---

### Vorgeschlagene Änderungen

**Datei: `src/hooks/useSpeechDictation.ts`**

1. **Stop-Bug fixen (Zeile 200-205):** `speechAdapter.stop()` immer aufrufen, nicht nur bei leerem contentText.

2. **Doppel-Commit eliminieren:** Die Stop-Erkennung im `onInterimTranscript`-Handler entfernen. Nur der `onFinalTranscript`-Handler soll bei Stop committen und stoppen. Der Interim-Handler zeigt weiterhin den visuellen Interim-Node, erkennt aber keine Kommandos mehr. Dadurch gibt es genau eine Commit-Stelle.

3. **Robusteren Dedup-Guard:** Nach jedem Commit (beide Pfade) `lastInsertedSegmentRef` aktualisieren und am Anfang von `commitContentText` prüfen — so wird identischer Text nie doppelt eingefügt.

**Datei: `src/lib/speechToTextAdapter.ts`**

4. **Session-Restart Dedup verbessern:** Beim automatischen Restart (`onend` mit `shouldListen=true`) den `finalizedTranscriptBuffer` **nicht** zurücksetzen. Da `event.results` in der neuen Session ohnehin leer startet, gibt es kein Akkumulations-Problem, aber das Nicht-Zurücksetzen verhindert, dass Text, der kurz vor Session-Ende final wurde, in der neuen Session nochmal emittiert wird.

---

### Zusammenfassung der Dateien

| Datei | Änderung |
|---|---|
| `src/hooks/useSpeechDictation.ts` | Stop immer auslösen; Interim-Handler: kein Commit bei Stop; robusterer Dedup-Guard |
| `src/lib/speechToTextAdapter.ts` | `resetSessionDedupeState()` bei Auto-Restart entfernen |

