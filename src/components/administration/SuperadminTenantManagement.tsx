import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { debugConsole } from '@/utils/debugConsole';
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/components/ui/use-toast";
import { Building2, Plus, Edit, Trash2, Users, UserPlus, RefreshCw, Copy, Check, MapPin, ChevronDown, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { TenantProvisioningWizard } from "./tenant-wizard/TenantProvisioningWizard";
import { TenantHealthBadges } from "./tenant-wizard/TenantHealthBadges";
import { CloneDataDrawer } from "./tenant-wizard/CloneDataDrawer";

const BUNDESLAENDER = [
  "Baden-Württemberg", "Bayern", "Berlin", "Brandenburg", "Bremen",
  "Hamburg", "Hessen", "Mecklenburg-Vorpommern", "Niedersachsen",
  "Nordrhein-Westfalen", "Rheinland-Pfalz", "Saarland", "Sachsen",
  "Sachsen-Anhalt", "Schleswig-Holstein", "Thüringen",
];

interface TenantWithStats {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  is_template?: boolean;
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

export function SuperadminTenantManagement(): React.JSX.Element {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState<boolean>(false);
  const [roleCheckLoading, setRoleCheckLoading] = useState<boolean>(true);
  
  // Tenant states
  const [tenants, setTenants] = useState<TenantWithStats[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [editingTenant, setEditingTenant] = useState<TenantWithStats | null>(null);
  
  // Tenant form state
  const [formName, setFormName] = useState<string>("");
  const [formDescription, setFormDescription] = useState<string>("");
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formConstituency, setFormConstituency] = useState<string>("");
  const [formConstituencyNumber, setFormConstituencyNumber] = useState<string>("");
  const [formCity, setFormCity] = useState<string>("");
  const [formState, setFormState] = useState<string>("");
  const [formParty, setFormParty] = useState<string>("");
  const [formAppName, setFormAppName] = useState<string>("LandtagsOS");
  const [formAppSubtitle, setFormAppSubtitle] = useState<string>("Koordinationssystem");
  const [formSocialInstagram, setFormSocialInstagram] = useState<string>("");
  const [formSocialFacebook, setFormSocialFacebook] = useState<string>("");
  const [formSocialX, setFormSocialX] = useState<string>("");
  const [formSocialLinkedIn, setFormSocialLinkedIn] = useState<string>("");
  const [socialSectionOpen, setSocialSectionOpen] = useState<boolean>(false);
  const [formIsTemplate, setFormIsTemplate] = useState<boolean>(false);

  // Wizard / clone drawer
  const [wizardOpen, setWizardOpen] = useState<boolean>(false);
  const [cloneDrawerOpen, setCloneDrawerOpen] = useState<boolean>(false);
  const [cloneTarget, setCloneTarget] = useState<{ id: string; name: string } | null>(null);
  const [healthRefreshKey, setHealthRefreshKey] = useState<number>(0);

  // User states
  const [allUsers, setAllUsers] = useState<UserWithTenants[]>([]);
  const [usersLoading, setUsersLoading] = useState<boolean>(false);
  const [selectedTenantFilter, setSelectedTenantFilter] = useState<string>("all");
  
  // Create user form
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState<boolean>(false);
  const [newUserEmail, setNewUserEmail] = useState<string>("");
  const [newUserName, setNewUserName] = useState<string>("");
  const [newUserRole, setNewUserRole] = useState<string>("mitarbeiter");
  const [newUserTenantId, setNewUserTenantId] = useState<string>("");
  const [createdUserPassword, setCreatedUserPassword] = useState<string | null>(null);
  const [passwordCopied, setPasswordCopied] = useState<boolean>(false);
  
  // Assign tenant dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState<boolean>(false);
  const [assigningUser, setAssigningUser] = useState<UserWithTenants | null>(null);
  const [assignTenantId, setAssignTenantId] = useState<string>("");
  const [assignRole, setAssignRole] = useState<string>("mitarbeiter");

  useEffect((): void => {
    const checkPlatformRole = async (): Promise<void> => {
      if (!user?.id) {
        setIsPlatformAdmin(false);
        setRoleCheckLoading(false);
        return;
      }

      setRoleCheckLoading(true);
      const { data, error } = await supabase.rpc('is_superadmin', { _user_id: user.id });
      if (error) {
        debugConsole.error('Error checking platform role:', error);
        setIsPlatformAdmin(false);
      } else {
        setIsPlatformAdmin(Boolean(data));
      }
      setRoleCheckLoading(false);
    };

    void checkPlatformRole();
  }, [user?.id]);

  const loadTenants = async (): Promise<void> => {
    try {
      setLoading(true);
      // Try to fetch is_template; gracefully fall back if column doesn't exist yet.
      let { data, error } = await supabase
        .from("tenants")
        .select(`id, name, description, is_active, created_at, is_template`)
        .order("name");

      if (error && /column .*is_template.* does not exist/i.test(error.message ?? "")) {
        const fallback = await supabase
          .from("tenants")
          .select(`id, name, description, is_active, created_at`)
          .order("name");
        data = fallback.data as typeof data;
        error = fallback.error;
      }

      if (error) throw error;

      setTenants(data || []);
    } catch (error: unknown) {
      debugConsole.error("Error loading tenants:", error);
      toast({ title: "Fehler", description: "Tenants konnten nicht geladen werden", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadAllUsers = async (): Promise<void> => {
    try {
      setUsersLoading(true);
      const { data, error } = await supabase.functions.invoke('manage-tenant-user', {
        body: { action: 'listAllUsers' }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setAllUsers(data.users ?? []);
    } catch (error: unknown) {
      debugConsole.error("Error loading users:", error);
      toast({ title: "Fehler", description: error instanceof Error ? error.message : "Benutzer konnten nicht geladen werden", variant: "destructive" });
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (isPlatformAdmin) {
      loadTenants();
      loadAllUsers();
    }
  }, [isPlatformAdmin]);

  const handleSaveTenant = async (): Promise<void> => {
    if (!formName.trim()) {
      toast({ title: "Fehler", description: "Name ist erforderlich", variant: "destructive" });
      return;
    }

    const settingsData = {
      constituency: formConstituency.trim(),
      constituency_number: formConstituencyNumber.trim(),
      city: formCity.trim(),
      state: formState,
      party: formParty.trim(),
      social_media: {
        instagram: formSocialInstagram.trim(),
        facebook: formSocialFacebook.trim(),
        x: formSocialX.trim(),
        linkedin: formSocialLinkedIn.trim(),
      },
    };

    try {
      if (editingTenant) {
        const updatePayload: Record<string, unknown> = {
          name: formName.trim(),
          description: formDescription.trim() || null,
          is_active: formIsActive,
          settings: settingsData,
          updated_at: new Date().toISOString(),
        };
        // Try with is_template first; fall back if column missing.
        let { error } = await supabase
          .from("tenants")
          .update({ ...updatePayload, is_template: formIsTemplate })
          .eq("id", editingTenant.id);
        if (error && /column .*is_template.* does not exist/i.test(error.message ?? "")) {
          const fallback = await supabase
            .from("tenants")
            .update(updatePayload)
            .eq("id", editingTenant.id);
          error = fallback.error;
        }

        if (error) throw error;

        // Update app_settings for this tenant
        const settingsToUpsert = [
          { tenant_id: editingTenant.id, setting_key: 'app_name', setting_value: formAppName.trim() || 'LandtagsOS' },
          { tenant_id: editingTenant.id, setting_key: 'app_subtitle', setting_value: formAppSubtitle.trim() || 'Koordinationssystem' },
        ];
        for (const s of settingsToUpsert) {
          const { data: existing } = await supabase
            .from('app_settings')
            .select('id')
            .eq('tenant_id', s.tenant_id)
            .eq('setting_key', s.setting_key)
            .maybeSingle();
          if (existing) {
            await supabase.from('app_settings').update({ setting_value: s.setting_value }).eq('id', existing.id);
          } else {
            await supabase.from('app_settings').insert(s);
          }
        }

        toast({ title: "Gespeichert", description: "Tenant wurde aktualisiert" });
      } else {
        // Create new tenant
        const { data: newTenant, error } = await supabase
          .from("tenants")
          .insert([{
            name: formName.trim(),
            description: formDescription.trim() || null,
            is_active: formIsActive,
            settings: settingsData,
          }])
          .select('id')
          .single();

        if (error) throw error;

        // Initialize tenant with default settings including app name/subtitle
        if (newTenant) {
          const { error: initError } = await supabase.functions.invoke('manage-tenant-user', {
            body: {
              action: 'initializeTenant',
              tenantId: newTenant.id,
              appName: formAppName.trim() || 'LandtagsOS',
              appSubtitle: formAppSubtitle.trim() || 'Koordinationssystem',
            }
          });
          
          if (initError) {
            debugConsole.error('Error initializing tenant:', initError);
          }
        }

        toast({ title: "Erstellt", description: "Neuer Tenant wurde angelegt und initialisiert" });
      }

      setDialogOpen(false);
      resetTenantForm();
      loadTenants();
    } catch (error: unknown) {
      debugConsole.error("Save tenant error:", error);
      toast({ title: "Fehler", description: error instanceof Error ? error.message : "Speichern fehlgeschlagen", variant: "destructive" });
    }
  };

  const handleDeleteTenant = async (tenant: TenantWithStats) => {
    const assignedUsersCount = usersByTenantId.get(tenant.id)?.length || 0;

    if (assignedUsersCount > 0) {
      toast({ 
        title: "Nicht möglich", 
        description: `Tenant hat noch ${assignedUsersCount} Benutzer. Bitte erst alle Benutzer entfernen.`,
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
    } catch (error: unknown) {
      toast({ title: "Fehler", description: error instanceof Error ? error.message : "Löschen fehlgeschlagen", variant: "destructive" });
    }
  };

  const handleCreateUser = async (): Promise<void> => {
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
    } catch (error: unknown) {
      debugConsole.error("Create user error:", error);
      toast({ title: "Fehler", description: error instanceof Error ? error.message : "Erstellen fehlgeschlagen", variant: "destructive" });
    }
  };

  const handleAssignTenant = async (): Promise<void> => {
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
    } catch (error: unknown) {
      toast({ title: "Fehler", description: error instanceof Error ? error.message : "Zuweisung fehlgeschlagen", variant: "destructive" });
    }
  };

  const handleDeleteUser = async (userToDelete: UserWithTenants): Promise<void> => {
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
    } catch (error: unknown) {
      toast({ title: "Fehler", description: error instanceof Error ? error.message : "Löschen fehlgeschlagen", variant: "destructive" });
    }
  };

  const copyPassword = (): void => {
    if (createdUserPassword) {
      navigator.clipboard.writeText(createdUserPassword);
      setPasswordCopied(true);
      setTimeout(() => {
        setPasswordCopied(false);
        setCreatedUserPassword(null);
      }, 2000);
    }
  };

  const openCreateTenantDialog = (): void => {
    // The classic dialog stays for editing; new tenants now go through the wizard.
    setWizardOpen(true);
  };

  const openEditTenantDialog = async (tenant: TenantWithStats): Promise<void> => {
    setEditingTenant(tenant);
    setFormName(tenant.name);
    setFormDescription(tenant.description || "");
    setFormIsActive(tenant.is_active);
    setFormIsTemplate(Boolean(tenant.is_template));

    // Load settings from tenant
    const { data: tenantData } = await supabase
      .from("tenants")
      .select("settings")
      .eq("id", tenant.id)
      .maybeSingle();
    const settings = (tenantData?.settings as Record<string, unknown>) ?? {};
    setFormConstituency(typeof settings.constituency === "string" ? settings.constituency : "");
    setFormConstituencyNumber(typeof settings.constituency_number === "string" ? settings.constituency_number : "");
    setFormCity(typeof settings.city === "string" ? settings.city : "");
    setFormState(typeof settings.state === "string" ? settings.state : "");
    setFormParty(typeof settings.party === "string" ? settings.party : "");
    const socialMedia = (
      settings.social_media &&
      typeof settings.social_media === "object" &&
      !Array.isArray(settings.social_media)
    )
      ? settings.social_media as Record<string, string>
      : {};
    setFormSocialInstagram(socialMedia.instagram || "");
    setFormSocialFacebook(socialMedia.facebook || "");
    setFormSocialX(socialMedia.x || "");
    setFormSocialLinkedIn(socialMedia.linkedin || "");
    setSocialSectionOpen(Boolean(
      socialMedia.instagram || socialMedia.facebook || socialMedia.x || socialMedia.linkedin
    ));

    // Load app_settings
    const { data: appSettings } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .eq("tenant_id", tenant.id)
      .in("setting_key", ["app_name", "app_subtitle"]);
    const settingsMap = Object.fromEntries((appSettings ?? []).map(s: Record<string, any> => [s.setting_key, s.setting_value]));
    setFormAppName(settingsMap.app_name || "LandtagsOS");
    setFormAppSubtitle(settingsMap.app_subtitle || "Koordinationssystem");

    setDialogOpen(true);
  };

  const openAssignDialog = (userToAssign: UserWithTenants): void => {
    setAssigningUser(userToAssign);
    setAssignTenantId("");
    setAssignRole("mitarbeiter");
    setAssignDialogOpen(true);
  };

  const resetTenantForm = (): void => {
    setFormName("");
    setFormDescription("");
    setFormIsActive(true);
    setFormConstituency("");
    setFormConstituencyNumber("");
    setFormCity("");
    setFormState("");
    setFormParty("");
    setFormAppName("LandtagsOS");
    setFormAppSubtitle("Koordinationssystem");
    setFormSocialInstagram("");
    setFormSocialFacebook("");
    setFormSocialX("");
    setFormSocialLinkedIn("");
    setSocialSectionOpen(false);
    setFormIsTemplate(false);
    setEditingTenant(null);
  };

  const resetCreateUserForm = (): void => {
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
    : allUsers.filter((u) => u.tenants.some((t) => t.id === selectedTenantFilter));

  const usersByTenantId = useMemo(() => {
    const map = new Map<string, Map<string, UserWithTenants>>();

    allUsers.forEach((userEntry) => {
      userEntry.tenants.forEach((tenantEntry) => {
        const usersForTenant = map.get(tenantEntry.id) || new Map<string, UserWithTenants>();
        usersForTenant.set(userEntry.id, userEntry);
        map.set(tenantEntry.id, usersForTenant);
      });
    });

    return new Map(
      Array.from(map.entries()).map(([tenantId, users]) => [tenantId, Array.from(users.values())])
    );
  }, [allUsers]);

  if (roleCheckLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Berechtigungen werden geladen...
        </CardContent>
      </Card>
    );
  }

  if (!isPlatformAdmin) {
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
                    <TableHead>Health</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>Erstellt</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((tenant) => (
                    <TableRow key={tenant.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {tenant.name}
                          {tenant.is_template && (
                            <Sparkles className="h-3.5 w-3.5 text-primary" aria-label="Vorlage" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">
                        {tenant.description || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="gap-1">
                          <Users className="h-3 w-3" />
                          {(usersByTenantId.get(tenant.id) || []).length}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {(usersByTenantId.get(tenant.id) || []).length ? (
                          <div className="flex flex-wrap gap-1">
                            {(usersByTenantId.get(tenant.id) || []).map((tenantUser) => (
                              <Badge key={`${tenant.id}-${tenantUser.id}`} variant="outline" className="text-xs">
                                {tenantUser.display_name || tenantUser.email}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Keine Benutzer zugewiesen</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <TenantHealthBadges tenantId={tenant.id} reloadKey={healthRefreshKey} />
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
                            title="Bearbeiten"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setCloneTarget({ id: tenant.id, name: tenant.name });
                              setCloneDrawerOpen(true);
                            }}
                            title="Daten aus anderem Tenant nachladen"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={(usersByTenantId.get(tenant.id) || []).length > 0}
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
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTenant ? "Tenant bearbeiten" : "Neuer Tenant"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {/* Grunddaten */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground">Grunddaten</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Name *</Label>
                    <Input
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="z.B. Büro Mustermann"
                    />
                  </div>
                  <div className="flex flex-col gap-3 md:items-end">
                    <div className="flex items-center gap-3">
                      <Label>Aktiv</Label>
                      <Switch
                        checked={formIsActive}
                        onCheckedChange={setFormIsActive}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Label className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        Als Vorlage
                      </Label>
                      <Switch
                        checked={formIsTemplate}
                        onCheckedChange={setFormIsTemplate}
                      />
                    </div>
                  </div>
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
              </div>

              {/* Wahlkreis & Herkunft */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground">Wahlkreis & Herkunft</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Wahlkreis-Name</Label>
                    <Input
                      value={formConstituency}
                      onChange={(e) => setFormConstituency(e.target.value)}
                      placeholder="z.B. Karlsruhe I"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Wahlkreis-Nummer</Label>
                    <Input
                      value={formConstituencyNumber}
                      onChange={(e) => setFormConstituencyNumber(e.target.value)}
                      placeholder="z.B. 27"
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Stadt / Ort</Label>
                    <Input
                      value={formCity}
                      onChange={(e) => setFormCity(e.target.value)}
                      placeholder="z.B. Karlsruhe"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Bundesland</Label>
                    <Select value={formState} onValueChange={setFormState}>
                      <SelectTrigger>
                        <SelectValue placeholder="Bundesland wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {BUNDESLAENDER.map(bl => (
                          <SelectItem key={bl} value={bl}>{bl}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Partei / Fraktion</Label>
                    <Input
                      value={formParty}
                      onChange={(e) => setFormParty(e.target.value)}
                      placeholder="z.B. GRÜNE"
                    />
                  </div>
                </div>
              </div>

              {/* Social Media (optional) */}
              <div className="space-y-4">
                <Collapsible open={socialSectionOpen} onOpenChange={setSocialSectionOpen}>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted/50"
                    >
                      <span>Social Media (optional)</span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${socialSectionOpen ? "rotate-180" : ""}`} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4 space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="grid gap-2">
                        <Label>Instagram</Label>
                        <Input
                          value={formSocialInstagram}
                          onChange={(e) => setFormSocialInstagram(e.target.value)}
                          placeholder="@konto oder URL"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Facebook</Label>
                        <Input
                          value={formSocialFacebook}
                          onChange={(e) => setFormSocialFacebook(e.target.value)}
                          placeholder="Seitenname oder URL"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="grid gap-2">
                        <Label>X / Twitter</Label>
                        <Input
                          value={formSocialX}
                          onChange={(e) => setFormSocialX(e.target.value)}
                          placeholder="@konto oder URL"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>LinkedIn</Label>
                        <Input
                          value={formSocialLinkedIn}
                          onChange={(e) => setFormSocialLinkedIn(e.target.value)}
                          placeholder="Profil oder URL"
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>

              {/* App-Einstellungen */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground">App-Einstellungen</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>App-Name</Label>
                    <Input
                      value={formAppName}
                      onChange={(e) => setFormAppName(e.target.value)}
                      placeholder="LandtagsOS"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>App-Untertitel</Label>
                    <Input
                      value={formAppSubtitle}
                      onChange={(e) => setFormAppSubtitle(e.target.value)}
                      placeholder="Koordinationssystem"
                    />
                  </div>
                </div>
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

      <TenantProvisioningWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        templateTenants={tenants.map((t) => ({ id: t.id, name: t.name, is_template: t.is_template }))}
        onCreated={() => {
          loadTenants();
          loadAllUsers();
          setHealthRefreshKey((k) => k + 1);
        }}
      />

      <CloneDataDrawer
        open={cloneDrawerOpen}
        onOpenChange={setCloneDrawerOpen}
        targetTenant={cloneTarget}
        availableSources={tenants.map((t) => ({ id: t.id, name: t.name }))}
        onDone={() => setHealthRefreshKey((k) => k + 1)}
      />
    </Card>
  );
}
