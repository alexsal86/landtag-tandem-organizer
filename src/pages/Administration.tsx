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
import { Trash2, Edit, Plus, Save, X, Check, GripVertical, Minus, Users, Clock, MapPin, Building } from "lucide-react";
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
import { RSSSourceManager } from "@/components/administration/RSSSourceManager";
import { RSSSettingsManager } from "@/components/administration/RSSSettingsManager";
import { CalendarSyncSettings } from "@/components/administration/CalendarSyncSettings";
import { LoginCustomization } from "@/components/administration/LoginCustomization";
import { UserColorManager } from "@/components/administration/UserColorManager";
import { DecisionArchiveSettings } from "@/components/administration/DecisionArchiveSettings";
import { MatrixSettings } from "@/components/MatrixSettings";
import { NewsEmailTemplateManager } from "@/components/administration/NewsEmailTemplateManager";
import { AuditLogViewer } from "@/components/administration/AuditLogViewer";
import { TopicSettings } from "@/components/administration/TopicSettings";
import { ConfigurableTypeSettings } from "@/components/administration/ConfigurableTypeSettings";
import { MeetingTemplateParticipantsEditor } from "@/components/meetings/MeetingTemplateParticipantsEditor";
import { AnnualTasksView } from "@/components/AnnualTasksView";
import { AdminSidebar } from "@/components/administration/AdminSidebar";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { ScrollArea } from "@/components/ui/scroll-area";

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

  // Navigation state
  const [activeSection, setActiveSection] = useState("system");
  const [activeSubSection, setActiveSubSection] = useState("general");
  const [annualTasksBadge, setAnnualTasksBadge] = useState<number>(0);

  // Template states
  const [meetingTemplates, setMeetingTemplates] = useState<any[]>([]);
  const [planningTemplates, setPlanningTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [selectedPlanningTemplate, setSelectedPlanningTemplate] = useState<any>(null);
  const [templateItems, setTemplateItems] = useState<any[]>([]);
  const [planningTemplateItems, setPlanningTemplateItems] = useState<any[]>([]);
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
      loadAnnualTasksBadge();
    }
  }, [loading, user, currentTenant]);

  const checkAdminStatus = async () => {
    if (!user) return;
    
    try {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      setIsAdmin(roleData?.role === 'abgeordneter' || roleData?.role === 'bueroleitung');
      setIsSuperAdmin(roleData?.role === 'abgeordneter');
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const loadAnnualTasksBadge = async () => {
    if (!currentTenant?.id) return;
    
    try {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      
      // Get tasks due this month or overdue
      const { data: tasks } = await supabase
        .from('annual_tasks')
        .select('id, due_month')
        .or(`tenant_id.eq.${currentTenant.id},is_system_task.eq.true`);
      
      if (!tasks) return;
      
      // Get completions for this year
      const { data: completions } = await supabase
        .from('annual_task_completions')
        .select('annual_task_id')
        .eq('year', currentYear);
      
      const completedIds = new Set(completions?.map(c => c.annual_task_id) || []);
      
      // Count pending tasks (due this month or overdue, not completed)
      const pendingCount = tasks.filter(task => {
        const isDue = task.due_month <= currentMonth;
        const isCompleted = completedIds.has(task.id);
        return isDue && !isCompleted;
      }).length;
      
      setAnnualTasksBadge(pendingCount);
    } catch (error) {
      console.error('Error loading annual tasks badge:', error);
    }
  };

  const loadData = async () => {
    if (!currentTenant?.id) return;
    
    try {
      setLoadingData(true);
      
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
        
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', userIds)
          .order('display_name');
        
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', userIds);
        
        setProfiles(profilesData || []);
        setRoles(rolesData || []);
      }
      
      const [meetingTemplatesRes, planningTemplatesRes] = await Promise.all([
        supabase.from('meeting_templates').select('*').order('name'),
        supabase.from('planning_templates').select('*').order('name')
      ]);
      
      setMeetingTemplates(meetingTemplatesRes.data || []);
      setPlanningTemplates(planningTemplatesRes.data || []);
      
    } catch (error) {
      console.error('Error loading data:', error);
      toast({ title: "Fehler", description: "Daten konnten nicht geladen werden.", variant: "destructive" });
    } finally {
      setLoadingData(false);
    }
  };

  const handleNavigate = (section: string, subSection?: string) => {
    setActiveSection(section);
    if (subSection) {
      setActiveSubSection(subSection);
    } else {
      // Set default sub-section for sections with children
      const defaults: Record<string, string> = {
        system: "general",
        appointments: "config",
        datatypes: "task-config",
        politics: "associations",
        documents: "letters",
        rss: "sources",
      };
      setActiveSubSection(defaults[section] || "");
    }
  };

  // Drag & Drop handlers
  const handleMeetingDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(templateItems);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

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
        if (!newItems[parentIndex].children) {
          newItems[parentIndex].children = [];
        }
        newItems[parentIndex].children.push({ title, order_index: newItems[parentIndex].children.length });
      } else {
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
        if (!newItems[parentIndex].sub_items) {
          newItems[parentIndex].sub_items = [];
        }
        newItems[parentIndex].sub_items.push({ title, order_index: newItems[parentIndex].sub_items.length });
      } else {
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

  // Render content based on active section
  const renderContent = () => {
    // System section
    if (activeSection === "system") {
      switch (activeSubSection) {
        case "general":
          return <GeneralSettings />;
        case "login":
          return <LoginCustomization />;
        case "status":
          return <StatusAdminSettings />;
        case "collaboration":
          return <TenantCollaboration />;
        case "expense":
          return <ExpenseManagement />;
        case "roles":
          if (!isSuperAdmin) return null;
          return (
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
          );
        case "usercolors":
          if (!isSuperAdmin) return null;
          return <UserColorManager />;
        case "matrix":
          return <MatrixSettings />;
        case "auditlogs":
          return <AuditLogViewer />;
        default:
          return <GeneralSettings />;
      }
    }

    // Topics
    if (activeSection === "topics") {
      return <TopicSettings />;
    }

    // Appointments section
    if (activeSection === "appointments") {
      switch (activeSubSection) {
        case "config":
          return (
            <div className="space-y-6">
              <ConfigurableTypeSettings
                title="Termin-Kategorien"
                tableName="appointment_categories"
                entityName="Kategorie"
                hasIcon={true}
                hasColor={true}
                defaultIcon="Calendar"
                defaultColor="#3b82f6"
                deleteWarning="Sind Sie sicher, dass Sie diese Kategorie löschen möchten?"
              />
              <ConfigurableTypeSettings
                title="Termin-Status"
                tableName="appointment_statuses"
                entityName="Status"
                hasIcon={true}
                hasColor={true}
                defaultIcon="CircleDot"
                defaultColor="#3b82f6"
                deleteWarning="Sind Sie sicher, dass Sie diesen Status löschen möchten?"
              />
              <ConfigurableTypeSettings
                title="Termin-Orte"
                tableName="appointment_locations"
                entityName="Ort"
                hasIcon={true}
                hasColor={true}
                defaultIcon="MapPin"
                defaultColor="#6366f1"
                deleteWarning="Sind Sie sicher, dass Sie diesen Ort löschen möchten?"
              />
            </div>
          );
        case "guests":
          return <DefaultGuestsAdmin />;
        case "preparation":
          return <AppointmentPreparationTemplateAdmin />;
        case "calendar-debug":
          return <CalendarSyncDebug />;
        case "calendar-sync":
          return <CalendarSyncSettings />;
        default:
          return null;
      }
    }

    // Datatypes section
    if (activeSection === "datatypes") {
      switch (activeSubSection) {
        case "task-config":
          return (
            <ConfigurableTypeSettings
              title="Aufgaben-Kategorien"
              tableName="task_categories"
              entityName="Kategorie"
              hasIcon={true}
              hasColor={true}
              defaultIcon="CheckSquare"
              defaultColor="#3b82f6"
              deleteWarning="Sind Sie sicher, dass Sie diese Kategorie löschen möchten?"
            />
          );
        case "todo-config":
          return (
            <ConfigurableTypeSettings
              title="ToDo-Kategorien"
              tableName="todo_categories"
              entityName="Kategorie"
              hasIcon={true}
              hasColor={true}
              defaultIcon="ListTodo"
              defaultColor="#10b981"
              deleteWarning="Sind Sie sicher, dass Sie diese Kategorie löschen möchten?"
            />
          );
        case "decisions":
          return <DecisionEmailTemplates />;
        case "documenttypes":
          return (
            <ConfigurableTypeSettings
              title="Dokumenten-Kategorien"
              tableName="document_categories"
              entityName="Kategorie"
              hasIcon={true}
              hasColor={true}
              defaultIcon="FileText"
              defaultColor="#6366f1"
              deleteWarning="Sind Sie sicher, dass Sie diese Kategorie löschen möchten?"
            />
          );
        case "casefiletypes":
          return (
            <ConfigurableTypeSettings
              title="FallAkten-Typen"
              tableName="case_file_types"
              entityName="Typ"
              hasIcon={true}
              hasColor={true}
              defaultIcon="Briefcase"
              defaultColor="#3b82f6"
              deleteWarning="Sind Sie sicher, dass Sie diesen Typ löschen möchten?"
            />
          );
        default:
          return null;
      }
    }

    // Politics section
    if (activeSection === "politics") {
      switch (activeSubSection) {
        case "associations":
          return <PartyAssociationsAdmin />;
        case "districts":
          return (
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
          );
        default:
          return null;
      }
    }

    // Documents section
    if (activeSection === "documents") {
      switch (activeSubSection) {
        case "letters":
          return (
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
          );
        case "meetings":
          return (
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
                <>
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
                  <CardContent className="border-t pt-4">
                    <MeetingTemplateParticipantsEditor
                      templateId={selectedTemplate.id}
                      defaultParticipants={selectedTemplate.default_participants || []}
                      defaultRecurrence={selectedTemplate.default_recurrence || null}
                      onSave={async (participants, recurrence) => {
                        try {
                          await supabase
                            .from('meeting_templates')
                            .update({
                              default_participants: participants,
                              default_recurrence: recurrence as any
                            })
                            .eq('id', selectedTemplate.id);
                          
                          setSelectedTemplate({
                            ...selectedTemplate,
                            default_participants: participants,
                            default_recurrence: recurrence
                          });
                          
                          toast({ title: "Gespeichert", description: "Template-Einstellungen aktualisiert." });
                        } catch (error) {
                          toast({ title: "Fehler", description: "Speichern fehlgeschlagen.", variant: "destructive" });
                        }
                      }}
                    />
                  </CardContent>
                </>
              )}
            </Card>
          );
        case "plannings":
          return (
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
          );
        default:
          return null;
      }
    }

    // RSS section
    if (activeSection === "rss") {
      switch (activeSubSection) {
        case "sources":
          return (
            <div>
              <h3 className="text-lg font-medium mb-4">RSS-Quellen verwalten</h3>
              <RSSSourceManager />
            </div>
          );
        case "settings":
          return (
            <div>
              <h3 className="text-lg font-medium mb-4">RSS-Einstellungen</h3>
              <RSSSettingsManager />
            </div>
          );
        case "templates":
          return (
            <div>
              <h3 className="text-lg font-medium mb-4">News E-Mail-Vorlagen</h3>
              <NewsEmailTemplateManager />
            </div>
          );
        default:
          return null;
      }
    }

    // Annual Tasks
    if (activeSection === "annual") {
      return <AnnualTasksView />;
    }

    // Archiving
    if (activeSection === "archiving") {
      return (
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
      );
    }

    return null;
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Sidebar */}
      <AdminSidebar
        activeSection={activeSection}
        activeSubSection={activeSubSection}
        onNavigate={handleNavigate}
        isSuperAdmin={isSuperAdmin}
        annualTasksBadge={annualTasksBadge}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-6">
            {renderContent()}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
