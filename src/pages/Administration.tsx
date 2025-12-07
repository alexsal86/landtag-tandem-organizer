import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GeneralSettings } from "@/components/GeneralSettings";
import { ExpenseManagement } from "@/components/ExpenseManagement";
import { StatusAdminSettings } from "@/components/StatusAdminSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Edit, Plus, Save, X, Check, Copy, GripVertical, Minus, Settings, Calendar, CheckSquare, Building, FileText, DollarSign, Users, Shield, Clock, MapPin, Rss, Palette, History, Briefcase } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { NewUserForm } from "@/components/NewUserForm";
import { CreateDemoUsers } from "@/components/CreateDemoUsers";
import { TenantCollaboration } from "@/components/TenantCollaboration";
import { DecisionEmailTemplates } from "@/components/task-decisions/DecisionEmailTemplates";
import { DefaultGuestsAdmin } from "@/components/DefaultGuestsAdmin";
import AppointmentPreparationTemplateAdmin from "@/components/AppointmentPreparationTemplateAdmin";
import { SenderInformationManager } from "@/components/administration/SenderInformationManager";
import { InformationBlockManager } from "@/components/administration/InformationBlockManager";
import { DistrictSupportManager } from "@/components/administration/DistrictSupportManager";
import { PartyDistrictMappingManager } from "@/components/administration/PartyDistrictMappingManager";
import { CalendarSyncDebug } from "@/components/CalendarSyncDebug";
import { PartyAssociationsAdmin } from "@/components/PartyAssociationsAdmin";
import { TagAdminSettings } from "@/components/TagAdminSettings";
import { DocumentCategoryAdminSettings } from "@/components/DocumentCategoryAdminSettings";
import { RSSSourceManager } from "@/components/administration/RSSSourceManager";
import { RSSSettingsManager } from "@/components/administration/RSSSettingsManager";
import { CalendarSyncSettings } from "@/components/administration/CalendarSyncSettings";
import { LoginCustomization } from "@/components/administration/LoginCustomization";
import { UserColorManager } from "@/components/administration/UserColorManager";
import { DecisionArchiveSettings } from "@/components/administration/DecisionArchiveSettings";
import { MatrixSettings } from "@/components/MatrixSettings";
import { NewsEmailTemplateManager } from "@/components/administration/NewsEmailTemplateManager";
import { AuditLogViewer } from "@/components/administration/AuditLogViewer";
import { CaseFileTypeSettings } from "@/components/administration/CaseFileTypeSettings";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

// Roles in descending hierarchy
const ROLE_OPTIONS = [
  { value: "abgeordneter", label: "Abgeordneter (Admin)" },
  { value: "bueroleitung", label: "Büroleitung" },
  { value: "mitarbeiter", label: "Mitarbeiter" },
  { value: "praktikant", label: "Praktikant" },
] as const;

type RoleValue = typeof ROLE_OPTIONS[number]["value"];

type Profile = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
};

type UserRole = {
  user_id: string;
  role: RoleValue;
};

type ConfigItem = {
  id: string;
  name: string;
  label: string;
  is_active: boolean;
  order_index: number;
  color?: string;
};

export default function Administration() {
  const { user, loading } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  // Configuration states
  const [appointmentCategories, setAppointmentCategories] = useState<ConfigItem[]>([]);
  const [appointmentStatuses, setAppointmentStatuses] = useState<ConfigItem[]>([]);
  const [appointmentLocations, setAppointmentLocations] = useState<ConfigItem[]>([]);
  const [taskCategories, setTaskCategories] = useState<ConfigItem[]>([]);
  const [taskStatuses, setTaskStatuses] = useState<ConfigItem[]>([]);
  const [todoCategories, setTodoCategories] = useState<ConfigItem[]>([]);

  // Template states
  const [meetingTemplates, setMeetingTemplates] = useState<any[]>([]);
  const [planningTemplates, setPlanningTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [selectedPlanningTemplate, setSelectedPlanningTemplate] = useState<any>(null);
  const [templateItems, setTemplateItems] = useState<any[]>([]);
  const [planningTemplateItems, setPlanningTemplateItems] = useState<any[]>([]);

  // Editing states
  const [editingItem, setEditingItem] = useState<{ type: string; id: string; value: string; color?: string } | null>(null);
  const [newItem, setNewItem] = useState<{ type: string; value: string; color?: string } | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<{ id: string; field: string; value: string } | null>(null);
  const [editingPlanningTemplate, setEditingPlanningTemplate] = useState<{ id: string; field: string; value: string } | null>(null);
  const [newTemplateItem, setNewTemplateItem] = useState<{ title: string; parentIndex?: number } | null>(null);
  const [newPlanningTemplateItem, setNewPlanningTemplateItem] = useState<{ title: string; parentIndex?: number } | null>(null);
  const [editingTemplateName, setEditingTemplateName] = useState<{ id: string; value: string } | null>(null);
  const [editingPlanningTemplateName, setEditingPlanningTemplateName] = useState<{ id: string; value: string } | null>(null);

  const currentUserRole = useMemo(() => {
    return roles.find(r => r.user_id === user?.id);
  }, [roles, user?.id]);

  useEffect(() => {
    if (!loading && user && currentTenant) {
      checkAdminStatus();
      loadData();
    }
  }, [loading, user, currentTenant]);

  const checkAdminStatus = async () => {
    if (!user) return;
    
    try {
      // Check if user has abgeordneter or bueroleitung role for admin access
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      // Both abgeordneter and bueroleitung can access administration
      setIsAdmin(roleData?.role === 'abgeordneter' || roleData?.role === 'bueroleitung');
      
      // Only abgeordneter can see the rights tab
      setIsSuperAdmin(roleData?.role === 'abgeordneter');
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const loadData = async () => {
    if (!currentTenant?.id) return;
    
    try {
      setLoadingData(true);
      
      // Get users for current tenant first
      const { data: tenantMemberships } = await supabase
        .from('user_tenant_memberships')
        .select('user_id')
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true);
      
      if (!tenantMemberships?.length) {
        setProfiles([]);
        setRoles([]);
      } else {
        const userIds = tenantMemberships.map(m => m.user_id);
        
        // Load profiles for tenant users only
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', userIds)
          .order('display_name');
        
        // Load roles for tenant users only
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', userIds);
        
        setProfiles(profilesData || []);
        setRoles(rolesData || []);
      }
      
      // Load configuration items
      const [categoriesRes, statusesRes, locationsRes, taskCatRes, taskStatRes, todoCatRes, meetingTemplatesRes, planningTemplatesRes] = await Promise.all([
        supabase.from('appointment_categories').select('*').order('order_index'),
        supabase.from('appointment_statuses').select('*').order('order_index'),
        supabase.from('appointment_locations').select('id, name, name, is_active, order_index').order('order_index'),
        supabase.from('task_categories').select('*').order('order_index'),
        supabase.from('task_statuses').select('*').order('order_index'),
        supabase.from('todo_categories').select('*').order('order_index'),
        supabase.from('meeting_templates').select('*').order('name'),
        supabase.from('planning_templates').select('*').order('name')
      ]);
      
      setAppointmentCategories(categoriesRes.data || []);
      setAppointmentStatuses(statusesRes.data || []);
      setAppointmentLocations(locationsRes.data?.map(item => ({ ...item, label: item.name })) || []);
      setTaskCategories(taskCatRes.data || []);
      setTaskStatuses(taskStatRes.data || []);
      setTodoCategories(todoCatRes.data || []);
      setMeetingTemplates(meetingTemplatesRes.data || []);
      setPlanningTemplates(planningTemplatesRes.data || []);
      
    } catch (error) {
      console.error('Error loading data:', error);
      toast({ title: "Fehler", description: "Daten konnten nicht geladen werden.", variant: "destructive" });
    } finally {
      setLoadingData(false);
    }
  };

  // Drag & Drop handlers
  const handleMeetingDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(templateItems);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update order_index for all items
    const updatedItems = items.map((item, index) => ({
      ...item,
      order_index: index
    }));

    setTemplateItems(updatedItems);
    saveTemplateItems(updatedItems);
  };

  const handlePlanningDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(planningTemplateItems);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update order_index for all items
    const updatedItems = items.map((item, index) => ({
      ...item,
      order_index: index
    }));

    setPlanningTemplateItems(updatedItems);
    savePlanningTemplateItems(updatedItems);
  };

  const updateUserRole = async (targetUserId: string, role: RoleValue | "none") => {
    try {
      setBusyUserId(targetUserId);
      const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", targetUserId);
      if (delErr) throw delErr;

      if (role !== "none") {
        const { error: insErr } = await supabase
          .from("user_roles")
          .insert({ user_id: targetUserId, role, assigned_by: user.id });
        if (insErr) throw insErr;
      }

      const { data: newRoles } = await supabase.from("user_roles").select("user_id, role");
      setRoles((newRoles as UserRole[]) || []);

      toast({ title: "Gespeichert", description: "Rolle erfolgreich aktualisiert." });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Fehler", description: e?.message ?? "Änderung fehlgeschlagen.", variant: "destructive" });
    } finally {
      setBusyUserId(null);
    }
  };

  // Template functions
  const loadTemplate = (template: any) => {
    setSelectedTemplate(template);
    const templateItems = Array.isArray(template.template_items) ? template.template_items : [];
    setTemplateItems(templateItems);
  };

  const loadPlanningTemplate = (template: any) => {
    setSelectedPlanningTemplate(template);
    const templateItems = Array.isArray(template.template_items) ? template.template_items : [];
    setPlanningTemplateItems(templateItems);
  };

  const saveTemplateItems = async (items = templateItems) => {
    if (!selectedTemplate) return;
    
    try {
      const { error } = await supabase
        .from('meeting_templates')
        .update({ template_items: items })
        .eq('id', selectedTemplate.id);
        
      if (error) throw error;
      
      if (items === templateItems) {
        toast({ title: "Gespeichert", description: "Template erfolgreich aktualisiert." });
      }
    } catch (error: any) {
      console.error(error);
      toast({ title: "Fehler", description: "Fehler beim Speichern.", variant: "destructive" });
    }
  };

  const savePlanningTemplateItems = async (items = planningTemplateItems) => {
    if (!selectedPlanningTemplate) return;
    
    try {
      const { error } = await supabase
        .from('planning_templates')
        .update({ template_items: items })
        .eq('id', selectedPlanningTemplate.id);
        
      if (error) throw error;
      
      if (items === planningTemplateItems) {
        toast({ title: "Gespeichert", description: "Template erfolgreich aktualisiert." });
      }
    } catch (error: any) {
      console.error(error);
      toast({ title: "Fehler", description: "Fehler beim Speichern.", variant: "destructive" });
    }
  };

  const addTemplateItem = (title: string, parentIndex?: number) => {
    if (selectedTemplate) {
      const newItems = [...templateItems];
      if (parentIndex !== undefined) {
        // Add sub-item
        if (!newItems[parentIndex].children) {
          newItems[parentIndex].children = [];
        }
        newItems[parentIndex].children.push({ title, order_index: newItems[parentIndex].children.length });
      } else {
        // Add main item or separator
        const itemType = title.startsWith('---') ? 'separator' : 'item';
        newItems.push({ 
          title: itemType === 'separator' ? title.replace(/^---\s*/, '') : title, 
          type: itemType,
          order_index: newItems.length 
        });
      }
      setTemplateItems(newItems);
      saveTemplateItems(newItems);
      setNewTemplateItem(null);
    }
  };

  const addPlanningTemplateItem = (title: string, parentIndex?: number) => {
    if (selectedPlanningTemplate) {
      const newItems = [...planningTemplateItems];
      if (parentIndex !== undefined) {
        // Add sub-item
        if (!newItems[parentIndex].sub_items) {
          newItems[parentIndex].sub_items = [];
        }
        newItems[parentIndex].sub_items.push({ title, order_index: newItems[parentIndex].sub_items.length });
      } else {
        // Add main item or separator
        const itemType = title.startsWith('---') ? 'separator' : 'item';
        newItems.push({ 
          title: itemType === 'separator' ? title.replace(/^---\s*/, '') : title, 
          type: itemType,
          order_index: newItems.length 
        });
      }
      setPlanningTemplateItems(newItems);
      savePlanningTemplateItems(newItems);
      setNewPlanningTemplateItem(null);
    }
  };

  const addSeparator = () => {
    if (selectedTemplate) {
      const newItems = [...templateItems];
      newItems.push({ 
        title: '', 
        type: 'separator',
        order_index: newItems.length 
      });
      setTemplateItems(newItems);
      saveTemplateItems(newItems);
    }
  };

  const addPlanningSeparator = () => {
    if (selectedPlanningTemplate) {
      const newItems = [...planningTemplateItems];
      newItems.push({ 
        title: '', 
        type: 'separator',
        order_index: newItems.length 
      });
      setPlanningTemplateItems(newItems);
      savePlanningTemplateItems(newItems);
    }
  };

  const updateTemplateItem = (index: number, field: string, value: string) => {
    const newItems = [...templateItems];
    newItems[index][field] = value;
    setTemplateItems(newItems);
    saveTemplateItems(newItems);
  };

  const updatePlanningTemplateItem = (index: number, field: string, value: string) => {
    const newItems = [...planningTemplateItems];
    newItems[index][field] = value;
    setPlanningTemplateItems(newItems);
    savePlanningTemplateItems(newItems);
  };

  const deleteTemplateItem = async (index: number) => {
    const newItems = templateItems.filter((_, i) => i !== index);
    setTemplateItems(newItems);
    saveTemplateItems(newItems);
  };

  const deletePlanningTemplateItem = async (index: number) => {
    const newItems = planningTemplateItems.filter((_, i) => i !== index);
    setPlanningTemplateItems(newItems);
    savePlanningTemplateItems(newItems);
  };

  // Configuration item functions
  const addConfigItem = async (tableName: 'appointment_categories' | 'appointment_statuses' | 'appointment_locations' | 'task_categories' | 'task_statuses' | 'todo_categories', value: string, color?: string) => {
    if (!value.trim()) return;
    
    try {
      const data: any = {
        name: value.toLowerCase().replace(/\s+/g, '_'),
        label: value,
        order_index: getNextOrderIndex(tableName)
      };
      
      if (color) data.color = color;
      
      const { error } = await supabase.from(tableName).insert(data);
      if (error) throw error;
      
      await loadData();
      setNewItem(null);
      toast({ title: "Gespeichert", description: "Element erfolgreich hinzugefügt." });
    } catch (error: any) {
      console.error(error);
      toast({ title: "Fehler", description: "Fehler beim Hinzufügen.", variant: "destructive" });
    }
  };

  const saveConfigItem = async (tableName: 'appointment_categories' | 'appointment_statuses' | 'appointment_locations' | 'task_categories' | 'task_statuses' | 'todo_categories', id: string, value: string, color?: string) => {
    if (!value.trim()) return;
    
    try {
      const data: any = {
        name: value.toLowerCase().replace(/\s+/g, '_'),
        label: value
      };
      
      if (color) data.color = color;
      
      const { error } = await supabase.from(tableName).update(data).eq('id', id);
      if (error) throw error;
      
      await loadData();
      setEditingItem(null);
      toast({ title: "Gespeichert", description: "Element erfolgreich aktualisiert." });
    } catch (error: any) {
      console.error(error);
      toast({ title: "Fehler", description: "Fehler beim Speichern.", variant: "destructive" });
    }
  };

  const deleteConfigItem = async (tableName: 'appointment_categories' | 'appointment_statuses' | 'appointment_locations' | 'task_categories' | 'task_statuses' | 'todo_categories', id: string) => {
    try {
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) throw error;
      
      await loadData();
      toast({ title: "Gelöscht", description: "Element erfolgreich entfernt." });
    } catch (error: any) {
      console.error(error);
      toast({ title: "Fehler", description: "Fehler beim Löschen.", variant: "destructive" });
    }
  };

  const getNextOrderIndex = (tableName: string) => {
    switch (tableName) {
      case 'appointment_categories':
        return appointmentCategories.length;
      case 'appointment_statuses':
        return appointmentStatuses.length;
      case 'appointment_locations':
        return appointmentLocations.length;
      case 'task_categories':
        return taskCategories.length;
      case 'task_statuses':
        return taskStatuses.length;
      case 'todo_categories':
        return todoCategories.length;
      default:
        return 0;
    }
  };

  if (loading) return null;

  if (!isAdmin) {
    return (
      <main className="container mx-auto p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">Administration</h1>
          <p className="text-muted-foreground">Sie besitzen keine Berechtigung, diese Seite zu sehen.</p>
        </header>
      </main>
    );
  }

  return (
    <main className="container mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Administration</h1>
        <p className="text-muted-foreground">Systemkonfiguration und Benutzerverwaltung</p>
      </header>

      <Tabs defaultValue="system" className="space-y-6">
        <TabsList className="grid w-full grid-cols-9">
          <TabsTrigger value="system" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            System & Allgemein
          </TabsTrigger>
          <TabsTrigger value="tags" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Tags & Kategorien
          </TabsTrigger>
          <TabsTrigger value="appointments" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Termine & Kalender
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            Aufgaben & ToDos
          </TabsTrigger>
          <TabsTrigger value="casefiles" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            FallAkten
          </TabsTrigger>
          <TabsTrigger value="politics" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Politik & Wahlkreise
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Dokumente & Vorlagen
          </TabsTrigger>
          <TabsTrigger value="rss" className="flex items-center gap-2">
            <Rss className="h-4 w-4" />
            RSS-Quellen & News
          </TabsTrigger>
          <TabsTrigger value="archiving" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Archivierung
          </TabsTrigger>
        </TabsList>

        {/* System & Allgemein */}
        <TabsContent value="system" className="space-y-6">
          <Tabs defaultValue="general" className="space-y-4">
            <TabsList>
              <TabsTrigger value="general">Allgemein</TabsTrigger>
              <TabsTrigger value="login">Login-Anpassung</TabsTrigger>
              <TabsTrigger value="status">Status</TabsTrigger>
              <TabsTrigger value="collaboration">Kollaboration</TabsTrigger>
              <TabsTrigger value="expense">Verwaltung</TabsTrigger>
              {isSuperAdmin && <TabsTrigger value="roles">Rechte</TabsTrigger>}
              {isSuperAdmin && <TabsTrigger value="usercolors"><Palette className="h-4 w-4 mr-2" />Benutzerfarben</TabsTrigger>}
              <TabsTrigger value="matrix">Matrix</TabsTrigger>
              <TabsTrigger value="auditlogs"><History className="h-4 w-4 mr-2" />Audit-Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="general">
              <GeneralSettings />
            </TabsContent>

            <TabsContent value="login">
              <LoginCustomization />
            </TabsContent>

            <TabsContent value="status">
              <StatusAdminSettings />
            </TabsContent>

            <TabsContent value="collaboration">
              <TenantCollaboration />
            </TabsContent>

            <TabsContent value="expense">
              <ExpenseManagement />
            </TabsContent>

            {isSuperAdmin && (
              <TabsContent value="roles">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Benutzerrollen
                    </CardTitle>
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Plus className="h-4 w-4 mr-2" />
                            Neuer Benutzer
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Neuen Benutzer erstellen</DialogTitle>
                          </DialogHeader>
                          <NewUserForm onSuccess={loadData} />
                        </DialogContent>
                      </Dialog>
                      <CreateDemoUsers />
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loadingData ? (
                      <div className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <Skeleton className="h-4 w-48" />
                            <Skeleton className="h-9 w-56 ml-auto" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Benutzer</TableHead>
                            <TableHead className="text-right">Rolle</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {profiles.map((p) => (
                            <TableRow key={p.user_id}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-10 w-10">
                                    <AvatarImage src={p.avatar_url ?? undefined} alt={p.display_name ?? "Avatar"} />
                                    <AvatarFallback>
                                      {(p.display_name ?? "U").charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{p.display_name || "Unbekannter Benutzer"}</span>
                                    <span className="text-xs text-muted-foreground">{p.user_id}</span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <Select
                                  value={roles.find(r => r.user_id === p.user_id)?.role ?? "none"}
                                  onValueChange={(val) => updateUserRole(p.user_id, val as RoleValue | "none")}
                                  disabled={busyUserId === p.user_id}
                                >
                                  <SelectTrigger className="w-56">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">Keine Rolle</SelectItem>
                                    {ROLE_OPTIONS.map(role => (
                                      <SelectItem key={role.value} value={role.value}>
                                        {role.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {isSuperAdmin && (
              <TabsContent value="usercolors">
                <UserColorManager />
              </TabsContent>
            )}

            <TabsContent value="matrix">
              <MatrixSettings />
            </TabsContent>

            <TabsContent value="auditlogs">
              <AuditLogViewer />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Tags & Kategorien */}
        <TabsContent value="tags" className="space-y-6">
          <TagAdminSettings />
          <DocumentCategoryAdminSettings />
        </TabsContent>

        {/* Termine & Kalender */}
        <TabsContent value="appointments" className="space-y-6">
          <Tabs defaultValue="config" className="space-y-4">
            <TabsList>
              <TabsTrigger value="config">Termine</TabsTrigger>
              <TabsTrigger value="guests">Standard-Gäste</TabsTrigger>
              <TabsTrigger value="preparation">Vorbereitung</TabsTrigger>
              <TabsTrigger value="calendar-debug">Kalender Debug</TabsTrigger>
              <TabsTrigger value="calendar-sync">Synchronisation</TabsTrigger>
            </TabsList>

            <TabsContent value="config">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Termine - Kategorien</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {appointmentCategories.map((item, index) => (
                      <div key={item.id} className="flex items-center gap-2">
                        {editingItem?.type === 'appointment_categories' && editingItem.id === item.id ? (
                          <>
                            <Input
                              value={editingItem.value}
                              onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
                              className="flex-1"
                            />
                            <Input
                              type="color"
                              value={editingItem.color || '#3b82f6'}
                              onChange={(e) => setEditingItem({ ...editingItem, color: e.target.value })}
                              className="w-12 h-9 p-1 rounded border"
                            />
                            <Button size="sm" onClick={() => saveConfigItem('appointment_categories', item.id, editingItem.value, editingItem.color)}>
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingItem(null)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <div className="w-4 h-4 rounded" style={{ backgroundColor: item.color }}></div>
                            <span className="flex-1">{item.label}</span>
                            <Button size="sm" variant="outline" onClick={() => setEditingItem({ type: 'appointment_categories', id: item.id, value: item.label, color: item.color })}>
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => deleteConfigItem('appointment_categories', item.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    ))}
                    
                    {newItem?.type === 'appointment_categories' ? (
                      <div className="flex gap-2">
                        <Input
                          value={newItem.value}
                          onChange={(e) => setNewItem({ ...newItem, value: e.target.value })}
                          placeholder="Neue Kategorie..."
                          className="flex-1"
                        />
                        <Input
                          type="color"
                          value={newItem.color || '#3b82f6'}
                          onChange={(e) => setNewItem({ ...newItem, color: e.target.value })}
                          className="w-12 h-9 p-1 rounded border"
                        />
                        <Button size="sm" onClick={() => addConfigItem('appointment_categories', newItem.value, newItem.color)}>
                          <Save className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setNewItem(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setNewItem({ type: 'appointment_categories', value: '', color: '#3b82f6' })}
                        disabled={!!editingItem || !!newItem}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Kategorie hinzufügen
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Termine - Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {appointmentStatuses.map((item, index) => (
                      <div key={item.id} className="flex items-center gap-2">
                        {editingItem?.type === 'appointment_statuses' && editingItem.id === item.id ? (
                          <>
                            <Input
                              value={editingItem.value}
                              onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
                              className="flex-1"
                            />
                            <Button size="sm" onClick={() => saveConfigItem('appointment_statuses', item.id, editingItem.value)}>
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingItem(null)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1">{item.label}</span>
                            <Button size="sm" variant="outline" onClick={() => setEditingItem({ type: 'appointment_statuses', id: item.id, value: item.label })}>
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => deleteConfigItem('appointment_statuses', item.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    ))}
                    
                    {newItem?.type === 'appointment_statuses' ? (
                      <div className="flex gap-2">
                        <Input
                          value={newItem.value}
                          onChange={(e) => setNewItem({ ...newItem, value: e.target.value })}
                          placeholder="Neuer Status..."
                          className="flex-1"
                        />
                        <Button size="sm" onClick={() => addConfigItem('appointment_statuses', newItem.value)}>
                          <Save className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setNewItem(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setNewItem({ type: 'appointment_statuses', value: '' })}
                        disabled={!!editingItem || !!newItem}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Status hinzufügen
                      </Button>
                    )}
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Termine - Orte</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {appointmentLocations.map((item, index) => (
                      <div key={item.id} className="flex items-center gap-2">
                        {editingItem?.type === 'appointment_locations' && editingItem.id === item.id ? (
                          <>
                            <Input
                              value={editingItem.value}
                              onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
                              className="flex-1"
                            />
                            <Button size="sm" onClick={() => saveConfigItem('appointment_locations', item.id, editingItem.value)}>
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingItem(null)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1">{item.name}</span>
                             <Button size="sm" variant="outline" onClick={() => setEditingItem({ type: 'appointment_locations', id: item.id, value: item.name })}>
                               <Edit className="h-3 w-3" />
                             </Button>
                            <Button size="sm" variant="destructive" onClick={() => deleteConfigItem('appointment_locations', item.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    ))}
                    
                    {newItem?.type === 'appointment_locations' ? (
                      <div className="flex gap-2">
                        <Input
                          value={newItem.value}
                          onChange={(e) => setNewItem({ ...newItem, value: e.target.value })}
                          placeholder="Neuer Ort..."
                          className="flex-1"
                        />
                        <Button size="sm" onClick={() => addConfigItem('appointment_locations', newItem.value)}>
                          <Save className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setNewItem(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setNewItem({ type: 'appointment_locations', value: '' })}
                        disabled={!!editingItem || !!newItem}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Ort hinzufügen
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="guests">
              <DefaultGuestsAdmin />
            </TabsContent>

            <TabsContent value="preparation">
              <AppointmentPreparationTemplateAdmin />
            </TabsContent>

            <TabsContent value="calendar-debug">
              <CalendarSyncDebug />
            </TabsContent>

            <TabsContent value="calendar-sync">
              <CalendarSyncSettings />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Aufgaben & ToDos */}
        <TabsContent value="tasks" className="space-y-6">
          <Tabs defaultValue="task-config" className="space-y-4">
            <TabsList>
              <TabsTrigger value="task-config">Aufgaben</TabsTrigger>
              <TabsTrigger value="todo-config">ToDos</TabsTrigger>
              <TabsTrigger value="decisions">Entscheidungen</TabsTrigger>
            </TabsList>

            <TabsContent value="task-config">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Aufgaben - Kategorien</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {taskCategories.map((item, index) => (
                      <div key={item.id} className="flex items-center gap-2">
                        {editingItem?.type === 'task_categories' && editingItem.id === item.id ? (
                          <>
                            <Input
                              value={editingItem.value}
                              onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
                              className="flex-1"
                            />
                            <Button size="sm" onClick={() => saveConfigItem('task_categories', item.id, editingItem.value)}>
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingItem(null)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1">{item.label}</span>
                            <Button size="sm" variant="outline" onClick={() => setEditingItem({ type: 'task_categories', id: item.id, value: item.label })}>
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => deleteConfigItem('task_categories', item.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    ))}
                    
                    {newItem?.type === 'task_categories' ? (
                      <div className="flex gap-2">
                        <Input
                          value={newItem.value}
                          onChange={(e) => setNewItem({ ...newItem, value: e.target.value })}
                          placeholder="Neue Kategorie..."
                          className="flex-1"
                        />
                        <Button size="sm" onClick={() => addConfigItem('task_categories', newItem.value)}>
                          <Save className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setNewItem(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setNewItem({ type: 'task_categories', value: '' })}
                        disabled={!!editingItem || !!newItem}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Kategorie hinzufügen
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Aufgaben - Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {taskStatuses.map((item, index) => (
                      <div key={item.id} className="flex items-center gap-2">
                        {editingItem?.type === 'task_statuses' && editingItem.id === item.id ? (
                          <>
                            <Input
                              value={editingItem.value}
                              onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
                              className="flex-1"
                            />
                            <Button size="sm" onClick={() => saveConfigItem('task_statuses', item.id, editingItem.value)}>
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingItem(null)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1">{item.label}</span>
                            <Button size="sm" variant="outline" onClick={() => setEditingItem({ type: 'task_statuses', id: item.id, value: item.label })}>
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => deleteConfigItem('task_statuses', item.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    ))}
                    
                    {newItem?.type === 'task_statuses' ? (
                      <div className="flex gap-2">
                        <Input
                          value={newItem.value}
                          onChange={(e) => setNewItem({ ...newItem, value: e.target.value })}
                          placeholder="Neuer Status..."
                          className="flex-1"
                        />
                        <Button size="sm" onClick={() => addConfigItem('task_statuses', newItem.value)}>
                          <Save className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setNewItem(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setNewItem({ type: 'task_statuses', value: '' })}
                        disabled={!!editingItem || !!newItem}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Status hinzufügen
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="todo-config">
              <Card>
                <CardHeader>
                  <CardTitle>ToDo - Kategorien</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {todoCategories.map((item, index) => (
                    <div key={item.id} className="flex items-center gap-2">
                      {editingItem?.type === 'todo_categories' && editingItem.id === item.id ? (
                        <>
                          <Input
                            value={editingItem.value}
                            onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
                            className="flex-1"
                          />
                          <Button size="sm" onClick={() => saveConfigItem('todo_categories', item.id, editingItem.value)}>
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingItem(null)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1">{item.label}</span>
                          <Button size="sm" variant="outline" onClick={() => setEditingItem({ type: 'todo_categories', id: item.id, value: item.label })}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteConfigItem('todo_categories', item.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                  
                  {newItem?.type === 'todo_categories' ? (
                    <div className="flex gap-2">
                      <Input
                        value={newItem.value}
                        onChange={(e) => setNewItem({ ...newItem, value: e.target.value })}
                        placeholder="Neue Kategorie..."
                        className="flex-1"
                      />
                      <Button size="sm" onClick={() => addConfigItem('todo_categories', newItem.value)}>
                        <Save className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setNewItem(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setNewItem({ type: 'todo_categories', value: '' })}
                      disabled={!!editingItem || !!newItem}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Kategorie hinzufügen
                    </Button>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="decisions">
              <DecisionEmailTemplates />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* FallAkten */}
        <TabsContent value="casefiles" className="space-y-6">
          <CaseFileTypeSettings />
        </TabsContent>

        {/* Politik & Wahlkreise */}
        <TabsContent value="politics" className="space-y-6">
          <Tabs defaultValue="associations" className="space-y-4">
            <TabsList>
              <TabsTrigger value="associations">Kreisverbände</TabsTrigger>
              <TabsTrigger value="districts">Betreuungswahlkreise</TabsTrigger>
            </TabsList>

            <TabsContent value="associations">
              <PartyAssociationsAdmin />
            </TabsContent>

            <TabsContent value="districts">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Betreuungswahlkreise
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DistrictSupportManager />
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      Wahlkreis-Zuordnung
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PartyDistrictMappingManager />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Dokumente & Vorlagen */}
        <TabsContent value="documents" className="space-y-6">
          <Tabs defaultValue="letters" className="space-y-4">
            <TabsList>
              <TabsTrigger value="letters">Briefvorlagen</TabsTrigger>
              <TabsTrigger value="meetings">Meetings</TabsTrigger>
              <TabsTrigger value="plannings">Planungen</TabsTrigger>
            </TabsList>

            <TabsContent value="letters">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Absenderinformationen</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <SenderInformationManager />
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Informationsblöcke</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <InformationBlockManager />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="meetings">
              <Card>
                <CardHeader>
                  <CardTitle>Meeting Templates</CardTitle>
                  <div className="flex gap-2">
                    <Select onValueChange={(value) => {
                      const template = meetingTemplates.find(t => t.id === value);
                      if (template) loadTemplate(template);
                    }}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Template auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {meetingTemplates.map(template => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                {selectedTemplate && (
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                      {editingTemplateName?.id === selectedTemplate.id ? (
                        <>
                          <Input
                            value={editingTemplateName.value}
                            onChange={(e) => setEditingTemplateName({ ...editingTemplateName, value: e.target.value })}
                            className="flex-1"
                          />
                          <Button size="sm" onClick={async () => {
                            try {
                              const { error } = await supabase
                                .from('meeting_templates')
                                .update({ name: editingTemplateName.value })
                                .eq('id', selectedTemplate.id);
                              if (error) throw error;
                              await loadData();
                              setEditingTemplateName(null);
                              toast({ title: "Gespeichert", description: "Template-Name aktualisiert." });
                            } catch (error: any) {
                              toast({ title: "Fehler", description: "Fehler beim Speichern.", variant: "destructive" });
                            }
                          }}>
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingTemplateName(null)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="font-medium flex-1">{selectedTemplate.name}</span>
                          <Button size="sm" variant="outline" onClick={() => setEditingTemplateName({ id: selectedTemplate.id, value: selectedTemplate.name })}>
                            <Edit className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>

                    <DragDropContext onDragEnd={handleMeetingDragEnd}>
                      <Droppable droppableId="template-items">
                        {(provided) => (
                          <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                            {templateItems.map((item, index) => (
                              <Draggable key={index} draggableId={index.toString()} index={index}>
                                {(provided) => (
                                  <div ref={provided.innerRef} {...provided.draggableProps} className="flex items-center gap-2 p-2 bg-card rounded border">
                                    <div {...provided.dragHandleProps} className="cursor-grab">
                                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    {item.type === 'separator' ? (
                                      <div className="flex-1 h-px bg-border" />
                                    ) : (
                                      <>
                                        {editingTemplate?.id === index.toString() && editingTemplate.field === 'title' ? (
                                          <>
                                            <Input
                                              value={editingTemplate.value}
                                              onChange={(e) => setEditingTemplate({ ...editingTemplate, value: e.target.value })}
                                              className="flex-1"
                                            />
                                            <Button size="sm" onClick={() => {
                                              updateTemplateItem(index, 'title', editingTemplate.value);
                                              setEditingTemplate(null);
                                            }}>
                                              <Check className="h-3 w-3" />
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => setEditingTemplate(null)}>
                                              <X className="h-3 w-3" />
                                            </Button>
                                          </>
                                        ) : (
                                          <>
                                            <span className="flex-1">{item.title}</span>
                                            <Button size="sm" variant="outline" onClick={() => setEditingTemplate({ id: index.toString(), field: 'title', value: item.title })}>
                                              <Edit className="h-3 w-3" />
                                            </Button>
                                          </>
                                        )}
                                      </>
                                    )}
                                    <Button size="sm" variant="destructive" onClick={() => deleteTemplateItem(index)}>
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </DragDropContext>

                    <div className="flex gap-2">
                      {newTemplateItem ? (
                        <>
                          <Input
                            value={newTemplateItem.title}
                            onChange={(e) => setNewTemplateItem({ ...newTemplateItem, title: e.target.value })}
                            placeholder="Neuer Punkt..."
                            className="flex-1"
                          />
                          <Button size="sm" onClick={() => addTemplateItem(newTemplateItem.title)}>
                            <Save className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setNewTemplateItem(null)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="outline" onClick={() => setNewTemplateItem({ title: '' })}>
                            <Plus className="h-4 w-4 mr-2" />
                            Punkt hinzufügen
                          </Button>
                          <Button variant="outline" onClick={addSeparator}>
                            <Minus className="h-4 w-4 mr-2" />
                            Trenner hinzufügen
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="plannings">
              <Card>
                <CardHeader>
                  <CardTitle>Planning Templates</CardTitle>
                  <div className="flex gap-2">
                    <Select onValueChange={(value) => {
                      const template = planningTemplates.find(t => t.id === value);
                      if (template) loadPlanningTemplate(template);
                    }}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Template auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {planningTemplates.map(template => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                {selectedPlanningTemplate && (
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                      {editingPlanningTemplateName?.id === selectedPlanningTemplate.id ? (
                        <>
                          <Input
                            value={editingPlanningTemplateName.value}
                            onChange={(e) => setEditingPlanningTemplateName({ ...editingPlanningTemplateName, value: e.target.value })}
                            className="flex-1"
                          />
                          <Button size="sm" onClick={async () => {
                            try {
                              const { error } = await supabase
                                .from('planning_templates')
                                .update({ name: editingPlanningTemplateName.value })
                                .eq('id', selectedPlanningTemplate.id);
                              if (error) throw error;
                              await loadData();
                              setEditingPlanningTemplateName(null);
                              toast({ title: "Gespeichert", description: "Template-Name aktualisiert." });
                            } catch (error: any) {
                              toast({ title: "Fehler", description: "Fehler beim Speichern.", variant: "destructive" });
                            }
                          }}>
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingPlanningTemplateName(null)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="font-medium flex-1">{selectedPlanningTemplate.name}</span>
                          <Button size="sm" variant="outline" onClick={() => setEditingPlanningTemplateName({ id: selectedPlanningTemplate.id, value: selectedPlanningTemplate.name })}>
                            <Edit className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>

                    <DragDropContext onDragEnd={handlePlanningDragEnd}>
                      <Droppable droppableId="planning-template-items">
                        {(provided) => (
                          <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                            {planningTemplateItems.map((item, index) => (
                              <Draggable key={index} draggableId={index.toString()} index={index}>
                                {(provided) => (
                                  <div ref={provided.innerRef} {...provided.draggableProps} className="flex items-center gap-2 p-2 bg-card rounded border">
                                    <div {...provided.dragHandleProps} className="cursor-grab">
                                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    {item.type === 'separator' ? (
                                      <div className="flex-1 h-px bg-border" />
                                    ) : (
                                      <>
                                        {editingPlanningTemplate?.id === index.toString() && editingPlanningTemplate.field === 'title' ? (
                                          <>
                                            <Input
                                              value={editingPlanningTemplate.value}
                                              onChange={(e) => setEditingPlanningTemplate({ ...editingPlanningTemplate, value: e.target.value })}
                                              className="flex-1"
                                            />
                                            <Button size="sm" onClick={() => {
                                              updatePlanningTemplateItem(index, 'title', editingPlanningTemplate.value);
                                              setEditingPlanningTemplate(null);
                                            }}>
                                              <Check className="h-3 w-3" />
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => setEditingPlanningTemplate(null)}>
                                              <X className="h-3 w-3" />
                                            </Button>
                                          </>
                                        ) : (
                                          <>
                                            <span className="flex-1">{item.title}</span>
                                            <Button size="sm" variant="outline" onClick={() => setEditingPlanningTemplate({ id: index.toString(), field: 'title', value: item.title })}>
                                              <Edit className="h-3 w-3" />
                                            </Button>
                                          </>
                                        )}
                                      </>
                                    )}
                                    <Button size="sm" variant="destructive" onClick={() => deletePlanningTemplateItem(index)}>
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </DragDropContext>

                    <div className="flex gap-2">
                      {newPlanningTemplateItem ? (
                        <>
                          <Input
                            value={newPlanningTemplateItem.title}
                            onChange={(e) => setNewPlanningTemplateItem({ ...newPlanningTemplateItem, title: e.target.value })}
                            placeholder="Neuer Punkt..."
                            className="flex-1"
                          />
                          <Button size="sm" onClick={() => addPlanningTemplateItem(newPlanningTemplateItem.title)}>
                            <Save className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setNewPlanningTemplateItem(null)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="outline" onClick={() => setNewPlanningTemplateItem({ title: '' })}>
                            <Plus className="h-4 w-4 mr-2" />
                            Punkt hinzufügen
                          </Button>
                          <Button variant="outline" onClick={addPlanningSeparator}>
                            <Minus className="h-4 w-4 mr-2" />
                            Trenner hinzufügen
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* RSS-Quellen & News */}
        <TabsContent value="rss" className="space-y-6">
          <div>
            <h3 className="text-lg font-medium mb-4">RSS-Quellen verwalten</h3>
            <RSSSourceManager />
          </div>
          
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium mb-4">RSS-Einstellungen</h3>
            <RSSSettingsManager />
          </div>
          
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium mb-4">News E-Mail-Vorlagen</h3>
            <NewsEmailTemplateManager />
          </div>
        </TabsContent>

        {/* Archivierung */}
        <TabsContent value="archiving" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Entscheidungsarchivierung
              </CardTitle>
              <CardDescription>
                Verwalten Sie die automatische Archivierung von Entscheidungsanfragen
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DecisionArchiveSettings />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}