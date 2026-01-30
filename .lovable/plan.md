
# Plan: Umfassende Tenant-Isolation und Verbesserungen

## Zusammenfassung der identifizierten Probleme

### 1. Globale Einstellungen ohne Tenant-Isolation

| Tabelle | Problem | Auswirkung |
|---------|---------|------------|
| `app_settings` | Keine `tenant_id` Spalte | Alle Tenants sehen dieselben App-Namen, Logos, Dashboard-Cover |
| `audit_log_entries` | Keine `tenant_id` Spalte | Alle Admins sehen alle Audit-Logs |
| `meeting_templates` | RLS erlaubt alle auth. Benutzer | Vorlagen sind global sichtbar |
| `task_decisions` | `visible_to_all = true` ohne Tenant-Check | Cross-Tenant Entscheidungen sichtbar |
| `user_status` | RLS: "Users can view all statuses" | Anwesenheit aller Tenants sichtbar |

### 2. Profile-Probleme

- **Stephanie Schellin** hat kein Profil in `profiles` (nur `user_tenant_memberships`)
- Ursache: Edge Function `manage-tenant-user` erstellt Profil, aber es gab einen Fehler
- Profile ohne `display_name` werden in Team-Ansicht nicht angezeigt

### 3. Kontakte-Fehler

- `useInfiniteContacts` verwendet `currentTenant?.id || ''` als Fallback
- Wenn Tenant noch nicht geladen ist, wird leerer String verwendet → RLS blockiert
- Führt zu Dauerschleife bei Ladeversuchen

### 4. UserColorManager zeigt alle Benutzer

- Zeile 32-35: Lädt alle Profile ohne Tenant-Filter
- Superadmin-Feature, aber zeigt trotzdem alle Benutzer

### 5. Presence/Anwesenheit ohne Tenant-Isolation

- `useUserStatus.tsx` Zeile 175: `supabase.channel('user_presence')` ist global
- Alle Benutzer teilen denselben Presence-Channel
- RLS auf `user_status`: `(auth.uid() IS NOT NULL)` erlaubt alle

### 6. Fehlende Tenant-Standardwerte bei Erstellung

- Beim Erstellen eines neuen Tenants werden keine Standard-Einstellungen angelegt
- Neuer Tenant erbt implizit globale `app_settings`

### 7. Passwort-Ändern nicht implementiert

- Button in `SettingsView.tsx` (Zeile 290-293) hat keine Funktionalität
- Supabase `updateUser({ password })` API wird nicht aufgerufen

---

## Lösungsplan

### Teil 1: Datenbank-Schema erweitern

#### 1.1 `app_settings` um `tenant_id` erweitern

```sql
-- Spalte hinzufügen
ALTER TABLE app_settings ADD COLUMN tenant_id UUID REFERENCES tenants(id);

-- Index für Performance
CREATE INDEX idx_app_settings_tenant ON app_settings(tenant_id);

-- RLS-Policies anpassen
DROP POLICY IF EXISTS "App settings are viewable by everyone" ON app_settings;
DROP POLICY IF EXISTS "Authenticated users can view app settings" ON app_settings;
DROP POLICY IF EXISTS "Admin users can manage app settings" ON app_settings;
DROP POLICY IF EXISTS "Only admins can manage app settings" ON app_settings;

-- Neue Policies
CREATE POLICY "Users can view settings in their tenant or global"
ON app_settings FOR SELECT
USING (
  tenant_id IS NULL 
  OR tenant_id = ANY(get_user_tenant_ids(auth.uid()))
);

CREATE POLICY "Tenant admins can manage their settings"
ON app_settings FOR ALL
USING (
  is_tenant_admin(auth.uid(), tenant_id)
  OR (tenant_id IS NULL AND is_superadmin(auth.uid()))
);
```

#### 1.2 `audit_log_entries` um `tenant_id` erweitern

```sql
ALTER TABLE audit_log_entries ADD COLUMN tenant_id UUID REFERENCES tenants(id);
CREATE INDEX idx_audit_log_tenant ON audit_log_entries(tenant_id);

-- RLS anpassen
DROP POLICY IF EXISTS "Admin users can view audit logs" ON audit_log_entries;

CREATE POLICY "Users can view audit logs in their tenant"
ON audit_log_entries FOR SELECT
TO authenticated
USING (
  is_superadmin(auth.uid())
  OR (tenant_id = ANY(get_user_tenant_ids(auth.uid())) AND is_admin(auth.uid()))
);
```

#### 1.3 `meeting_templates` RLS korrigieren

```sql
-- Bestehende Policies entfernen
DROP POLICY IF EXISTS "Authenticated users can create all meeting templates" ON meeting_templates;
DROP POLICY IF EXISTS "Authenticated users can delete all meeting templates" ON meeting_templates;
DROP POLICY IF EXISTS "Authenticated users can update all meeting templates" ON meeting_templates;
DROP POLICY IF EXISTS "Authenticated users can view all meeting templates" ON meeting_templates;

-- Tenant-basierte Policies
CREATE POLICY "Users can view templates in their tenant"
ON meeting_templates FOR SELECT
USING (tenant_id = ANY(get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant admins can manage templates"
ON meeting_templates FOR ALL
USING (is_tenant_admin(auth.uid(), tenant_id))
WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));
```

#### 1.4 `task_decisions` RLS korrigieren

```sql
-- Problematische Policy entfernen
DROP POLICY IF EXISTS "task_decisions_allow_authenticated" ON task_decisions;

-- visible_to_all muss tenant_id respektieren
DROP POLICY IF EXISTS "Users can view decisions they're involved in" ON task_decisions;

CREATE POLICY "Users can view decisions in their tenant"
ON task_decisions FOR SELECT
USING (
  tenant_id = ANY(get_user_tenant_ids(auth.uid()))
  AND (
    created_by = auth.uid()
    OR visible_to_all = true
    OR EXISTS (
      SELECT 1 FROM task_decision_participants
      WHERE decision_id = task_decisions.id AND user_id = auth.uid()
    )
  )
);
```

#### 1.5 `user_status` RLS korrigieren

```sql
DROP POLICY IF EXISTS "Users can view all statuses" ON user_status;

CREATE POLICY "Users can view status in their tenant"
ON user_status FOR SELECT
USING (
  tenant_id = ANY(get_user_tenant_ids(auth.uid()))
  OR user_id = auth.uid()
);
```

---

### Teil 2: Frontend-Komponenten anpassen

#### 2.1 `GeneralSettings.tsx` - Tenant-spezifische Einstellungen

```typescript
// Hook useTenant hinzufügen
const { currentTenant } = useTenant();

// Beim Laden: tenant-spezifische Settings laden
const { data } = await supabase
  .from('app_settings')
  .select('setting_key, setting_value')
  .eq('tenant_id', currentTenant?.id)
  .in('setting_key', [...]);

// Beim Speichern: tenant_id mitgeben
await supabase.from('app_settings').upsert({
  tenant_id: currentTenant?.id,
  setting_key: key,
  setting_value: value
}, { onConflict: 'tenant_id,setting_key' });
```

#### 2.2 `AuditLogViewer.tsx` - Tenant-Filter

```typescript
const { currentTenant } = useTenant();

let query = supabase
  .from('audit_log_entries')
  .select('*', { count: 'exact' })
  .eq('tenant_id', currentTenant?.id)  // Filter hinzufügen
  .order('created_at', { ascending: false });
```

#### 2.3 `UserColorManager.tsx` - Tenant-Filter

```typescript
const { currentTenant } = useTenant();

// In loadUsers():
const { data: memberships } = await supabase
  .from('user_tenant_memberships')
  .select('user_id')
  .eq('tenant_id', currentTenant.id)
  .eq('is_active', true);

const { data } = await supabase
  .from('profiles')
  .select('user_id, display_name, badge_color')
  .in('user_id', memberships.map(m => m.user_id))
  .order('display_name');
```

#### 2.4 `useUserStatus.tsx` - Tenant-basierter Presence Channel

```typescript
const { currentTenant } = useTenant();

// Tenant-spezifischer Channel-Name
const channel = supabase.channel(`user_presence_${currentTenant?.id}`, {
  config: {
    presence: { key: user.id },
  },
});

// Status-Abfrage mit Tenant-Filter
const { data: statuses } = await supabase
  .from('user_status')
  .select('*')
  .eq('tenant_id', currentTenant?.id)
  .in('user_id', onlineUserIds);
```

#### 2.5 `useInfiniteContacts.tsx` - Robustere Tenant-Prüfung

```typescript
const buildQuery = useCallback((offset: number, limit: number) => {
  // Früher Abbruch wenn kein Tenant
  if (!currentTenant?.id) {
    return null;
  }
  
  let query = supabase
    .from('contacts')
    .select('*', { count: 'exact' })
    .eq('tenant_id', currentTenant.id);  // Keine Fallback-String
  // ...
}, [currentTenant?.id, ...]);

const fetchContacts = useCallback(async (isLoadMore = false) => {
  if (!user || !currentTenant?.id) {
    setLoading(false);
    return;
  }
  // ...
}, [user, currentTenant?.id, ...]);
```

---

### Teil 3: Tenant-Erstellung mit Standardwerten

#### 3.1 Edge Function erweitern

In `manage-tenant-user/index.ts` neue Action `initializeTenant`:

```typescript
case 'initializeTenant': {
  const { tenantId } = body;
  
  // Standard app_settings für neuen Tenant
  const defaultSettings = [
    { tenant_id: tenantId, setting_key: 'app_name', setting_value: 'LandtagsOS' },
    { tenant_id: tenantId, setting_key: 'app_subtitle', setting_value: 'Koordinationssystem' },
    { tenant_id: tenantId, setting_key: 'app_logo_url', setting_value: '' },
    { tenant_id: tenantId, setting_key: 'default_dashboard_cover_url', 
      setting_value: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1920' },
    { tenant_id: tenantId, setting_key: 'default_dashboard_cover_position', setting_value: 'center' },
  ];
  
  await supabaseAdmin.from('app_settings').insert(defaultSettings);
  
  // Standard-Statusoptionen, Email-Templates etc. können hier auch erstellt werden
  
  return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
}
```

#### 3.2 `SuperadminTenantManagement.tsx` - Nach Tenant-Erstellung initialisieren

```typescript
const handleSaveTenant = async () => {
  // ... bestehender Code für INSERT ...
  
  if (!editingTenant) {
    // Neuer Tenant - initialisieren
    const { data: newTenant } = await supabase
      .from("tenants")
      .insert({ ... })
      .select('id')
      .single();
    
    if (newTenant) {
      await supabase.functions.invoke('manage-tenant-user', {
        body: { action: 'initializeTenant', tenantId: newTenant.id }
      });
    }
  }
};
```

---

### Teil 4: Stephanie's fehlendes Profil reparieren

Einmaliger SQL-Befehl:

```sql
INSERT INTO profiles (user_id, display_name, tenant_id)
SELECT 
  '12119701-6263-4d8b-940f-c69397fd841d',
  'Stephanie Schellin',
  '5a65ce13-af54-439f-becf-e23e458627d9'
WHERE NOT EXISTS (
  SELECT 1 FROM profiles WHERE user_id = '12119701-6263-4d8b-940f-c69397fd841d'
);

-- user_status auch erstellen
INSERT INTO user_status (user_id, tenant_id, status_type)
SELECT 
  '12119701-6263-4d8b-940f-c69397fd841d',
  '5a65ce13-af54-439f-becf-e23e458627d9',
  'online'
WHERE NOT EXISTS (
  SELECT 1 FROM user_status WHERE user_id = '12119701-6263-4d8b-940f-c69397fd841d'
);
```

---

### Teil 5: Passwort-Ändern implementieren

#### 5.1 `SettingsView.tsx` - Dialog und Funktionalität

```typescript
const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
const [currentPassword, setCurrentPassword] = useState("");
const [newPassword, setNewPassword] = useState("");
const [confirmPassword, setConfirmPassword] = useState("");

const handleChangePassword = async () => {
  if (newPassword !== confirmPassword) {
    toast.error("Passwörter stimmen nicht überein");
    return;
  }
  
  if (newPassword.length < 8) {
    toast.error("Passwort muss mindestens 8 Zeichen haben");
    return;
  }
  
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    
    if (error) throw error;
    
    toast.success("Passwort wurde geändert");
    setPasswordDialogOpen(false);
    setNewPassword("");
    setConfirmPassword("");
  } catch (error: any) {
    toast.error(error.message);
  }
};

// Im JSX:
<Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
  <DialogTrigger asChild>
    <Button variant="outline" className="w-full justify-start">
      <Shield className="h-4 w-4 mr-2" />
      Passwort ändern
    </Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Passwort ändern</DialogTitle>
    </DialogHeader>
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>Neues Passwort</Label>
        <Input 
          type="password" 
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Passwort bestätigen</Label>
        <Input 
          type="password" 
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>
    </div>
    <DialogFooter>
      <Button onClick={handleChangePassword}>
        Passwort speichern
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

### Teil 6: `useAppSettings` Tenant-aware machen

```typescript
// In useAppSettings.tsx
import { useTenant } from "@/hooks/useTenant";

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const { currentTenant, loading: tenantLoading } = useTenant();
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  useEffect(() => {
    if (tenantLoading || !currentTenant?.id) return;
    
    const loadSettings = async () => {
      // Zuerst tenant-spezifische Settings versuchen
      const { data: tenantData } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .eq('tenant_id', currentTenant.id)
        .in('setting_key', ['app_name', 'app_subtitle', 'app_logo_url']);

      if (tenantData && tenantData.length > 0) {
        // Tenant hat eigene Settings
        const settingsMap = tenantData.reduce((acc, item) => {
          acc[item.setting_key] = item.setting_value || '';
          return acc;
        }, {} as Record<string, string>);

        setSettings({
          app_name: settingsMap.app_name || 'LandtagsOS',
          app_subtitle: settingsMap.app_subtitle || 'Koordinationssystem',
          app_logo_url: settingsMap.app_logo_url || '',
          isLoading: false,
        });
      } else {
        // Fallback auf Defaults
        setSettings({
          app_name: 'LandtagsOS',
          app_subtitle: 'Koordinationssystem', 
          app_logo_url: '',
          isLoading: false,
        });
      }
    };

    loadSettings();
  }, [currentTenant?.id, tenantLoading]);

  // ...
}
```

---

## Zusammenfassung der Änderungen

| # | Bereich | Änderung |
|---|---------|----------|
| 1 | DB | `app_settings` um `tenant_id` erweitern, RLS anpassen |
| 2 | DB | `audit_log_entries` um `tenant_id` erweitern |
| 3 | DB | `meeting_templates` RLS auf Tenant beschränken |
| 4 | DB | `task_decisions` RLS korrigieren (visible_to_all + tenant) |
| 5 | DB | `user_status` RLS auf Tenant beschränken |
| 6 | DB | Stephanie's Profil manuell erstellen |
| 7 | Frontend | `GeneralSettings.tsx` - Tenant-Filter |
| 8 | Frontend | `AuditLogViewer.tsx` - Tenant-Filter |
| 9 | Frontend | `UserColorManager.tsx` - Tenant-Filter |
| 10 | Frontend | `useUserStatus.tsx` - Tenant-spezifischer Presence-Channel |
| 11 | Frontend | `useInfiniteContacts.tsx` - Robustere Null-Checks |
| 12 | Frontend | `useAppSettings.tsx` - Tenant-aware |
| 13 | Edge Function | `initializeTenant` Action hinzufügen |
| 14 | Frontend | `SuperadminTenantManagement.tsx` - Tenant-Init nach Erstellung |
| 15 | Frontend | `SettingsView.tsx` - Passwort-Ändern implementieren |

---

## Erwartete Ergebnisse

1. **Büro Erwin hat eigene Einstellungen** - App-Name, Logo, Dashboard-Cover unabhängig
2. **Audit-Logs sind getrennt** - Jeder Tenant sieht nur seine Logs
3. **Vorlagen sind tenant-spezifisch** - Keine Cross-Tenant Sichtbarkeit
4. **Anwesenheit ist isoliert** - Nur Teammitglieder desselben Tenants sichtbar
5. **Kontakte laden korrekt** - Keine Endlosschleife bei leerem Tenant
6. **Stephanie wird angezeigt** - Profil existiert mit korrektem tenant_id
7. **Neue Tenants haben Defaults** - Standardwerte bei Erstellung
8. **Benutzer können Passwort ändern** - Selbstständig über Einstellungen
