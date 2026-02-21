import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { Building2, Plus, Edit, Trash2, Users, UserPlus, RefreshCw, Copy, Check } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface TenantWithStats {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  user_count: number;
}

interface UserWithTenants {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  created_at: string;
  tenants: Array<{ id: string; name: string; role: string }>;
}

const ROLE_OPTIONS = [
  { value: "abgeordneter", label: "Abgeordneter (Admin)" },
  { value: "bueroleitung", label: "Büroleitung" },
  { value: "mitarbeiter", label: "Mitarbeiter" },
  { value: "praktikant", label: "Praktikant" },
];

export function SuperadminTenantManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Tenant states
  const [tenants, setTenants] = useState<TenantWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantWithStats | null>(null);
  
  // Tenant form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);

  // User states
  const [allUsers, setAllUsers] = useState<UserWithTenants[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedTenantFilter, setSelectedTenantFilter] = useState<string>("all");
  
  // Create user form
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState("mitarbeiter");
  const [newUserTenantId, setNewUserTenantId] = useState("");
  const [createdUserPassword, setCreatedUserPassword] = useState<string | null>(null);
  const [passwordCopied, setPasswordCopied] = useState(false);
  
  // Assign tenant dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assigningUser, setAssigningUser] = useState<UserWithTenants | null>(null);
  const [assignTenantId, setAssignTenantId] = useState("");
  const [assignRole, setAssignRole] = useState("mitarbeiter");

  // Superadmin-Check (hardcoded für mail@alexander-salomon.de)
  const isSuperadmin = user?.email === "mail@alexander-salomon.de";

  const loadTenants = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("tenants")
        .select(`id, name, description, is_active, created_at`)
        .order("name");

      if (error) throw error;

      // User-Counts laden
      const { data: memberships } = await supabase
        .from("user_tenant_memberships")
        .select("tenant_id")
        .eq("is_active", true);

      const countMap = new Map<string, number>();
      (memberships || []).forEach(m => {
        countMap.set(m.tenant_id, (countMap.get(m.tenant_id) || 0) + 1);
      });

      const tenantsWithStats = (data || []).map(t => ({
        ...t,
        user_count: countMap.get(t.id) || 0,
      }));

      setTenants(tenantsWithStats);
    } catch (error) {
      console.error("Error loading tenants:", error);
      toast({ title: "Fehler", description: "Tenants konnten nicht geladen werden", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      setUsersLoading(true);
      const { data, error } = await supabase.functions.invoke('manage-tenant-user', {
        body: { action: 'listAllUsers' }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setAllUsers(data.users || []);
    } catch (error: any) {
      console.error("Error loading users:", error);
      toast({ title: "Fehler", description: error.message || "Benutzer konnten nicht geladen werden", variant: "destructive" });
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperadmin) {
      loadTenants();
      loadAllUsers();
    }
  }, [isSuperadmin]);

  const handleSaveTenant = async () => {
    if (!formName.trim()) {
      toast({ title: "Fehler", description: "Name ist erforderlich", variant: "destructive" });
      return;
    }

    try {
      if (editingTenant) {
        const { error } = await supabase
          .from("tenants")
          .update({
            name: formName.trim(),
            description: formDescription.trim() || null,
            is_active: formIsActive,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingTenant.id);

        if (error) throw error;
        toast({ title: "Gespeichert", description: "Tenant wurde aktualisiert" });
      } else {
        // Create new tenant
        const { data: newTenant, error } = await supabase
          .from("tenants")
          .insert({
            name: formName.trim(),
            description: formDescription.trim() || null,
            is_active: formIsActive,
            settings: {},
          })
          .select('id')
          .single();

        if (error) throw error;

        // Initialize tenant with default settings
        if (newTenant) {
          console.log('Initializing new tenant:', newTenant.id);
          const { error: initError } = await supabase.functions.invoke('manage-tenant-user', {
            body: { action: 'initializeTenant', tenantId: newTenant.id }
          });
          
          if (initError) {
            console.error('Error initializing tenant:', initError);
            // Don't fail the whole operation, just log
          }
        }

        toast({ title: "Erstellt", description: "Neuer Tenant wurde angelegt und initialisiert" });
      }

      setDialogOpen(false);
      resetTenantForm();
      loadTenants();
    } catch (error: any) {
      console.error("Save tenant error:", error);
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteTenant = async (tenant: TenantWithStats) => {
    if (tenant.user_count > 0) {
      toast({ 
        title: "Nicht möglich", 
        description: `Tenant hat noch ${tenant.user_count} Benutzer. Bitte erst alle Benutzer entfernen.`,
        variant: "destructive" 
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("tenants")
        .delete()
        .eq("id", tenant.id);

      if (error) throw error;
      toast({ title: "Gelöscht", description: "Tenant wurde entfernt" });
      loadTenants();
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    }
  };

  const handleCreateUser = async () => {
    if (!newUserEmail.trim() || !newUserName.trim() || !newUserTenantId) {
      toast({ title: "Fehler", description: "Alle Felder sind erforderlich", variant: "destructive" });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('manage-tenant-user', {
        body: {
          action: 'createUser',
          email: newUserEmail.trim(),
          displayName: newUserName.trim(),
          role: newUserRole,
          tenantId: newUserTenantId
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setCreatedUserPassword(data.user.password);
      toast({ title: "Benutzer erstellt", description: `${newUserEmail} wurde erfolgreich angelegt` });
      
      // Reload data
      loadTenants();
      loadAllUsers();
    } catch (error: any) {
      console.error("Create user error:", error);
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    }
  };

  const handleAssignTenant = async () => {
    if (!assigningUser || !assignTenantId) {
      toast({ title: "Fehler", description: "Tenant ist erforderlich", variant: "destructive" });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('manage-tenant-user', {
        body: {
          action: 'assignTenant',
          userId: assigningUser.id,
          tenantId: assignTenantId,
          role: assignRole
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast({ title: "Zugewiesen", description: `${assigningUser.display_name} wurde dem Tenant zugewiesen` });
      setAssignDialogOpen(false);
      setAssigningUser(null);
      loadTenants();
      loadAllUsers();
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteUser = async (userToDelete: UserWithTenants) => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-tenant-user', {
        body: {
          action: 'deleteUser',
          userId: userToDelete.id
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast({ title: "Gelöscht", description: `${userToDelete.display_name} wurde entfernt` });
      loadTenants();
      loadAllUsers();
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    }
  };

  const copyPassword = () => {
    if (createdUserPassword) {
      navigator.clipboard.writeText(createdUserPassword);
      setPasswordCopied(true);
      setTimeout(() => setPasswordCopied(false), 2000);
    }
  };

  const openCreateTenantDialog = () => {
    setEditingTenant(null);
    resetTenantForm();
    setDialogOpen(true);
  };

  const openEditTenantDialog = (tenant: TenantWithStats) => {
    setEditingTenant(tenant);
    setFormName(tenant.name);
    setFormDescription(tenant.description || "");
    setFormIsActive(tenant.is_active);
    setDialogOpen(true);
  };

  const openAssignDialog = (userToAssign: UserWithTenants) => {
    setAssigningUser(userToAssign);
    setAssignTenantId("");
    setAssignRole("mitarbeiter");
    setAssignDialogOpen(true);
  };

  const resetTenantForm = () => {
    setFormName("");
    setFormDescription("");
    setFormIsActive(true);
    setEditingTenant(null);
  };

  const resetCreateUserForm = () => {
    setNewUserEmail("");
    setNewUserName("");
    setNewUserRole("mitarbeiter");
    setNewUserTenantId("");
    setCreatedUserPassword(null);
    setPasswordCopied(false);
  };

  // Filter users by selected tenant
  const filteredUsers = selectedTenantFilter === "all" 
    ? allUsers 
    : allUsers.filter(u => u.tenants.some(t => t.id === selectedTenantFilter));

  const usersByTenantId = useMemo(() => {
    const map = new Map<string, UserWithTenants[]>();

    allUsers.forEach((userEntry) => {
      userEntry.tenants.forEach((tenantEntry) => {
        const usersForTenant = map.get(tenantEntry.id) || [];
        usersForTenant.push(userEntry);
        map.set(tenantEntry.id, usersForTenant);
      });
    });

    return map;
  }, [allUsers]);

  if (!isSuperadmin) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Keine Berechtigung für diesen Bereich.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          System-Verwaltung
        </CardTitle>
        <CardDescription>
          Verwaltung aller Mandanten und Benutzer im System
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="tenants" className="space-y-4">
          <TabsList>
            <TabsTrigger value="tenants">Tenants</TabsTrigger>
            <TabsTrigger value="users">Benutzer</TabsTrigger>
            <TabsTrigger value="create-user">Neuer Benutzer</TabsTrigger>
          </TabsList>

          {/* TAB: Tenants */}
          <TabsContent value="tenants" className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                {tenants.length} Tenant(s) vorhanden
              </div>
              <Button onClick={openCreateTenantDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Neuer Tenant
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Laden...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Beschreibung</TableHead>
                    <TableHead className="text-center">Benutzer</TableHead>
                    <TableHead>Zugeordnete Benutzer</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>Erstellt</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((tenant) => (
                    <TableRow key={tenant.id}>
                      <TableCell className="font-medium">{tenant.name}</TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">
                        {tenant.description || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="gap-1">
                          <Users className="h-3 w-3" />
                          {tenant.user_count}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {usersByTenantId.get(tenant.id)?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {usersByTenantId.get(tenant.id)!.map((tenantUser) => (
                              <Badge key={`${tenant.id}-${tenantUser.id}`} variant="outline" className="text-xs">
                                {tenantUser.display_name || tenantUser.email}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Keine Benutzer zugewiesen</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={tenant.is_active ? "default" : "outline"}>
                          {tenant.is_active ? "Aktiv" : "Inaktiv"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(tenant.created_at), "dd.MM.yyyy", { locale: de })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditTenantDialog(tenant)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={tenant.user_count > 0}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Tenant löschen?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tenant "{tenant.name}" wird unwiderruflich gelöscht.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground"
                                  onClick={() => handleDeleteTenant(tenant)}
                                >
                                  Löschen
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {tenants.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Keine Tenants vorhanden
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          {/* TAB: Users */}
          <TabsContent value="users" className="space-y-4">
            <div className="flex justify-between items-center gap-4">
              <Select value={selectedTenantFilter} onValueChange={setSelectedTenantFilter}>
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
              <Button variant="outline" size="sm" onClick={loadAllUsers} disabled={usersLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${usersLoading ? 'animate-spin' : ''}`} />
                Aktualisieren
              </Button>
            </div>

            {usersLoading ? (
              <div className="text-center py-8 text-muted-foreground">Laden...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>E-Mail</TableHead>
                    <TableHead>Tenant(s)</TableHead>
                    <TableHead>Rolle</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.display_name}</TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {u.tenants.length > 0 ? (
                            u.tenants.map(t => (
                              <Badge key={t.id} variant="outline" className="text-xs">
                                {t.name}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-sm">Kein Tenant</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {u.tenants[0]?.role ? (
                          <Badge variant="secondary">
                            {ROLE_OPTIONS.find(r => r.value === u.tenants[0].role)?.label || u.tenants[0].role}
                          </Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openAssignDialog(u)}
                          >
                            <UserPlus className="h-4 w-4 mr-1" />
                            Zuweisen
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                disabled={u.email === user?.email}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Benutzer löschen?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {u.display_name} ({u.email}) wird unwiderruflich aus dem System entfernt.
                                  Alle zugehörigen Daten werden gelöscht.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground"
                                  onClick={() => handleDeleteUser(u)}
                                >
                                  Unwiderruflich löschen
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Keine Benutzer gefunden
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          {/* TAB: Create User */}
          <TabsContent value="create-user">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Neuen Benutzer erstellen
                </CardTitle>
                <CardDescription>
                  Der Benutzer wird automatisch dem gewählten Tenant zugewiesen.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {createdUserPassword ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                      <p className="text-green-800 dark:text-green-200 font-medium mb-2">
                        ✓ Benutzer erfolgreich erstellt!
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                        Bitte notieren Sie das generierte Passwort:
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 p-2 bg-white dark:bg-gray-900 rounded border font-mono">
                          {createdUserPassword}
                        </code>
                        <Button variant="outline" size="sm" onClick={copyPassword}>
                          {passwordCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <Button onClick={resetCreateUserForm}>
                      Weiteren Benutzer erstellen
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>E-Mail *</Label>
                        <Input
                          type="email"
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                          placeholder="benutzer@beispiel.de"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Name *</Label>
                        <Input
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          placeholder="Max Mustermann"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
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
                      <div className="space-y-2">
                        <Label>Rolle</Label>
                        <Select value={newUserRole} onValueChange={setNewUserRole}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map(r => (
                              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button onClick={handleCreateUser} disabled={!newUserEmail || !newUserName || !newUserTenantId}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Benutzer erstellen
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Tenant Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingTenant ? "Tenant bearbeiten" : "Neuer Tenant"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid gap-2">
                <Label>Name *</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="z.B. Büro Mustermann"
                />
              </div>
              <div className="grid gap-2">
                <Label>Beschreibung</Label>
                <Textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optionale Beschreibung..."
                  rows={2}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Aktiv</Label>
                <Switch
                  checked={formIsActive}
                  onCheckedChange={setFormIsActive}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleSaveTenant}>
                {editingTenant ? "Speichern" : "Erstellen"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Assign Tenant Dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Tenant zuweisen: {assigningUser?.display_name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid gap-2">
                <Label>Tenant *</Label>
                <Select value={assignTenantId} onValueChange={setAssignTenantId}>
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
              <div className="grid gap-2">
                <Label>Rolle</Label>
                <Select value={assignRole} onValueChange={setAssignRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleAssignTenant} disabled={!assignTenantId}>
                Zuweisen
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
