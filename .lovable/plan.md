
# Plan: Superadmin-Tenant-Verwaltung erweitern & RLS-Policies anpassen

## Zusammenfassung der Probleme

1. **RLS-Fehler beim Erstellen von Tenants:** Es gibt keine INSERT-Policy für die `tenants`-Tabelle
2. **Keine Benutzerübersicht pro Tenant:** Superadmin kann Benutzer nicht sehen
3. **Keine Möglichkeit, Benutzer Tenants zuzuweisen:** Bestehende oder neue Benutzer können nicht zugewiesen werden
4. **Keine Möglichkeit, Benutzer zu löschen:** Abgeordnete können ihre Mitarbeiter nicht entfernen
5. **Edge Function `create-admin-user` weist keinen Tenant zu:** Neuer Benutzer wird ohne Tenant-Membership erstellt

---

## Teil 1: Datenbank-Änderungen

### 1.1 Neue Funktion `is_superadmin` erstellen

```sql
CREATE OR REPLACE FUNCTION public.is_superadmin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = _user_id
      AND email = 'mail@alexander-salomon.de'
  )
$$;
```

### 1.2 RLS-Policies für `tenants` erweitern

```sql
-- Superadmin kann alle Tenants sehen
CREATE POLICY "Superadmin can view all tenants"
ON public.tenants FOR SELECT
TO authenticated
USING (is_superadmin(auth.uid()));

-- Superadmin kann Tenants erstellen
CREATE POLICY "Superadmin can create tenants"
ON public.tenants FOR INSERT
TO authenticated
WITH CHECK (is_superadmin(auth.uid()));

-- Superadmin kann Tenants bearbeiten
CREATE POLICY "Superadmin can update tenants"
ON public.tenants FOR UPDATE
TO authenticated
USING (is_superadmin(auth.uid()));

-- Superadmin kann Tenants löschen
CREATE POLICY "Superadmin can delete tenants"
ON public.tenants FOR DELETE
TO authenticated
USING (is_superadmin(auth.uid()));
```

### 1.3 RLS-Policies für `user_tenant_memberships` erweitern

```sql
-- Superadmin kann alle Memberships sehen
CREATE POLICY "Superadmin can view all memberships"
ON public.user_tenant_memberships FOR SELECT
TO authenticated
USING (is_superadmin(auth.uid()));

-- Superadmin kann Memberships erstellen
CREATE POLICY "Superadmin can create memberships"
ON public.user_tenant_memberships FOR INSERT
TO authenticated
WITH CHECK (is_superadmin(auth.uid()));

-- Superadmin kann Memberships bearbeiten/löschen
CREATE POLICY "Superadmin can manage all memberships"
ON public.user_tenant_memberships FOR ALL
TO authenticated
USING (is_superadmin(auth.uid()));
```

---

## Teil 2: Neue Edge Function `manage-tenant-user`

Diese Funktion ermöglicht es:
- Superadmin: Benutzer erstellen UND einem Tenant zuweisen
- Superadmin: Bestehende Benutzer einem Tenant zuweisen/entfernen
- Abgeordneter: Benutzer in seinem Tenant löschen

### Datei: `supabase/functions/manage-tenant-user/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPERADMIN_EMAIL = 'mail@alexander-salomon.de';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const { data: { user } } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (!user) throw new Error('Authentication failed');

    const isSuperadmin = user.email === SUPERADMIN_EMAIL;

    // Get caller's tenant and role
    const { data: callerMembership } = await supabaseAdmin
      .from('user_tenant_memberships')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    const isAbgeordneter = callerMembership?.role === 'abgeordneter';

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'createUser': {
        // Superadmin only
        if (!isSuperadmin) throw new Error('Only superadmin can create users');
        
        const { email, displayName, role, tenantId } = body;
        if (!email || !displayName || !tenantId) {
          throw new Error('Email, displayName, and tenantId are required');
        }

        const password = generatePassword();

        // Create user
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          user_metadata: { display_name: displayName },
          email_confirm: true
        });

        if (createError) throw new Error(`Failed to create user: ${createError.message}`);

        // Create profile
        await supabaseAdmin.from('profiles').insert({
          user_id: newUser.user.id,
          display_name: displayName
        });

        // Create tenant membership
        await supabaseAdmin.from('user_tenant_memberships').insert({
          user_id: newUser.user.id,
          tenant_id: tenantId,
          role: role || 'mitarbeiter',
          is_active: true
        });

        // Assign role
        if (role && role !== 'none') {
          await supabaseAdmin.from('user_roles').insert({
            user_id: newUser.user.id,
            role: role
          });
        }

        // Create user status
        await supabaseAdmin.from('user_status').insert({
          user_id: newUser.user.id,
          status_type: 'online',
          notifications_enabled: true,
          tenant_id: tenantId
        });

        return new Response(JSON.stringify({
          success: true,
          user: { id: newUser.user.id, email, display_name: displayName, password }
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'assignTenant': {
        // Superadmin only
        if (!isSuperadmin) throw new Error('Only superadmin can assign tenants');
        
        const { userId, tenantId, role } = body;
        if (!userId || !tenantId) throw new Error('userId and tenantId required');

        // Check if membership exists
        const { data: existing } = await supabaseAdmin
          .from('user_tenant_memberships')
          .select('id')
          .eq('user_id', userId)
          .eq('tenant_id', tenantId)
          .single();

        if (existing) {
          // Update
          await supabaseAdmin
            .from('user_tenant_memberships')
            .update({ role: role || 'mitarbeiter', is_active: true })
            .eq('id', existing.id);
        } else {
          // Insert
          await supabaseAdmin.from('user_tenant_memberships').insert({
            user_id: userId,
            tenant_id: tenantId,
            role: role || 'mitarbeiter',
            is_active: true
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'removeTenantMembership': {
        // Superadmin or Abgeordneter for own tenant
        const { userId, tenantId } = body;
        if (!userId || !tenantId) throw new Error('userId and tenantId required');

        const canRemove = isSuperadmin || 
          (isAbgeordneter && callerMembership?.tenant_id === tenantId);
        
        if (!canRemove) throw new Error('Insufficient permissions');

        await supabaseAdmin
          .from('user_tenant_memberships')
          .update({ is_active: false })
          .eq('user_id', userId)
          .eq('tenant_id', tenantId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'deleteUser': {
        // Superadmin or Abgeordneter for users in their tenant
        const { userId, tenantId } = body;
        if (!userId) throw new Error('userId required');

        // Check if caller can delete this user
        const canDelete = isSuperadmin || 
          (isAbgeordneter && callerMembership?.tenant_id === tenantId);
        
        if (!canDelete) throw new Error('Insufficient permissions');

        // Prevent self-deletion
        if (userId === user.id) throw new Error('Cannot delete yourself');

        // Delete user from auth (cascades to profiles, roles, etc.)
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (error) throw new Error(`Failed to delete user: ${error.message}`);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'updateRole': {
        // Superadmin or Abgeordneter for own tenant
        const { userId, tenantId, role } = body;
        
        const canUpdate = isSuperadmin || 
          (isAbgeordneter && callerMembership?.tenant_id === tenantId);
        
        if (!canUpdate) throw new Error('Insufficient permissions');

        // Update membership role
        await supabaseAdmin
          .from('user_tenant_memberships')
          .update({ role })
          .eq('user_id', userId)
          .eq('tenant_id', tenantId);

        // Update user_roles
        await supabaseAdmin.from('user_roles').upsert({
          user_id: userId,
          role: role
        }, { onConflict: 'user_id' });

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : String(error) 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generatePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 14; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
```

---

## Teil 3: SuperadminTenantManagement erweitern

### 3.1 Neue Tabs für erweiterte Verwaltung

Die Komponente wird um folgende Tabs erweitert:
- **Tenants**: Mandanten erstellen/bearbeiten/löschen (bestehend)
- **Benutzer pro Tenant**: Liste aller Benutzer mit Tenant-Zugehörigkeit
- **Benutzer zuweisen**: Bestehende Benutzer einem Tenant zuweisen
- **Neuer Benutzer**: Benutzer erstellen und direkt Tenant zuweisen

### 3.2 Neuer State und Funktionen

```typescript
// Zusätzliche States
const [allUsers, setAllUsers] = useState<UserWithTenants[]>([]);
const [selectedTenantForUsers, setSelectedTenantForUsers] = useState<string | null>(null);
const [userDialogOpen, setUserDialogOpen] = useState(false);
const [assignDialogOpen, setAssignDialogOpen] = useState(false);
const [newUserTenantId, setNewUserTenantId] = useState("");
const [newUserEmail, setNewUserEmail] = useState("");
const [newUserName, setNewUserName] = useState("");
const [newUserRole, setNewUserRole] = useState("mitarbeiter");

interface UserWithTenants {
  id: string;
  email: string;
  display_name: string;
  tenants: Array<{ id: string; name: string; role: string }>;
}
```

### 3.3 Benutzer laden (alle mit Tenant-Info)

```typescript
const loadAllUsers = async () => {
  // Lade alle Profile
  const { data: profiles } = await supabase.rpc('get_all_users_for_superadmin');
  
  // Alternative: Direct query via edge function
  const { data } = await supabase.functions.invoke('manage-tenant-user', {
    body: { action: 'listAllUsers' }
  });
  
  setAllUsers(data.users);
};
```

### 3.4 UI-Erweiterung

```tsx
<Tabs defaultValue="tenants">
  <TabsList>
    <TabsTrigger value="tenants">Tenants</TabsTrigger>
    <TabsTrigger value="users">Benutzer</TabsTrigger>
    <TabsTrigger value="create-user">Neuer Benutzer</TabsTrigger>
  </TabsList>
  
  <TabsContent value="tenants">
    {/* Bestehende Tenant-Tabelle */}
  </TabsContent>
  
  <TabsContent value="users">
    <div className="space-y-4">
      {/* Tenant-Filter Dropdown */}
      <Select value={selectedTenantForUsers} onValueChange={setSelectedTenantForUsers}>
        <SelectTrigger className="w-64">
          <SelectValue placeholder="Alle Tenants" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle Tenants</SelectItem>
          {tenants.map(t => (
            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {/* Benutzer-Tabelle */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>E-Mail</TableHead>
            <TableHead>Tenant(s)</TableHead>
            <TableHead>Rolle</TableHead>
            <TableHead>Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredUsers.map(user => (
            <TableRow key={user.id}>
              <TableCell>{user.display_name}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>
                {user.tenants.map(t => (
                  <Badge key={t.id} variant="outline" className="mr-1">
                    {t.name}
                  </Badge>
                ))}
              </TableCell>
              <TableCell>
                {user.tenants[0]?.role}
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" onClick={() => openAssignDialog(user)}>
                  Zuweisen
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" 
                  onClick={() => confirmDeleteUser(user)}>
                  Löschen
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  </TabsContent>
  
  <TabsContent value="create-user">
    {/* Formular zum Erstellen eines neuen Benutzers mit Tenant-Auswahl */}
    <Card>
      <CardHeader>
        <CardTitle>Neuen Benutzer erstellen</CardTitle>
        <CardDescription>
          Der Benutzer wird automatisch dem gewählten Tenant zugewiesen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label>Tenant *</Label>
          <Select value={newUserTenantId} onValueChange={setNewUserTenantId}>
            <SelectTrigger>
              <SelectValue placeholder="Tenant auswählen" />
            </SelectTrigger>
            <SelectContent>
              {tenants.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* E-Mail, Name, Rolle Felder */}
        <Button onClick={handleCreateUserWithTenant}>
          Benutzer erstellen
        </Button>
      </CardContent>
    </Card>
  </TabsContent>
</Tabs>
```

---

## Teil 4: Abgeordneter kann Mitarbeiter löschen

### 4.1 Erweiterung der Team-Verwaltung in Administration.tsx

In der bestehenden `Administration.tsx` unter dem Abschnitt "Team" einen Löschen-Button hinzufügen:

```tsx
// Bei jedem Benutzer in der Tabelle
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="ghost" size="icon" className="text-destructive">
      <Trash2 className="h-4 w-4" />
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Benutzer löschen?</AlertDialogTitle>
      <AlertDialogDescription>
        {profile.display_name} wird unwiderruflich aus dem System entfernt.
        Alle zugehörigen Daten (Zeiteinträge, Nachrichten, etc.) werden gelöscht.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
      <AlertDialogAction 
        className="bg-destructive text-destructive-foreground"
        onClick={() => handleDeleteUser(profile.user_id)}
      >
        Unwiderruflich löschen
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### 4.2 Handler-Funktion

```typescript
const handleDeleteUser = async (userId: string) => {
  try {
    const { data, error } = await supabase.functions.invoke('manage-tenant-user', {
      body: {
        action: 'deleteUser',
        userId,
        tenantId: currentTenant?.id
      }
    });
    
    if (error || !data.success) {
      throw new Error(data?.error || 'Löschen fehlgeschlagen');
    }
    
    toast({ title: 'Benutzer gelöscht' });
    loadData();
  } catch (error: any) {
    toast({ 
      title: 'Fehler', 
      description: error.message, 
      variant: 'destructive' 
    });
  }
};
```

---

## Zusammenfassung der Änderungen

| # | Bereich | Änderung |
|---|---------|----------|
| 1 | Datenbank | `is_superadmin()` Funktion erstellen |
| 2 | Datenbank | RLS-Policies für `tenants` erweitern (INSERT, UPDATE, DELETE für Superadmin) |
| 3 | Datenbank | RLS-Policies für `user_tenant_memberships` erweitern |
| 4 | Edge Function | Neue `manage-tenant-user` Funktion für alle Benutzeroperationen |
| 5 | Frontend | `SuperadminTenantManagement.tsx` mit Tabs für Tenants/Benutzer/Neuer Benutzer |
| 6 | Frontend | `Administration.tsx` erweitern um Löschen-Button für Abgeordnete |

---

## Erwartete Ergebnisse

1. **Superadmin kann Tenants erstellen** - RLS erlaubt INSERT für Superadmin
2. **Superadmin sieht alle Benutzer** - Mit Tenant-Zugehörigkeit und Rolle
3. **Superadmin kann Benutzer erstellen** - Mit direkter Tenant-Zuweisung
4. **Superadmin kann Benutzer zuweisen** - Bestehende Benutzer zu Tenants hinzufügen
5. **Abgeordneter kann Mitarbeiter löschen** - Mit Bestätigungsdialog
6. **Transparenz** - Klare Übersicht wer zu welchem Tenant gehört

---

## Technische Details

### Datenbank-Migration erforderlich

```sql
-- 1. is_superadmin Funktion
CREATE OR REPLACE FUNCTION public.is_superadmin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = _user_id AND email = 'mail@alexander-salomon.de'
  )
$$;

-- 2. Tenant Policies
CREATE POLICY "Superadmin can view all tenants" ON public.tenants 
  FOR SELECT USING (is_superadmin(auth.uid()));
CREATE POLICY "Superadmin can create tenants" ON public.tenants 
  FOR INSERT WITH CHECK (is_superadmin(auth.uid()));
CREATE POLICY "Superadmin can update all tenants" ON public.tenants 
  FOR UPDATE USING (is_superadmin(auth.uid()));
CREATE POLICY "Superadmin can delete tenants" ON public.tenants 
  FOR DELETE USING (is_superadmin(auth.uid()));

-- 3. Membership Policies
CREATE POLICY "Superadmin can view all memberships" ON public.user_tenant_memberships
  FOR SELECT USING (is_superadmin(auth.uid()));
CREATE POLICY "Superadmin can manage all memberships" ON public.user_tenant_memberships
  FOR ALL USING (is_superadmin(auth.uid()));
```

### Neue Edge Function

- Datei: `supabase/functions/manage-tenant-user/index.ts`
- Aktionen: `createUser`, `assignTenant`, `removeTenantMembership`, `deleteUser`, `updateRole`, `listAllUsers`

### Frontend-Änderungen

- `SuperadminTenantManagement.tsx`: Erweitern mit Tabs
- `Administration.tsx`: Löschen-Button für Mitarbeiter
