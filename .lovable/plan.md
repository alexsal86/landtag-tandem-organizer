

# Fix: Doppelter Text und steckengebliebene Interim-Nodes bei der Spracherkennung

## Analyse der Bugs

Ich habe zwei zusammenhängende Fehler identifiziert:

### Bug 1: Text bleibt grau/kursiv (Interim-Node wird nicht aufgelöst)
In `commitContentText` wird `removeInterimNode()` aufgerufen, das den Node aus dem Baum **entfernt** (`interimNode.remove()`). Danach versucht Zeile 114 `interimNode.replace(...)` auf dem bereits entfernten Node — das schlägt still fehl, weil der Node nicht mehr im Baum hängt. Ergebnis: Der graue Text verschwindet, aber der finale Text wird nie eingefügt.

### Bug 2: Text wird doppelt eingefügt
Wenn der `replace`-Aufruf fehlschlägt (Bug 1), kehrt die Funktion trotzdem bei Zeile 117 zurück, ohne Text einzufügen. Beim nächsten `onresult`-Event des Browsers kommt derselbe finale Text erneut an. Diesmal existiert kein Interim-Node mehr, also geht der Code über `insertTextRef.current()` — und fügt den Text ein. Manchmal bleibt aber zusätzlich noch ein verwaister Interim-Node sichtbar → doppelt.

### Bug 3: `lastInsertedSegmentRef` wird nie zurückgesetzt
Zwischen Speech-Sessions oder nach Session-Neustarts (Browser beendet die Recognition automatisch) wird `lastInsertedSegmentRef` nicht geleert. Wenn der nächste Satz zufällig denselben Text enthält, wird er fälschlicherweise als Duplikat erkannt und unterdrückt.

## Lösung

### 1. `removeInterimNode` → `takeInterimNode` refactoren
Statt den Node zu entfernen und dann zu ersetzen, soll die Funktion den Node nur **aus dem Ref lösen** ohne ihn aus dem Baum zu entfernen. `commitContentText` kann dann direkt `replace()` auf den noch im Baum befindlichen Node aufrufen, oder ihn entfernen falls kein Text eingefügt wird.

### 2. `lastInsertedSegmentRef` zurücksetzen
- Bei `startSpeechRecognition` → `lastInsertedSegmentRef.current = ''`
- Bei jedem neuen Interim-Transkript (das sich vom letzten unterscheidet) → Reset, damit der nächste Final-Text nicht blockiert wird

### 3. Interim-Node Cleanup bei Session-Ende
Wenn `speechState` auf `'idle'` wechselt, sicherstellen dass kein Interim-Node im Editor zurückbleibt (Cleanup im State-Change Handler).

## Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/hooks/useSpeechDictation.ts` | `removeInterimNode` → `takeInterimNode` (Node im Baum lassen), `lastInsertedSegmentRef` Reset-Logik, Cleanup bei idle |

