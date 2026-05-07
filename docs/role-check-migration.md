# Migration: hardcoded Role-Checks → `useActionPermission` / `<RequireAction>`

## Warum
Hardcoded Checks wie `if (role === "abgeordneter" || role === "bueroleitung")` lassen sich
nicht pro Tenant konfigurieren. Mit `action_permissions` + `useActionPermission` werden
Aktionen über Admin-UI steuerbar.

## Schema
`action_permissions(tenant_id, action_key, allowed_roles[])`. Server-seitige Prüfung
zusätzlich via `is_action_allowed(action_key)` RPC.

## Konventionen für `action_key`
- `letter.send`, `letter.delete`
- `decision.archive`
- `case.close`
- `workflow.execute_manual`
- `contact.delete`
- `tenant.invite_user`

Neue Keys im `PermissionsManager.ACTION_KEYS` registrieren.

## Migration-Pattern

### Vorher
```tsx
const { role } = useResolvedUserRole();
const canSend = role === "abgeordneter" || role === "bueroleitung";
return canSend ? <Button onClick={send}>Senden</Button> : null;
```

### Nachher (Hook)
```tsx
const { allowed } = useActionPermission("letter.send");
return allowed ? <Button onClick={send}>Senden</Button> : null;
```

### Nachher (Wrapper)
```tsx
<RequireAction action="letter.send">
  <Button onClick={send}>Senden</Button>
</RequireAction>
```

## Roll-out Reihenfolge
1. Letters: send/delete Buttons in `LetterDetail`, `LetterListItem`
2. Decisions: archive in `DecisionDetailHeader`
3. Cases: close in `CaseItemHeader`
4. Workflows: manual run in `WorkflowEngineManager`
5. Contacts: delete in `ContactDetail`
6. Tenant-User-Invite in `Administration`

Pro PR max. einen Bereich migrieren, Tests anpassen, dann nächste Domain.

## Default-Verhalten
Wenn keine Regel gesetzt ist, ist die Aktion erlaubt (Backwards-Compat). Erst wenn ein
Admin im PermissionsManager Rollen auswählt, greift die Restriktion.
