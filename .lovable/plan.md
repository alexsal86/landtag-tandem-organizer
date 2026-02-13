
# Plan: 7 Verbesserungen und neue Funktionen

Hier ist eine Uebersicht aller Punkte mit Einschaetzung und Vorgehensweise:

---

## 1. Brief-Anlass-Vorlagen-Verwaltung in der Administration

**Aktueller Stand:** Die Zuordnung von Anlaessen zu Vorlagen ist im Code hartcodiert (`OCCASION_TEMPLATE_MAP` in `LetterWizard.tsx`). Es gibt 7 Anlaesse (Buergeranliegen, Ministerium, Einladung, etc.), die ueber Textmuster mit Vorlagen verknuepft werden.

**Loesung:**

- Neue Datenbanktabelle `letter_occasions` mit Feldern: `id`, `tenant_id`, `key`, `label`, `description`, `icon`, `color`, `sort_order`, `default_template_id` (FK auf `letter_templates`), `is_active`, `created_at`, `updated_at`
- Neuer Administrations-Bereich unter **Vorlagen > Brief-Anlaesse** (neuer Unterpunkt in der Admin-Sidebar)
- CRUD-Oberflaeche zum Erstellen, Bearbeiten und Loeschen von Anlaessen mit Verknuepfung zur Briefvorlage
- `LetterWizard.tsx` wird angepasst, um die Anlaesse aus der Datenbank statt aus dem hartcodierten Array zu laden
- RLS-Policies fuer Mandantentrennung

### Dateien:
- `AdminSidebar.tsx`: Neuer Unterpunkt "Brief-Anlaesse" unter "Vorlagen"
- Neue Komponente: `src/components/administration/LetterOccasionManager.tsx`
- `LetterWizard.tsx`: Anlaesse aus DB laden statt hardcoded
- DB-Migration: Neue Tabelle `letter_occasions` + Seed-Daten der 7 Standard-Anlaesse

---

## 2. "Preview has not been built yet" Fehler

**Analyse:** Dies ist ein Build-/Preview-Fehler der Lovable-Umgebung, kein Code-Fehler. Der Fehler tritt auf, wenn die Anwendung gerade gebaut wird oder ein Kompilierfehler vorliegt. Nach dem Implementieren der geplanten Aenderungen und erfolgreichem Build sollte die Vorschau wieder funktionieren. Es sind keine speziellen Code-Aenderungen noetig.

---

## 3. Suche: Direkte Eingabe im Header und Performance

**Aktueller Stand:** Die `HeaderSearch`-Komponente ist nur ein visueller Button, der den `GlobalSearchCommand`-Dialog oeffnet. Es gibt einen 300ms Debounce und eine Mindestlaenge von 2 Zeichen.

**Loesung:**

- `HeaderSearch` wird zu einem echten Eingabefeld umgebaut: Tippen startet sofort die Suche
- Bei Eingabe oeffnet sich automatisch der `GlobalSearchCommand`-Dialog mit dem bereits eingegebenen Text
- Performance-Verbesserung: Debounce von 300ms auf 150ms reduzieren
- Der `GlobalSearchCommand` erhaelt eine optionale `initialQuery`-Prop, um mit vorgefillertem Text zu starten

### Dateien:
- `src/components/layout/HeaderSearch.tsx`: Echtes Input-Feld mit Weiterleitung an GlobalSearch
- `src/components/GlobalSearchCommand.tsx`: `initialQuery` Event-Daten akzeptieren

---

## 4. Canvas-Designer: Element-Farben in der Sidebar

**Aktueller Stand:** Die Elemente in der Sidebar-Liste des Canvas-Designers verwenden einheitliche Buttons (`variant="outline"` oder `variant="default"`), waehrend die Bloecke auf dem Canvas individuelle Farben haben (z.B. cyan fuer Header, blau fuer Adressfeld, lila fuer Info-Block).

**Loesung:**

- Die Element-Buttons in der Sidebar erhalten dieselben Farben wie auf dem Canvas
- Jeder Button zeigt einen farbigen Streifen oder Hintergrund entsprechend der `block.color`-Klasse

### Dateien:
- `src/components/letters/LetterLayoutCanvasDesigner.tsx`: Sidebar-Buttons mit Block-Farben versehen (Zeilen 209-219)

---

## 5. Zoom-Funktion fuer den Canvas-Designer

**Aktueller Stand:** Der Canvas verwendet einen festen Skalierungsfaktor (`SCALE = 2.2`).

**Loesung:**

- Zoom-Steuerung (Plus/Minus-Buttons und Prozentwert-Anzeige) in der Toolbar des Canvas-Designers
- SCALE wird von einer Konstante zu einem State-Wert
- Zoom-Stufen: 50%, 75%, 100%, 125%, 150%, 200% (wobei 100% = 2.2 SCALE entspricht)
- Mausrad-Zoom mit Ctrl/Cmd gehalten

### Dateien:
- `src/components/letters/LetterLayoutCanvasDesigner.tsx`: State fuer Zoom-Level, Zoom-Buttons in der Toolbar, SCALE dynamisch berechnen

---

## 6. Grosse Dateien aufteilen

**Empfehlung:** Ja, es lohnt sich. Grosse Dateien verlangsamen den Editor und erschweren die Wartung.

**Kandidaten fuer Aufteilung (nach Groesse/Komplexitaet):**
- `GlobalSearchCommand.tsx` (713 Zeilen) - Suchlogik in eigenen Hook auslagern
- `AppNavigation.tsx` (564 Zeilen) - Navigation-Items und Render-Funktionen auslagern
- `LetterTemplateManager.tsx` - Tab-Inhalte in eigene Komponenten
- `DocumentsView.tsx` - Sehr grosse Datei, einzelne Tabs/Dialoge auslagern

Dies kann als separater Refactoring-Schritt durchgefuehrt werden und hat keinen Einfluss auf die Funktionalitaet.

---

## 7. Badges nur fuer neue Benachrichtigungen

**Aktueller Stand:** Die Navigation zeigt Badges mit der **Gesamtanzahl** offener Elemente (z.B. alle offenen Aufgaben, alle unbeantworteten Entscheidungen). Der Hook `useNavigationNotifications` zaehlt offene Tasks, unbeantwortete Entscheidungen usw. unabhaengig davon, ob sie "neu" sind.

**Loesung:**

Der Hook `useNavigationNotifications.tsx` wird grundlegend umgebaut:

- **Nur ungelesene Benachrichtigungen zaehlen**: Statt offene Aufgaben/Entscheidungen zu zaehlen, werden nur `notifications` mit `is_read = false` pro `navigation_context` gezaehlt
- Die speziellen Zaehler fuer Aufgaben (Zeilen 66-78) und Entscheidungen (Zeilen 49-63) werden entfernt
- Administration-Badge bleibt fuer faellige Jahresaufgaben bestehen (da dies eine echte Handlungsaufforderung ist)
- SubNavigation und MobileSubNavigation verwenden dann ebenfalls nur die Benachrichtigungs-Zaehler

### Dateien:
- `src/hooks/useNavigationNotifications.tsx`: Nur `notifications` mit `is_read = false` zaehlen, keine separaten Task/Decision-Counts
- `src/components/AppNavigation.tsx`: Keine Aenderungen noetig (nutzt bereits `navigationCounts`)
- `src/components/layout/SubNavigation.tsx`: Keine Aenderungen noetig
- `src/components/layout/MobileSubNavigation.tsx`: Keine Aenderungen noetig

---

## Zusammenfassung der Prioritaeten

| Nr. | Thema | Aufwand | Dateien |
|-----|-------|---------|---------|
| 1 | Brief-Anlass-Verwaltung | Hoch | 4+ Dateien, DB-Migration |
| 2 | Preview-Fehler | Keiner | Kein Code-Fix noetig |
| 3 | Header-Suche direkt | Mittel | 2 Dateien |
| 4 | Canvas-Farben Sidebar | Gering | 1 Datei |
| 5 | Canvas-Zoom | Mittel | 1 Datei |
| 6 | Dateien aufteilen | Mittel | Refactoring |
| 7 | Badges nur Neuigkeiten | Mittel | 1 Datei |

Alle Punkte ausser Nr. 2 und Nr. 6 werden direkt umgesetzt. Nr. 6 (Dateien aufteilen) kann als separater Schritt erfolgen.
