

# Brief-Tool: Analyse und Korrekturen

## Gefundene Probleme

### 1. KRITISCH: LettersView fragt nicht-existente Spalten ab
`src/components/LettersView.tsx` Zeile 76 fragt `user_id` und `archived_at` aus der `letters`-Tabelle ab — diese Spalten existieren nicht (bestatigt durch DB-Schema). Das verursacht einen PostgREST-Fehler, der das Laden von Briefen komplett blockieren kann.

Gleicher Fehler in `handleWizardComplete` (Zeile 123-130): `user_id` und `archived_at` werden beim Erstellen eines neuen Briefes gesetzt.

### 2. KRITISCH: letterPDFGenerator.ts hat Debug-Guides IMMER an
`src/utils/letterPDFGenerator.ts` Zeile 335-336: `drawDebugGuides(1)` wird IMMER aufgerufen (Kommentar sagt "ALWAYS ENABLED for testing"). Das bedeutet, jede PDF die uber diesen Generator erzeugt wird (z.B. beim Archivieren), enthalt rote/grune/blaue Hilfslinien, Rand-Markierungen und DIN-5008-Annotationen.

### 3. Zwei duplizierte PDF-Generatoren
Es gibt ZWEI separate PDF-Generatoren mit divergierendem Code:
- `src/components/letter-pdf/pdfGenerator.ts` (976 Zeilen) — verwendet vom PDF-Export-Button im Editor (bessere Version, mit Variable-Substitution, Header-Rendering, Signature)
- `src/utils/letterPDFGenerator.ts` (702 Zeilen) — verwendet fur Archivierung und andere Flows (schlechtere Version, Debug-Guides immer an, keine Variable-Substitution, keine Signatur/Abschlussformel)

Das fuhrt zu **inkonsistenten PDFs** je nachdem, ob man den Export-Button oder die Archivierung nutzt.

### 4. DOCX-Generator vereinfacht zu stark
`src/utils/letterDOCXGenerator.ts`:
- Keine Anrede/Salutation aus dem Template
- Hardcoded "Mit freundlichen Grusen" statt die konfigurierte Grussformel
- Keine Variable-Substitution ({{anrede}}, {{empfaenger_name}} etc.)
- Keine Signatur/Unterschriftsbild
- Keine Anlagen-Liste am Ende
- Sender-Info zeigt nur Landtag-Adresse, ignoriert Wahlkreis-Varianten

### 5. Edge-Function Syntax-Fehler (pre-existing, nicht vom Brieftool)
4 Edge-Functions haben fehlende Semikolons nach `Deno.serve(...)`:
- `import-election-districts/index.ts` — Zeile 162: `)` statt `);`
- `matrix-bot-handler/index.ts` — Zeile 668
- `matrix-decision-handler/index.ts` — Zeile 110
- `send-matrix-morning-greeting/index.ts` — Zeile 283
- `sync-external-calendar/index.ts` — Zeile 525

Plus ein Typ-Fehler in `respond-public-event-invitation.test.ts` (provider: `"turnstile"` als `string` statt als Literal-Typ).

## Umsetzungsplan

### Schritt 1: LettersView Query fixen
**Datei:** `src/components/LettersView.tsx`
- Zeile 76: `user_id` und `archived_at` aus dem `.select()` entfernen
- Zeile 113-131: `user_id` und `archived_at` aus dem `newLetter`-Objekt entfernen
- Gleiche Fixes in `src/components/DocumentsView.tsx` (Zeile 210)

### Schritt 2: letterPDFGenerator.ts Debug-Guides deaktivieren
**Datei:** `src/utils/letterPDFGenerator.ts`
- Zeile 335-337: `drawDebugGuides(1)` nur aufrufen wenn ein `debugMode`-Parameter gesetzt ist (aktuell gibt es keinen solchen Parameter in `generateLetterPDF`)
- Optional: `debugMode`-Parameter zur `generateLetterPDF`-Funktion hinzufugen

### Schritt 3: letterPDFGenerator.ts mit pdfGenerator.ts abgleichen
**Datei:** `src/utils/letterPDFGenerator.ts`
Die wichtigsten fehlenden Features aus `pdfGenerator.ts` ubernehmen:
- Variable-Substitution (buildVariableMap, substituteBlockLines)
- BlockLine-basiertes Rendering fur Absender/Adressfeld/Infoblock
- Grussformel + Signatur aus `layout.closing`
- Anlagen-Liste nach dem Brieftext
- Contact-Daten laden fur Empfanger-Variablen

### Schritt 4: DOCX-Generator verbessern
**Datei:** `src/utils/letterDOCXGenerator.ts`
- Contact laden fur Variablen-Auflosung
- Anrede aus Template (`layout.salutation.template`) mit Variable-Substitution
- Grussformel aus `layout.closing.formula` statt hartcodiert
- Signaturname aus `layout.closing.signatureName`
- Anlagen-Liste am Ende des Dokuments hinzufugen

### Schritt 5: Edge-Function Syntax-Fehler fixen
5 Dateien: jeweils fehlendes `;` nach der schliesenden `)` von `Deno.serve()` hinzufugen.
Plus Test-Fix: `provider: "turnstile" as const` im Captcha-Mock.

## Zusammenfassung

| Datei | Problem |
|---|---|
| `src/components/LettersView.tsx` | Fragt `user_id`, `archived_at` ab die nicht existieren |
| `src/components/DocumentsView.tsx` | Setzt `user_id`, `archived_at` beim Wizard |
| `src/utils/letterPDFGenerator.ts` | Debug-Guides immer an; divergiert stark vom Haupt-PDF-Generator |
| `src/utils/letterDOCXGenerator.ts` | Keine Variablen, hardcoded Grussformel, keine Anlagen |
| 5 Edge-Functions | Fehlende Semikolons / Typ-Fehler |

