

# Template-Galerie: Lohnt sich das?

## Ist-Zustand
- 2 Templates existieren bereits im Wizard (Step 1, Select-Dropdown)
- Mechanik funktioniert: `applyTemplate()` füllt das Formular vor

## Was fehlt (laut Roadmap)
3 weitere Einträge im `RULE_TEMPLATES`-Array:

| Template | Modul | Trigger | Action |
|----------|-------|---------|--------|
| Meeting in 48h ohne Vorbereitung | meetings | schedule | create_notification |
| Entscheidung angenommen → Folge-Task | decisions | record_changed (status=accepted) | create_task |
| Casefile Status kritisch | cases | record_changed (status=critical) | create_notification |

## Aufwand
- **1 Datei**, **~60 Zeilen** Daten-Ergänzung in `AutomationRuleWizard.tsx`
- Keine neuen Komponenten, keine DB-Änderung, keine Edge-Function-Änderung

## Empfehlung
Der Aufwand ist minimal (5 Minuten), aber der Nutzen für Erstnutzer:innen ist real — sie sehen sofort praxisnahe Beispiele für verschiedene Module. Wenn du willst, setze ich es kurz um. Alternativ können wir direkt zum nächsten größeren Feature springen:

- **"Warum diese Notification?"** — Deep-Link von Notifications zur auslösenden Regel
- **Rule-Versionierung** (Phase 4)
- **Anderes Feature** außerhalb der Automations-Engine

