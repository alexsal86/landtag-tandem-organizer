

# Plan: select('*') Optimierung + console.log Bereinigung

## Umfang

**1. `select('*')` → gezielte Spaltenauswahl**: ~90 Dateien, ~736 Vorkommen
**2. `console.log` → `debugConsole.log`**: ~36 Dateien, ~857 Vorkommen (ohne die bereits migrierten debugConsole-Aufrufe)

Zusaetzlich: `console.warn` und `console.error` in denselben Dateien ebenfalls auf `debugConsole` umstellen, wo es sich um Debug-Output handelt (echte Fehler-Logs in catch-Bloecken koennen bleiben oder ebenfalls migriert werden).

## Vorgehen

### A. console.log Migration (36 Dateien)

Jede Datei: `console.log(` → `debugConsole.log(`, Import von `debugConsole` hinzufuegen. Dateien mit den meisten Vorkommen zuerst:

| Datei | ~Vorkommen |
|---|---|
| headerRenderer.ts | ~30 |
| LetterTemplateSelector.tsx | ~10 |
| ContactEditForm.tsx | ~15 |
| TodoCreateDialog.tsx | ~10 |
| useEventPlanningData.ts | ~10 |
| DashboardWidget.tsx | ~5 |
| KarlsruheDistrictsMap.tsx | ~5 |
| useDashboardLayout.tsx | ~3 |
| ReactBigCalendarView.tsx | ~2 |
| + ~27 weitere Dateien | ... |

Ausnahme: `debugConsole.ts` selbst bleibt unveraendert.

Auch `console.warn` und `console.error` die reines Debugging sind werden migriert. Echte User-facing Error-Handler (z.B. in catch-Bloecken die sonst nichts tun) bleiben als `console.error`, da sie bei Produktionsproblemen nuetzlich sind -- oder werden ebenfalls auf `debugConsole.error` umgestellt fuer konsistentes Verhalten.

### B. select('*') Optimierung (90 Dateien)

Fuer jede `select('*')` Abfrage: Spalten identifizieren die tatsaechlich verwendet werden und explizit auflisten. Beispiel:

```
// Vorher
.select('*')

// Nachher  
.select('id, name, email, phone, created_at')
```

Die wichtigsten Dateien (nach Haeufigkeit):

| Datei | ~Vorkommen |
|---|---|
| useCaseFileDetails.tsx | 4 |
| usePDFData.ts | 4 |
| letterPDFGenerator.ts | 4 |
| letterDOCXGenerator.ts | 3 |
| ContactDetailPanel.tsx | 2 |
| useDocumentsData.ts | 3 |
| useMeetingArchive.ts | 3 |
| AppointmentPreparationSidebar.tsx | 2 |
| + ~82 weitere Dateien | ... |

## Reihenfolge der Umsetzung

1. **console.log Migration** (alle 36 Dateien) -- mechanisch, geringes Risiko
2. **select('*') Optimierung** (alle 90 Dateien) -- erfordert Spaltenanalyse pro Query, hoehere Sorgfalt noetig

## Risiken

- **select-Optimierung**: Wenn eine Spalte vergessen wird, fehlen Daten zur Laufzeit. Muss pro Query geprueft werden welche Felder im Code tatsaechlich genutzt werden.
- **console-Migration**: Kein funktionales Risiko, rein kosmetisch.

