# Workflow-Domain-Modell (gemeinsam für UI, API, Engine)

Dieses Dokument definiert das gemeinsame Workflow-Modell für alle Schichten (UI, API, Engine) inklusive DSL/Schema, Versionierung und Migration aus dem bisherigen Automationsmodell.

## 1) Gemeinsames Domain-Modell

### `WorkflowDefinition`

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | `string` | Eindeutige ID der konkreten Version. |
| `key` | `string` | Stabiler fachlicher Schlüssel eines Workflows über Versionen hinweg. |
| `name` | `string` | Anzeigename. |
| `description` | `string` | Beschreibung. |
| `tenantId` | `string` | Mandant. |
| `module` | `string` | Fachmodul/Bounded Context. |
| `status` | `draft \| published \| archived` | Lebenszyklusstatus. |
| `version` | `number` | Monoton steigende Version ab `1`. |
| `trigger` | `Trigger` | Startmechanismus. |
| `condition` | `Condition` | Boolesche Bedingungslogik. |
| `actions` | `Action[]` | Auszuführende Effekte. |
| `approvalSteps` | `ApprovalStep[]` | Optionale Genehmigungskette. |
| `metadata` | `Record<string, unknown>` | Erweiterbare Zusatzdaten. |
| `createdAt`, `createdBy` | ISO-Date + Nutzer | Erstellungsmetadaten. |
| `publishedAt`, `archivedAt` | ISO-Date \/ `null` | Pflicht bei `published`/`archived`. |

### `Trigger`

* `event`: Ereignisbasiert (`eventName`, `source`, optionale `filters`).
* `time`: Zeitbasiert (`cron`, `timezone`, optional `startAt/endAt`).
* `manual`: Manuell (`allowedRoles`).

### `Condition`

* `rule`: atomare Regel (`field`, `operator`, optional `value`).
* `group`: rekursive Gruppe (`combinator = AND|OR`, `conditions[]`).

Unterstützte Operatoren: `eq`, `neq`, `contains`, `gt`, `gte`, `lt`, `lte`, `exists`, `in`.

### `Action`

* Typen: `side_effect`, `notification`, `data_change`, `api_call`.
* `config`: serialisierbares Payload-Objekt.
* Referenzen für Ablaufsteuerung:
  * `dependsOnActionIds[]`
  * `onSuccessActionIds[]`
  * `onFailureActionIds[]`

### `ApprovalStep`

* Pflicht: `id`, `role`, `slaMinutes`.
* Optional: `escalationRole`, `escalationAfterMinutes`, `delegateRole`.
* Abhängigkeiten: `dependsOnApprovalStepIds[]`.

## 2) DSL/JSON-Schema + Validierung

* Verbindliches JSON-Schema: `docs/automation/workflow-definition.schema.json`.
* Laufzeit-Validierung und Typmodell: `src/features/automation/domain/workflowDefinition.ts`.

### Zentrale Validierungsregeln

1. Pflichtfelder je Typ (`trigger`, `condition`, `action`, `approvalStep`).
2. Eindeutige IDs innerhalb von `condition`, `actions`, `approvalSteps`.
3. Referenzauflösung:
   * Alle Action-Referenzen müssen auf existierende Actions zeigen.
   * Alle Approval-Abhängigkeiten müssen auf existierende Steps zeigen.
4. Zyklenerkennung:
   * Keine Zyklen im Action-Graph.
   * Keine Zyklen im Approval-Graph.
5. Status-Regeln:
   * `published` benötigt `publishedAt`.
   * `archived` benötigt `archivedAt`.

## 3) Versionierung & unveränderliche Historie

Das Dokumentmodell:

```json
{
  "workflowKey": "invoice-reminder",
  "draft": { "status": "draft", "version": 4, "...": "..." },
  "publishedVersions": [
    { "status": "published", "version": 1, "checksum": "...", "...": "..." },
    { "status": "published", "version": 2, "checksum": "...", "...": "..." }
  ],
  "archivedVersions": [
    { "status": "archived", "version": 3, "checksum": "...", "...": "..." }
  ]
}
```

Regeln:

* Veröffentlichte Versionen sind **immutable snapshots** (inkl. `checksum`).
* `draft.version` muss größer als jede `publishedVersions[].version` sein.
* Eine Versionsnummer darf nicht gleichzeitig in Published- und Archived-History vorkommen.
* Published-History enthält ausschließlich Status `published`.

## 4) Migrationsregeln (alt → neu)

### Mapping-Tabelle

| Alt (`automation_rules` etc.) | Neu (`WorkflowDefinition`) | Regel |
|---|---|---|
| `automation_rules.id` | `id` | Direkt übernehmen pro migrierter Version. |
| `automation_rules.name` | `name` | Direkt übernehmen. |
| `automation_rules.tenant_id` | `tenantId` | Direkt übernehmen. |
| `automation_rules.trigger_type` | `trigger.type` | Mapping: `record_changed -> event`, `schedule -> time`, `webhook -> event`. |
| `automation_rules.trigger_config` | `trigger.*` | Feldweise transformieren (z. B. `minutes_interval` -> `cron` via Generator). |
| `automation_rules.conditions` | `condition` | In rekursive Group-Struktur transformieren (`all -> AND`, `any -> OR`). |
| `automation_rules.actions` | `actions` | Jeder Eintrag bekommt stabile `id`; `type` wird auf neue Action-Typen normalisiert. |
| `automation_rules.enabled=true` | `status` | `draft` oder `published` nach Rollout-Entscheid. |
| `automation_rules.enabled=false` | `status` | Standard: `archived` oder `draft` (je nach Laufzeitbedarf). |
| `automation_rule_versions.*` | `publishedVersions[]` | Jede alte Version als immutable Snapshot importieren. |
| `automation_rule_runs.trigger_source` | `metadata.lastTriggerSource` (optional) | Nur analytische Übernahme, kein DSL-Kernfeld. |

### Transformationsregeln

1. **Trigger-Normalisierung**
   * `schedule` + `minutes_interval` wird in Cron (`*/N * * * *`) übersetzt.
2. **Condition-Normalisierung**
   * Legacy `all[]` -> `group(combinator=AND)`.
   * Legacy `any[]` -> `group(combinator=OR)`.
   * Bei gemischten Strukturen wird eine Root-AND-Gruppe erzeugt.
3. **Action-Normalisierung**
   * Legacy Typen wie `create_notification`, `send_email_template` etc. werden in die vier neuen Domänentypen gemappt.
   * Nicht zuordenbare Typen -> `side_effect` + `metadata.legacyActionType`.
4. **Versionierung**
   * Jede existierende Legacy-Version bekommt feste `version` + `checksum`.
   * Änderungen an veröffentlichten Versionen nur als neue Version zulässig.

## 5) Technische Artefakte

* Types + Validatoren: `src/features/automation/domain/workflowDefinition.ts`
* JSON-Schema für UI/API/Engine-Vertrag: `docs/automation/workflow-definition.schema.json`
* Tests: `src/features/automation/domain/__tests__/workflowDefinition.test.ts`
