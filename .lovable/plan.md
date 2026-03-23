

## PDF-Ausgabe grundlegend an die Briefansicht angleichen

### Kernproblem

Die PDF-Erzeugung (`pdfGenerator.ts`) baut ihre eigene, **unvollständige** Variable-Map und ignoriert große Teile der Template-Block-Daten. Im Vergleich dazu baut `LetterEditor.tsx` eine vollständige Variable-Map mit allen Sender-, Empfänger-, Kontakt- und Anlagendaten und substituiert **alle** Block-Bereiche (Adressfeld, Rücksendezeile, Info-Block) über `substituteBlockLines`/`substituteVariables`.

### Konkrete Diskrepanzen

| Bereich | HTML-Vorschau | PDF |
|---|---|---|
| **Variable-Map** | Volle Sender-Daten (Straße, PLZ, Ort, Wahlkreis, Landtag), Empfänger mit Geschlecht/Nachname, Info-Block-Daten, Anlagen | Nur `name`, `organization`, `phone`, `email` vom Sender; nur `name` vom Empfänger; keine Anlagen |
| **Rücksendezeile** | Aus Template-BlockLines (`returnAddress` in `blockContent`) mit Variablen-Substitution | Direkt `senderInfo.return_address_line` als Rohtext |
| **Adressfeld** | Aus Template-BlockLines (`addressField` in `blockContent`) mit Variablen-Substitution | Direkt `letter.recipient_name` + `letter.recipient_address` |
| **Info-Block** | BlockLines mit vollständiger Variable-Map | BlockLines mit unvollständiger Variable-Map |
| **Anrede** | Dynamisch aus Template-Salutation mit `{{anrede}}`-Substitution | Statisch aus `layout.salutation.template` ohne Substitution |
| **Schriftfamilie** | `Calibri, Carlito, "Segoe UI", Arial, sans-serif` | `helvetica` (jsPDF built-in) |
| **Faltmarken** | Gerendert via `FoldHoleMarks` | Fehlen komplett im PDF |

### Plan

#### 1. Vollständige Variable-Map im PDF aufbauen

Die `generatePDF`-Funktion erhält die Variable-Map entweder als neuen Parameter (bevorzugt) oder baut sie intern identisch wie `LetterEditor.tsx` auf — mit vollen Sender-Feldern (Straße, Wahlkreis, Landtag), Empfänger-Geschlecht/Nachname, Info-Block-Daten und Anlagen.

#### 2. Alle Block-Bereiche aus Template-Daten rendern

Wie im Editor alle `blockContent`-Bereiche durchgehen:
- `returnAddress` → `renderBlockLinesToPdf` (statt roher `return_address_line`)
- `addressField` → `renderBlockLinesToPdf` (statt roher `recipient_name`/`recipient_address`)
- `infoBlock` → bereits vorhanden, aber mit vollständiger Variable-Map
- Fallback auf die bestehende Rohtext-Logik nur wenn kein `blockContent` im Template definiert ist

#### 3. Anrede-Substitution

Die Anrede `{{anrede}}` aus der Variable-Map ersetzen (wie im Editor), statt den Template-String wörtlich zu rendern.

#### 4. Faltmarken im PDF rendern

Aus `layout.foldHoleMarks` die drei Linien (oben, Lochmarke, unten) zeichnen — auf jeder Seite, analog zur HTML-Komponente `FoldHoleMarks`.

#### 5. Font-Konsistenz (Hinweis)

jsPDF hat kein Calibri. Das ist eine bekannte Einschränkung — Helvetica bleibt der beste verfügbare Ersatz. Kein Handlungsbedarf, aber erwähnenswert.

---

### Dateien

| Datei | Änderung |
|---|---|
| `src/components/letter-pdf/pdfGenerator.ts` | Variable-Map vollständig aufbauen; alle blockContent-Bereiche rendern; Anrede substituieren; Faltmarken zeichnen |
| `src/components/letter-pdf/types.ts` | `GeneratePDFOptions` um optionale `contacts`-Daten erweitern |
| `src/components/LetterPDFExport.tsx` | Kontakt-Daten an `generatePDF` durchreichen (falls nötig) |

