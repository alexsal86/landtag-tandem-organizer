import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Calendar as CalendarIcon, Users, FileText, Trash2, Check, X, Upload, Clock, Edit2, MapPin, GripVertical, MessageCircle, Paperclip, ListTodo, Send, Download } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { AppointmentPreparationsView } from "./AppointmentPreparationsView";

interface EventPlanning {
  id: string;
  title: string;
  description?: string;
  location?: string;
  background_info?: string;
  confirmed_date?: string;
  is_private: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
  is_digital?: boolean;
  digital_platform?: string;
  digital_link?: string;
  digital_access_info?: string;
}

interface EventPlanningContact {
  id: string;
  event_planning_id: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  created_at: string;
  updated_at: string;
}

interface EventPlanningSpeaker {
  id: string;
  event_planning_id: string;
  name: string;
  email?: string;
  phone?: string;
  bio?: string;
  topic?: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

interface EventPlanningDate {
  id: string;
  event_planning_id: string;
  date_time: string;
  is_confirmed: boolean;
  appointment_id?: string;
}

interface ChecklistItem {
  id: string;
  event_planning_id: string;
  title: string;
  is_completed: boolean;
  order_index: number;
  type?: string;
  sub_items?: Array<{
    title: string;
    is_completed: boolean;
  }>;
}

interface PlanningSubtask {
  id: string;
  planning_item_id: string;
  user_id: string;
  description: string;
  assigned_to?: string;
  due_date?: string;
  is_completed: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
  result_text?: string;
  completed_at?: string;
}

interface PlanningComment {
  id: string;
  planning_item_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: {
    display_name?: string;
    avatar_url?: string;
  };
}

interface PlanningDocument {
  id: string;
  planning_item_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  file_type?: string;
  created_at: string;
}

interface Collaborator {
  id: string;
  event_planning_id: string;
  user_id: string;
  can_edit: boolean;
  profiles?: {
    display_name?: string;
    avatar_url?: string;
  };
}

interface Profile {
  user_id: string;
  display_name?: string;
  avatar_url?: string;
}

interface AppointmentPreparation {
  id: string;
  appointment_id: string;
  template_id?: string;
  tenant_id: string;
  created_by: string;
  title: string;
  status: string;
  notes?: string;
  preparation_data: any;
  checklist_items: any;
  is_archived: boolean;
  archived_at?: string;
  created_at: string;
  updated_at: string;
  appointment?: {
    title: string;
    category: string;
    start_time: string;
  };
}

export function EventPlanningView() {
  console.log('=== EventPlanningView component loaded ===');
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  
  const [plannings, setPlannings] = useState<EventPlanning[]>([]);
  const [selectedPlanning, setSelectedPlanning] = useState<EventPlanning | null>(null);
  const [planningDates, setPlanningDates] = useState<EventPlanningDate[]>([]);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [appointmentPreparations, setAppointmentPreparations] = useState<AppointmentPreparation[]>([]);
  const [archivedPreparations, setArchivedPreparations] = useState<AppointmentPreparation[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [activeTab, setActiveTab] = useState<'events' | 'appointments'>('events');
  const [contacts, setContacts] = useState<EventPlanningContact[]>([]);
  const [speakers, setSpeakers] = useState<EventPlanningSpeaker[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCollaboratorDialogOpen, setIsCollaboratorDialogOpen] = useState(false);
  const [isDateDialogOpen, setIsDateDialogOpen] = useState(false);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [isSpeakerDialogOpen, setIsSpeakerDialogOpen] = useState(false);
  const [isDigitalDialogOpen, setIsDigitalDialogOpen] = useState(false);
  const [newPlanningTitle, setNewPlanningTitle] = useState("");
  const [newPlanningIsPrivate, setNewPlanningIsPrivate] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("none");
  const [planningTemplates, setPlanningTemplates] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState("10:00");
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [loading, setLoading] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", email: "", phone: "" });
  const [newSpeaker, setNewSpeaker] = useState({ name: "", email: "", phone: "", bio: "", topic: "" });
  const [editingContact, setEditingContact] = useState<EventPlanningContact | null>(null);
  const [editingSpeaker, setEditingSpeaker] = useState<EventPlanningSpeaker | null>(null);
  const [availableContacts, setAvailableContacts] = useState<any[]>([]);
  const [isEditContactDialogOpen, setIsEditContactDialogOpen] = useState(false);
  const [isEditSpeakerDialogOpen, setIsEditSpeakerDialogOpen] = useState(false);
  const [digitalEvent, setDigitalEvent] = useState({ platform: "", link: "", access_info: "" });
  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [itemComments, setItemComments] = useState<{ [itemId: string]: PlanningComment[] }>({});
  const [itemSubtasks, setItemSubtasks] = useState<{ [itemId: string]: PlanningSubtask[] }>({});
  const [itemDocuments, setItemDocuments] = useState<{ [itemId: string]: PlanningDocument[] }>({});
  const [newComment, setNewComment] = useState("");
  const [newSubtask, setNewSubtask] = useState({ description: '', assigned_to: 'unassigned', due_date: '' });
  const [uploading, setUploading] = useState(false);
  const [editingComment, setEditingComment] = useState<{ [commentId: string]: string }>({});
  const [editingSubtask, setEditingSubtask] = useState<{ [id: string]: Partial<PlanningSubtask> }>({});
  const [expandedItems, setExpandedItems] = useState<{ [itemId: string]: { subtasks: boolean; comments: boolean; documents: boolean } }>({});
  const [showItemSubtasks, setShowItemSubtasks] = useState<{ [itemId: string]: boolean }>({});
  const [showItemComments, setShowItemComments] = useState<{ [itemId: string]: boolean }>({});
  const [showItemDocuments, setShowItemDocuments] = useState<{ [itemId: string]: boolean }>({});
  
  // New states for result dialog
  const [completingSubtask, setCompletingSubtask] = useState<string | null>(null);
  const [completionResult, setCompletionResult] = useState('');

  useEffect(() => {
    console.log('EventPlanningView mounted, user:', user);
    fetchPlannings();
    fetchAppointmentPreparations();
    fetchAllProfiles();
    fetchAvailableContacts();
    fetchPlanningTemplates();
  }, [user]);

  const fetchPlanningTemplates = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("planning_templates")
      .select("*")
      .order("name");

    if (error) {
      console.error("Error fetching planning templates:", error);
      return;
    }

    setPlanningTemplates(data || []);
  };

  const fetchPlannings = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("event_plannings")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error('Error fetching plannings:', error);
        toast({
          title: "Fehler",
          description: `Planungen konnten nicht geladen werden: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      setPlannings(data || []);
    } catch (err) {
      console.error('Unexpected error in fetchPlannings:', err);
      toast({
        title: "Fehler",
        description: "Ein unerwarteter Fehler ist aufgetreten.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAllProfiles = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url");

    if (error) {
      console.error("Error fetching profiles:", error);
      return;
    }

    setAllProfiles(data || []);
  };

  const fetchAvailableContacts = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("contacts")
      .select("id, name, email, phone, role, organization")
      .eq("user_id", user.id)
      .order("name");

    if (error) {
      console.error("Error fetching contacts:", error);
      return;
    }

    setAvailableContacts(data || []);
  };

  const fetchAppointmentPreparations = async () => {
    if (!user) return;

    try {
      // Fetch active preparations
      const { data: activeData, error: activeError } = await supabase
        .from("appointment_preparations")
        .select(`
          *,
          appointment:appointments(title, category, start_time)
        `)
        .eq("is_archived", false)
        .order("created_at", { ascending: false });

      if (activeError) {
        console.error("Error fetching appointment preparations:", activeError);
        return;
      }

      setAppointmentPreparations((activeData || []).map(item => ({
        ...item,
        checklist_items: Array.isArray(item.checklist_items) ? item.checklist_items : 
                        (typeof item.checklist_items === 'string' ? JSON.parse(item.checklist_items) : []),
        preparation_data: typeof item.preparation_data === 'string' ? JSON.parse(item.preparation_data) : item.preparation_data
      })));

      // Fetch archived preparations
      const { data: archivedData, error: archivedError } = await supabase
        .from("appointment_preparations")
        .select(`
          *,
          appointment:appointments(title, category, start_time)
        `)
        .eq("is_archived", true)
        .order("archived_at", { ascending: false });

      if (archivedError) {
        console.error("Error fetching archived preparations:", archivedError);
        return;
      }

      setArchivedPreparations((archivedData || []).map(item => ({
        ...item,
        checklist_items: Array.isArray(item.checklist_items) ? item.checklist_items : 
                        (typeof item.checklist_items === 'string' ? JSON.parse(item.checklist_items) : []),
        preparation_data: typeof item.preparation_data === 'string' ? JSON.parse(item.preparation_data) : item.preparation_data
      })));

    } catch (error) {
      console.error("Unexpected error fetching preparations:", error);
    }
  };

  // Function to sync appointment category with preparation
  const syncPreparationWithAppointment = async () => {
    if (!user) return;

    try {
      const { data: preparations, error } = await supabase
        .from("appointment_preparations")
        .select(`
          id,
          appointment_id,
          preparation_data,
          appointment:appointments(category)
        `)
        .eq("is_archived", false);

      if (error || !preparations) return;

      for (const prep of preparations) {
        if (prep.appointment && prep.preparation_data) {
          const prepData = typeof prep.preparation_data === 'string' ? 
                          JSON.parse(prep.preparation_data) : prep.preparation_data;
          const currentEventType = prepData?.event_type;
          const appointmentCategory = prep.appointment.category;
          
          // Update if category changed
          if (currentEventType !== appointmentCategory) {
            const updatedData = {
              ...prepData,
              event_type: appointmentCategory
            };

            await supabase
              .from("appointment_preparations")
              .update({ preparation_data: updatedData })
              .eq("id", prep.id);
          }
        }
      }
    } catch (error) {
      console.error("Error syncing preparations with appointments:", error);
    }
  };

  const createPlanning = async () => {
    console.log('createPlanning called, user:', user, 'title:', newPlanningTitle);
    if (!user || !newPlanningTitle.trim()) return;

    const { data, error } = await supabase
      .from("event_plannings")
      .insert({
        title: newPlanningTitle,
        user_id: user.id,
        is_private: newPlanningIsPrivate,
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Fehler",
        description: "Planung konnte nicht erstellt werden.",
        variant: "destructive",
      });
      return;
    }

    // Create checklist items based on selected template
    const templateParam = selectedTemplateId === "none" ? null : selectedTemplateId;
    await supabase.rpc("create_default_checklist_items", {
      planning_id: data.id,
      template_id_param: templateParam,
    });

    setNewPlanningTitle("");
    setNewPlanningIsPrivate(false);
    setSelectedTemplateId("none");
    setIsCreateDialogOpen(false);
    fetchPlannings();
    setSelectedPlanning(data);

    toast({
      title: "Erfolg",
      description: "Planung wurde erfolgreich erstellt.",
    });
  };

  // Type guard function
  const isAppointmentsTab = activeTab === 'appointments';
  const isEventsTab = activeTab === 'events';

  // Show appointment preparations view
  if (isAppointmentsTab) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Planungen</h2>
          <div className="flex items-center space-x-2">
            <Button
              variant={isEventsTab ? 'default' : 'outline'}
              onClick={() => setActiveTab('events')}
            >
              Veranstaltungen
            </Button>
            <Button
              variant={isAppointmentsTab ? 'default' : 'outline'}
              onClick={() => setActiveTab('appointments')}
            >
              Terminvorbereitungen
            </Button>
          </div>
        </div>
        <AppointmentPreparationsView />
      </div>
    );
  }

  // Show events planning view
  if (!selectedPlanning) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Planungen</h2>
          <div className="flex items-center space-x-2">
            <Button
              variant={isEventsTab ? 'default' : 'outline'}
              onClick={() => setActiveTab('events')}
            >
              Veranstaltungen
            </Button>
            <Button
              variant={isAppointmentsTab ? 'default' : 'outline'}
              onClick={() => setActiveTab('appointments')}
            >
              Terminvorbereitungen
            </Button>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Neue Planung
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Neue Veranstaltungsplanung erstellen</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="planning-title">Titel</Label>
                    <Input
                      id="planning-title"
                      value={newPlanningTitle}
                      onChange={(e) => setNewPlanningTitle(e.target.value)}
                      placeholder="Titel der Veranstaltung..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="template-select">Vorlage (optional)</Label>
                    <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Vorlage auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Keine Vorlage</SelectItem>
                        {planningTemplates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is-private"
                      checked={newPlanningIsPrivate}
                      onCheckedChange={setNewPlanningIsPrivate}
                    />
                    <Label htmlFor="is-private">Private Planung</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Abbrechen
                  </Button>
                  <Button onClick={createPlanning} disabled={!newPlanningTitle.trim()}>
                    Erstellen
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <div className="col-span-full text-center py-4">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : plannings.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">
                  Noch keine Planungen vorhanden.
                </p>
              </CardContent>
            </Card>
          ) : (
            plannings.map((planning) => {
              const planningCollaborators = collaborators.filter(c => c.event_planning_id === planning.id);
              
              return (
                <Card
                  key={planning.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedPlanning(planning)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {planning.title}
                      {planning.is_private && (
                        <Badge variant="secondary">Privat</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <CalendarIcon className="h-4 w-4" />
                        <span>{format(new Date(planning.created_at), "dd.MM.yyyy", { locale: de })}</span>
                      </div>
                      
                      {planningCollaborators.length > 0 && (
                        <div className="flex items-center space-x-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <div className="flex -space-x-2">
                            {planningCollaborators.slice(0, 3).map((collab) => (
                              <Avatar key={collab.id} className="h-6 w-6 border-2 border-background">
                                <AvatarFallback className="text-xs">
                                  {collab.profiles?.display_name?.charAt(0) || '?'}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                            {planningCollaborators.length > 3 && (
                              <div className="flex items-center justify-center h-6 w-6 rounded-full bg-muted border-2 border-background text-xs">
                                +{planningCollaborators.length - 3}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {planning.location && (
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <span className="truncate">{planning.location}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // Show detailed event planning view for selected planning
  return <div>Detailansicht für {selectedPlanning.title} wird hier implementiert.</div>;
}