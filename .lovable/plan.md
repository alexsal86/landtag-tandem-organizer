

# Plan: Editor-Bereinigung, Brief-Assistent, Entscheidungs-Fix und Dashboard-Tab

## 1. Editor-Bereinigung

Aktuell gibt es 5 Editor-Varianten. Davon werden nur 2 tatsaechlich gebraucht:
- **SimpleRichTextEditor** (Lexical, in `src/components/ui/`) -- verwendet in ~18 Dateien fuer kurze Rich-Text-Felder (Entscheidungen, Notizen, Kommentare)
- **EnhancedLexicalEditor** -- vollwertiger Editor fuer Briefe und Dokumente

### Zu loeschen:
| Datei | Grund |
|-------|-------|
| `src/components/SimpleLexicalEditor.tsx` | Nur in EditorTestPage verwendet |
| `src/components/PlainTextEditor.tsx` | Nirgends importiert |
| `src/components/RichTextEditor.tsx` (1007 Zeilen) | Nirgends importiert |
| `src/components/EditorTestPage.tsx` | Test-Seite, nicht noetig |
| `src/pages/EditorTest.tsx` | Route zur Test-Seite |
| `src/pages/HeaderEditorTestPage.tsx` | Test-Seite |
| `src/components/emails/EmailRichTextEditor.tsx` | Ersetzen durch SimpleRichTextEditor |

### Migrationen:
- `EmailComposer.tsx`: `EmailRichTextEditor` durch `SimpleRichTextEditor` ersetzen (gleiche API: `initialContent` + `onChange` mit HTML)
- `EmailTemplateManager.tsx`: Ebenso migrieren
- Route `/editor-test` aus `App.tsx` entfernen

---

## 2. Brief-Assistent (Briefe neu konzipiert)

### Aktuell
"Neuer Brief" -> Template-Auswahl (technisch, nur Template-Name) -> Editor mit vielen Feldern

### Neu: Brief-Assistent als geführter Wizard
Statt direkt in den Editor zu springen, fuehrt ein Assistent durch die Erstellung:

**Schritt 1 -- Anlass waehlen:**
Karten mit Icons zur Auswahl:
- Buergeranliegen (Brief an Buerger als Antwort auf Anfragen)
- Ministerium (formelle Korrespondenz mit Ministerien)
- Einladung (Veranstaltungseinladungen)
- Gruss (Glueckwuensche, Beileid, Dank)
- Parlamentarische Anfrage (Anfragen an Regierung)
- Stellungnahme (offizielle Positionierung)
- Sonstiges (freie Briefform)

**Schritt 2 -- Empfaenger waehlen:**
- Kontakt aus dem System waehlen (ContactSelector)
- Oder neue Adresse eingeben
- Adresse wird automatisch uebernommen

**Schritt 3 -- Absender + Vorlage (automatisch vorgeschlagen):**
- Basierend auf dem Anlass wird das passende Template und der Absender vorgeschlagen
- Nutzer kann beides noch aendern
- Button "Brief erstellen" oeffnet den Editor

### Dateien:
| Datei | Aenderung |
|-------|-----------|
| `src/components/letters/LetterWizard.tsx` (NEU) | Dreischrittiger Assistent |
| `src/components/LettersView.tsx` | "Neuer Brief" oeffnet Wizard statt Template-Selector, Briefliste wird schlanker (weniger Felder direkt sichtbar, kompaktere Cards) |

---

## 3. Entscheidungen -- Kenntnisnahme und Freitext funktionieren nicht

### Ursache gefunden
Die Test-Entscheidungen (ID `3452632d...` und `312e6221...`) haben den gleichen User als `created_by` UND als Teilnehmer. Der Code in `TaskDecisionResponse.tsx` Zeile 331 blockiert den Creator komplett:
```text
if (isCreator) {
  return "Als Ersteller koennen Sie nur auf Rueckmeldungen antworten..."
}
```

Bei Kenntnisnahme und Freitext macht diese Blockade keinen Sinn -- der Ersteller soll ebenfalls bestaetigen oder antworten koennen, da es keine "Abstimmung" im klassischen Sinne ist.

### Fix
In `TaskDecisionResponse.tsx`:
- Pruefen ob es sich um Kenntnisnahme (`isSingleAcknowledgement`) oder Freitext (`isSingleFreetext`) handelt
- Bei diesen Typen den Creator NICHT blockieren -- die Blockade nur fuer klassische Abstimmungen beibehalten
- Reihenfolge anpassen: `isSingleAcknowledgement` und `isSingleFreetext` Checks VOR die Creator-Blockade verschieben

Zusaetzlich in den Card-Renderings (`MyWorkDecisionCard.tsx`, `DecisionOverview.tsx`, `TaskDecisionList.tsx`):
- Die Bedingung `!decision.isCreator` bei Kenntnisnahme/Freitext lockern, damit der Response-Button auch fuer Ersteller erscheint

**Dateien:** `TaskDecisionResponse.tsx`, `MyWorkDecisionCard.tsx`, `DecisionOverview.tsx`, `TaskDecisionList.tsx`

---

## 4. Dashboard als erster Tab in "Meine Arbeit"

### Konzept
Das App-Logo wird als erster Tab-Eintrag in der Tab-Leiste von "Meine Arbeit" platziert. Klick darauf zeigt eine schlanke Dashboard-Ansicht mit:
- Begruessung (DashboardGreetingSection)
- Nachrichten-Widget (CombinedMessagesWidget -- Schwarzes Brett + persoenliche Nachrichten)
- Keine Schnellzugriffe, keine Statistik-Karten

### Umsetzung
In `MyWorkView.tsx`:
- Neuer Tab `dashboard` als erster Eintrag in `BASE_TABS`, mit dem App-Logo als Icon (dynamisch aus `app_settings` geladen, Fallback: Home-Icon)
- Default-Tab von `"capture"` auf `"dashboard"` aendern
- Tab-Content: `DashboardGreetingSection` + `CombinedMessagesWidget` in einem sauberen Layout

**Dateien:** `MyWorkView.tsx`

---

## Technische Zusammenfassung

### Keine DB-Aenderungen noetig

### Dateien

| Datei | Aenderung |
|-------|-----------|
| `SimpleLexicalEditor.tsx` | Loeschen |
| `PlainTextEditor.tsx` | Loeschen |
| `RichTextEditor.tsx` | Loeschen |
| `EditorTestPage.tsx` | Loeschen |
| `pages/EditorTest.tsx` | Loeschen |
| `pages/HeaderEditorTestPage.tsx` | Loeschen |
| `emails/EmailRichTextEditor.tsx` | Loeschen |
| `emails/EmailComposer.tsx` | EmailRichTextEditor -> SimpleRichTextEditor |
| `emails/EmailTemplateManager.tsx` | EmailRichTextEditor -> SimpleRichTextEditor |
| `App.tsx` | Route `/editor-test` entfernen |
| `letters/LetterWizard.tsx` (NEU) | Brief-Assistent mit 3 Schritten |
| `LettersView.tsx` | Wizard statt Template-Selector, schlankere Uebersicht |
| `TaskDecisionResponse.tsx` | Creator-Blockade fuer Kenntnisnahme/Freitext aufheben |
| `MyWorkDecisionCard.tsx` | Response-Button auch fuer Creator bei Kenntnisnahme/Freitext |
| `DecisionOverview.tsx` | Ebenso |
| `TaskDecisionList.tsx` | Ebenso |
| `MyWorkView.tsx` | Dashboard-Tab mit Logo als erstem Tab |

