
# Plan: Paginierung im Layout, Canvas-Fixes, Standardtext, Unterschrift und Betreff-Zeileneditor

## Uebersicht

Sechs Aenderungen am Brief-System:
1. Paginierung im Layout-Tab konfigurierbar machen
2. Canvas-Inhaltsbereich: Labels nur anzeigen wenn kein Inhalt vorhanden
3. Standardtext fuer Briefinhalt in den Einstellungen
4. Kleinerer Abstand bei Abschlussformel ohne Unterschriftsbild
5. Betreff-Zeile im Tab "Betreff, Anrede und Abschluss" als BlockLineEditor
6. Unterschriftsbilder hochladen und auswaehlen

---

## 1. Paginierung im Layout-Tab

**Problem:** Im `LayoutSettingsEditor.tsx` fehlt die Sektion fuer die Paginierung komplett.

**Loesung:** Neue Sektion "Paginierung" in `LayoutSettingsEditor.tsx` hinzufuegen mit den Feldern:
- Position von oben (mm) -> `pagination.top`
- Ausrichtung (links/mittig/rechts) -> `pagination.align`
- Schriftgroesse (pt) -> `pagination.fontSize`
- Aktiviert (Checkbox) -> `pagination.enabled`

Die `updateSetting`-Funktion muss um den `pagination`-Pfad erweitert werden (ggf. mit Initialisierung falls `pagination` undefined ist).

**Datei:** `src/components/letters/LayoutSettingsEditor.tsx`

---

## 2. Canvas-Inhaltsbereich: Labels bei vorhandenem Inhalt ausblenden

**Problem:** Im Canvas-Designer zeigt der Inhaltsbereich immer "Inhaltsbereich" und das Badge "98mm" an, selbst wenn Betreff/Anrede/Abschluss-Vorschau gerendert wird (Zeile 664-667).

**Loesung:** Die Labels (Block-Name + Badge) im Content-Block nur anzeigen, wenn keine Inhaltsvorschau vorhanden ist. Aktuell werden die Labels immer gerendert, danach kommt die Vorschau. Die Labels sollten nur angezeigt werden, wenn weder Betreff noch Salutation noch Closing definiert sind.

Konkret: Die Zeilen 664-667 im `LetterLayoutCanvasDesigner.tsx` so aendern, dass das Label+Badge-div nur gerendert wird, wenn kein integrierter Inhalt vorhanden ist (kein `subject.integrated`, keine `salutation.template`, kein `closing.formula`).

**Datei:** `src/components/letters/LetterLayoutCanvasDesigner.tsx`

---

## 3. Standardtext fuer Briefinhalt in den Einstellungen

**Problem:** In den globalen Briefvorlagen-Einstellungen (`LetterTemplateSettings.tsx`) kann man keinen Standardtext fuer den Briefinhalt voreinstellen.

**Loesung:** 
- Neue Karte "Standardtext" nach den Variablen hinzufuegen mit einem Textarea-Feld
- Der Standardtext wird in `variable_defaults` unter dem Schluessel `default_content` gespeichert
- Alternativ als eigenes Feld in der `letter_template_settings`-Tabelle (JSONB erlaubt das ohne Migration)

**Datei:** `src/components/letters/LetterTemplateSettings.tsx`

---

## 4. Kleinerer Abstand bei Abschlussformel ohne Unterschrift

**Problem:** In `DIN5008LetterLayout.tsx` (Zeile 593) wird bei fehlender Unterschrift ein fester Abstand von 13.5mm eingefuegt. Wenn es kein Unterschriftsbild gibt, soll der Abstand kleiner sein.

**Loesung:** 
- Wenn `signatureImagePath` vorhanden ist: 13.5mm Abstand (Platz fuer Unterschrift)
- Wenn kein Bild und kein `signatureName`: gar kein Extra-Abstand
- Wenn kein Bild aber `signatureName`: nur 4.5mm Abstand (eine Leerzeile)

Gleiche Logik im Canvas-Designer Vorschau anpassen (Zeile 696).

**Dateien:** `src/components/letters/DIN5008LetterLayout.tsx`, `src/components/letters/LetterLayoutCanvasDesigner.tsx`

---

## 5. Betreff als BlockLineEditor im Tab "Betreff, Anrede und Abschluss"

**Problem:** Der Betreff ist aktuell nur ein Checkbox+Select fuer die Form, aber kein Zeileneditor zum Einfuegen von Variablen wie `{{betreff}}`.

**Loesung:** Im Tab `block-subject` eine einzelne BlockLineEditor-Zeile einbauen fuer den Betreff. Diese Zeile erlaubt es, den Betreff als Variable `{{betreff}}` einzufuegen und optional eine Form davor zu platzieren. 

Technisch: Eine vereinfachte Version des BlockLineEditors oder eine einzelne Zeile mit Variable-Dropdown verwenden. Die Betreff-Zeile wird in `blockContent.subjectLine` als `BlockLineData` gespeichert (eine einzelne Zeile).

**Datei:** `src/components/LetterTemplateManager.tsx`

---

## 6. Unterschriftsbilder hochladen und auswaehlen

**Problem:** Aktuell ist das Unterschriftsbild nur ein Text-Input fuer den Storage-Pfad (Zeile 792-806 in LetterTemplateManager). Es fehlt ein Upload-Button und eine Bildauswahl.

**Loesung:**
- Den Text-Input ersetzen durch: einen Upload-Button (File-Input) + eine Vorschau des aktuellen Bildes + einen "Entfernen"-Button
- Upload-Logik: Bild in den `letter-assets` Bucket hochladen unter `signatures/[tenant_id]/[filename]`
- Nach erfolgreichem Upload den Pfad in `closing.signatureImagePath` setzen
- Die Galerie-Bilder (falls bereits geladen) als Auswahlmoeglichkeit anbieten
- Vorschau des aktuellen Unterschriftsbilds anzeigen wenn ein Pfad gesetzt ist

**Datei:** `src/components/LetterTemplateManager.tsx`

---

## Reihenfolge der Implementierung

1. `LayoutSettingsEditor.tsx` - Paginierung-Sektion hinzufuegen
2. `LetterLayoutCanvasDesigner.tsx` - Content-Block Labels Fix + Closing-Abstand
3. `DIN5008LetterLayout.tsx` - Closing-Abstand bei fehlender Unterschrift
4. `LetterTemplateSettings.tsx` - Standardtext-Feld hinzufuegen
5. `LetterTemplateManager.tsx` - Betreff BlockLineEditor + Unterschriftsbild Upload/Auswahl

Alle Aenderungen sind reine Frontend-Aenderungen ohne DB-Migrationen.
