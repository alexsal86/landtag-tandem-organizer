

# Paket E: User-Picker statt UUID-Eingabe

## Problem
Im Wizard-Step 4 gibt es drei UUID-Eingabefelder:
- **Ziel-User-ID** (Zeile 524) — für Notifications/Push
- **Assigned_to** (Zeile 646) — für Task-Erstellung
- **Record-ID** (Zeile 571) — bleibt UUID (kein User)

Nutzer müssen aktuell UUIDs manuell eintippen — das ist fehleranfällig und unpraktisch.

## Lösung
Einen wiederverwendbaren `TenantUserSelect`-Combobox erstellen, der Tenant-Mitglieder lädt und als Dropdown anzeigt.

## Umsetzung

### 1. Neuer Hook: `useTenantUsers.ts`
- Lädt `user_tenant_memberships` für aktuellen Tenant (Pattern aus `useMeetingsData.ts`)
- Dann `profiles` für die gefundenen `user_id`s
- Gibt `{ users: Array<{ id, display_name, avatar_url }>, loading }` zurück

### 2. Neue Komponente: `TenantUserSelect.tsx`
- Combobox (cmdk ist bereits installiert) mit Suche
- Props: `value`, `onValueChange`, `placeholder`, `label`
- Zeigt `display_name` + Avatar, speichert `user_id`

### 3. Wizard anpassen
- Zeile 522-528: `Input` für `actionTargetUserId` → `TenantUserSelect`
- Zeile 644-649: `Input` für `actionTaskAssignees` → `TenantUserSelect`
- Validierung bleibt gleich (prüft auf nicht-leeren String)

### Dateien
| Datei | Änderung |
|-------|----------|
| `src/hooks/useTenantUsers.ts` | Neu — Hook zum Laden der Tenant-Nutzer |
| `src/components/administration/TenantUserSelect.tsx` | Neu — Combobox-Komponente |
| `src/components/administration/AutomationRuleWizard.tsx` | 2 Input-Felder durch TenantUserSelect ersetzen |

