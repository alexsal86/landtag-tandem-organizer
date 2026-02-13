

# Plan: 6 Verbesserungen

## 1. Brief-Anlaesse in die Datenbank laden (Seed-Daten)

Die `LetterOccasionManager`-Komponente hat bereits einen "Standard-Anlaesse erstellen"-Button mit `seedDefaults()`, der die 7 Standard-Anlaesse in die DB schreibt. Allerdings muss der Nutzer diesen manuell klicken. Stattdessen wird eine automatische Befuellung implementiert: Beim Laden der `LetterOccasionManager`-Seite wird geprueft, ob die Tabelle `letter_occasions` fuer den aktuellen Mandanten leer ist. Falls ja, werden die 7 Standardwerte automatisch eingefuegt.

### Dateien:
- `src/components/administration/LetterOccasionManager.tsx`: In `loadOccasions` automatisch `seedDefaults()` ausfuehren, wenn keine Eintraege vorhanden

---

## 2. Suche reparieren -- Performance und Bedienbarkeit

**Probleme:**
- Text wird beim Tippen "verschluckt", weil der Such-Dialog sofort bei 1 Zeichen oeffnet und den Fokus stiehlt
- Ergebnisse erscheinen nicht zuverlaessig; erst beim erneuten Oeffnen
- Der debounce auf `CommandInput.onValueChange` konkurriert mit dem State-Update aus `HeaderSearch`

**Loesung:**
- `HeaderSearch`: Erst bei Enter oder ab 2 Zeichen + kurzer Pause (400ms) den Dialog oeffnen -- nicht sofort bei jedem Tastendruck
- `GlobalSearchCommand`: Den internen `debouncedSearch`-Wrapper entfernen und stattdessen den `searchQuery`-State direkt setzen. Der Debounce wird ueber die `enabled`-Bedingung der react-query Hooks natuerlich gehandhabt (Queries starten erst bei `searchQuery.length >= 2`)
- `CommandInput` erhaelt `value={searchQuery}` und `onValueChange` setzt direkt `setSearchQuery`
- Kein Event-basiertes Oeffnen mehr -- stattdessen oeffnet sich der Dialog ueber einen State der in beiden Komponenten geteilt wird (oder der bisherige Event-Mechanismus wird beibehalten, aber mit Verzoegerung)

### Dateien:
- `src/components/layout/HeaderSearch.tsx`: Debounce vor Dialog-Oeffnung (400ms), kein sofortiges Oeffnen bei jedem Zeichen
- `src/components/GlobalSearchCommand.tsx`: `debouncedSearch`-Wrapper entfernen, `setSearchQuery` direkt nutzen, react-query Debounce ueber `staleTime` und Query-Key

---

## 3. Suche ohne Filterbereich -- schlankere Darstellung

Die Filter (Datum, Kategorie, Status) werden standardmaessig ausgeblendet und stattdessen ein einfacher "Mehr..."-Link angezeigt, der sie bei Bedarf einblendet. Die Suche soll so wirken: Eingabefeld oben, Treffer direkt darunter.

### Dateien:
- `src/components/GlobalSearchCommand.tsx`: Filter-Button bleibt, aber der Filter-Bereich ist standardmaessig eingeklappt. Das grundsaetzliche Verhalten bleibt gleich.

(Dies ist bereits so implementiert -- `showFilters` ist standardmaessig `false`. Hier muss nur sichergestellt werden, dass die Suche ohne Filter-Klick funktioniert. Das wird durch Punkt 2 behoben.)

---

## 4. LetterTemplateManager: Tabs konsistent machen (Betreff-Variablen, Ruecksende, Info-Block, Erweitert wiederherstellen)

**Problem:** Der Bearbeitungs-Dialog und der Erstellungs-Dialog in `LetterTemplateManager.tsx` haben inkonsistente Tabs. Die im Plan beschriebene konsolidierte Tab-Leiste (`renderTabsList` mit 10 Tabs: Canvas, Header, Footer, Layout, Allgemein, Adressfeld, Ruecksende, Info-Block, Betreff, Anlagen) wird nur im Bearbeitungsmodus teilweise genutzt. Der Create-Dialog hat eigene 12 Tabs mit anderem Layout.

**Loesung:** Beide Dialoge (Create und Edit) verwenden dieselbe konsistente Tab-Leiste (`renderTabsList`) und `renderCommonTabsContent`. Die bestehenden Features (Betreff-Variablen-Platzhalter, Ruecksende mit `SenderInformationManager`, Info-Block mit `InformationBlockManager`, Erweitert-Tab) werden in `renderCommonTabsContent` konsolidiert, sodass sie in beiden Kontexten identisch funktionieren.

Dazu werden die Tab-Listen in Create- und Edit-Dialog durch die gemeinsame `renderTabsList()`-Funktion ersetzt und der Inhalt durch `renderCommonTabsContent()` bereitgestellt. Die Tabs `block-content` und `advanced` werden ebenfalls integriert.

### Dateien:
- `src/components/LetterTemplateManager.tsx`: Create- und Edit-Dialog konsolidieren

---

## 5. Navigations-Badges bei Seitenbesuch zuruecksetzen

**Problem:** Wenn man eine Seite besucht und dort Benachrichtigungen als gelesen markiert werden (Tab-Badge verschwindet), bleibt der Badge in der Sidebar-Navigation bestehen.

**Loesung:** `markNavigationAsVisited` setzt bereits den lokalen `navigationCounts`-State auf 0 fuer den besuchten Kontext. Das Problem koennte sein, dass die uebergeordneten Gruppen-Badges (z.B. "Aufgaben"-Gruppe = Summe aus tasks + decisions + meetings) nicht aktualisiert werden. Die Funktion `getGroupBadge` summiert die Counts der SubItems -- wenn ein SubItem auf 0 gesetzt wird, sollte die Summe sich entsprechend reduzieren. Ein moegliches Problem: Die Realtime-Subscription laedt die Counts komplett neu und ueberschreibt den lokalen State. Hier wird eine zusaetzliche Synchronisation eingebaut: Nach `markNavigationAsVisited` wird der Count fuer alle uebergeordneten Kontexte ebenfalls aktualisiert.

Ausserdem wird sichergestellt, dass das "Alle als gelesen markieren"-Feature die Counts sofort zuruecksetzt.

### Dateien:
- `src/hooks/useNavigationNotifications.tsx`: `markNavigationAsVisited` setzt auch Parent-Kontext-Counts zurueck; Realtime-Subscription wartet kurz nach manueller Aktualisierung

---

## 6. Grosse Dateien aufteilen

### LetterTemplateManager.tsx (1031 Zeilen)
Aufteilung in:
- `src/components/letters/templates/LetterTemplateManager.tsx` -- Hauptkomponente (Templates-Liste, Create/Edit-Steuerung)
- `src/components/letters/templates/TemplateForm.tsx` -- Formular mit Tabs (renderCommonTabsContent, renderTabsList)
- `src/components/letters/templates/TemplateCard.tsx` -- Template-Karte fuer die Liste
- `src/components/letters/templates/TemplatePreview.tsx` -- Vorschau-Dialog
- `src/components/letters/templates/BlockCanvasEditor.tsx` -- renderBlockCanvas als eigene Komponente
- `src/components/letters/templates/SubjectTabContent.tsx` -- Betreff-Tab mit Variablen und Bildern

### AppNavigation.tsx (564 Zeilen)
Aufteilung in:
- `src/components/navigation/AppNavigation.tsx` -- Hauptkomponente (schlanker)
- `src/components/navigation/navigationConfig.ts` -- `navigationGroups`, `NavGroup`-Interface, `getNavigationGroups()`
- `src/components/navigation/NavGroupButton.tsx` -- `renderNavGroup` als eigene Komponente
- `src/components/navigation/HelpDialog.tsx` -- Hilfe-Dialog

### GlobalSearchCommand.tsx (719 Zeilen)
Aufteilung in:
- `src/components/search/GlobalSearchCommand.tsx` -- Hauptkomponente (Dialog, Rendering)
- `src/hooks/useGlobalSearch.ts` -- Alle Search-Queries und Logik (contacts, tasks, documents, etc.)
- `src/components/search/SearchResultGroups.tsx` -- Rendering der Ergebnisgruppen
- `src/components/search/RecentAndPopularSearches.tsx` -- Zuletzt/Beliebt-Bereiche
- `src/components/search/SearchFilters.tsx` -- Filter-UI
- `src/components/search/searchConfig.ts` -- navigationItems, recentSearches-Hilfsfunktionen

### Dateien insgesamt: ~15 neue Dateien, 3 Dateien werden aufgeteilt

---

## Zusammenfassung

| Nr. | Thema | Aufwand |
|-----|-------|---------|
| 1 | Brief-Anlaesse Seed-Daten | Gering |
| 2 | Suche reparieren | Mittel |
| 3 | Suche ohne Filter | Gering (bereits so) |
| 4 | LetterTemplateManager Tabs konsolidieren | Mittel |
| 5 | Navigation-Badges Sync | Gering |
| 6 | Dateien aufteilen | Hoch (aber rein mechanisch) |

