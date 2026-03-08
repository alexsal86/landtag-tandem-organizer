

# Phase 2: Wizard-Builder fur Automations-Regeln

## Ist-Zustand
Der aktuelle Regel-Builder ist ein einzelnes langes Formular (Zeilen 479-744) mit allen Feldern auf einer Seite. Fur Fachnutzer:innen ist das unubersichtlich.

## Ziel
Umwandlung in einen gefuhrten 4-Schritt-Wizard:

```text
[1. Grundlagen] → [2. Trigger] → [3. Bedingungen] → [4. Aktionen + Testlauf]
```

## Umsetzungsplan

### 1. Wizard-Komponente erstellen
Neue Datei `src/components/administration/AutomationRuleWizard.tsx`:
- Stepper-Header mit 4 Schritten (visueller Fortschrittsbalken)
- State: `currentStep` (0-3), bestehender `form`-State wird ubernommen
- Navigation: "Zuruck" / "Weiter" Buttons mit Validierung pro Schritt
- Letzter Schritt: "Speichern" + "Dry-Run testen"

**Schritt 1 — Grundlagen**: Name, Beschreibung, Modul, Aktiv-Toggle, Template-Auswahl
**Schritt 2 — Trigger**: Trigger-Typ, Trigger-Feld, Trigger-Wert (+ Cron-Hinweis bei "schedule")
**Schritt 3 — Bedingungen**: Bedingungsfeld, Operator, Wert (modulabhangige Feld-Optionen)
**Schritt 4 — Aktionen**: Aktionstyp + dynamische Felder je nach Typ, Zusammenfassung, Dry-Run Button

### 2. AutomationRulesManager refactoren
- Formular-Block (Zeilen 479-744) durch `<AutomationRuleWizard>` ersetzen
- Props: `form`, `setForm`, `onSave`, `onDryRun`, `editingRuleId`, `saving`, `runningRuleId`, `resetForm`, `applyTemplate`
- Regel-Liste und Run-Historie bleiben in der Hauptkomponente

### 3. Wizard als Dialog/Sheet
- Wizard offnet sich als `Dialog` (Sheet) statt inline
- Trigger: "Neue Regel" Button und "Bearbeiten" Button offnen den Dialog
- Vorteil: Regel-Liste bleibt sichtbar, fokussierte Erstellung

### 4. Validierung pro Schritt
- Schritt 1: Name required (min 3 Zeichen)
- Schritt 2: Trigger-Wert required bei `record_changed`
- Schritt 3: Bedingungswert required
- Schritt 4: Action-spezifische Pflichtfelder (target_user_id, title etc.)
- "Weiter" Button disabled wenn Validierung fehlschlagt

### 5. Zusammenfassungs-Preview
Im letzten Schritt eine kompakte Ubersicht:
- "Wenn [Modul].[Feld] = [Wert] UND [Bedingung], dann [Aktion]"
- Visuell als Karte mit Icons

## Dateien
| Datei | Anderung |
|-------|----------|
| `src/components/administration/AutomationRuleWizard.tsx` | Neu — 4-Schritt Wizard |
| `src/components/administration/AutomationRulesManager.tsx` | Formular durch Wizard-Dialog ersetzen |

Keine DB-Anderungen notwendig — alles Frontend.

