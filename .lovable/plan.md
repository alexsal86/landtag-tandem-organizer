

# Outlook-Mails per Drag and Drop / Paste importieren

## Problemanalyse

### Drag and Drop
- Outlook Desktop nutzt proprietaeres OLE-Drag-and-Drop, das nicht dem Standard-Web-API entspricht
- Chrome/Edge auf Windows koennen in manchen Faellen eine .msg-Datei aus dem Drag-Event extrahieren, aber nicht zuverlaessig
- Der aktuelle Code liest nur `e.dataTransfer.files` - wenn das leer ist, passiert nichts und der Nutzer bekommt kein Feedback

### Strg+C / Strg+V (Paste)
- Outlook legt beim Kopieren einer Mail **keine Datei** in die Zwischenablage, sondern HTML- und Text-Inhalt
- Der aktuelle Paste-Handler prueft nur `clipboardData.files` und `clipboardData.items` (kind === 'file') - beides ist leer bei Outlook-Paste
- Daher passiert beim Einfuegen aktuell gar nichts

### Build-Fehler
- Zusaetzlich gibt es einen bestehenden Build-Fehler in `send-document-email/index.ts`: Die Resend-API akzeptiert `scheduledAt` nicht als Property in `CreateEmailOptions`. Dies muss separat behoben werden.

---

## Loesung

### 1. Build-Fehler beheben (send-document-email)

Die `scheduledAt`-Property wird von der aktuellen Resend-Version nicht direkt in `emails.send()` unterstuetzt. Loesung: Die Property entfernen oder ueber die korrekte API (`resend.emails.create()` oder separates Scheduling) handhaben.

### 2. Drag and Drop verbessern (DecisionFileUpload.tsx)

**Wenn `dataTransfer.files` leer ist:**
- Pruefen, ob `dataTransfer.types` Outlook-spezifische Formate enthaelt (z.B. `text/html`, `text/plain`)
- Dem Nutzer eine klare Fehlermeldung/Hinweis anzeigen: "Outlook-Mails koennen nicht direkt per Drag and Drop uebernommen werden. Bitte speichern Sie die Mail zuerst als .msg-Datei (Datei > Speichern unter) und ziehen Sie dann die gespeicherte Datei hierher."
- Falls `dataTransfer.files` eine Datei enthaelt (funktioniert manchmal in Chrome/Edge), diese normal verarbeiten (funktioniert bereits)

### 3. Paste-Handler erweitern (DecisionFileUpload.tsx)

**Neuer Fallback fuer HTML-Paste aus Outlook:**
- Wenn keine Dateien in der Zwischenablage sind, pruefen ob `text/html`-Inhalt vorhanden ist
- Falls ja: Den HTML-Inhalt analysieren und als synthetische `.eml`-Datei erzeugen
  - Subject aus dem HTML-Titel oder Betreff-Feld extrahieren
  - Absender, Empfaenger und Datum aus typischen Outlook-HTML-Patterns parsen
  - Eine RFC822-konforme `.eml`-Datei im Speicher erzeugen und als `File`-Objekt einfuegen
- Falls die HTML-Analyse keinen E-Mail-Inhalt erkennt: Hinweis-Toast anzeigen mit Anleitung zum Speichern als .msg

### 4. Hilfreiche Nutzerfuehrung

- Toast-Meldungen mit konkreten Anleitungen wenn Import fehlschlaegt
- Erweiterte Beschreibung in der Dropzone mit Outlook-spezifischem Hinweis

---

## Technische Details

### Neue Hilfsfunktion: `buildEmlFromOutlookHtml`

```text
Eingabe: HTML-String aus Outlook-Zwischenablage
Ausgabe: File-Objekt (.eml) oder null

Schritte:
1. HTML parsen (DOMParser)
2. Typische Outlook-Metadaten extrahieren:
   - Betreff (aus <title> oder spezifischen Outlook-Klassen)
   - Von/An/Datum aus Header-Tabellen
3. RFC822-Header zusammenbauen:
   From: ...
   To: ...
   Subject: ...
   Date: ...
   MIME-Version: 1.0
   Content-Type: text/html; charset=utf-8
   
   [HTML-Body]
4. Als File-Objekt mit .eml-Endung zurueckgeben
```

### Aenderungen in DecisionFileUpload.tsx

```text
handleDrop():
  - Nach files = e.dataTransfer.files
  - WENN files leer UND dataTransfer.types enthaelt 'text/html':
    -> Toast: "Direkt-Drag aus Outlook nicht moeglich, bitte .msg speichern"
  - SONST WENN files vorhanden:
    -> Bestehende Logik (funktioniert)

handlePastedFiles():
  - WENN keine Dateien gefunden:
    -> clipboardData.getData('text/html') pruefen
    -> buildEmlFromOutlookHtml() aufrufen
    -> Falls erfolgreich: synthetische .eml-Datei in Pipeline einspeisen
    -> Falls nicht: Toast mit Hinweis anzeigen
```

### Betroffene Dateien

| Datei | Aenderung |
|-------|-----------|
| `supabase/functions/send-document-email/index.ts` | `scheduledAt` Build-Fehler beheben |
| `src/components/task-decisions/DecisionFileUpload.tsx` | Drop- und Paste-Handler erweitern |
| `src/utils/emlParser.ts` | Neue Funktion `buildEmlFromOutlookHtml()` |

### Einschraenkungen

- Drag and Drop direkt aus Outlook wird in den meisten Faellen **nicht** funktionieren (Browser-Limitation). Der Nutzer erhaelt aber einen klaren Hinweis statt Stille.
- Paste funktioniert nur, wenn Outlook HTML-Inhalt in die Zwischenablage legt (Standard bei "Mail kopieren"). Die extrahierten Metadaten sind abhaengig vom Outlook-HTML-Format.
- Die sicherste Methode bleibt: Mail in Outlook als .msg speichern, dann per Drag and Drop oder Dateiauswahl hochladen.

