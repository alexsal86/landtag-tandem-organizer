
# Plan: Entscheidungen -- 10 Punkte beheben und verbessern

## 1. Template-Reset-Bug im StandaloneDecisionCreator (Punkt 1)

**Problem:** Nach dem Erstellen einer Entscheidung wird `setSelectedTemplateId(DEFAULT_TEMPLATE_ID)` im StandaloneDecisionCreator NICHT aufgerufen (fehlt in Zeile 456-467). Im TaskDecisionCreator ist es bereits korrekt (Zeile 499).

**Fix:** In `StandaloneDecisionCreator.tsx` im Reset-Block (nach Zeile 460) die Zeile `setSelectedTemplateId(DEFAULT_TEMPLATE_ID)` vor dem `setCustomOptions`-Aufruf einfuegen.

**Datei:** `StandaloneDecisionCreator.tsx`

---

## 2 + 3. Kenntnisnahme und Freitext funktionieren nicht (Punkte 2 + 3)

**Problem:** Fuer "Kenntnisnahme" (1 Option ohne `requires_comment`) fehlt eine Sonderbehandlung in `TaskDecisionResponse.tsx`. Die Komponente zeigt den Button nur im Standard-Rendering, das funktioniert grundsaetzlich. Allerdings wird die `ResponseOptionsEditor` bei der Erstellung angezeigt (Zeilen 572/604: `selectedTemplateId !== "yesNo" && selectedTemplateId !== "yesNoQuestion"`) -- und der Editor erzwingt "Mindestens 2 Optionen", was verwirrend ist und ggf. dazu fuehrt, dass Optionen ueberschrieben werden.

**Fix:**
- `ResponseOptionsEditor` NUR anzeigen wenn `selectedTemplateId === "custom"` (in allen drei Creatorn)
- Die Preview weiterhin fuer alle Templates anzeigen
- In `TaskDecisionResponse.tsx`: Fuer Kenntnisnahme (1 Option, kein `requires_comment`): Den Button direkt prominent darstellen, aehnlich wie der Freitext-Modus -- ein einzelner grosser Button "Zur Kenntnis genommen"

**Dateien:** `StandaloneDecisionCreator.tsx`, `TaskDecisionCreator.tsx`, `NoteDecisionCreator.tsx`, `TaskDecisionResponse.tsx`

---

## 4. Hinweistext bei Kenntnisnahme/Freitext anpassen (Punkt 4)

**Problem:** `ResponseOptionsEditor.tsx` zeigt immer "Mindestens 2 Optionen erforderlich" (Zeile 118-120).

**Fix:** Eruebrigt sich durch Punkt 2/3 -- der Editor wird nur noch bei `custom` angezeigt, wo der Hinweis passt.

---

## 5. Template-Dropdown-Stil aus TaskDecisionCreator uebernehmen (Punkt 5)

**Problem:** `StandaloneDecisionCreator` (Zeile 560-564) zeigt im Dropdown nur den Template-Namen. `TaskDecisionCreator` (Zeile 592-601) zeigt Name + Beschreibung in einer zweizeiligen Darstellung.

**Fix:** In `StandaloneDecisionCreator.tsx` und `NoteDecisionCreator.tsx` das Select-Dropdown auf das gleiche Format aendern:
```text
<SelectItem key={template.id} value={template.id}>
  <div className="flex flex-col items-start">
    <span>{template.name}</span>
    <span className="text-xs text-muted-foreground">{template.description}</span>
  </div>
</SelectItem>
```

**Dateien:** `StandaloneDecisionCreator.tsx`, `NoteDecisionCreator.tsx`

---

## 6. Randfarbe bei benutzerdefinierten Antworttypen (Punkt 6)

**Problem:** In `types.ts` Zeile 148 wird die Randfarbe dynamisch zusammengebaut: `colorClasses.borderClass.replace('border-', 'border-l-')`. Das erzeugt z.B. `border-l-green-600`, aber Tailwind generiert diese Klasse nicht, weil sie nie statisch im Code vorkommt (JIT-Problem).

**Fix:** In `types.ts` eine statische Mapping-Funktion hinzufuegen, die fuer jede Farbe die korrekte `border-l-*` Klasse zurueckgibt:

```text
const BORDER_LEFT_MAP: Record<string, string> = {
  green: "border-l-green-600",
  red: "border-l-red-600",
  orange: "border-l-orange-500",
  yellow: "border-l-yellow-500",
  blue: "border-l-blue-600",
  purple: "border-l-purple-600",
  lime: "border-l-lime-600",
  gray: "border-l-gray-400",
};
```

In `getBorderColor` statt des dynamischen `replace` die Map verwenden: `BORDER_LEFT_MAP[sorted[0].color] || 'border-l-gray-400'`.

**Datei:** `types.ts`

---

## 7. E-Mail-Anhaenge separat anzeigen (Punkt 7)

**Problem:** Mails (.eml/.msg) werden zusammen mit normalen Dateien gezaehlt und unter dem Paperclip-Icon angezeigt.

**Fix:**
- In `MyWorkDecisionsTab.tsx` beim Laden der Entscheidungen auch die Attachment-Daten mit Dateinamen laden (statt nur `count`), um E-Mail-Dateien (.eml/.msg) separat zaehlen zu koennen
- Alternative (einfacher): Eine separate Query fuer Attachments pro Decision, die nach Dateityp filtert
- In `MyWorkDecisionCard.tsx`: Neues Mail-Icon (`Mail`) mit eigenem Zaehler neben dem Paperclip-Icon anzeigen. Klick oeffnet einen kleinen Dialog/Popover mit der Liste der angehaengten E-Mails

**Dateien:** `MyWorkDecisionsTab.tsx` (Daten laden), `MyWorkDecisionCard.tsx` (Anzeige), neuer Interface-Feld `emailAttachmentCount` in `types.ts`

---

## 8. Letzte Aktivitaet: Bessere Hierarchie (Punkt 8)

**Problem:** In `DecisionCardActivity.tsx` ist die Creator-Antwort (Zeile 161-176) visuell zu flach -- sie sieht aus wie ein separater Eintrag statt einer verschachtelten Antwort auf die Rueckfrage.

**Fix:**
- Creator-Antwort staerker einruecken (ml-6 statt implizit)
- Einen vertikalen Strich (border-l-2) als visuelle Verbindungslinie hinzufuegen
- Text "Antwort von [Name]:" als Prefix
- Hintergrund beibehalten aber mit leichtem Rahmen links in der Farbe der Rueckfrage (orange)

```text
{item.creatorResponse && (
  <div className="ml-4 mt-1 pl-2 border-l-2 border-orange-300 bg-muted/50 rounded-r px-2 py-1">
    <div className="flex items-center gap-1 mb-0.5">
      <Avatar ... />
      <span className="font-medium text-[10px]">{creatorProfile?.display_name}</span>
    </div>
    <RichTextDisplay content={item.creatorResponse} className="text-[11px]" />
  </div>
)}
```

**Datei:** `DecisionCardActivity.tsx`

---

## 9. Oeffentlich-Icon neben Status-Badge, nur Icon (Punkt 9)

**Problem:** In `MyWorkDecisionCard.tsx` Zeile 213-218 wird "Oeffentlich" als Text + Globe-Icon in der Metadata-Zeile angezeigt.

**Fix:**
- Aus der Metadata-Zeile (Zeile 213-218) entfernen
- In den Header-Bereich (Zeile 106-128) neben den Status-Badges das Globe-Icon einfuegen -- nur das Icon, kein Text, mit Tooltip "Oeffentlich"

**Datei:** `MyWorkDecisionCard.tsx`

---

## 10. Oeffentliche Entscheidungen nicht im Tab sichtbar (Punkt 10)

**Problem:** Oeffentliche Entscheidungen, bei denen der User bereits Teilnehmer ist, erscheinen unter "Fuer mich" statt unter "Oeffentlich". Der Tab "Oeffentlich" filtert mit `!d.isCreator && !d.isParticipant`, was korrekt ist -- aber moeglicherweise blockiert eine RLS-Policy den Zugriff auf Decisions, die `visible_to_all = true` haben, aber bei denen der User nicht explizit Teilnehmer ist.

**Fix:** Pruefen, ob eine SELECT-RLS-Policy auf `task_decisions` existiert, die den Zugriff auf `visible_to_all`-Decisions erlaubt. Falls nicht, wird eine neue Policy hinzugefuegt:

```text
CREATE POLICY "Users can view public decisions in their tenant"
ON task_decisions FOR SELECT
USING (visible_to_all = true AND tenant_id IN (
  SELECT tenant_id FROM user_tenant_memberships 
  WHERE user_id = auth.uid() AND is_active = true
));
```

**Datei:** SQL-Migration

---

## Technische Zusammenfassung

### SQL-Migration
- RLS-Policy fuer oeffentliche Entscheidungen (Punkt 10)

### Dateien

| Datei | Aenderungen |
|-------|-------------|
| `StandaloneDecisionCreator.tsx` | Template-Reset fix, Editor nur bei "custom", Dropdown-Stil angleichen |
| `TaskDecisionCreator.tsx` | Editor nur bei "custom" |
| `NoteDecisionCreator.tsx` | Editor nur bei "custom", Dropdown-Stil angleichen |
| `TaskDecisionResponse.tsx` | Kenntnisnahme: prominenter Einzelbutton |
| `types.ts` | Statische border-l-Map, emailAttachmentCount-Feld |
| `MyWorkDecisionCard.tsx` | Mail-Icon separat, Globe nur als Icon neben Badge |
| `MyWorkDecisionsTab.tsx` | Email-Attachment-Count laden |
| `DecisionCardActivity.tsx` | Bessere Hierarchie fuer Creator-Antworten |
| SQL-Migration | RLS-Policy fuer visible_to_all |
