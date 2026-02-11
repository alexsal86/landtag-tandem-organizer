
# Plan: Entscheidungen -- Standardeinstellungen, Bug-Fixes und neue Features

## 1. Standard-Einstellungen erweitern (Punkt 1)

Aktuell speichert `useDefaultDecisionParticipants` nur Teilnehmer-IDs in localStorage. Die Erweiterung umfasst drei zusaetzliche Standardwerte.

**Aenderungen:**

**`useDefaultDecisionParticipants.ts`** -> Umbenennung/Erweiterung zu `useDefaultDecisionSettings.ts`:
- Neuer Storage-Key `default_decision_settings` mit JSON-Objekt:
  ```text
  {
    participants: string[],
    visibleToAll: boolean,
    sendByEmail: boolean,
    sendViaMatrix: boolean
  }
  ```
- Rueckwaertskompatibilitaet: Beim ersten Laden wird der alte Key `default_decision_participants` migriert

**`DefaultParticipantsDialog.tsx`** -> Erweitern um drei zusaetzliche Toggles:
- Switch "Oeffentlich (fuer alle sichtbar)" -- setzt `visibleToAll`-Standard
- Switch "Per E-Mail versenden" -- setzt `sendByEmail`-Standard
- Switch "Via Matrix versenden" -- setzt `sendViaMatrix`-Standard
- Dialog-Titel aendern zu "Standard-Einstellungen"

**`StandaloneDecisionCreator.tsx` und `TaskDecisionCreator.tsx`**:
- Beim Laden der Standardeinstellungen auch `visibleToAll`, `sendByEmail` und `sendViaMatrix` aus den gespeicherten Defaults uebernehmen

---

## 2. Vorschau-Bug nach zweiter Erstellung beheben (Punkt 2)

**Problem:** Nach dem Reset im `handleSubmit` werden `customOptions` auf generische Platzhalter `["Option 1", "Option 2"]` zurueckgesetzt (Zeile 448-451 in Standalone, Zeile 464-467 in Task), obwohl `selectedTemplateId` auf den Default (`yesNoQuestion`) zurueckgesetzt wird. Beim naechsten Oeffnen stimmt die Vorschau nicht mehr mit dem ausgewaehlten Template ueberein.

**Fix in beiden Creatorn (`StandaloneDecisionCreator.tsx` und `TaskDecisionCreator.tsx`):**
- Im Reset-Block nach `setSelectedTemplateId(DEFAULT_TEMPLATE_ID)` die `customOptions` auf die tatsaechlichen Options des Default-Templates setzen:
  ```text
  const defaultTpl = getTemplateById(DEFAULT_TEMPLATE_ID);
  setCustomOptions(defaultTpl ? defaultTpl.options.map(o => ({...o})) : []);
  ```
  statt der Platzhalter `Option 1 / Option 2`.

---

## 3. File-Upload angleichen (Punkt 3)

**Analyse:** Beide Creatorn nutzen `DecisionFileUpload` im `mode="creation"` identisch. Der Unterschied: `StandaloneDecisionCreator` extrahiert Email-Metadaten beim Upload und speichert sie in `email_metadata`, `TaskDecisionCreator` dagegen nicht.

**Fix in `TaskDecisionCreator.tsx`:**
- Die Upload-Logik im `handleSubmit` wird an `StandaloneDecisionCreator` angeglichen: Email-Metadaten (.eml/.msg) werden analog geparst und beim DB-Insert mitgegeben (imports fuer `isEmlFile`, `isMsgFile`, `parseEmlFile`, `parseMsgFile` hinzufuegen)

**UI-Angleichung:**
- `TaskDecisionCreator` bekommt denselben Themen-Selektor (`TopicSelector`) wie `StandaloneDecisionCreator`
- Reihenfolge der Felder in beiden Dialogen vereinheitlichen: Titel, Beschreibung, Oeffentlich-Checkbox, Antworttyp, Teilnehmer, Themen, Dateien, E-Mail/Matrix-Checkboxen

---

## 4. Kenntnisnahme-Feature (Punkt 4)

Umgesetzt als neues Decision-Template "Kenntnisnahme" -- es nutzt die vorhandene Entscheidungs-Infrastruktur, ist aber konzeptionell simpler: Der Ersteller teilt eine Information, Teilnehmer bestaetigen mit "Zur Kenntnis genommen".

**Aenderungen:**

**`decisionTemplates.ts`** -- Neues Template:
```text
kenntnisnahme: {
  id: "kenntnisnahme",
  name: "Zur Kenntnisnahme",
  description: "Information teilen -- Teilnehmer bestaetigen den Erhalt",
  options: [
    { key: "acknowledged", label: "Zur Kenntnis genommen", color: "green", icon: "check" }
  ]
}
```

Keine DB-Aenderung noetig -- das Template wird als `response_options` in der bestehenden `task_decisions`-Tabelle gespeichert. Die Anzeige in der Card passt sich automatisch an (nur ein gruener Zaehler, kein Rot/Orange).

---

## 5. Ergebnisanzeige an benutzerdefinierte Antworttypen anpassen (Punkt 5)

**Problem:** Die Karten zeigen immer fest `Gruen/Orange/Rot` (Ja/Rueckfrage/Nein) als Zaehler. Bei benutzerdefinierten Templates (A/B/C, 1-5, Kenntnisnahme) passt das nicht.

**Aenderungen:**

**`MyWorkDecision`-Typ (types.ts):**
- Feld `response_options?: ResponseOption[]` zum Interface hinzufuegen, damit die Card die konfigurierten Optionen kennt

**`getResponseSummary` (types.ts):**
- Neue Funktion `getCustomResponseSummary(participants, responseOptions)`:
  - Zaehlt pro konfigurierter Option die Anzahl der Stimmen
  - Gibt Array von `{ key, label, color, count }` zurueck + `pending`
  - Fallback auf alte Logik wenn keine `response_options` vorhanden

**`getBorderColor` (types.ts):**
- Erweitern: Wenn `response_options` vorhanden und NICHT das Standard-Yes/No-Template:
  - Orange-Rand bei offenen Rueckfragen (key="question")
  - Grau-Rand bei ausstehenden Antworten
  - Farbe der meistgewaehlten Option als Rand-Farbe bei Abschluss

**`MyWorkDecisionCard.tsx` -- Ergebnis-Anzeige (Zeile 243-256):**
- Statt fester `yesCount/questionCount/noCount`-Anzeige:
  - Bei Standard-Templates (yesNo, yesNoQuestion): Bisherige Anzeige beibehalten
  - Bei benutzerdefinierten Templates: Farbige Badges pro Option mit Zaehler anzeigen, z.B. `[A: 2] [B: 1] [C: 0]` mit den jeweiligen Template-Farben

**Daten-Laden:** Die Query, die Entscheidungen laedt, muss `response_options` aus `task_decisions` mitlesen und ins `MyWorkDecision`-Objekt einfuegen.

---

## 6. Reines Freitext-Antwortfeld als Template (Punkt 6)

Neues Template, bei dem es keine Buttons gibt, sondern nur ein Textfeld fuer eine schriftliche Rueckmeldung.

**`decisionTemplates.ts`** -- Neues Template:
```text
freetext: {
  id: "freetext",
  name: "Nur Freitext",
  description: "Nur eine schriftliche Rueckmeldung ohne Abstimmung",
  options: [
    { key: "comment", label: "Rueckmeldung", color: "blue", icon: "message-circle", requires_comment: true }
  ]
}
```

**`TaskDecisionResponse.tsx`:**
- Wenn nur eine einzige Option existiert und diese `requires_comment: true` hat:
  - Direkt das Textfeld anzeigen (ohne vorher einen Button klicken zu muessen)
  - Senden-Button darunter
- Dadurch wird die UX fuer reine Freitext-Anfragen deutlich vereinfacht

---

## Technische Zusammenfassung

### Keine DB-Aenderungen noetig
Alle Aenderungen sind rein im Frontend.

### Dateien

| Datei | Aenderungen |
|-------|-------------|
| `useDefaultDecisionParticipants.ts` | Erweitern um visibleToAll, sendByEmail, sendViaMatrix |
| `DefaultParticipantsDialog.tsx` | Drei neue Toggles (Oeffentlich, E-Mail, Matrix) |
| `StandaloneDecisionCreator.tsx` | Standard-Settings laden, Reset-Bug fix (customOptions), Email-Upload angleichen |
| `TaskDecisionCreator.tsx` | Standard-Settings laden, Reset-Bug fix, Email-Metadaten beim Upload, TopicSelector |
| `decisionTemplates.ts` | Zwei neue Templates: "Kenntnisnahme" und "Nur Freitext" |
| `types.ts` (my-work/decisions) | response_options ins Interface, dynamische Ergebnis-Zusammenfassung |
| `MyWorkDecisionCard.tsx` | Dynamische Ergebnis-Anzeige und Randfarbe basierend auf response_options |
| `TaskDecisionResponse.tsx` | Direktes Freitext-Feld wenn nur eine requires_comment-Option |
| Daten-Laden (MyWorkDecisionsTab o.ae.) | response_options aus DB mitlesen |
