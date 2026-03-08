

# Phase 4: Rule-Versionierung & Import/Export

## Überblick

Zwei Features für das Automation-System:
1. **Versionierung** -- bei jedem Speichern einer Regel wird ein Snapshot in einer Versions-Tabelle gesichert, mit Möglichkeit zur Wiederherstellung
2. **Import/Export** -- Regelsets als JSON exportieren und in andere Tenants importieren

## Datenbank-Änderungen

### Neue Tabelle: `automation_rule_versions`

```text
automation_rule_versions
├── id (uuid, PK)
├── rule_id (uuid, FK → automation_rules.id ON DELETE CASCADE)
├── tenant_id (uuid, FK → tenants.id)
├── version_number (integer)
├── name, description, module, trigger_type
├── trigger_config (jsonb)
├── conditions (jsonb)
├── actions (jsonb)
├── enabled (boolean)
├── created_by (uuid)
├── created_at (timestamptz)
└── UNIQUE(rule_id, version_number)
```

RLS: Tenant-isoliert, nur authentifizierte Nutzer mit passender `tenant_id` können lesen/einfügen.

### Trigger: Auto-Versionierung

Ein `BEFORE UPDATE`-Trigger auf `automation_rules` speichert automatisch den alten Zustand als neue Version, bevor das Update durchgeführt wird. Versionsnummer wird per `COALESCE(MAX(version_number), 0) + 1` berechnet.

## Frontend-Änderungen

### 1. Versions-Historie im Rule-Manager

- Neuer Button "Versionen" pro Regel in der Regelliste
- Dialog/Sheet zeigt chronologische Liste der Versionen (Nummer, Datum, wer hat gespeichert)
- "Wiederherstellen"-Button pro Version → überschreibt aktuelle Regel mit dem Versions-Snapshot

### 2. Export-Funktion

- Button "Regeln exportieren" in der Regel-Karte
- Checkbox-Auswahl welche Regeln exportiert werden sollen
- Generiert eine `.json`-Datei mit allen ausgewählten Regeln (ohne IDs/tenant_id)
- Download über Blob-URL

### 3. Import-Funktion

- Button "Regeln importieren" 
- File-Upload für `.json`
- Validierung des Schemas vor Import
- Vorschau der zu importierenden Regeln
- Import erstellt neue Regeln im aktuellen Tenant

## Technische Details

### Export-Format (JSON)

```text
{
  "version": "1.0",
  "exported_at": "...",
  "rules": [
    {
      "name": "...",
      "description": "...",
      "module": "...",
      "trigger_type": "...",
      "trigger_config": {...},
      "conditions": {...},
      "actions": [...],
      "enabled": true
    }
  ]
}
```

### Betroffene Dateien

- **Neue Migration**: `automation_rule_versions` Tabelle + Auto-Versionierungs-Trigger
- **AutomationRulesManager.tsx**: Export/Import-Buttons, Versions-Button pro Regel
- **Neue Komponente**: `AutomationRuleVersions.tsx` -- Versions-Dialog mit Wiederherstellung
- **Neue Komponente**: `AutomationRuleImportExport.tsx` -- Import/Export UI

