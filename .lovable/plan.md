

# Plan: Bilder im Header-Designer reparieren + Loeschfunktion

## Problem

Die Bilder in der Sidebar-Galerie des Header-Designers werden nicht angezeigt -- es erscheint nur der Dateiname (alt-Text). Die oeffentliche URL ist technisch korrekt (Bucket ist public, Dateien existieren), aber die Bilder laden trotzdem nicht im Browser.

## Ursache

Die `getPublicUrl`-Methode erzeugt zwar eine gueltige URL, aber diese funktioniert moeglicherweise nicht im Kontext der Preview-Umgebung. **Signierte URLs** (mit Auth-Token) umgehen dieses Problem, da sie direkt ueber den authentifizierten Storage-Endpoint laufen.

## Loesung

### 1. Signierte URLs fuer Bildanzeige verwenden

Die `loadSystemImages`-Funktion wird so umgebaut, dass sie `createSignedUrl` verwendet (mit 7 Tagen Gueltigkeit). Da der Nutzer authentifiziert ist, funktionieren signierte URLs zuverlaessig.

### 2. Fehlerbehandlung fuer Bilder

Jedes `<img>`-Tag in der Galerie bekommt einen `onError`-Handler, der die URL in der Konsole loggt. Zusaetzlich wird ein Fallback-Icon angezeigt, wenn ein Bild nicht laedt.

### 3. Loeschfunktion fuer Bilder

Jedes Bild in der Galerie bekommt einen kleinen X-Button. Beim Klick wird:
- Die Datei aus dem Supabase Storage geloescht
- Die Galerie aktualisiert
- Eine Bestaetigungsmeldung angezeigt

## Technische Details

### Datei: `src/components/letters/StructuredHeaderEditor.tsx`

**loadSystemImages (Zeilen 126-146):**
- Statt `getPublicUrl` wird `createSignedUrl` mit `expiresIn: 604800` (7 Tage) verwendet
- Die Funktion wird wieder async mit `Promise.all`
- Fallback auf `getPublicUrl` falls signierte URL fehlschlaegt

**Neue Funktion `deleteSystemImage`:**
- Nimmt den Dateinamen entgegen
- Loescht die Datei via `supabase.storage.from('letter-assets').remove([path])`
- Ruft `loadSystemImages()` erneut auf

**Galerie-Rendering (Zeilen 405-417):**
- Jedes Bild bekommt einen relativen Container mit einem absolut positionierten Loeschen-Button (X-Icon, oben rechts)
- `<img>` bekommt `onError` Handler fuer Debugging
- Beim Klick auf X wird `deleteSystemImage(img.name)` aufgerufen mit Bestaetigung

### Aenderungsumfang

Es wird nur eine Datei geaendert: `src/components/letters/StructuredHeaderEditor.tsx`
- `loadSystemImages`: async mit `createSignedUrl` 
- Neue Funktion `deleteSystemImage`
- Galerie-UI: Loeschen-Button pro Bild, `onError`-Handler

