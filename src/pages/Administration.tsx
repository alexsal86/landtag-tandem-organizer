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
import { Trash2, Edit, Plus, Save, X, Check, GripVertical, Minus, Users, Clock, MapPin, Building, CalendarDays, StickyNote, MoveVertical, ArrowUp, ArrowDown, ChevronUp, ChevronDown, CornerUpLeft, ListTodo, Cake } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { SuperadminTenantManagement } from "@/components/administration/SuperadminTenantManagement";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

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
  const [activeSection, setActiveSection] = useState("security");
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
const [editingChild, setEditingChild] = useState<{ parentIndex: number; childIndex: number; value: string } | null>(null);
  const [deletingChild, setDeletingChild] = useState<{ parentIndex: number; childIndex: number; title: string } | null>(null);
  const [childPopoverOpen, setChildPopoverOpen] = useState<number | null>(null);

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
      
      // Parallel: Load tenant memberships and templates simultaneously
      const [tenantMembershipsRes, meetingTemplatesRes, planningTemplatesRes] = await Promise.all([
        supabase
          .from('user_tenant_memberships')
          .select('user_id')
          .eq('tenant_id', currentTenant.id)
          .eq('is_active', true),
        supabase.from('meeting_templates').select('*').order('name'),
        supabase.from('planning_templates').select('*').order('name')
      ]);
      
      const tenantMemberships = tenantMembershipsRes.data;
      setMeetingTemplates(meetingTemplatesRes.data || []);
      setPlanningTemplates(planningTemplatesRes.data || []);
      
      if (!tenantMemberships?.length) {
        setProfiles([]);
        setRoles([]);
      } else {
        const userIds = tenantMemberships.map(m => m.user_id);
        
        // Parallel: Load profiles and roles simultaneously
        const [profilesRes, rolesRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('user_id, display_name, avatar_url')
            .in('user_id', userIds)
            .order('display_name'),
          supabase
            .from('user_roles')
            .select('user_id, role')
            .in('user_id', userIds)
        ]);
        
        setProfiles(profilesRes.data || []);
        setRoles(rolesRes.data || []);
      }
      
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
        security: "general",
        users: "status",
        calendar: "config",
        content: "topics",
        templates: "letters",
        politics: "associations",
        automation: "rss-sources",
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
  const createNewMeetingTemplate = async () => {
    if (!user || !currentTenant) return;
    
    try {
      const newName = `Neues Template ${meetingTemplates.length + 1}`;
      const { data, error } = await supabase
        .from('meeting_templates')
        .insert({
          name: newName,
          description: '',
          template_items: [],
          default_participants: [],
          default_recurrence: null,
          auto_create_count: 3,
          is_default: false,
          user_id: user.id
        })
        .select()
        .single();
        
      if (error) throw error;
      
      setMeetingTemplates([...meetingTemplates, data]);
      loadTemplate(data);
      setEditingTemplateName({ id: data.id, value: data.name });
      
      toast({ title: "Template erstellt", description: "Neues Meeting-Template wurde angelegt." });
    } catch (error: any) {
      console.error('Error creating template:', error);
      toast({ title: "Fehler", description: "Template konnte nicht erstellt werden.", variant: "destructive" });
    }
  };

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

  const saveTemplateItems = async (items = templateItems, retryCount = 0) => {
    if (!selectedTemplate) return;
    
    try {
      const { error } = await supabase
        .from('meeting_templates')
        .update({ template_items: items })
        .eq('id', selectedTemplate.id);
        
      if (error) throw error;
      // Silent save - no toast on success
    } catch (error: any) {
      console.error('Save error:', error);
      // Extended network error detection
      const isNetworkError = 
        error.message?.includes('Failed to fetch') ||
        error.name === 'TypeError' ||
        error.message?.includes('NetworkError') ||
        error.message?.includes('network') ||
        !navigator.onLine;
        
      if (retryCount < 2 && isNetworkError) {
        // Exponential backoff
        await new Promise(r => setTimeout(r, 500 * (retryCount + 1)));
        return saveTemplateItems(items, retryCount + 1);
      }
      
      // Only show toast if all retries failed and it's not a network issue (local state is current)
      if (!isNetworkError) {
        toast({ title: "Fehler", description: "Fehler beim Speichern.", variant: "destructive" });
      }
      // For network errors: local state is already updated, changes will sync on next page load
    }
  };

  // Move child item up or down within a parent
  const moveChildItem = (parentIndex: number, childIndex: number, direction: 'up' | 'down') => {
    const newItems = [...templateItems];
    const children = [...(newItems[parentIndex].children || [])];
    
    if (direction === 'up' && childIndex > 0) {
      [children[childIndex - 1], children[childIndex]] = [children[childIndex], children[childIndex - 1]];
    } else if (direction === 'down' && childIndex < children.length - 1) {
      [children[childIndex], children[childIndex + 1]] = [children[childIndex + 1], children[childIndex]];
    } else {
      return;
    }
    
    // Re-index
    newItems[parentIndex].children = children.map((c, i) => ({ ...c, order_index: i }));
    setTemplateItems(newItems);
    saveTemplateItems(newItems);
  };

  // Update child item title
  const updateChildItem = (parentIndex: number, childIndex: number, newTitle: string) => {
    const newItems = [...templateItems];
    if (newItems[parentIndex].children && newItems[parentIndex].children[childIndex]) {
      newItems[parentIndex].children[childIndex].title = newTitle;
      setTemplateItems(newItems);
      saveTemplateItems(newItems);
    }
  };

  // Delete child item permanently (after confirmation)
  const confirmDeleteChild = (parentIndex: number, childIndex: number) => {
    const newItems = [...templateItems];
    newItems[parentIndex].children = newItems[parentIndex].children.filter((_: any, i: number) => i !== childIndex);
    if (newItems[parentIndex].children.length === 0) {
      delete newItems[parentIndex].children;
    }
    setTemplateItems(newItems);
    saveTemplateItems(newItems);
    setDeletingChild(null);
  };

  // Make child available (move to pool)
  const makeChildAvailable = (parentIndex: number, childIndex: number) => {
    const newItems = [...templateItems];
    if (newItems[parentIndex].children?.[childIndex]) {
      newItems[parentIndex].children[childIndex].is_available = true;
      setTemplateItems(newItems);
      saveTemplateItems(newItems);
    }
  };

  // Activate child from pool (make visible in agenda)
  const activateChild = (parentIndex: number, childIndex: number) => {
    const newItems = [...templateItems];
    if (newItems[parentIndex].children?.[childIndex]) {
      newItems[parentIndex].children[childIndex].is_available = false;
      setTemplateItems(newItems);
      saveTemplateItems(newItems);
      setChildPopoverOpen(null);
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

  // Helper function to get title for system types
  const getTitleForSystemType = (systemType: string) => {
    switch (systemType) {
      case 'upcoming_appointments': return 'Kommende Termine';
      case 'quick_notes': return 'Meine Notizen';
      case 'tasks': return 'Aufgaben';
      case 'birthdays': return 'Geburtstage';
      default: return systemType;
    }
  };

  const addSystemTemplateItem = (systemType: 'upcoming_appointments' | 'quick_notes' | 'tasks' | 'birthdays', parentIndex?: number) => {
    if (!selectedTemplate) return;
    
    // Check if this system type already exists in main items OR in children
    const existsInMain = templateItems.find(item => item.system_type === systemType);
    const existsInChildren = templateItems.some(item => 
      item.children?.some((child: any) => child.system_type === systemType)
    );
    
    if (existsInMain || existsInChildren) {
      toast({ 
        title: "Bereits vorhanden", 
        description: `"${getTitleForSystemType(systemType)}" ist bereits in der Agenda.`,
        variant: "destructive" 
      });
      return;
    }

    const title = getTitleForSystemType(systemType);
    const newItems = [...templateItems];
    
    if (parentIndex !== undefined) {
      // Add as child of an existing item
      if (!newItems[parentIndex].children) {
        newItems[parentIndex].children = [];
      }
      newItems[parentIndex].children.push({ 
        title, 
        type: 'system',
        system_type: systemType,
        order_index: newItems[parentIndex].children.length 
      });
    } else {
      newItems.push({ 
        title, 
        type: 'system',
        system_type: systemType,
        order_index: newItems.length 
      });
    }
    
    setTemplateItems(newItems);
    saveTemplateItems(newItems);
  };

  // Move system item between main level and child level
  const moveSystemItem = (
    fromMain: boolean,
    fromIndex: number,
    fromChildIndex: number | null,
    toParentIndex: number | null // null = move to main level
  ) => {
    const newItems = [...templateItems];
    let movedItem: any;

    // Remove from current position
    if (fromMain && fromChildIndex === null) {
      // Remove from main level
      [movedItem] = newItems.splice(fromIndex, 1);
    } else if (!fromMain && fromChildIndex !== null) {
      // Remove from children
      movedItem = newItems[fromIndex].children.splice(fromChildIndex, 1)[0];
      // Clean up empty children array
      if (newItems[fromIndex].children.length === 0) {
        delete newItems[fromIndex].children;
      }
    } else {
      return;
    }

    // Add to new position
    if (toParentIndex !== null) {
      // Add as child
      if (!newItems[toParentIndex].children) {
        newItems[toParentIndex].children = [];
      }
      movedItem.order_index = newItems[toParentIndex].children.length;
      newItems[toParentIndex].children.push(movedItem);
    } else {
      // Add to main level
      movedItem.order_index = newItems.length;
      newItems.push(movedItem);
    }

    // Re-index all items
    const reindexedItems = newItems.map((item, idx) => ({
      ...item,
      order_index: idx,
      children: item.children?.map((child: any, childIdx: number) => ({
        ...child,
        order_index: childIdx
      }))
    }));

    setTemplateItems(reindexedItems);
    saveTemplateItems(reindexedItems);
    toast({ title: "Verschoben", description: "Element wurde erfolgreich verschoben." });
  };

  // Toggle is_optional flag for template children
  const toggleChildOptional = (parentIndex: number, childIndex: number) => {
    const newItems = [...templateItems];
    if (newItems[parentIndex].children && newItems[parentIndex].children[childIndex]) {
      newItems[parentIndex].children[childIndex].is_optional = !newItems[parentIndex].children[childIndex].is_optional;
      setTemplateItems(newItems);
      saveTemplateItems(newItems);
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
    // SECTION 1: System & Sicherheit
    if (activeSection === "security") {
      switch (activeSubSection) {
        case "general":
          return <GeneralSettings />;
        case "login":
          return <LoginCustomization />;
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
                        <TableHead className="w-16"></TableHead>
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
                          <TableCell>
                            {p.user_id !== user?.id && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Benutzer löschen?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {p.display_name} wird unwiderruflich aus dem System entfernt.
                                      Alle zugehörigen Daten (Zeiteinträge, Nachrichten, etc.) werden gelöscht.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                    <AlertDialogAction 
                                      className="bg-destructive text-destructive-foreground"
                                      onClick={async () => {
                                        try {
                                          const { data, error } = await supabase.functions.invoke('manage-tenant-user', {
                                            body: {
                                              action: 'deleteUser',
                                              userId: p.user_id,
                                              tenantId: currentTenant?.id
                                            }
                                          });
                                          if (error || !data?.success) {
                                            throw new Error(data?.error || 'Löschen fehlgeschlagen');
                                          }
                                          toast({ title: "Benutzer gelöscht" });
                                          loadData();
                                        } catch (err: any) {
                                          toast({ title: "Fehler", description: err.message, variant: "destructive" });
                                        }
                                      }}
                                    >
                                      Unwiderruflich löschen
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          );
        case "tenants":
          // Only for system superadmin (mail@alexander-salomon.de)
          if (user?.email !== "mail@alexander-salomon.de") {
            return (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  Nur für System-Administratoren zugänglich.
                </CardContent>
              </Card>
            );
          }
          return <SuperadminTenantManagement />;
        case "auditlogs":
          return <AuditLogViewer />;
        case "archiving":
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
        case "expense":
          return <ExpenseManagement />;
        default:
          return <GeneralSettings />;
      }
    }

    // SECTION 2: Benutzer & Kommunikation
    if (activeSection === "users") {
      switch (activeSubSection) {
        case "status":
          return <StatusAdminSettings />;
        case "usercolors":
          if (!isSuperAdmin) return null;
          return <UserColorManager />;
        case "collaboration":
          return <TenantCollaboration />;
        case "matrix":
          return <MatrixSettings />;
        default:
          return <StatusAdminSettings />;
      }
    }

    // SECTION 3: Kalender & Termine
    if (activeSection === "calendar") {
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
        case "sync":
          return <CalendarSyncSettings />;
        case "debug":
          return <CalendarSyncDebug />;
        default:
          return null;
      }
    }

    // SECTION 4: Inhalte & Daten
    if (activeSection === "content") {
      switch (activeSubSection) {
        case "topics":
          return <TopicSettings />;
        case "tasks":
          return (
            <div className="space-y-6">
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
              <ConfigurableTypeSettings
                title="Aufgaben-Status"
                tableName="task_statuses"
                entityName="Status"
                hasIcon={false}
                hasColor={false}
                deleteWarning="Sind Sie sicher, dass Sie diesen Status löschen möchten?"
              />
            </div>
          );
        case "todos":
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
        case "documents":
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
        case "casefiles":
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
          return <TopicSettings />;
      }
    }

    // SECTION 5: Vorlagen
    if (activeSection === "templates") {
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
            <>
              {/* Delete confirmation dialog for child items */}
              <AlertDialog open={!!deletingChild} onOpenChange={(open) => !open && setDeletingChild(null)}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Unterpunkt löschen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Möchten Sie den Unterpunkt "{deletingChild?.title}" wirklich permanent löschen?
                      Dieser Vorgang kann nicht rückgängig gemacht werden.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction 
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => {
                        if (deletingChild) {
                          confirmDeleteChild(deletingChild.parentIndex, deletingChild.childIndex);
                        }
                      }}
                    >
                      Löschen
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Meeting Templates</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Side-by-side layout: Sidebar | Agenda */}
                  <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
                    
                    {/* LEFT SIDEBAR */}
                    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                      {/* Template Selection */}
                      <div>
                        <label className="text-xs text-muted-foreground mb-2 block">Template auswählen</label>
                        <Select 
                          value={selectedTemplate?.id || ""}
                          onValueChange={(value) => {
                            if (value === "__new__") {
                              createNewMeetingTemplate();
                            } else {
                              const template = meetingTemplates.find(t => t.id === value);
                              if (template) loadTemplate(template);
                            }
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Template auswählen" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__new__" className="text-primary font-medium">
                              <span className="flex items-center gap-2">
                                <Plus className="h-4 w-4" />
                                Neues Template erstellen
                              </span>
                            </SelectItem>
                            {meetingTemplates.length > 0 && <Separator className="my-1" />}
                            {meetingTemplates.map(template => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.name}
                                {template.is_default && " ⭐"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedTemplate && (
                        <>
                          <div className="border-t pt-4">
                            <label className="text-xs text-muted-foreground mb-2 block">Template-Name</label>
                            <div className="flex items-center gap-2">
                              {editingTemplateName?.id === selectedTemplate.id ? (
                                <>
                                  <Input
                                    value={editingTemplateName.value}
                                    onChange={(e) => setEditingTemplateName({ ...editingTemplateName, value: e.target.value })}
                                    className="flex-1 h-8 text-sm"
                                  />
                                  <Button size="sm" className="h-8 w-8 p-0" onClick={async () => {
                                    try {
                                      const { error } = await supabase
                                        .from('meeting_templates')
                                        .update({ name: editingTemplateName.value })
                                        .eq('id', selectedTemplate.id);
                                      if (error) throw error;
                                      
                                      // Update local state first (before loadData to avoid losing selection)
                                      setSelectedTemplate({
                                        ...selectedTemplate,
                                        name: editingTemplateName.value
                                      });
                                      
                                      await loadData();
                                      setEditingTemplateName(null);
                                      toast({ title: "Gespeichert", description: "Template-Name aktualisiert." });
                                    } catch (error: any) {
                                      toast({ title: "Fehler", description: "Fehler beim Speichern.", variant: "destructive" });
                                    }
                                  }}>
                                    <Check className="h-3 w-3" />
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setEditingTemplateName(null)}>
                                    <X className="h-3 w-3" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <span className="text-sm font-medium flex-1 truncate">{selectedTemplate.name}</span>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingTemplateName({ id: selectedTemplate.id, value: selectedTemplate.name })}>
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Participants & Recurrence in sidebar */}
                          <div className="border-t pt-4">
                            <MeetingTemplateParticipantsEditor
                              templateId={selectedTemplate.id}
                              defaultParticipants={selectedTemplate.default_participants || []}
                              defaultRecurrence={selectedTemplate.default_recurrence || null}
                              autoCreateCount={selectedTemplate.auto_create_count || 3}
                              compact
                              onSave={async (participants, recurrence, autoCreateCount, visibility) => {
                                try {
                                  await supabase
                                    .from('meeting_templates')
                                    .update({
                                      default_participants: participants as any,
                                      default_recurrence: recurrence as any,
                                      auto_create_count: autoCreateCount || 3,
                                      default_visibility: visibility || 'private'
                                    })
                                    .eq('id', selectedTemplate.id);
                                  
                                  setSelectedTemplate({
                                    ...selectedTemplate,
                                    default_participants: participants,
                                    default_recurrence: recurrence,
                                    auto_create_count: autoCreateCount,
                                    default_visibility: visibility
                                  });
                                } catch (error) {
                                  toast({ title: "Fehler", description: "Speichern fehlgeschlagen.", variant: "destructive" });
                                }
                              }}
                            />
                          </div>
                        </>
                      )}
                    </div>

                    {/* RIGHT SIDE: AGENDA */}
                    <div className="space-y-4">
                      {selectedTemplate ? (
                        <>
                          <h3 className="text-lg font-semibold">Tagesordnung</h3>
                          
                          <DragDropContext onDragEnd={handleMeetingDragEnd}>
                      <Droppable droppableId="template-items">
                        {(provided) => (
                          <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                            {templateItems.map((item, index) => (
                              <Draggable key={index} draggableId={index.toString()} index={index}>
                                {(provided) => (
                                  <div 
                                    ref={provided.innerRef} 
                                    {...provided.draggableProps} 
                                    className="space-y-1"
                                  >
                                    <div className={`flex items-center gap-2 p-2 bg-card rounded border ${
                                      item.type === 'system' 
                                        ? item.system_type === 'upcoming_appointments' 
                                          ? 'border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20' 
                                          : item.system_type === 'quick_notes'
                                          ? 'border-l-4 border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20'
                                          : item.system_type === 'tasks'
                                          ? 'border-l-4 border-l-green-500 bg-green-50/50 dark:bg-green-950/20'
                                          : item.system_type === 'birthdays'
                                          ? 'border-l-4 border-l-pink-500 bg-pink-50/50 dark:bg-pink-950/20'
                                          : ''
                                        : ''
                                    }`}>
                                      <div {...provided.dragHandleProps} className="cursor-grab">
                                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                                      </div>
                                      {item.type === 'separator' ? (
                                        <div className="flex-1 h-px bg-border" />
                                      ) : item.type === 'system' ? (
                                        <div className="flex items-center gap-2 flex-1">
                                          {item.system_type === 'upcoming_appointments' ? (
                                            <CalendarDays className="h-4 w-4 text-blue-600" />
                                          ) : item.system_type === 'quick_notes' ? (
                                            <StickyNote className="h-4 w-4 text-amber-600" />
                                          ) : item.system_type === 'tasks' ? (
                                            <ListTodo className="h-4 w-4 text-green-600" />
                                          ) : item.system_type === 'birthdays' ? (
                                            <Cake className="h-4 w-4 text-pink-600" />
                                          ) : null}
                                          <span className="font-medium">{item.title}</span>
                                          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                            Dynamisch
                                          </span>
                                          {/* Move menu for system items on main level */}
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                                                <MoveVertical className="h-3 w-3" />
                                              </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                              <DropdownMenuSub>
                                                <DropdownMenuSubTrigger>
                                                  <ArrowDown className="h-3 w-3 mr-2" />
                                                  Als Unterpunkt verschieben
                                                </DropdownMenuSubTrigger>
                                                <DropdownMenuPortal>
                                                  <DropdownMenuSubContent>
                                                    {templateItems
                                                      .filter((parentItem, parentIdx) => parentIdx !== index && parentItem.type !== 'separator' && parentItem.type !== 'system')
                                                      .map((parentItem, filteredIdx) => {
                                                        const originalIdx = templateItems.findIndex(i => i === parentItem);
                                                        return (
                                                          <DropdownMenuItem 
                                                            key={originalIdx}
                                                            onClick={() => moveSystemItem(true, index, null, originalIdx)}
                                                          >
                                                            {parentItem.title}
                                                          </DropdownMenuItem>
                                                        );
                                                      })
                                                    }
                                                  </DropdownMenuSubContent>
                                                </DropdownMenuPortal>
                                              </DropdownMenuSub>
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        </div>
                                      ) : (
                                        <>
                                          {editingTemplate?.id === index.toString() && editingTemplate.field === 'title' ? (
                                            <div className="flex items-center gap-2 flex-1">
                                              <Input
                                                value={editingTemplate.value}
                                                onChange={(e) => setEditingTemplate({ ...editingTemplate, value: e.target.value })}
                                                className="flex-1"
                                                autoFocus
                                              />
                                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => {
                                                updateTemplateItem(index, 'title', editingTemplate.value);
                                                setEditingTemplate(null);
                                              }}>
                                                <Check className="h-3 w-3" />
                                              </Button>
                                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditingTemplate(null)}>
                                                <X className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          ) : (
                                            <div className="flex items-center gap-1 flex-1">
                                              <span>{item.title}</span>
                                              <Button 
                                                size="sm" 
                                                variant="ghost" 
                                                className="h-5 w-5 p-0 opacity-60 hover:opacity-100"
                                                onClick={() => setEditingTemplate({ id: index.toString(), field: 'title', value: item.title })}
                                              >
                                                <Edit className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          )}
                                        </>
                                      )}
                                      {/* Add children via Popover - only add options, no existing children list */}
                                      {item.type !== 'separator' && item.type !== 'system' && (
                                        <Popover open={childPopoverOpen === index} onOpenChange={(open) => setChildPopoverOpen(open ? index : null)}>
                                          <PopoverTrigger asChild>
                                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                                              <Plus className="h-3 w-3" />
                                            </Button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-72">
                                            <div className="space-y-3">
                                              {/* Add new sub-item */}
                                              <div>
                                                <p className="text-sm font-medium mb-2">Unterpunkt hinzufügen</p>
                                                <div className="flex gap-2">
                                                  <Input 
                                                    placeholder="Neuer Unterpunkt..." 
                                                    className="flex-1 text-sm h-8"
                                                    onKeyDown={(e) => {
                                                      if (e.key === 'Enter' && (e.target as HTMLInputElement).value) {
                                                        addTemplateItem((e.target as HTMLInputElement).value, index);
                                                        (e.target as HTMLInputElement).value = '';
                                                        setChildPopoverOpen(null);
                                                      }
                                                    }}
                                                  />
                                                  <Button 
                                                    size="sm"
                                                    className="h-8"
                                                    onClick={(e) => {
                                                      const input = (e.target as HTMLElement).closest('.flex')?.querySelector('input') as HTMLInputElement;
                                                      if (input?.value) {
                                                        addTemplateItem(input.value, index);
                                                        input.value = '';
                                                        setChildPopoverOpen(null);
                                                      }
                                                    }}
                                                  >
                                                    <Plus className="h-3 w-3" />
                                                  </Button>
                                                </div>
                                              </div>

                                              {/* Available sub-items (pool) */}
                                              {(() => {
                                                const availableChildren = item.children?.filter((c: any) => c.is_available === true) || [];
                                                if (availableChildren.length === 0) return null;
                                                return (
                                                  <div className="border-t pt-2">
                                                    <p className="text-xs text-muted-foreground mb-2">Verfügbare Unterpunkte:</p>
                                                    <div className="space-y-1 max-h-32 overflow-y-auto">
                                                      {item.children?.map((child: any, childIdx: number) => {
                                                        if (!child.is_available) return null;
                                                        return (
                                                          <Button 
                                                            key={childIdx}
                                                            variant="ghost" 
                                                            size="sm"
                                                            className="w-full justify-between text-sm h-8 px-2"
                                                            onClick={() => activateChild(index, childIdx)}
                                                          >
                                                          <span className="flex items-center gap-1.5 truncate">
                                                              {child.system_type === 'upcoming_appointments' && (
                                                                <CalendarDays className="h-3 w-3 text-blue-600 shrink-0" />
                                                              )}
                                                              {child.system_type === 'quick_notes' && (
                                                                <StickyNote className="h-3 w-3 text-amber-600 shrink-0" />
                                                              )}
                                                              {child.system_type === 'tasks' && (
                                                                <ListTodo className="h-3 w-3 text-green-600 shrink-0" />
                                                              )}
                                                              {child.system_type === 'birthdays' && (
                                                                <Cake className="h-3 w-3 text-pink-600 shrink-0" />
                                                              )}
                                                              {child.title}
                                                            </span>
                                                            <CornerUpLeft className="h-3 w-3 text-muted-foreground shrink-0" />
                                                          </Button>
                                                        );
                                                      })}
                                                    </div>
                                                  </div>
                                                );
                                              })()}

                                              {/* Dynamic content buttons */}
                                              <div className="border-t pt-2">
                                                <p className="text-xs text-muted-foreground mb-2">Dynamische Inhalte:</p>
                                                <div className="flex flex-wrap gap-1">
                                                  <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    className="flex-1 justify-start border-blue-200 text-blue-700 h-7 text-xs"
                                                    onClick={() => {
                                                      addSystemTemplateItem('upcoming_appointments', index);
                                                      setChildPopoverOpen(null);
                                                    }}
                                                  >
                                                    <CalendarDays className="h-3 w-3 mr-1" />
                                                    Termine
                                                  </Button>
                                                  <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    className="flex-1 justify-start border-amber-200 text-amber-700 h-7 text-xs"
                                                    onClick={() => {
                                                      addSystemTemplateItem('quick_notes', index);
                                                      setChildPopoverOpen(null);
                                                    }}
                                                  >
                                                    <StickyNote className="h-3 w-3 mr-1" />
                                                    Notizen
                                                  </Button>
                                                  <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    className="flex-1 justify-start border-green-200 text-green-700 h-7 text-xs"
                                                    onClick={() => {
                                                      addSystemTemplateItem('tasks', index);
                                                      setChildPopoverOpen(null);
                                                    }}
                                                  >
                                                    <ListTodo className="h-3 w-3 mr-1" />
                                                    Aufgaben
                                                  </Button>
                                                </div>
                                              </div>
                                            </div>
                                          </PopoverContent>
                                        </Popover>
                                      )}
                                      <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                        onClick={() => deleteTemplateItem(index)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  
                                    {/* Children displayed below main item in agenda - only active ones (is_available !== true) */}
                                    {item.children && item.children.filter((c: any) => c.is_available !== true).length > 0 && (
                                      <div className="ml-8 mt-1 space-y-1">
                                        {item.children.map((child: any, childIndex: number) => {
                                          // Skip available (pooled) children
                                          if (child.is_available === true) return null;
                                          
                                          // Calculate the display index for active children only (for up/down button logic)
                                          const activeChildren = item.children.filter((c: any) => c.is_available !== true);
                                          const activeDisplayIndex = activeChildren.findIndex((c: any) => c === child);
                                          
                                          return (
                                            <div 
                                              key={childIndex}
                                              className={`flex items-center gap-2 p-2 rounded-md border ${
                                                child.system_type
                                                  ? child.system_type === 'upcoming_appointments'
                                                    ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800'
                                                    : child.system_type === 'tasks'
                                                    ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800'
                                                    : child.system_type === 'birthdays'
                                                    ? 'bg-pink-50 border-pink-200 dark:bg-pink-950/30 dark:border-pink-800'
                                                    : 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
                                                  : 'bg-muted/30 border-border'
                                              }`}
                                            >
                                              {/* Up/Down arrows */}
                                              <div className="flex flex-col gap-0.5">
                                                <Button 
                                                  size="sm" 
                                                  variant="ghost" 
                                                  className="h-4 w-4 p-0"
                                                  disabled={activeDisplayIndex === 0}
                                                  onClick={() => moveChildItem(index, childIndex, 'up')}
                                                >
                                                  <ChevronUp className="h-3 w-3" />
                                                </Button>
                                                <Button 
                                                  size="sm" 
                                                  variant="ghost" 
                                                  className="h-4 w-4 p-0"
                                                  disabled={activeDisplayIndex === activeChildren.length - 1}
                                                  onClick={() => moveChildItem(index, childIndex, 'down')}
                                                >
                                                  <ChevronDown className="h-3 w-3" />
                                                </Button>
                                              </div>

                                              {/* Child content with inline editing */}
                                              {editingChild?.parentIndex === index && editingChild?.childIndex === childIndex ? (
                                                <div className="flex items-center gap-1 flex-1">
                                                  <Input
                                                    value={editingChild.value}
                                                    onChange={(e) => setEditingChild({ ...editingChild, value: e.target.value })}
                                                    className="h-6 text-xs flex-1"
                                                    autoFocus
                                                    onKeyDown={(e) => {
                                                      if (e.key === 'Enter') {
                                                        updateChildItem(index, childIndex, editingChild.value);
                                                        setEditingChild(null);
                                                      } else if (e.key === 'Escape') {
                                                        setEditingChild(null);
                                                      }
                                                    }}
                                                  />
                                                  <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => {
                                                    updateChildItem(index, childIndex, editingChild.value);
                                                    setEditingChild(null);
                                                  }}>
                                                    <Check className="h-3 w-3" />
                                                  </Button>
                                                  <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => setEditingChild(null)}>
                                                    <X className="h-3 w-3" />
                                                  </Button>
                                                </div>
                                              ) : (
                                                <div className="flex items-center gap-1 flex-1 min-w-0">
                                                  {child.system_type ? (
                                                    <>
                                                      {child.system_type === 'upcoming_appointments' ? (
                                                        <CalendarDays className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                                                      ) : child.system_type === 'tasks' ? (
                                                        <ListTodo className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                                      ) : child.system_type === 'birthdays' ? (
                                                        <Cake className="h-3.5 w-3.5 text-pink-600 shrink-0" />
                                                      ) : (
                                                        <StickyNote className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                                                      )}
                                                      <span className="text-sm">{child.title}</span>
                                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                                                        Dynamisch
                                                      </span>
                                                    </>
                                                  ) : (
                                                    <>
                                                      <span className="text-sm">{child.title}</span>
                                                      <Button 
                                                        size="sm" 
                                                        variant="ghost" 
                                                        className="h-5 w-5 p-0 opacity-60 hover:opacity-100 shrink-0"
                                                        onClick={() => setEditingChild({ parentIndex: index, childIndex, value: child.title })}
                                                      >
                                                        <Edit className="h-3 w-3" />
                                                      </Button>
                                                    </>
                                                  )}
                                                </div>
                                              )}

                                              {/* Make available button (move to pool) */}
                                              <Button 
                                                size="sm" 
                                                variant="ghost" 
                                                className="h-5 w-5 p-0 text-muted-foreground hover:text-primary shrink-0"
                                                onClick={() => makeChildAvailable(index, childIndex)}
                                                title="In 'Verfügbar' verschieben"
                                              >
                                                <CornerUpLeft className="h-3 w-3" />
                                              </Button>

                                              {/* Delete button - opens confirmation dialog */}
                                              <Button 
                                                size="sm" 
                                                variant="ghost" 
                                                className="h-5 w-5 p-0 text-destructive shrink-0"
                                                onClick={() => setDeletingChild({ parentIndex: index, childIndex, title: child.title })}
                                                title="Permanent löschen"
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </DragDropContext>

                          <div className="flex flex-wrap gap-2 pt-4 border-t">
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
                                <Button variant="outline" size="sm" onClick={() => setNewTemplateItem({ title: '' })}>
                                  <Plus className="h-4 w-4 mr-2" />
                                  Punkt hinzufügen
                                </Button>
                                <Button variant="outline" size="sm" onClick={addSeparator}>
                                  <Minus className="h-4 w-4 mr-2" />
                                  Trenner
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950"
                                  onClick={() => addSystemTemplateItem('upcoming_appointments')}
                                >
                                  <CalendarDays className="h-4 w-4 mr-2" />
                                  Termine
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950"
                                  onClick={() => addSystemTemplateItem('quick_notes')}
                                >
                                  <StickyNote className="h-4 w-4 mr-2" />
                                  Notizen
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-950"
                                  onClick={() => addSystemTemplateItem('tasks')}
                                >
                                  <ListTodo className="h-4 w-4 mr-2" />
                                  Aufgaben
                                </Button>
                              </>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-center h-64 text-muted-foreground">
                          <div className="text-center">
                            <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>Wählen Sie links ein Template aus</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
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
        case "emails":
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

    // SECTION 6: Politik & Organisation
    if (activeSection === "politics") {
      switch (activeSubSection) {
        case "associations":
          return <PartyAssociationsAdmin />;
        case "districts":
          return (
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
          );
        case "mapping":
          return (
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
          );
        default:
          return <PartyAssociationsAdmin />;
      }
    }

    // SECTION 7: Automatisierung
    if (activeSection === "automation") {
      switch (activeSubSection) {
        case "rss-sources":
          return (
            <div>
              <h3 className="text-lg font-medium mb-4">RSS-Quellen verwalten</h3>
              <RSSSourceManager />
            </div>
          );
        case "rss-settings":
          return (
            <div>
              <h3 className="text-lg font-medium mb-4">RSS-Einstellungen</h3>
              <RSSSettingsManager />
            </div>
          );
        case "annual":
          return <AnnualTasksView />;
        default:
          return null;
      }
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
