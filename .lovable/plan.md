

# Fix: Terminanfrage — Abgeordneten über `employee_settings.admin_id` ermitteln

## Problem
Die aktuelle Logik fragt `user_tenant_memberships` nach Nutzern mit der Rolle "abgeordneter" ab. Aufgrund von RLS-Policies kann ein Mitarbeiter aber nur seine eigene Membership-Zeile sehen — nicht die anderer Nutzer. Daher liefert die Abfrage keine Ergebnisse und die Fehlermeldung "Keine Abgeordneten gefunden" erscheint.

## Lösung
Statt über `user_tenant_memberships` nach der Rolle zu filtern, den betreuenden Abgeordneten direkt aus `employee_settings.admin_id` des aktuellen Nutzers lesen. Diese Tabelle erlaubt per RLS den Zugriff auf den eigenen Datensatz (`user_id = auth.uid()`).

## Änderungen

**Datei: `src/components/dashboard/DashboardAppointments.tsx`** — Funktion `handleCreateRequest`:

Ersetze den Block (Zeilen ~330–360), der `user_tenant_memberships` nach Rolle "abgeordneter" filtert, durch:

1. Abfrage: `employee_settings` → `admin_id` für `user_id = user.id`
2. Wenn `admin_id` vorhanden und nicht der eigene User → als `targetDeputyId` verwenden
3. Wenn kein `admin_id` hinterlegt → Fehlermeldung: "Kein betreuender Abgeordneter hinterlegt"
4. Wenn `admin_id === user.id` → Fehlermeldung: "Als Abgeordneter können Sie keine Anfrage an sich selbst senden"

```typescript
// Betreuenden Abgeordneten aus employee_settings ermitteln
const { data: settings, error: settingsError } = await supabase
  .from('employee_settings')
  .select('admin_id')
  .eq('user_id', user.id)
  .maybeSingle();

if (settingsError) throw settingsError;

const adminId = settings?.admin_id;

if (!adminId) {
  toast({ title: 'Kein Abgeordneter zugeordnet', description: '...', variant: 'destructive' });
  return;
}

if (adminId === user.id) {
  toast({ title: 'Nicht möglich', description: '...', variant: 'destructive' });
  return;
}

const targetDeputyId = adminId;
```

Keine Datenbankänderungen nötig — die RLS-Policy erlaubt bereits den Zugriff auf den eigenen `employee_settings`-Eintrag.

