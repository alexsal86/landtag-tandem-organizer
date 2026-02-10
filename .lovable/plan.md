

# Plan: Storage MIME-Fix und .msg-Unterstuetzung

## Problem 1: MIME-Typ `message/rfc822` nicht erlaubt

Der Storage-Bucket `decision-attachments` hat eine Whitelist erlaubter MIME-Typen (Zeile 8-19 der Migration). `message/rfc822` (.eml) und `application/vnd.ms-outlook` (.msg) fehlen dort. Daher wird der Upload mit "400 Bad Request" abgelehnt.

**Loesung:** SQL-Migration, die die `allowed_mime_types` des Buckets aktualisiert und die fehlenden Typen ergaenzt:
- `message/rfc822` (.eml)
- `application/vnd.ms-outlook` (.msg)
- `application/octet-stream` (Fallback, da Browser manchmal keinen spezifischen MIME-Typ erkennen)

## Problem 2: .msg-Dateien parsen

Die Bibliothek `@kenjiuno/msgreader` ist aktiv gepflegt (letzte Veroeffentlichung vor 12 Tagen) und funktioniert im Browser. Sie kann:
- Betreff, Absender, Empfaenger, Datum extrahieren
- Anhaenge auslesen
- Den Body lesen (HTML, Text oder komprimiertes RTF)

### RTF-Handling

MSG-Dateien speichern den Body oft als komprimiertes RTF. Die Bibliothek liefert das dekomprimierte RTF. Da RTF im Browser nicht direkt darstellbar ist, wird folgende Fallback-Kette verwendet:
1. HTML-Body (falls vorhanden) -> direkt anzeigen
2. Text-Body (falls vorhanden) -> als Plaintext anzeigen
3. RTF-Body -> als Plaintext-Extraktion anzeigen (RTF-Tags entfernen, reinen Text extrahieren)

Fuer die Metadaten-Karte (Betreff, Von, An, Datum) ist RTF irrelevant -- diese Felder sind immer als Klartext verfuegbar.

## Aenderungen

### 1. SQL-Migration
```sql
UPDATE storage.buckets
SET allowed_mime_types = array_cat(
  allowed_mime_types,
  ARRAY['message/rfc822', 'application/vnd.ms-outlook', 'application/octet-stream']
)
WHERE id = 'decision-attachments';
```

### 2. Neue Dependency
`@kenjiuno/msgreader` installieren.

### 3. Parser-Utility erweitern: `src/utils/emlParser.ts`
- Neue Funktion `isMsgFile(file)` -- prueft auf `.msg`-Endung
- Neue Funktion `parseMsgFile(file)` -- nutzt MsgReader, extrahiert Metadaten und Body
- RTF-Stripping: einfache Funktion die RTF-Control-Woerter entfernt und Klartext extrahiert
- Beide Parser (EML + MSG) liefern dasselbe `ParsedEmail`-Interface zurueck

### 4. `DecisionFileUpload.tsx` anpassen
- `processFiles()` erkennt jetzt auch `.msg`-Dateien und ruft `parseMsgFile()` auf
- `uploadFiles()` behandelt `.msg` analog zu `.eml` (Metadaten extrahieren und speichern)
- Dropzone-Text aktualisieren: "Dokumente, Bilder oder E-Mails (.eml, .msg) aus Outlook"

### 5. `EmailPreviewDialog.tsx` anpassen
- Beim Oeffnen der Vorschau: Dateiendung pruefen
- `.eml` -> wie bisher mit `postal-mime` parsen
- `.msg` -> mit `MsgReader` parsen
- RTF-Body: Klartext-Extraktion anzeigen mit Hinweis "Originalformatierung nur in Outlook verfuegbar"

### 6. `StandaloneDecisionCreator.tsx` und `NoteDecisionCreator.tsx`
- Im Upload-Handler (`handleSubmit`): Vor dem Storage-Upload pruefen ob Datei `.eml` oder `.msg` ist
- Falls ja: `email_metadata` extrahieren und beim DB-Insert mitgeben (gleiche Logik wie in DecisionFileUpload)

## Dateien

| Datei | Aenderung |
|-------|-----------|
| SQL-Migration | `allowed_mime_types` um 3 Typen erweitern |
| `package.json` | `@kenjiuno/msgreader` hinzufuegen |
| `src/utils/emlParser.ts` | `isMsgFile()`, `parseMsgFile()`, RTF-Stripping |
| `src/components/task-decisions/DecisionFileUpload.tsx` | MSG-Erkennung in processFiles/uploadFiles, Text-Update |
| `src/components/task-decisions/EmailPreviewDialog.tsx` | MSG-Parsing beim Vorschau-Oeffnen |
| `src/components/task-decisions/StandaloneDecisionCreator.tsx` | MSG-Metadaten beim Upload extrahieren |
| `src/components/shared/NoteDecisionCreator.tsx` | MSG-Metadaten beim Upload extrahieren |

