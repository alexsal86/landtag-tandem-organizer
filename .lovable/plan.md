

# Plan: 6 Verbesserungen am E-Mail- und Pressesystem

## 1. Presse-Einstellungen Fehler beheben

**Ursache:** `<SelectItem value="">` ist in Radix UI Select nicht erlaubt -- leere Strings verursachen einen Absturz.

**Fix in `src/components/press/PressReleasesList.tsx`:**
- `<SelectItem value="">` durch `<SelectItem value="none">` ersetzen
- `defaultDistListId`-Logik anpassen: "none" wird wie leer behandelt

## 2. SenderInformationManager: Bearbeiten, Loschen, Standard-Markierung

**Datei:** `src/components/administration/SenderInformationManager.tsx`

Aktuell fehlen Bearbeiten- und Loschen-Buttons in den Absender-Cards. Erganzungen:
- **Bearbeiten-Button**: Offnet den Dialog mit vorausgefullten Feldern (`setEditingInfo`, `setFormData`)
- **Loschen-Button**: Setzt `is_active = false` (Soft-Delete) mit Bestatigungsdialog
- **Standard-Button**: Setzt `is_default = true` fur den gewahlten Absender und `is_default = false` fur alle anderen im selben Tenant
- Visuelles Badge "Standard" an der Standard-Karte

## 3. E-Mail verfassen: Standard-Absender automatisch setzen

Bereits implementiert in `EmailComposer.tsx` (Zeile 260-262). Funktioniert korrekt -- der Default-Sender wird automatisch selektiert.

Keine Anderung noetig, da dies bereits funktioniert.

## 4. Presse-Variable {{inhalt}} -- bereits implementiert

Die Variable `{{inhalt}}` ist bereits in `loadPressReleaseForEmail` (Zeile 202) implementiert und wird durch `content_html` ersetzt. Der Variablen-Hinweis in den Presse-Einstellungen (Zeile 236) zeigt `{{inhalt}}` bereits an.

Keine Anderung noetig.

## 5. Empfanger-UI: Drei Buttons (Manuell, Verteiler, Kontakte) pro Feld

**Datei:** `src/components/emails/EmailComposer.tsx`

Aktuelle UI: Ein globaler Tab-Bereich (Manuell/Verteiler/Kontakte) mit einem separaten "Aktiv"-Button pro An/CC/BCC-Feld.

Neue UI fur die `RecipientField`-Komponente (Zeilen 610-643):
- Unter jedem Feld (An, CC, BCC) drei kleine Buttons nebeneinander: **Manuell**, **Verteiler**, **Kontakte**
- Erst wenn ein Button geklickt wird, erscheint darunter das zugehorige Eingabefeld/Liste
- State: `openFieldSource: { field: 'to'|'cc'|'bcc', source: 'manual'|'lists'|'contacts' } | null`
- Der globale Tab-Bereich unten wird entfernt (Zeilen 845-944)
- Jedes Feld wird eigenstandig und kompakter

## 6. Vorschau als Popup statt inline

**Datei:** `src/components/emails/EmailComposer.tsx`

Aktuelle UI: Vorschau-Card erscheint unter dem E-Mail-Inhalt (Zeilen 777-820).

Anderung:
- Den Vorschau-Bereich in einen `Dialog` wrappen statt inline zu rendern
- `showPreview` steuert den Dialog-State
- Der Vorschau-Button (Zeile 656-661) offnet den Dialog

---

## Technische Zusammenfassung

| Datei | Anderungen |
|---|---|
| `src/components/press/PressReleasesList.tsx` | `SelectItem value=""` durch `value="none"` ersetzen |
| `src/components/administration/SenderInformationManager.tsx` | Bearbeiten, Loschen (Soft-Delete), Standard-Markierung hinzufugen |
| `src/components/emails/EmailComposer.tsx` | RecipientField mit 3 Inline-Buttons pro Feld, globale Tabs entfernen, Vorschau als Dialog |

