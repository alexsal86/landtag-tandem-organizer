

# Plan: Bilder im Header-Designer -- Blob-URL-Ansatz

## Problem

Sowohl oeffentliche als auch signierte URLs funktionieren beim direkten Aufrufen, aber nicht im Browser-Preview. Das liegt wahrscheinlich an Cross-Origin-Einschraenkungen der Preview-Umgebung.

## Loesung: Blob-URLs statt externe URLs

Statt eine URL zu erzeugen und dem Browser das Laden zu ueberlassen, werden die Bilder direkt ueber den Supabase JS Client heruntergeladen (`download()`) und als lokale Blob-URLs bereitgestellt. Das umgeht alle URL- und CORS-Probleme vollstaendig.

```text
Vorher:  getPublicUrl/createSignedUrl -> externe URL -> Browser laedt Bild (scheitert)
Nachher: download() via Supabase Client -> Blob -> URL.createObjectURL() -> lokale URL (funktioniert immer)
```

## Technische Details

### Datei: `src/components/letters/StructuredHeaderEditor.tsx`

**loadSystemImages (Zeilen 126-153):**

Die Funktion wird so umgebaut:

1. Dateien auflisten (wie bisher via `.list()`)
2. Fuer jede Datei: `supabase.storage.from('letter-assets').download(path)` aufrufen
3. Den zurueckgegebenen Blob mit `URL.createObjectURL(blob)` in eine lokale URL umwandeln
4. Diese Blob-URL als `img.url` verwenden

Blob-URLs sehen so aus: `blob:https://...` und funktionieren immer im lokalen Browser-Kontext.

**Aufraeumen der Blob-URLs:**

Beim Neuladen der Bilder oder Unmount der Komponente werden die alten Blob-URLs via `URL.revokeObjectURL()` freigegeben, um Speicherlecks zu vermeiden.

**deleteSystemImage:**

Bleibt wie implementiert (`.remove([path])` + `loadSystemImages()`)

**Galerie-Rendering:**

Bleibt wie implementiert (mit `onError`-Handler und Loeschen-Button)

### Aenderungsumfang

Nur die Funktion `loadSystemImages` wird geaendert (ca. 15 Zeilen). Der Rest bleibt unveraendert.

