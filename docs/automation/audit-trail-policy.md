# Automation Audit-Trail & Monitoring

## Einheitliches Run-Log-Format
Jeder Lauf verwendet `automation_run_log.v1` und enthält folgende Korrelation:

- `run_id`
- `workflow_version`
- `entity_id`
- `module`
- `owner_id`

Zusätzlich wird eine `timeline` gespeichert mit:

1. Trigger-Ereignis
2. Condition-Auswertung (inkl. Regel-Evaluierungen)
3. Approval-Entscheidungen
4. Action-Ausführung inkl. Status/Resultat

## Explainability („Warum ausgelöst?“ / „Warum nicht?“)
Pro Run wird unter `result_payload.explainability` gespeichert:

- `why_triggered`
- `why_not_triggered`

Damit können Fachanwender die Entscheidung pro Lauf direkt nachvollziehen.

## Aufbewahrung (Retention)
Standardrichtlinie im Audit-Trail:

- `policy`: `default_180_days`
- `delete_after_days`: `180`

## Datenschutz & Maskierung
Sensible Daten werden im Run-Log maskiert (`***`).

Maskierungsstrategie:

- rekursiv für Objekt/Array-Payloads
- Schlüsselmuster: `password|token|secret|authorization|cookie|api_key|email|phone|recipient|name`
- Maskierung auf Step- und Run-Ebene

## Monitoring-Ansicht
Die Administration zeigt Filter für:

- Modul
- Status
- Zeitfenster
- Owner
- Regel

Drill-down ist bis auf einzelne Steps (Condition/Approval/Action) möglich.
