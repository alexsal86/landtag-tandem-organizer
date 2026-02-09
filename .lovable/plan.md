

# Plan: 6 Fixes und Erweiterung Kosten-Widget im Team-Tab

## 1. Push-Benachrichtigungen funktionieren nicht im Browser

**Analyse:** Die Edge Function wird korrekt aufgerufen (Logs zeigen "No active subscriptions found" fuer den Ziel-User). Der Trigger sendet an `user_id` des Benachrichtigungsempfaengers, aber die einzige aktive Push-Subscription gehoert User `56188e2c...`, waehrend die Benachrichtigungen an User `adb472ab...` gehen. Dieser User hat keine aktive Subscription.

**Loesung:** Das ist kein Code-Bug - der User muss Push-Benachrichtigungen im Browser aktivieren (Einstellungen > Push-Benachrichtigungen aktivieren). Zusaetzlich wird die Edge Function so angepasst, dass sie bei `from_trigger: true` aussagekraeftigere Logs schreibt, damit Probleme leichter diagnostiziert werden koennen.

**Datei:** `supabase/functions/send-push-notification/index.ts` - Besseres Logging bei "No subscriptions" inkl. User-ID.

---

## 2. Drei-Punkte-Menue fuer eigene Entscheidungen im Tab "Fuer mich"

**Analyse:** Im Tab "Fuer mich" werden auch eigene Entscheidungen (mit neuer Aktivitaet) angezeigt. Die Bedingung `decision.isCreator` fuer das DropdownMenu (Zeile 871) ist bereits vorhanden und sollte greifen. Das Problem liegt daran, dass der `renderCompactCard` nur einmal definiert ist und fuer alle Tabs verwendet wird - die Bedingung existiert bereits. Es muss geprueft werden, ob `isCreator` korrekt gesetzt wird fuer die gefilterten Entscheidungen.

**Analyse vertieft:** Die Filter-Logik in Zeile 786-793 fuer "for-me" fuegt eigene Entscheidungen mit Aktivitaet hinzu (`myWithActivity`), und das Menu wird mit `decision.isCreator` angezeigt (Zeile 871). Das DropdownMenu sollte also bereits erscheinen. Moeglicherweise ist das Problem, dass `isCreator` bei manchen Entscheidungen nicht korrekt erkannt wird. Sicherheitshalber wird die Bedingung um eine zusaetzliche Pruefung erweitert.

**Datei:** `src/components/task-decisions/DecisionOverview.tsx` - Sicherstellen, dass das Menu fuer Ersteller-Entscheidungen im "for-me" Tab immer angezeigt wird.

---

## 3. Vorschau passt nicht zum Antworttyp bei Entscheidungserstellung

**Analyse:** Der Kern des Problems liegt in `StandaloneDecisionCreator.tsx`:
- `customOptions` wird initial mit `[{key: "option_1", label: "Option 1"}, {key: "option_2", label: "Option 2"}]` gesetzt (Zeile 59-62).
- `selectedTemplateId` startet mit `DEFAULT_TEMPLATE_ID` = "yesNoQuestion" (Zeile 58).
- Aber `handleTemplateChange` wird nur bei manueller Aenderung aufgerufen, nicht bei der Initialisierung.
- Ergebnis: Die Vorschau und die gespeicherten `response_options` zeigen "Option 1 / Option 2" statt "Ja / Nein / Rueckfrage".

**Loesung:** Die initiale `customOptions`-State mit den Optionen des Default-Templates (`yesNoQuestion`) initialisieren statt mit generischen "Option 1/2".

```text
// Aenderung in StandaloneDecisionCreator.tsx, Zeile 59-62:
const defaultTemplate = getTemplateById(DEFAULT_TEMPLATE_ID);
const [customOptions, setCustomOptions] = useState<ResponseOption[]>(
  defaultTemplate ? defaultTemplate.options.map(o => ({ ...o })) : [
    { key: "option_1", label: "Option 1", color: "blue" },
    { key: "option_2", label: "Option 2", color: "green" }
  ]
);
```

Gleiche Aenderung auch in `TaskDecisionCreator.tsx` pruefen und ggf. anpassen.

**Dateien:** `src/components/task-decisions/StandaloneDecisionCreator.tsx`, evtl. `src/components/task-decisions/TaskDecisionCreator.tsx`

---

## 4. E-Mail-Template fuer Pressemitteilungen: Standardtext editierbar machen

**Analyse:** In `PressReleasesList.tsx` (Zeile 229-234) wird der Template-Body als `placeholder` eines Textareas gesetzt. Wenn kein Wert in der DB gespeichert ist, bleibt `emailTemplateBody` leer ("") und der Placeholder-Text verschwindet beim Tippen.

**Loesung:** Beim Laden der Settings wird geprueft, ob ein Body-Template existiert. Falls nicht, wird der Standardtext als tatsaechlicher Wert (nicht als Placeholder) gesetzt, sodass der User diesen bearbeiten und erweitern kann.

```text
// In loadSettings(), nach dem forEach:
if (!emailTemplateBody) {
  setEmailTemplateBody('Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie unsere aktuelle Pressemitteilung:\n\n{{titel}}\n\n{{excerpt}}\n\nDen vollständigen Beitrag finden Sie unter:\n{{link}}');
}
// Analog fuer emailTemplateSubject
```

**Datei:** `src/components/press/PressReleasesList.tsx`

---

## 5. Verwaltungsseite (Ausgaben) unter Admin nicht erreichbar

**Analyse:** Die AdminSidebar definiert "expense" unter der Section "security" (Zeile 78). Aber `Administration.tsx` rendert `ExpenseManagement` nur wenn `activeSection === "politics"` (Zeile 1878). Da "politics" als Section in der Sidebar gar nicht existiert (wurde offenbar umstrukturiert), wird der Code nie erreicht.

**Loesung:** Den `case "expense"` mit `return <ExpenseManagement />` in den richtigen Section-Block verschieben, naemlich unter `activeSection === "security"`.

**Datei:** `src/pages/Administration.tsx` - `case "expense"` von der `politics`-Section in die `security`-Section verschieben.

---

## 6. Kosten-Widget im Team-Tab unter "Meine Arbeit"

**Analyse:** Der Team-Tab (`MyWorkTeamTab.tsx`) zeigt aktuell Teammitglieder mit Arbeitszeit-Indikatoren und Mitarbeitergespraechs-Status. Der Abgeordnete und die Bueroleitung sollen zusaetzlich eine kompakte Kostenuebersicht sehen.

**Konzept:** Ein neuer Abschnitt "Kosten-Ueberblick" im Team-Tab mit folgenden Elementen:

### Fuer den Abgeordneten:
- **Monatsueberblick:** Gesamtausgaben des aktuellen Monats vs. Budget (Fortschrittsbalken)
- **Top-Kategorien:** Die 3 groessten Ausgabenkategorien als farbige Badges mit Betraegen
- **Schnell-Erfassung:** Button "Kosten einreichen" oeffnet einen kompakten Dialog (Betrag, Kategorie, Beleg-Upload, Beschreibung)
- **Letzte Ausgaben:** Die 5 neuesten Ausgaben als kompakte Liste

### Fuer Mitarbeiter (Bueroleitung):
- Gleicher Ueberblick plus ein Badge/Hinweis wenn Ausgaben zur Pruefung ausstehen
- Button "Zur Verwaltung" der direkt zur Admin-Seite `/admin?section=security&sub=expense` navigiert

### Umsetzung:
1. Neue Komponente `src/components/my-work/MyWorkExpenseWidget.tsx` erstellen
2. Widget nutzt die bestehenden Supabase-Tabellen (`expenses`, `expense_categories`, `expense_budgets`)
3. Einbindung in `MyWorkTeamTab.tsx` zwischen "Team Announcements" und "Teammitglieder"
4. Kompakt-Dialog fuer Schnell-Erfassung (Betrag, Kategorie-Dropdown, optionaler Beleg, Beschreibung)

**Dateien:**
- `src/components/my-work/MyWorkExpenseWidget.tsx` (neu)
- `src/components/my-work/MyWorkTeamTab.tsx` (Widget einbinden)

---

## Zusammenfassung der Aenderungen

| Datei | Aenderung |
|-------|-----------|
| `supabase/functions/send-push-notification/index.ts` | Besseres Logging bei fehlenden Subscriptions |
| `src/components/task-decisions/DecisionOverview.tsx` | Sicherstellen, dass Ersteller-Menu im "Fuer mich"-Tab sichtbar ist |
| `src/components/task-decisions/StandaloneDecisionCreator.tsx` | Initiale customOptions mit Default-Template-Optionen statt generischen Werten |
| `src/components/task-decisions/TaskDecisionCreator.tsx` | Gleiche Korrektur der initialen Optionen |
| `src/components/press/PressReleasesList.tsx` | Standardtext als Wert statt Placeholder setzen |
| `src/pages/Administration.tsx` | `case "expense"` in die richtige Section verschieben |
| `src/components/my-work/MyWorkExpenseWidget.tsx` | Neue kompakte Kosten-Uebersicht mit Schnell-Erfassung |
| `src/components/my-work/MyWorkTeamTab.tsx` | Expense-Widget einbinden |

## Reihenfolge

1. Fix #5: Admin Expense-Seite erreichbar machen (1 Zeile verschieben)
2. Fix #3: Decision-Template Initialisierung korrigieren
3. Fix #4: Press-Template als editierbaren Wert setzen
4. Fix #2: Decision-Menu im "Fuer mich"-Tab pruefen/sicherstellen
5. Fix #1: Push-Logging verbessern
6. Feature #6: Kosten-Widget erstellen und einbinden

