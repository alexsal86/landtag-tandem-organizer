import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GeneralSettings } from "@/components/GeneralSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Edit, Plus, Save, X, Check, Copy, GripVertical, Minus } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
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
  const [taskCategories, setTaskCategories] = useState<ConfigItem[]>([]);
  const [taskStatuses, setTaskStatuses] = useState<ConfigItem[]>([]);

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
    if (!loading && user) {
      checkAdminStatus();
      loadData();
    }
  }, [loading, user]);

  const checkAdminStatus = async () => {
    if (!user) return;
    
    try {
      const { data: adminCheck } = await supabase.rpc('is_admin', { _user_id: user.id });
      setIsAdmin(!!adminCheck);
      
      // Check for super admin (abgeordneter role)
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      setIsSuperAdmin(roleData?.role === 'abgeordneter');
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoadingData(true);
      
      // Load profiles
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .order('display_name');
      
      // Load roles
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role');
      
      // Load configuration items
      const [categoriesRes, statusesRes, taskCatRes, taskStatRes, meetingTemplatesRes, planningTemplatesRes] = await Promise.all([
        supabase.from('appointment_categories').select('*').order('order_index'),
        supabase.from('appointment_statuses').select('*').order('order_index'),
        supabase.from('task_categories').select('*').order('order_index'),
        supabase.from('task_statuses').select('*').order('order_index'),
        supabase.from('meeting_templates').select('*').order('name'),
        supabase.from('planning_templates').select('*').order('name')
      ]);
      
      setProfiles(profilesData || []);
      setRoles(rolesData || []);
      setAppointmentCategories(categoriesRes.data || []);
      setAppointmentStatuses(statusesRes.data || []);
      setTaskCategories(taskCatRes.data || []);
      setTaskStatuses(taskStatRes.data || []);
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

  const deleteTemplateItem = (index: number, subIndex?: number) => {
    const newItems = [...templateItems];
    if (subIndex !== undefined) {
      newItems[index].children.splice(subIndex, 1);
    } else {
      newItems.splice(index, 1);
    }
    setTemplateItems(newItems);
    saveTemplateItems(newItems);
  };

  const deletePlanningTemplateItem = (index: number, subIndex?: number) => {
    const newItems = [...planningTemplateItems];
    if (subIndex !== undefined) {
      newItems[index].sub_items.splice(subIndex, 1);
    } else {
      newItems.splice(index, 1);
    }
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

  return (
    <main className="container mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Administration</h1>
        <p className="text-muted-foreground">Systemkonfiguration und Benutzerverwaltung</p>
      </header>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="general">Allgemein</TabsTrigger>
          <TabsTrigger value="appointments">Termine</TabsTrigger>
          <TabsTrigger value="tasks">Aufgaben</TabsTrigger>
          <TabsTrigger value="meetings">Meetings</TabsTrigger>
          <TabsTrigger value="plannings">Planungen</TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="roles">Rechte</TabsTrigger>}
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <GeneralSettings />
        </TabsContent>

        <TabsContent value="meetings" className="space-y-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Meeting Templates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {meetingTemplates.map((template) => (
                    <Button
                      key={template.id}
                      variant={selectedTemplate?.id === template.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => loadTemplate(template)}
                    >
                      {template.name}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>
                    {selectedTemplate ? `${selectedTemplate.name} - Agenda-Punkte` : 'Kein Template ausgewählt'}
                  </CardTitle>
                  {selectedTemplate && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={addSeparator}
                      >
                        <Minus className="h-4 w-4 mr-1" />
                        Trenner hinzufügen
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedTemplate ? (
                  <DragDropContext onDragEnd={handleMeetingDragEnd}>
                    <Droppable droppableId="meeting-items">
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                          {templateItems.map((item, index) => (
                            <Draggable key={`item-${index}`} draggableId={`item-${index}`} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={`border rounded-lg p-4 space-y-3 ${snapshot.isDragging ? 'bg-accent' : ''}`}
                                >
                                  {item.type === 'separator' ? (
                                    <div className="flex items-center gap-2">
                                      <div {...provided.dragHandleProps}>
                                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                                      </div>
                                      <div className="flex-1 flex items-center gap-2">
                                        <Minus className="h-4 w-4 text-muted-foreground" />
                                        <div className="flex-1 border-t border-dashed"></div>
                                        <span className="text-muted-foreground italic text-sm">{item.title || 'Trenner'}</span>
                                        <div className="flex-1 border-t border-dashed"></div>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => setEditingTemplate({ id: `${index}`, field: 'title', value: item.title || '' })}
                                        >
                                          <Edit className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          onClick={() => deleteTemplateItem(index)}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <div {...provided.dragHandleProps}>
                                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                                      </div>
                                      <span className="font-medium flex-1">{item.title}</span>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setEditingTemplate({ id: `${index}`, field: 'title', value: item.title })}
                                      >
                                        <Edit className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => deleteTemplateItem(index)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                          
                          {/* Add new item */}
                          {newTemplateItem && newTemplateItem.parentIndex === undefined ? (
                            <div className="flex gap-2">
                              <Input
                                value={newTemplateItem.title}
                                onChange={(e) => setNewTemplateItem({ ...newTemplateItem, title: e.target.value })}
                                placeholder="Punkt eingeben (--- für Trenner)..."
                                className="flex-1"
                              />
                              <Button 
                                size="sm" 
                                onClick={() => addTemplateItem(newTemplateItem.title)}
                                disabled={!newTemplateItem.title.trim()}
                              >
                                <Save className="h-3 w-3" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => setNewTemplateItem(null)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              className="w-full"
                              onClick={() => setNewTemplateItem({ title: '' })}
                              disabled={!!editingTemplate || !!newTemplateItem}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Punkt hinzufügen
                            </Button>
                          )}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                ) : (
                  <p className="text-muted-foreground">Wählen Sie ein Template aus, um die Agenda-Punkte zu bearbeiten.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="plannings" className="space-y-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Planungs-Templates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {planningTemplates.map((template) => (
                    <Button
                      key={template.id}
                      variant={selectedPlanningTemplate?.id === template.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => loadPlanningTemplate(template)}
                    >
                      {template.name}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>
                    {selectedPlanningTemplate ? `${selectedPlanningTemplate.name} - Checklisten-Punkte` : 'Kein Template ausgewählt'}
                  </CardTitle>
                  {selectedPlanningTemplate && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={addPlanningSeparator}
                      >
                        <Minus className="h-4 w-4 mr-1" />
                        Trenner hinzufügen
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedPlanningTemplate ? (
                  <DragDropContext onDragEnd={handlePlanningDragEnd}>
                    <Droppable droppableId="planning-items">
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                          {planningTemplateItems.map((item, index) => (
                            <Draggable key={`item-${index}`} draggableId={`item-${index}`} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={`border rounded-lg p-4 space-y-3 ${snapshot.isDragging ? 'bg-accent' : ''}`}
                                >
                                  {item.type === 'separator' ? (
                                    <div className="flex items-center gap-2">
                                      <div {...provided.dragHandleProps}>
                                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                                      </div>
                                      <div className="flex-1 flex items-center gap-2">
                                        <Minus className="h-4 w-4 text-muted-foreground" />
                                        <div className="flex-1 border-t border-dashed"></div>
                                        <span className="text-muted-foreground italic text-sm">{item.title || 'Trenner'}</span>
                                        <div className="flex-1 border-t border-dashed"></div>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => setEditingPlanningTemplate({ id: `${index}`, field: 'title', value: item.title || '' })}
                                        >
                                          <Edit className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          onClick={() => deletePlanningTemplateItem(index)}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <div {...provided.dragHandleProps}>
                                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                                      </div>
                                      <span className="font-medium flex-1">{item.title}</span>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setEditingPlanningTemplate({ id: `${index}`, field: 'title', value: item.title })}
                                      >
                                        <Edit className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => deletePlanningTemplateItem(index)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                          
                          {/* Add new item */}
                          {newPlanningTemplateItem && newPlanningTemplateItem.parentIndex === undefined ? (
                            <div className="flex gap-2">
                              <Input
                                value={newPlanningTemplateItem.title}
                                onChange={(e) => setNewPlanningTemplateItem({ ...newPlanningTemplateItem, title: e.target.value })}
                                placeholder="Punkt eingeben (--- für Trenner)..."
                                className="flex-1"
                              />
                              <Button 
                                size="sm" 
                                onClick={() => addPlanningTemplateItem(newPlanningTemplateItem.title)}
                                disabled={!newPlanningTemplateItem.title.trim()}
                              >
                                <Save className="h-3 w-3" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => setNewPlanningTemplateItem(null)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              className="w-full"
                              onClick={() => setNewPlanningTemplateItem({ title: '' })}
                              disabled={!!editingPlanningTemplate || !!newPlanningTemplateItem}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Punkt hinzufügen
                            </Button>
                          )}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                ) : (
                  <p className="text-muted-foreground">Wählen Sie ein Template aus, um die Checklisten-Punkte zu bearbeiten.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="roles">
            <Card>
              <CardHeader>
                <CardTitle>Benutzerrollen</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingData ? (
                  <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-4">
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
      </Tabs>
    </main>
  );
}
