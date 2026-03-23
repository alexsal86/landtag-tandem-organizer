

## PDF-Ausgabe an Briefansicht angleichen

### Problem-Analyse

Nach Vergleich der PDF-Ausgabe (`pdfGenerator.ts` + `headerRenderer.ts`) mit der HTML-Briefansicht (`DIN5008LetterLayout.tsx`) gibt es folgende Diskrepanzen:

**PDF-Probleme (Header & Struktur):**
1. **Debug-Guides immer aktiv**: `drawDebugGuides()` wird auf jeder Seite aufgerufen (rote/blaue/grüne Linien, DIN-A4-Info-Box). `HeaderRenderer.renderDebugBox()` zeichnet rote Kästchen um jedes Element. Das verfälscht die Ausgabe komplett.
2. **Info-Block hardcoded**: PDF rendert den Info-Block mit eigener Logik (Zeile 392-458) statt die gespeicherten BlockLine-Daten zu verwenden. Die HTML-Ansicht nutzt `renderBlockLines()` mit den line-mode Daten aus dem Template.
3. **Return-Address/Address-Field**: PDF rendert diese Bereiche mit hardcodierten Schriftgrößen (7pt/9pt) statt den Template-Einstellungen zu folgen.
4. **Kein Salutation/Closing im PDF**: Die PDF-Ausgabe rendert weder Anrede noch Schlussformel/Unterschrift — die HTML-Ansicht schon.
5. **Footer-Rendering**: PDF hat eine eigene `renderFooterBlocks()`-Implementierung, die anders arbeitet als `TemplateFooterBlocks` in der HTML-Ansicht.

**HTML-Problem (Absatzabstände):**
6. **Keine `<p>`-Margin-Styles in DIN5008LetterLayout**: Im `LetterEditorCanvas` gibt es `margin: 0 0 4.5mm 0` für `.din5008-content-text p`, aber in `DIN5008LetterLayout.tsx` fehlt diese Regel — Absätze fallen mit Browser-Default-Margins zusammen. Im PDF werden Absätze korrekt mit `lineHeight / 2` (2.25mm) getrennt.

---

### Plan

#### Schritt 1: Debug-Ausgaben nur bei explizitem Debug-Modus

- **`pdfGenerator.ts`**: `drawDebugGuides()` nur aufrufen wenn ein `debugMode`-Flag gesetzt ist (analog zum HTML `debugMode`-Prop)
- **`headerRenderer.ts`**: `renderDebugBox()` nur bei Debug-Modus aufrufen. Dazu `debugMode`-Parameter im Constructor übergeben.

#### Schritt 2: Absatzabstände in der HTML-Briefansicht korrigieren

- **`DIN5008LetterLayout.tsx`**: Im `<style>`-Block die fehlende `<p>`-Margin-Regel hinzufügen (gleich wie im Editor-Canvas):
```css
.din5008-content-text p {
  margin: 0 0 4.5mm 0;
}
.din5008-content-text p:last-child {
  margin-bottom: 0;
}
```

#### Schritt 3: Info-Block im PDF mit BlockLine-Daten rendern

- **`pdfGenerator.ts`**: Neue Funktion `renderInfoBlockLines()` die die gespeicherten `BlockLine[]`-Daten aus dem Template (`layout_settings.blockContent.infoBlock`) rendert, mit korrekten Schriftgrößen, Label/Value-Paaren und Spacern — analog zur HTML-Ansicht.
- Variable-Substitution mit `buildVariableMap` + `substituteBlockLines` einbinden.

#### Schritt 4: Anrede und Schlussformel im PDF rendern

- **`pdfGenerator.ts`**: Vor dem Content-Text die Anrede (`salutation` aus Layout-Settings) rendern, danach eine Leerzeile. Nach dem Content die Schlussformel, Unterschriftenbild und Unterschriftsname rendern.

#### Schritt 5: Return-Address und Adressfeld aus Template-Einstellungen

- **`pdfGenerator.ts`**: Schriftgrößen für Rücksendezeile und Empfängeradresse aus `layout.addressField.returnAddressFontSize