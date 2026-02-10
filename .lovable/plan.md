

# Plan: Drag-and-Drop Datei-Upload mit E-Mail-Vorschau fuer Entscheidungen

## Idee und Konzept

Outlook-Mails koennen als `.eml`-Dateien per Drag-and-Drop aus Outlook direkt in den Browser gezogen werden. Diese Dateien lassen sich clientseitig parsen, um Betreff, Absender, Empfaenger, Datum und den Mail-Body (Text/HTML) zu extrahieren.

### Darstellungskonzept fuer E-Mails

E-Mails werden **nicht** wie normale Dateien (nur Dateiname + Groesse) angezeigt, sondern erhalten eine **spezielle Mail-Karte** direkt in der Dateiliste:

```text
+----------------------------------------------+
| [Mail-Icon]  Betreff der E-Mail        [X]   |
| Von: max@example.com                         |
| An: team@buero.de                            |
| Datum: 10.02.2026, 14:30                     |
| [Vorschau oeffnen]              2 Anhaenge   |
+----------------------------------------------+
```

- **Inline-Vorschau**: Betreff, Absender, Empfaenger und Datum werden direkt auf der Karte angezeigt -- so sieht man sofort, worum es geht, ohne extra klicken zu muessen
- **Detail-Dialog**: Ueber "Vorschau oeffnen" oeffnet sich ein Dialog mit dem vollstaendigen Mail-Body (HTML gerendert oder Plaintext) und einer Liste der Mail-Anhaenge
- **Anhaenge der Mail**: Werden separat aufgelistet und koennen einzeln heruntergeladen werden
- Die `.eml`-Datei selbst wird weiterhin im Supabase Storage gespeichert, sodass das Original jederzeit verfuegbar bleibt

### Warum dieser Ansatz?

- Der Abgeordnete sieht sofort den Kontext (Betreff, Absender) ohne extra Klick
- Die Mail fuegt sich natuerlich in den Entscheidungs-Workflow ein -- man weiss auf einen Blick, welche E-Mail die Grundlage der Entscheidung ist
- Normal-Dateien (PDFs, Bilder etc.) funktionieren weiterhin wie bisher
- Kein Server-Parsing noetig -- alles passiert im Browser

## Technische Umsetzung

### 1. Neue Bibliothek: `postal-mime`

Leichtgewichtiger, reiner Browser-Parser fuer `.eml`-Dateien. Kein Server noetig.

### 2. Dropzone in `DecisionFileUpload.tsx`

Die bestehende Upload-Komponente wird um eine Drag-and-Drop-Zone erweitert:

- Visuelles Feedback beim Drag-Over (gestrichelte Umrandung, Hintergrundfarbe)
- Akzeptiert alle Dateitypen (Dokumente, Bilder, und eben `.eml`)
- Der bestehende "Dateien auswaehlen"-Button bleibt als Alternative erhalten
- Events: `onDragOver`, `onDragEnter`, `onDragLeave`, `onDrop`

### 3. E-Mail-Metadaten in der Datenbank

Eine neue Spalte `email_metadata` (JSONB) in `task_decision_attachments` speichert fuer `.eml`-Dateien:

```text
{
  "subject": "Anfrage zur Foerderung",
  "from": "max@example.com",
  "to": ["team@buero.de"],
  "date": "2026-02-10T14:30:00Z",
  "hasHtmlBody": true,
  "attachmentCount": 2
}
```

So kann die Mail-Karte sofort gerendert werden, ohne die `.eml`-Datei erneut zu parsen.

### 4. Neue Komponente: `EmailPreviewCard.tsx`

Zeigt die Mail-Metadaten inline an (Betreff, Von, An, Datum). Enthaelt einen Button "Vorschau oeffnen", der einen Dialog mit dem vollstaendigen Body oeffnet.

### 5. Neuer Dialog: `EmailPreviewDialog.tsx`

- Laedt die `.eml`-Datei aus dem Storage
- Parst sie mit `postal-mime`
- Zeigt den HTML-Body sanitized in einem iframe/sandbox an (oder Plaintext als Fallback)
- Listet Mail-Anhaenge auf mit Download-Moeglichkeit

## Dateien und Aenderungen

| Datei | Aenderung |
|-------|-----------|
| `package.json` | `postal-mime` als neue Dependency |
| SQL-Migration | `ALTER TABLE task_decision_attachments ADD COLUMN email_metadata JSONB` |
| `src/components/task-decisions/DecisionFileUpload.tsx` | Dropzone-Logik, `.eml`-Erkennung, Metadaten-Extraktion vor Upload, unterschiedliche Darstellung fuer E-Mails vs. normale Dateien |
| `src/components/task-decisions/EmailPreviewCard.tsx` | Neue Komponente: Kompakte Mail-Karte mit Metadaten |
| `src/components/task-decisions/EmailPreviewDialog.tsx` | Neuer Dialog: Vollstaendige Mail-Ansicht mit Body und Anhaengen |
| `src/utils/emlParser.ts` | Hilfs-Utility zum Parsen von `.eml`-Dateien mit `postal-mime` |

## Reihenfolge

1. SQL-Migration: `email_metadata`-Spalte hinzufuegen
2. `postal-mime` installieren, Parser-Utility erstellen
3. `DecisionFileUpload.tsx` um Dropzone und `.eml`-Handling erweitern
4. `EmailPreviewCard.tsx` und `EmailPreviewDialog.tsx` erstellen
5. Alles in der Dateiliste zusammenfuegen

## Einschraenkungen

- **`.msg`-Dateien** (proprietaeres Outlook-Format) sind im Browser nicht zuverlaessig parsbar. Nur `.eml` (offener Standard) wird mit Vorschau unterstuetzt. `.msg`-Dateien werden wie normale Dateien behandelt (Upload + Download, keine Vorschau)
- Outlook fuer Windows erzeugt beim Drag-and-Drop manchmal `.msg` statt `.eml`. Die Web-Version von Outlook und Thunderbird erzeugen `.eml`. Falls noetig, kann spaeter eine serverseitige `.msg`-Konvertierung ergaenzt werden

