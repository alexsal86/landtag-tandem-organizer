
# Plan: Bild-Vorschau und Darstellungsfehler beheben

## Zusammenfassung
Es gibt vier zusammenhangende Probleme zu losen:

1. **Bilder in der Entscheidungs-Vorschau gebrochen** - Die `DecisionAttachmentPreviewDialog` erstellt eine signedUrl, aber das Bild ladt nicht korrekt
2. **Word/Excel-Vorschau uber officeapps.live.com funktioniert nicht** - Die signedUrl ist zeitlich begrenzt und officeapps kann nicht darauf zugreifen
3. **PDF-Thumbnail-Vorschau** - PDFs sollen klein als Vorschau dargestellt werden
4. **Canvas-Bilder in Briefvorlagen gebrochen** - Bilder im LetterTemplateManager zeigen Container aber kein Bild

---

## Problem-Analyse

### 1. Bilder in Entscheidungs-Vorschau
Der `decision-attachments` Bucket ist **privat** (nicht public). Der Code erstellt zwar eine `signedUrl`, aber die `normalizeStoragePath`-Funktion scheint den Pfad falsch zu normalisieren. Aus dem Screenshot ist erkennbar, dass das Bild als gebrochenes `<img>` Tag dargestellt wird - die signedUrl ist entweder ungultig oder abgelaufen. Wahrscheinlich wird der `file_path` aus der Datenbank nicht korrekt auf den Storage-Pfad gemappt.

### 2. Word/Excel ohne officeapps.live.com
Die Microsoft Office Online Viewer braucht eine offentlich erreichbare URL. Da der Bucket privat ist, funktioniert das nicht. **Interne Alternative**: Wir konnen `docx` (bereits installiert) und `xlsx` (bereits installiert) verwenden, um Dokumente clientseitig zu parsen und als HTML darzustellen.

### 3. PDF-Vorschau
`pdfjs-dist` ist bereits installiert. Wir konnen die erste Seite eines PDFs als Canvas/Bild rendern und als Thumbnail anzeigen.

### 4. Canvas-Bilder in Briefvorlagen
Der `letter-assets` Bucket ist **public**. Die `imageUrl`s werden via `getPublicUrl` generiert, was korrekt sein sollte. Das Problem liegt wahrscheinlich an gespeicherten `blobUrl`s, die nach einem Session-Neustart ungultig sind. Die `normalizeLayoutBlockContentImages`-Funktion lauft nur fur Layout-Block-Content, aber nicht fur alle Block-Typen (addressField, returnAddress, infoBlock, subject, attachments).

---

## Technische Umsetzung

### Schritt 1: Build-Fehler beheben
- **`send-document-email/index.ts`**: `scheduledAt` durch `scheduled_at` ersetzen (Resend API erwartet snake_case)

### Schritt 2: Bild-Vorschau in Entscheidungen reparieren
- **`DecisionAttachmentPreviewDialog.tsx`**: Die `normalizeStoragePath`-Funktion debuggen/fixen - sicherstellen, dass der Pfad korrekt aus `file_path` extrahiert wird
- Logging hinzufugen um den tatsachlichen Pfad zu verifizieren
- Fallback: Wenn signedUrl fehlschlagt, einen klareren Fehlertext anzeigen

### Schritt 3: Word/Excel intern rendern
- **Word (.docx)**: Mit der bereits installierten `docx`-Bibliothek den Inhalt extrahieren und als einfaches HTML darstellen (Text, Absatze, grundlegende Formatierung)
- **Excel (.xls/.xlsx)**: Mit der bereits installierten `xlsx`-Bibliothek die Tabellendaten auslesen und als HTML-Tabelle darstellen
- Die `officeapps.live.com`-Integration entfernen, da sie nicht funktioniert

### Schritt 4: PDF-Thumbnail erstellen
- `pdfjs-dist` verwenden um die erste Seite zu rendern
- Ein Canvas-Element nutzen, um ein kleines Vorschaubild (Thumbnail) zu generieren
- Sowohl in der Vorschau-Ansicht als auch im Dialog nutzbar

### Schritt 5: Canvas-Bilder in Briefvorlagen reparieren
- **`LetterTemplateManager.tsx`**: Die `normalizeLayoutBlockContentImages`-Funktion auf alle Block-Typen erweitern, nicht nur `blockContent`
- Sicherstellen, dass beim Laden einer Vorlage alle `imageUrl`-Werte uber `getPublicUrl` mit dem `storagePath` aktualisiert werden
- Fallback: Wenn `imageUrl` fehlschlagt und `storagePath` vorhanden ist, `getPublicUrl` on-the-fly aufrufen

### Betroffene Dateien
- `supabase/functions/send-document-email/index.ts` - Build-Fehler
- `src/components/task-decisions/DecisionAttachmentPreviewDialog.tsx` - Bild-Vorschau + Word/Excel/PDF intern
- `src/components/LetterTemplateManager.tsx` - Canvas-Bild-Normalisierung erweitern
- Eventuell neue Utility-Datei fur DOCX/XLSX-zu-HTML Konvertierung
