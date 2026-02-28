

# Fix: Brieftext wird nicht gespeichert (Editor leer nach Reload)

## Ursache

Die Reihenfolge beim Laden eines Briefes ist fehlerhaft:

1. Brief wird geladen, `draftContentNodes` gesetzt, `draftInitializedRef = true`
2. Lexical Editor mountet mit leerem Zustand und feuert sofort `onChange` mit leerem Content
3. Da `draftInitializedRef` bereits `true` ist, laeuft die Live-Sync und ueberschreibt `latestContentRef` mit leerem Content
4. Erst DANACH laedt ContentPlugin (useEffect) den echten Content aus `contentNodes`
5. Beim Speichern wird der leere `latestContentRef` in die Datenbank geschrieben

Die Vorschau zeigt den Text trotzdem korrekt, weil ContentPlugin den Editor-State nachtraeglich setzt und die nachfolgende `onChange`-Kette die Vorschau aktualisiert. Aber `latestContentRef` wurde zu diesem Zeitpunkt bereits mit leerem Inhalt befuellt.

## Loesung

In `src/components/LetterEditor.tsx`: `draftInitializedRef.current = true` nicht sofort setzen, sondern mit einer kurzen Verzoegerung (500ms). Das gibt ContentPlugin Zeit, den echten Inhalt zu laden und `onChange` mit den richtigen Daten zu feuern. Waehrend dieser 500ms wird die Live-Sync blockiert, sodass der leere Mount-State nicht durchkommt.

`latestContentRef` bleibt sofort mit dem DB-Inhalt initialisiert -- damit funktioniert Speichern auch waehrend der 500ms korrekt.

### Aenderung (Zeile 304 in LetterEditor.tsx)

Aus:
```
draftInitializedRef.current = true;
```

Wird:
```
// Delay enabling live-sync so Lexical's ContentPlugin can load
// the real content before onChange overwrites the ref
setTimeout(() => {
  draftInitializedRef.current = true;
}, 500);
```

Gleiche Aenderung im else-Zweig fuer neue Briefe (Zeile 339).

### Betroffene Datei
- `src/components/LetterEditor.tsx` (2 Stellen)
