
# Plan: 10-Punkte-Umsetzung

## 1. LetterWizard im DocumentsView einbinden

In `DocumentsView.tsx` oeffnet `handleCreateLetter()` (Zeile 574) noch den alten `showTemplateSelector`. Das muss durch den LetterWizard ersetzt werden.

**Aenderungen in `DocumentsView.tsx`:**
- `LetterWizard` importieren
- State `showWizard` hinzufuegen
- `handleCreateLetter` aendern: `setShowWizard(true)` statt `setShowTemplateSelector(true)`
- `handleWizardComplete`-Funktion hinzufuegen (gleiche Logik wie in `LettersView.tsx` Zeile 104-136)
- `LetterWizard`-Komponente rendern (analog zu Zeile 413-418 in `LettersView.tsx`)
- Den alten Template-Selector-Block (Zeilen 2108-2123) kann optional entfernt werden, da der Wizard ihn ersetzt

---

## 2. Browser-Push-Benachrichtigungen fuer Plattform-Ereignisse

Aktuell existiert bereits ein funktionierender Push-Trigger: Ein PostgreSQL-Trigger auf `notifications` ruft die Edge Function `send-push-notification` via `pg_net` auf. Jedes Mal, wenn `create_notification` RPC aufgerufen wird (was bereits in ~15 Stellen im Code passiert), wird ein Eintrag in die `notifications`-Tabelle geschrieben und der Trigger feuert automatisch.

**Status:** Die Push-Infrastruktur ist vollstaendig implementiert. `create_notification` schreibt in die DB, der Trigger sendet den Push. In-App-Benachrichtigungen und Push laufen parallel -- der Nutzer bekommt beides.

**Massnahmen:**
- Sicherstellen, dass der Trigger korrekt feuert (Logs pruefen)
- Falls nicht bereits vorhanden: Den Trigger-Status in der DB verifizieren
- Ggf. fehlende `create_notification`-Aufrufe in neuen Features ergaenzen (z.B. bei Kommentar-Antworten aus der Sidebar)

Keine Code-Aenderungen noetig, sofern der Trigger aktiv ist.

---

## 3. Suche auf Archive erweitern

Es gibt derzeit keine globale Suchfunktion in der App. Die Suche ist jeweils lokal in den einzelnen Views implementiert (z.B. `searchQuery` in DecisionOverview). Die Archiv-Suche funktioniert bereits in `DecisionOverview` -- der `searchQuery`-Filter wird VOR dem Tab-Filter angewandt (Zeile 769-775), und der Tab "Archiv" hat seinen eigenen Filter (Zeile 778-779).

**Fazit:** Die Suche innerhalb der Entscheidungen durchsucht bereits archivierte Eintraege, wenn man im "Archiv"-Tab ist. Eine globale Suche ueber alle Bereiche waere ein groesseres Feature, das hier nicht im Scope ist.

---

## 4. Inline-Antwort in Decision-Cards und Sidebar verbreitern

### 4a. Inline-Antwort in DecisionCardActivity
Die `DecisionCardActivity` (Zeile 46) zeigt bereits Rueckfragen mit Reply-Button und Textarea an (Zeile 47-48). Der `onReply`-Callback ist vorhanden und funktioniert. Dieses Feature existiert bereits.

### 4b. Sidebar verbreitern
Die `MyWorkDecisionSidebar` wird in einem Grid `lg:grid-cols-[1fr_240px]` (Zeile 622 in MyWorkDecisionsTab.tsx) gerendert. Die `DecisionSidebar` in `DecisionOverview.tsx` nutzt `lg:grid-cols-[1fr_340px]` (Zeile 1148).

**Aenderung in `MyWorkDecisionsTab.tsx`:**
- Grid von `lg:grid-cols-[1fr_240px]` auf `lg:grid-cols-[1fr_340px]` aendern (Zeile 622), damit beide Sidebars gleich breit sind

---

## 5. Wissen von "Mehr" nach "Akten" verschieben

"Wissen" ist aktuell unter "Mehr" in der Navigation (`AppNavigation.tsx` Zeile 120: `{ id: "knowledge", label: "Wissen", icon: Database }`). Es soll ein Unter-Tab von "Akten" (FallAkten/CaseFiles) werden.

**Aenderungen:**
- `AppNavigation.tsx`: "knowledge" aus den "Mehr"-subItems entfernen und stattdessen als subItem unter dem Akten-Bereich hinzufuegen (sofern Akten eine eigene Navigationsgruppe hat), oder alternativ ueber die Routing-Logik
- `Navigation.tsx`: Ebenso anpassen (Zeile 70)
- `Index.tsx` / Router: Route `/knowledge` ueberpruefen und ggf. Redirect einrichten
- Die `KnowledgeBaseView` selbst bleibt unveraendert, nur die Navigation aendert sich

Da "Akten" (casefiles) in "Meine Arbeit" als Tab existiert, kann "Wissen" als Unterseite innerhalb der Akten-Ansicht integriert werden:
- In `MyWorkCaseFilesTab` einen zusaetzlichen Sub-Tab "Wissen" hinzufuegen, der die `KnowledgeBaseView` rendert
- Oder in der Hauptnavigation "Akten" eine Sub-Navigation mit "FallAkten" und "Wissen" einbauen

**Empfohlener Ansatz:** "Wissen" wird als Sub-Tab in der Hauptnavigation unter "Akten" eingeordnet (aehnlich wie "Mehr" Unterpunkte hat). Die bestehende Route `/knowledge` wird beibehalten, aber die Navigation zeigt es unter "Akten".

**Dateien:** `AppNavigation.tsx`, `Navigation.tsx`

---

## 6. Entscheidungen priorisieren

### DB-Aenderung noetig
Ein neues Feld `priority` (integer, default 0) in der Tabelle `task_decisions` wird benoetigt.

```sql
ALTER TABLE task_decisions ADD COLUMN priority integer DEFAULT 0;
```

### Frontend-Aenderungen:
- **StandaloneDecisionCreator.tsx** und **TaskDecisionCreator.tsx**: Checkbox oder Toggle "Als prioritaer markieren" hinzufuegen, das `priority = 1` setzt
- **DecisionOverview.tsx** und **MyWorkDecisionsTab.tsx**: Entscheidungen nach `priority DESC, created_at DESC` sortieren
- **MyWorkDecisionCard.tsx** und DecisionOverview-Cards: Wenn `priority > 0`, ein kleines Prioritaets-Badge anzeigen (z.B. ein Stern-Icon oder "Prioritaer"-Badge)
- **Supabase-Queries**: `order('priority', { ascending: false })` vor `order('created_at', { ascending: false })` setzen

**Dateien:** DB-Migration, `StandaloneDecisionCreator.tsx`, `TaskDecisionCreator.tsx`, `DecisionOverview.tsx`, `MyWorkDecisionsTab.tsx`, `MyWorkDecisionCard.tsx`, `types.ts`

---

## 7. Oeffentlich-Icon Position angleichen

In `DecisionOverview.tsx` (Zeile 960-964) wird das Globe-Icon im Metadata-Bereich mit Text "Oeffentlich" angezeigt. In `MyWorkDecisionCard.tsx` (Zeile 130-139) ist es oben im Header-Bereich als Tooltip-Icon ohne Text.

**Aenderung in `DecisionOverview.tsx`:**
- Das Globe-Icon+Text aus der Metadata-Row (Zeile 960-964) entfernen
- Stattdessen das Globe-Icon in den Header-Badge-Bereich verschieben (Zeile 848, nach den Status-Badges), exakt wie in `MyWorkDecisionCard.tsx` Zeile 130-139 -- als reines Icon mit Tooltip, ohne Text

---

## 8. Ueberschrift und Beschreibung in der Card begrenzen

Aktuell hat der Titel `line-clamp-1` mit `group-hover:line-clamp-none` und die Beschreibung expandiert ueber `TruncatedDescription` mit `maxLength=150`. Bei langen Texten kann die Card sehr gross werden.

**Aenderungen in `MyWorkDecisionCard.tsx` und `DecisionOverview.tsx`:**
- Titel: `line-clamp-1` beibehalten, aber `group-hover:line-clamp-none` durch `group-hover:line-clamp-2` ersetzen (maximal 2 Zeilen beim Hover)
- Beschreibung: `maxLength` von 150 auf 100 reduzieren
- Beide Cards: Einen `max-h` auf den Titel+Beschreibungs-Container setzen, um sicherzustellen, dass sie nicht ueber die Voting-Row hinauswachsen

---

## 9. Entscheidungs-Dialog kompakter gestalten

Betrifft `StandaloneDecisionCreator.tsx` und `TaskDecisionCreator.tsx`.

**Layout-Aenderungen:**

1. **Dialog breiter und hoeher:**
   - `sm:max-w-[500px]` auf `sm:max-w-[900px] max-h-[90vh] overflow-y-auto` aendern

2. **Benutzerauswahl (50%) + E-Mail/Matrix-Checkboxen (50%) nebeneinander:**
   ```text
   <div className="grid grid-cols-2 gap-4">
     <div>Benutzer auswahlen...</div>
     <div>
       <Checkbox>Auch per E-Mail</Checkbox>
       <Checkbox>Auch via Matrix</Checkbox>
     </div>
   </div>
   ```

3. **Antworttyp: Doppelten Erklaertext entfernen:**
   - In `StandaloneDecisionCreator.tsx` Zeile 571-572 wird unter der Select-Box nochmal `template.description` angezeigt. Das entfernen, da der Text schon im SelectItem steht.

4. **Vorschau inline:**
   - `ResponseOptionsPreview` direkt hinter dem Label "Vorschau:" in einer Zeile:
   ```text
   <div className="flex items-start gap-2">
     <span className="text-sm font-medium shrink-0">Vorschau:</span>
     <ResponseOptionsPreview options={currentOptions} />
   </div>
   ```

5. **Dateien (70%) + Themen (30%) nebeneinander:**
   ```text
   <div className="grid grid-cols-[70%_30%] gap-4">
     <div>Dateien anhaengen...</div>
     <div>Themen...</div>
   </div>
   ```

**Dateien:** `StandaloneDecisionCreator.tsx`, `TaskDecisionCreator.tsx`

---

## 10. Dashboard-Tab Anpassungen

### 10a. Tab schmaler machen
In `MyWorkView.tsx` Zeile 466 hat jeder Tab `px-4`. Der Dashboard-Tab soll weniger Padding haben.

**Aenderung:** Wenn `tab.isLogo`, dann `px-2` statt `px-4`

### 10b. Text sofort sichtbar statt Typewriter
In `DashboardGreetingSection.tsx` Zeile 311 wird `TypewriterText` verwendet. Stattdessen den Text direkt rendern.

**Aenderung in `DashboardGreetingSection.tsx`:**
- `TypewriterText` durch ein einfaches `<span>` ersetzen, das `fullText` direkt anzeigt (mit Markdown-Formatierung fuer Fettschrift)

### 10c. CombinedMessagesWidget durch NewsWidget ersetzen
In `MyWorkView.tsx` Zeile 495 wird `CombinedMessagesWidget` gerendert. Stattdessen das `NewsWidget` (aus `src/components/widgets/NewsWidget.tsx`) einbinden, das RSS-Feeds anzeigt.

**Aenderung in `MyWorkView.tsx`:**
```text
{activeTab === "dashboard" && (
  <div className="space-y-6">
    <DashboardGreetingSection />
    <div className="w-1/2">
      <NewsWidget />
    </div>
  </div>
)}
```

**Dateien:** `MyWorkView.tsx`, `DashboardGreetingSection.tsx`

---

## Technische Zusammenfassung

### DB-Aenderung
```sql
ALTER TABLE task_decisions ADD COLUMN priority integer DEFAULT 0;
```

### Dateien

| Datei | Aenderungen |
|-------|-------------|
| `DocumentsView.tsx` | LetterWizard einbinden statt Template-Selector |
| `MyWorkDecisionsTab.tsx` | Sidebar-Breite von 240px auf 340px |
| `AppNavigation.tsx` | "Wissen" von "Mehr" nach "Akten" verschieben |
| `Navigation.tsx` | Ebenso |
| `StandaloneDecisionCreator.tsx` | Kompakteres Layout (2-Spalten, breiter Dialog), Priority-Toggle |
| `TaskDecisionCreator.tsx` | Ebenso |
| `DecisionOverview.tsx` | Globe-Icon in Header verschieben, Titel/Beschreibung begrenzen, Priority-Sortierung |
| `MyWorkDecisionCard.tsx` | Titel/Beschreibung begrenzen, Priority-Badge |
| `MyWorkView.tsx` | Dashboard-Tab schmaler, NewsWidget statt CombinedMessagesWidget |
| `DashboardGreetingSection.tsx` | Text direkt anzeigen statt Typewriter |
| DB-Migration | `priority` Spalte in `task_decisions` |
