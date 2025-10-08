import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Calendar as CalendarIcon, Users, FileText, Trash2, Check, X, Upload, Clock, Edit2, MapPin, GripVertical, MessageCircle, Paperclip, ListTodo, Send, Download, Archive, Grid, List } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { useNewItemIndicators } from "@/hooks/useNewItemIndicators";
import { NewItemIndicator } from "./NewItemIndicator";

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
  title: string;
  appointment_id?: string;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  archived_at?: string;
}

export function EventPlanningView() {
  console.log('=== EventPlanningView component loaded ===');
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { isItemNew, clearAllIndicators } = useNewItemIndicators('eventplanning');
  const [plannings, setPlannings] = useState<EventPlanning[]>([]);
  const [selectedPlanning, setSelectedPlanning] = useState<EventPlanning | null>(null);
  const [planningDates, setPlanningDates] = useState<EventPlanningDate[]>([]);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
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

  // States for appointment preparations
  const [appointmentPreparations, setAppointmentPreparations] = useState<AppointmentPreparation[]>([]);
  const [archivedPreparations, setArchivedPreparations] = useState<AppointmentPreparation[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  // View preferences
  const [eventPlanningView, setEventPlanningView] = useState<'card' | 'table'>('card');
  const [appointmentPreparationView, setAppointmentPreparationView] = useState<'card' | 'table'>('card');

  useEffect(() => {
    console.log('EventPlanningView mounted, user:', user, 'currentTenant:', currentTenant);
    if (!currentTenant || !user) {
      console.log('No currentTenant or user available, skipping data fetching');
      return;
    }
    
    // Check for appointment parameters from URL
    const appointmentId = searchParams.get('appointmentId');
    const appointmentTitle = searchParams.get('title');
    const appointmentDate = searchParams.get('date');
    const appointmentTime = searchParams.get('time');
    const appointmentLocation = searchParams.get('location');
    
    if (appointmentId && appointmentTitle) {
      // Pre-fill the create dialog with appointment data
      setNewPlanningTitle(`Planung: ${appointmentTitle}`);
      setIsCreateDialogOpen(true);
      
      // Clear URL parameters after reading them
      navigate('/eventplanning', { replace: true });
    }
    
    // Use async wrapper to avoid blocking
    const loadData = async () => {
      try {
        await fetchPlannings();
        await fetchAllProfiles();
        await fetchAvailableContacts();
        await fetchPlanningTemplates();
        await fetchAppointmentPreparations();
        loadViewPreferences();
      } catch (error) {
        console.error('Error loading planning data:', error);
      }
    };
    
    loadData();

    // Cleanup indicators when leaving the page
    return () => {
      clearAllIndicators();
    };
  }, [user, currentTenant?.id, searchParams]); // Added searchParams to dependencies

  // Load view preferences from localStorage
  const loadViewPreferences = () => {
    const eventView = localStorage.getItem('eventPlanningView') as 'card' | 'table' | null;
    const appointmentView = localStorage.getItem('appointmentPreparationView') as 'card' | 'table' | null;
    
    if (eventView) setEventPlanningView(eventView);
    if (appointmentView) setAppointmentPreparationView(appointmentView);
  };

  // Save view preferences to localStorage
  const saveViewPreferences = (section: 'event' | 'appointment', view: 'card' | 'table') => {
    if (section === 'event') {
      setEventPlanningView(view);
      localStorage.setItem('eventPlanningView', view);
    } else {
      setAppointmentPreparationView(view);
      localStorage.setItem('appointmentPreparationView', view);
    }
  };

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

  useEffect(() => {
    if (selectedPlanning) {
      fetchPlanningDetails(selectedPlanning.id);
      loadAllItemCounts(); // Load counts for all items
    }
  }, [selectedPlanning]);

  const fetchPlannings = async () => {
    console.log('fetchPlannings called, user:', user, 'currentTenant:', currentTenant);
    if (!user) {
      console.log('No user found, returning early');
      return;
    }
    if (!currentTenant || !currentTenant.id) {
      console.log('No currentTenant or currentTenant.id found, returning early');
      return;
    }

    try {
      setLoading(true);
      console.log('Fetching plannings from Supabase for tenant:', currentTenant.id);
      
      // Add timeout to prevent hanging
      const timeoutId = setTimeout(() => {
        console.error('Supabase query timeout');
        setLoading(false);
      }, 10000); // 10 second timeout

      const { data, error } = await supabase
        .from("event_plannings")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .order("created_at", { ascending: false });

      clearTimeout(timeoutId);
      console.log('Supabase response:', { data, error });

      if (error) {
        console.error('Error fetching plannings:', error);
        toast({
          title: "Fehler",
          description: `Planungen konnten nicht geladen werden: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      console.log('Successfully fetched plannings:', data);
      setPlannings(data || []);
      
      // Also fetch all collaborators for all plannings
      if (data && data.length > 0) {
        try {
          await fetchAllCollaborators(data.map(p => p.id));
        } catch (collabError) {
          console.error('Error fetching collaborators:', collabError);
          // Don't fail the whole operation if collaborators fail
        }
      }
    } catch (err) {
      console.error('Unexpected error in fetchPlannings:', err);
      toast({
        title: "Fehler", 
        description: "Ein unerwarteter Fehler ist aufgetreten beim Laden der Planungen.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAllCollaborators = async (planningIds: string[]) => {
    const { data: collabs } = await supabase
      .from("event_planning_collaborators")
      .select("*")
      .in("event_planning_id", planningIds);

    if (collabs) {
      // Fetch profile data separately
      const collabsWithProfiles = await Promise.all(
        collabs.map(async (collab) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, avatar_url")
            .eq("user_id", collab.user_id)
            .single();
          
          return {
            ...collab,
            profiles: profile
          };
        })
      );
      
      setCollaborators(collabsWithProfiles);
    } else {
      setCollaborators([]);
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
        .select("*")
        .eq("is_archived", false)
        .order("created_at", { ascending: false });

      if (activeError) {
        console.error("Error fetching active preparations:", activeError);
      } else {
        setAppointmentPreparations(activeData || []);
      }

      // Fetch archived preparations
      const { data: archivedData, error: archivedError } = await supabase
        .from("appointment_preparations")
        .select("*")
        .eq("is_archived", true)
        .order("archived_at", { ascending: false });

      if (archivedError) {
        console.error("Error fetching archived preparations:", archivedError);
      } else {
        setArchivedPreparations(archivedData || []);
      }
    } catch (error) {
      console.error("Error in fetchAppointmentPreparations:", error);
    }
  };

  const handlePreparationClick = (preparation: AppointmentPreparation) => {
    navigate(`/appointment-preparation/${preparation.id}`);
  };

  const EventPlanningTable = ({ plannings }: { plannings: EventPlanning[] }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Titel</TableHead>
          <TableHead>Beschreibung</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Datum</TableHead>
          <TableHead>Privat</TableHead>
          <TableHead>Erstellt</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {plannings.map((planning) => (
          <TableRow 
            key={planning.id} 
            className="cursor-pointer hover:bg-muted/50 relative"
            onClick={() => setSelectedPlanning(planning)}
          >
            <TableCell className="font-medium relative">
              <NewItemIndicator isVisible={isItemNew(planning.id, planning.created_at)} size="sm" />
              {planning.title}
            </TableCell>
            <TableCell className="max-w-xs truncate">{planning.description || '-'}</TableCell>
            <TableCell>
              <Badge variant={planning.confirmed_date ? "default" : "secondary"}>
                {planning.confirmed_date ? "Bestätigt" : "In Planung"}
              </Badge>
            </TableCell>
            <TableCell>
              {planning.confirmed_date 
                ? format(new Date(planning.confirmed_date), "dd.MM.yyyy", { locale: de })
                : "-"
              }
            </TableCell>
            <TableCell>
              <Badge variant={planning.is_private ? "secondary" : "outline"}>
                {planning.is_private ? "Privat" : "Öffentlich"}
              </Badge>
            </TableCell>
            <TableCell>
              {format(new Date(planning.created_at), "dd.MM.yyyy", { locale: de })}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const AppointmentPreparationTable = ({ 
    preparations, 
    isArchived = false 
  }: { 
    preparations: AppointmentPreparation[], 
    isArchived?: boolean 
  }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Titel</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Notizen</TableHead>
          <TableHead>{isArchived ? "Archiviert" : "Erstellt"}</TableHead>
          <TableHead>Zuletzt bearbeitet</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {preparations.map((preparation) => (
          <TableRow 
            key={preparation.id} 
            className="cursor-pointer hover:bg-muted/50 relative"
            onClick={() => handlePreparationClick(preparation)}
          >
            <TableCell className="font-medium relative">
              <NewItemIndicator isVisible={isItemNew(preparation.id, preparation.created_at)} size="sm" />
              {preparation.title}
            </TableCell>
            <TableCell>
              <Badge 
                variant={
                  preparation.status === 'completed' ? 'default' : 
                  preparation.status === 'in_progress' ? 'secondary' : 'outline'
                }
              >
                {preparation.status === 'completed' ? 'Abgeschlossen' :
                 preparation.status === 'in_progress' ? 'In Bearbeitung' : 'Entwurf'}
              </Badge>
            </TableCell>
            <TableCell className="max-w-xs truncate">
              {preparation.notes || '-'}
            </TableCell>
            <TableCell>
              {format(
                new Date(isArchived && preparation.archived_at ? preparation.archived_at : preparation.created_at), 
                "dd.MM.yyyy", 
                { locale: de }
              )}
            </TableCell>
            <TableCell>
              {preparation.updated_at !== preparation.created_at 
                ? format(new Date(preparation.updated_at), "dd.MM.yyyy HH:mm", { locale: de })
                : "-"
              }
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const fetchPlanningDetails = async (planningId: string) => {
    // Fetch dates
    const { data: dates } = await supabase
      .from("event_planning_dates")
      .select("*")
      .eq("event_planning_id", planningId)
      .order("date_time");

    setPlanningDates(dates || []);

    // Fetch checklist items
    const { data: checklist } = await supabase
      .from("event_planning_checklist_items")
      .select("*")
      .eq("event_planning_id", planningId)
      .order("order_index");

    // Transform the data to match our interface
    const transformedChecklist = (checklist || []).map((item: any) => ({
      ...item,
      sub_items: Array.isArray(item.sub_items) ? item.sub_items : 
                 (item.sub_items ? JSON.parse(item.sub_items as string) : [])
    }));
    setChecklistItems(transformedChecklist);
    loadAllItemCounts(transformedChecklist); // Load counts after checklist is loaded

    // Fetch collaborators
    const { data: collabs } = await supabase
      .from("event_planning_collaborators")
      .select("*")
      .eq("event_planning_id", planningId);

    if (collabs) {
      // Fetch profile data separately
      const collabsWithProfiles = await Promise.all(
        collabs.map(async (collab) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, avatar_url")
            .eq("user_id", collab.user_id)
            .single();
          
          return {
            ...collab,
            profiles: profile
          };
        })
      );
      
      setCollaborators(collabsWithProfiles);
    } else {
      setCollaborators([]);
    }

    // Fetch contacts
    const { data: contactsData } = await supabase
      .from("event_planning_contacts")
      .select("*")
      .eq("event_planning_id", planningId)
      .order("created_at");

    setContacts(contactsData || []);

    // Fetch speakers
    const { data: speakersData } = await supabase
      .from("event_planning_speakers")
      .select("*")
      .eq("event_planning_id", planningId)
      .order("order_index");

    setSpeakers(speakersData || []);
  };

  // Utility function for debouncing
  function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
    let timeout: NodeJS.Timeout;
    return ((...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    }) as T;
  }

  // Debounced auto-save function
  const debouncedUpdate = useCallback(
    debounce(async (field: string, value: any, planningId: string) => {
      const { error } = await supabase
        .from("event_plannings")
        .update({ [field]: value })
        .eq("id", planningId);

      if (error) {
        toast({
          title: "Fehler",
          description: "Änderung konnte nicht gespeichert werden.",
          variant: "destructive",
        });
      }
    }, 500),
    []
  );

  const updatePlanningField = async (field: string, value: any) => {
    if (!selectedPlanning) return;

    // Update local state immediately
    setSelectedPlanning({ ...selectedPlanning, [field]: value });
    
    // Debounced save to database
    debouncedUpdate(field, value, selectedPlanning.id);
  };

  const createPlanning = async () => {
    console.log('createPlanning called, user:', user, 'title:', newPlanningTitle);
    if (!user || !newPlanningTitle.trim()) return;
    if (!currentTenant) {
      toast({
        title: "Fehler",
        description: "Kein Tenant gefunden. Bitte laden Sie die Seite neu.",
        variant: "destructive",
      });
      return;
    }

    const { data, error } = await supabase
      .from("event_plannings")
      .insert({
        title: newPlanningTitle,
        user_id: user.id,
        tenant_id: currentTenant.id,
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

  const deletePlanning = async (planningId: string) => {
    const { error } = await supabase
      .from("event_plannings")
      .delete()
      .eq("id", planningId);

    if (error) {
      toast({
        title: "Fehler",
        description: "Planung konnte nicht gelöscht werden.",
        variant: "destructive",
      });
      return;
    }

    fetchPlannings();
    if (selectedPlanning?.id === planningId) {
      setSelectedPlanning(null);
    }

    toast({
      title: "Erfolg",
      description: "Planung wurde gelöscht.",
    });
  };

  const addPlanningDate = async () => {
    if (!selectedPlanning || !selectedDate) return;

    const dateTime = new Date(selectedDate);
    const [hours, minutes] = selectedTime.split(":").map(Number);
    dateTime.setHours(hours, minutes);

    const { data, error } = await supabase
      .from("event_planning_dates")
      .insert({
        event_planning_id: selectedPlanning.id,
        date_time: dateTime.toISOString(),
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Fehler",
        description: "Termin konnte nicht hinzugefügt werden.",
        variant: "destructive",
      });
      return;
    }

    // Create blocked appointment and store appointment_id
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .insert({
        user_id: user?.id,
        tenant_id: currentTenant?.id || '', // Use current tenant ID
        title: `Geplant: ${selectedPlanning.title}`,
        start_time: dateTime.toISOString(),
        end_time: new Date(dateTime.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        category: "blocked",
        status: "planned",
      })
      .select()
      .single();

    if (!appointmentError && appointment) {
      // Update the planning date with the appointment_id
      await supabase
        .from("event_planning_dates")
        .update({ appointment_id: appointment.id })
        .eq("id", data.id);
    }

    fetchPlanningDetails(selectedPlanning.id);
    setSelectedDate(undefined);
    setIsDateDialogOpen(false);

    toast({
      title: "Erfolg",
      description: "Termin wurde hinzugefügt und im Kalender geblockt.",
    });
  };

  const confirmDate = async (dateId: string) => {
    if (!selectedPlanning) return;

    // First, unconfirm all other dates
    await supabase
      .from("event_planning_dates")
      .update({ is_confirmed: false })
      .eq("event_planning_id", selectedPlanning.id);

    // Confirm the selected date
    const { data, error } = await supabase
      .from("event_planning_dates")
      .update({ is_confirmed: true })
      .eq("id", dateId)
      .select()
      .single();

    if (error) {
      toast({
        title: "Fehler",
        description: "Termin konnte nicht bestätigt werden.",
        variant: "destructive",
      });
      return;
    }

    // Update planning with confirmed date
    await updatePlanningField("confirmed_date", data.date_time);

    // Update the appointment to be confirmed instead of blocked
    const confirmedDate = planningDates.find(d => d.id === dateId);
    if (confirmedDate?.appointment_id) {
      await supabase
        .from("appointments")
        .update({
          title: selectedPlanning.title,
          category: "appointment",
          status: "confirmed",
        })
        .eq("id", confirmedDate.appointment_id);
    }

    // Delete all other planning dates and their appointments
    const otherDates = planningDates.filter(d => d.id !== dateId);
    for (const date of otherDates) {
      if (date.appointment_id) {
        await supabase
          .from("appointments")
          .delete()
          .eq("id", date.appointment_id);
      }
    }

    await supabase
      .from("event_planning_dates")
      .delete()
      .eq("event_planning_id", selectedPlanning.id)
      .neq("id", dateId);

    fetchPlanningDetails(selectedPlanning.id);

    toast({
      title: "Erfolg",
      description: "Termin wurde bestätigt und andere Termine entfernt.",
    });
  };

  const updateConfirmedDate = async (dateId: string, newDateTime: string) => {
    if (!selectedPlanning) return;

    const { error } = await supabase
      .from("event_planning_dates")
      .update({ date_time: newDateTime })
      .eq("id", dateId);

    if (error) {
      toast({
        title: "Fehler", 
        description: "Termin konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
      return;
    }

    // Update the associated appointment
    const dateToUpdate = planningDates.find(d => d.id === dateId);
    if (dateToUpdate?.appointment_id) {
      const newDate = new Date(newDateTime);
      await supabase
        .from("appointments")
        .update({
          start_time: newDate.toISOString(),
          end_time: new Date(newDate.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        })
        .eq("id", dateToUpdate.appointment_id);
    }

    // Update planning confirmed date
    await updatePlanningField("confirmed_date", newDateTime);
    
    fetchPlanningDetails(selectedPlanning.id);

    toast({
      title: "Erfolg",
      description: "Termin wurde aktualisiert.",
    });
  };

  const toggleChecklistItem = async (itemId: string, isCompleted: boolean) => {
    const { error } = await supabase
      .from("event_planning_checklist_items")
      .update({ is_completed: !isCompleted })
      .eq("id", itemId);

    if (error) {
      toast({
        title: "Fehler",
        description: "Checkliste konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
      return;
    }

    setChecklistItems(items =>
      items.map(item =>
        item.id === itemId ? { ...item, is_completed: !isCompleted } : item
      )
    );
  };

  const updateChecklistItemTitle = async (itemId: string, title: string) => {
    const { error } = await supabase
      .from("event_planning_checklist_items")
      .update({ title })
      .eq("id", itemId);

    if (error) {
      toast({
        title: "Fehler",
        description: "Checkliste konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
      return;
    }

    setChecklistItems(items =>
      items.map(item =>
        item.id === itemId ? { ...item, title } : item
      )
    );
  };

  const addChecklistItem = async () => {
    if (!selectedPlanning || !newChecklistItem.trim()) return;

    const maxOrder = Math.max(...checklistItems.map(item => item.order_index), -1);
    
    // Determine if it's a separator (starts with ---)
    const itemType = newChecklistItem.startsWith('---') ? 'separator' : 'item';
    const title = itemType === 'separator' ? newChecklistItem.replace(/^---\s*/, '') : newChecklistItem;

    const { data, error } = await supabase
      .from("event_planning_checklist_items")
      .insert({
        event_planning_id: selectedPlanning.id,
        title: title,
        order_index: maxOrder + 1,
        type: itemType,
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Fehler",
        description: "Checklisten-Punkt konnte nicht hinzugefügt werden.",
        variant: "destructive",
      });
      return;
    }

    // Transform the new data to match our interface
    const transformedData = {
      ...data,
      sub_items: Array.isArray(data.sub_items) ? data.sub_items : 
                 (data.sub_items ? JSON.parse(data.sub_items as string) : [])
    };
    setChecklistItems([...checklistItems, transformedData]);
    setNewChecklistItem("");
  };

  const deleteChecklistItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from("event_planning_checklist_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;

      setChecklistItems(items => items.filter(item => item.id !== itemId));
      
      toast({
        title: "Erfolg",
        description: "Checklisten-Punkt wurde gelöscht.",
      });
    } catch (error) {
      console.error('Error deleting checklist item:', error);
      toast({
        title: "Fehler",
        description: "Checklisten-Punkt konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const addCollaborator = async (userId: string, canEdit: boolean) => {
    if (!selectedPlanning) return;

    const { error } = await supabase
      .from("event_planning_collaborators")
      .insert({
        event_planning_id: selectedPlanning.id,
        user_id: userId,
        can_edit: canEdit,
      });

    if (error) {
      toast({
        title: "Fehler",
        description: "Mitarbeiter konnte nicht hinzugefügt werden.",
        variant: "destructive",
      });
      return;
    }

    fetchPlanningDetails(selectedPlanning.id);
    setIsCollaboratorDialogOpen(false);

    toast({
      title: "Erfolg",
      description: "Mitarbeiter wurde hinzugefügt.",
    });
  };

  const updateCollaboratorPermission = async (collaboratorId: string, canEdit: boolean) => {
    const { error } = await supabase
      .from("event_planning_collaborators")
      .update({ can_edit: canEdit })
      .eq("id", collaboratorId);

    if (error) {
      toast({
        title: "Fehler",
        description: "Berechtigung konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
      return;
    }

    setCollaborators(collaborators.map(collab =>
      collab.id === collaboratorId ? { ...collab, can_edit: canEdit } : collab
    ));

    toast({
      title: "Erfolg",
      description: "Berechtigung wurde aktualisiert.",
    });
  };

  // Add contact functions
  const addContact = async () => {
    if (!selectedPlanning || !newContact.name.trim()) return;

    const { data, error } = await supabase
      .from("event_planning_contacts")
      .insert({
        event_planning_id: selectedPlanning.id,
        name: newContact.name,
        email: newContact.email || null,
        phone: newContact.phone || null,
        role: "contact_person",
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Fehler",
        description: "Ansprechperson konnte nicht hinzugefügt werden.",
        variant: "destructive",
      });
      return;
    }

    setContacts([...contacts, data]);
    setNewContact({ name: "", email: "", phone: "" });
    setIsContactDialogOpen(false);

    toast({
      title: "Erfolg",
      description: "Ansprechperson wurde hinzugefügt.",
    });
  };

  const removeContact = async (contactId: string) => {
    const { error } = await supabase
      .from("event_planning_contacts")
      .delete()
      .eq("id", contactId);

    if (error) {
      toast({
        title: "Fehler",
        description: "Ansprechperson konnte nicht entfernt werden.",
        variant: "destructive",
      });
      return;
    }

    setContacts(contacts.filter(contact => contact.id !== contactId));

    toast({
      title: "Erfolg",
      description: "Ansprechperson wurde entfernt.",
    });
  };

  // Add speaker functions
  const addSpeaker = async () => {
    if (!selectedPlanning || !newSpeaker.name.trim()) return;

    const maxOrder = Math.max(...speakers.map(speaker => speaker.order_index), -1);

    const { data, error } = await supabase
      .from("event_planning_speakers")
      .insert({
        event_planning_id: selectedPlanning.id,
        name: newSpeaker.name,
        email: newSpeaker.email || null,
        phone: newSpeaker.phone || null,
        bio: newSpeaker.bio || null,
        topic: newSpeaker.topic || null,
        order_index: maxOrder + 1,
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Fehler",
        description: "Referent konnte nicht hinzugefügt werden.",
        variant: "destructive",
      });
      return;
    }

    setSpeakers([...speakers, data]);
    setNewSpeaker({ name: "", email: "", phone: "", bio: "", topic: "" });
    setIsSpeakerDialogOpen(false);

    toast({
      title: "Erfolg",
      description: "Referent wurde hinzugefügt.",
    });
  };

  const removeSpeaker = async (speakerId: string) => {
    const { error } = await supabase
      .from("event_planning_speakers")
      .delete()
      .eq("id", speakerId);

    if (error) {
      toast({
        title: "Fehler",
        description: "Referent konnte nicht entfernt werden.",
        variant: "destructive",
      });
      return;
    }

    setSpeakers(speakers.filter(speaker => speaker.id !== speakerId));

    toast({
      title: "Erfolg",
      description: "Referent wurde entfernt.",
    });
  };

  // Edit contact functions
  const editContact = async () => {
    if (!editingContact || !editingContact.name.trim()) return;

    const { data, error } = await supabase
      .from("event_planning_contacts")
      .update({
        name: editingContact.name,
        email: editingContact.email || null,
        phone: editingContact.phone || null,
      })
      .eq("id", editingContact.id)
      .select()
      .single();

    if (error) {
      toast({
        title: "Fehler",
        description: "Ansprechperson konnte nicht bearbeitet werden.",
        variant: "destructive",
      });
      return;
    }

    setContacts(contacts.map(contact => 
      contact.id === editingContact.id ? data : contact
    ));
    setEditingContact(null);
    setIsEditContactDialogOpen(false);

    toast({
      title: "Erfolg",
      description: "Ansprechperson wurde bearbeitet.",
    });
  };

  // Edit speaker functions
  const editSpeaker = async () => {
    if (!editingSpeaker || !editingSpeaker.name.trim()) return;

    const { data, error } = await supabase
      .from("event_planning_speakers")
      .update({
        name: editingSpeaker.name,
        email: editingSpeaker.email || null,
        phone: editingSpeaker.phone || null,
        bio: editingSpeaker.bio || null,
        topic: editingSpeaker.topic || null,
      })
      .eq("id", editingSpeaker.id)
      .select()
      .single();

    if (error) {
      toast({
        title: "Fehler",
        description: "Referent konnte nicht bearbeitet werden.",
        variant: "destructive",
      });
      return;
    }

    setSpeakers(speakers.map(speaker => 
      speaker.id === editingSpeaker.id ? data : speaker
    ));
    setEditingSpeaker(null);
    setIsEditSpeakerDialogOpen(false);

    toast({
      title: "Erfolg",
      description: "Referent wurde bearbeitet.",
    });
  };

  // Helper functions for auto-filling contact/speaker data
  const fillFromContact = (contactId: string) => {
    const contact = availableContacts.find(c => c.id === contactId);
    if (contact) {
      setNewContact({
        name: contact.name || "",
        email: contact.email || "",
        phone: contact.phone || "",
      });
    }
  };

  const fillFromProfile = (profileId: string) => {
    const profile = allProfiles.find(p => p.user_id === profileId);
    if (profile) {
      setNewContact({
        name: profile.display_name || "",
        email: "",
        phone: "",
      });
    }
  };

  const fillSpeakerFromContact = (contactId: string) => {
    const contact = availableContacts.find(c => c.id === contactId);
    if (contact) {
      setNewSpeaker({
        name: contact.name || "",
        email: contact.email || "",
        phone: contact.phone || "",
        bio: contact.role || "",
        topic: "",
      });
    }
  };

  // Digital event functions
  const updateDigitalEventSettings = async () => {
    if (!selectedPlanning) return;

    const { error } = await supabase
      .from("event_plannings")
      .update({
        is_digital: true,
        digital_platform: digitalEvent.platform || null,
        digital_link: digitalEvent.link || null,
        digital_access_info: digitalEvent.access_info || null,
      })
      .eq("id", selectedPlanning.id);

    if (error) {
      toast({
        title: "Fehler",
        description: "Digitale Einstellungen konnten nicht gespeichert werden.",
        variant: "destructive",
      });
      return;
    }

    setSelectedPlanning({
      ...selectedPlanning,
      is_digital: true,
      digital_platform: digitalEvent.platform,
      digital_link: digitalEvent.link,
      digital_access_info: digitalEvent.access_info,
    });

    setIsDigitalDialogOpen(false);

    toast({
      title: "Erfolg",
      description: "Digitale Einstellungen wurden gespeichert.",
    });
  };

  const removeDigitalEventSettings = async () => {
    if (!selectedPlanning) return;

    const { error } = await supabase
      .from("event_plannings")
      .update({
        is_digital: false,
        digital_platform: null,
        digital_link: null,
        digital_access_info: null,
      })
      .eq("id", selectedPlanning.id);

    if (error) {
      toast({
        title: "Fehler",
        description: "Digitale Einstellungen konnten nicht entfernt werden.",
        variant: "destructive",
      });
      return;
    }

    setSelectedPlanning({
      ...selectedPlanning,
      is_digital: false,
      digital_platform: undefined,
      digital_link: undefined,
      digital_access_info: undefined,
    });

    toast({
      title: "Erfolg",
      description: "Digitale Einstellungen wurden entfernt.",
    });
  };

  const removeCollaborator = async (collaboratorId: string) => {
    const { error } = await supabase
      .from("event_planning_collaborators")
      .delete()
      .eq("id", collaboratorId);

    if (error) {
      toast({
        title: "Fehler",
        description: "Mitarbeiter konnte nicht entfernt werden.",
        variant: "destructive",
      });
      return;
    }

    setCollaborators(collaborators.filter(collab => collab.id !== collaboratorId));

    toast({
      title: "Erfolg",
      description: "Mitarbeiter wurde entfernt.",
    });
  };

  const addSubItem = async (itemId: string) => {
    const currentItem = checklistItems.find(item => item.id === itemId);
    if (!currentItem) return;

    const currentSubItems = currentItem.sub_items || [];
    const newSubItems = [...currentSubItems, { title: '', is_completed: false }];

    const { error } = await supabase
      .from("event_planning_checklist_items")
      .update({ sub_items: newSubItems })
      .eq("id", itemId);

    if (error) {
      toast({
        title: "Fehler",
        description: "Unterpunkt konnte nicht hinzugefügt werden.",
        variant: "destructive",
      });
      return;
    }

    setChecklistItems(items =>
      items.map(item =>
        item.id === itemId ? { ...item, sub_items: newSubItems } : item
      )
    );
  };

  const toggleSubItem = async (itemId: string, subItemIndex: number, isCompleted: boolean) => {
    const currentItem = checklistItems.find(item => item.id === itemId);
    if (!currentItem || !currentItem.sub_items) return;

    const updatedSubItems = currentItem.sub_items.map((subItem: any, index: number) =>
      index === subItemIndex ? { ...subItem, is_completed: !isCompleted } : subItem
    );

    const { error } = await supabase
      .from("event_planning_checklist_items")
      .update({ sub_items: updatedSubItems })
      .eq("id", itemId);

    if (error) {
      toast({
        title: "Fehler",
        description: "Unterpunkt konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
      return;
    }

    setChecklistItems(items =>
      items.map(item =>
        item.id === itemId ? { ...item, sub_items: updatedSubItems } : item
      )
    );
  };

  const updateSubItemTitle = async (itemId: string, subItemIndex: number, title: string) => {
    const currentItem = checklistItems.find(item => item.id === itemId);
    if (!currentItem || !currentItem.sub_items) return;

    const updatedSubItems = currentItem.sub_items.map((subItem: any, index: number) =>
      index === subItemIndex ? { ...subItem, title } : subItem
    );

    const { error } = await supabase
      .from("event_planning_checklist_items")
      .update({ sub_items: updatedSubItems })
      .eq("id", itemId);

    if (error) {
      toast({
        title: "Fehler",
        description: "Unterpunkt konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
      return;
    }

    setChecklistItems(items =>
      items.map(item =>
        item.id === itemId ? { ...item, sub_items: updatedSubItems } : item
      )
    );
  };

  const removeSubItem = async (itemId: string, subItemIndex: number) => {
    const currentItem = checklistItems.find(item => item.id === itemId);
    if (!currentItem || !currentItem.sub_items) return;

    const updatedSubItems = currentItem.sub_items.filter((_: any, index: number) => index !== subItemIndex);

    const { error } = await supabase
      .from("event_planning_checklist_items")
      .update({ sub_items: updatedSubItems })
      .eq("id", itemId);

    if (error) {
      toast({
        title: "Fehler",
        description: "Unterpunkt konnte nicht entfernt werden.",
        variant: "destructive",
      });
      return;
    }

    setChecklistItems(items =>
      items.map(item =>
        item.id === itemId ? { ...item, sub_items: updatedSubItems } : item
      )
    );
  };

  // Drag and drop functionality
  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(checklistItems);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update local state immediately
    setChecklistItems(items);

    // Update order_index for all items
    const updates = items.map((item, index) => ({
      id: item.id,
      order_index: index,
    }));

    try {
      for (const update of updates) {
        await supabase
          .from("event_planning_checklist_items")
          .update({ order_index: update.order_index })
          .eq("id", update.id);
      }
    } catch (error) {
      console.error('Error updating item order:', error);
      toast({
        title: "Fehler",
        description: "Reihenfolge konnte nicht gespeichert werden.",
        variant: "destructive",
      });
      // Revert local state on error
      fetchPlanningDetails(selectedPlanning!.id);
    }
  };

  // Load item details when item is selected
  useEffect(() => {
    if (selectedItemId) {
      loadItemComments(selectedItemId);
      loadItemSubtasks(selectedItemId);
      loadItemDocuments(selectedItemId);
    }
  }, [selectedItemId]);

  const loadItemComments = async (itemId: string) => {
    try {
      const { data: comments, error } = await supabase
        .from('planning_item_comments')
        .select('*')
        .eq('planning_item_id', itemId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const userIds = [...new Set(comments?.map(c => c.user_id) || [])];
      let profiles: any[] = [];
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', userIds);
        
        profiles = profilesData || [];
      }

      const formattedComments: PlanningComment[] = (comments || []).map(comment => ({
        id: comment.id,
        planning_item_id: comment.planning_item_id,
        user_id: comment.user_id,
        content: comment.content,
        created_at: comment.created_at,
        profile: profiles.find(p => p.user_id === comment.user_id) || null,
      }));

      setItemComments(prev => ({ ...prev, [itemId]: formattedComments }));
    } catch (error) {
      console.error('Error loading item comments:', error);
    }
  };

  const loadItemSubtasks = async (itemId: string) => {
    try {
      const { data, error } = await supabase
        .from('planning_item_subtasks')
        .select('*')
        .eq('planning_item_id', itemId)
        .order('order_index', { ascending: true });

      if (error) throw error;
      setItemSubtasks(prev => ({ ...prev, [itemId]: data || [] }));
    } catch (error) {
      console.error('Error loading item subtasks:', error);
    }
  };

  const loadItemDocuments = async (itemId: string) => {
    try {
      const { data, error } = await supabase
        .from('planning_item_documents')
        .select('*')
        .eq('planning_item_id', itemId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItemDocuments(prev => ({ ...prev, [itemId]: data || [] }));
    } catch (error) {
      console.error('Error loading item documents:', error);
    }
  };

  const addItemComment = async () => {
    if (!newComment.trim() || !selectedItemId || !user) return;

    try {
      const { error } = await supabase
        .from('planning_item_comments')
        .insert({
          planning_item_id: selectedItemId,
          user_id: user.id,
          content: newComment.trim(),
        });

      if (error) throw error;

      setNewComment('');
      loadItemComments(selectedItemId);
      loadAllItemCounts(); // Refresh counts

      toast({
        title: "Kommentar hinzugefügt",
        description: "Ihr Kommentar wurde erfolgreich hinzugefügt.",
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: "Fehler",
        description: "Kommentar konnte nicht hinzugefügt werden.",
        variant: "destructive",
      });
    }
  };

  const addItemSubtask = async (description?: string, assignedTo?: string, dueDate?: string, itemId?: string) => {
    const desc = description || newSubtask.description.trim();
    const assigned = assignedTo || newSubtask.assigned_to;
    const due = dueDate || newSubtask.due_date;
    const planningItemId = itemId || selectedItemId;
    
    if (!desc || !planningItemId || !user) return;

    try {
      const currentSubtasks = itemSubtasks[planningItemId] || [];
      const nextOrderIndex = Math.max(...currentSubtasks.map(s => s.order_index), -1) + 1;
      
      const { error } = await supabase
        .from('planning_item_subtasks')
        .insert({
          planning_item_id: planningItemId,
          user_id: user.id,
          description: desc,
          assigned_to: assigned === 'unassigned' ? null : assigned,
          due_date: due || null,
          order_index: nextOrderIndex,
        });

      if (error) throw error;

      setNewSubtask({ description: '', assigned_to: 'unassigned', due_date: '' });
      loadItemSubtasks(planningItemId);
      loadAllItemCounts(); // Refresh counts

      toast({
        title: "Unteraufgabe hinzugefügt",
        description: "Die Unteraufgabe wurde erfolgreich erstellt.",
      });
    } catch (error) {
      console.error('Error adding subtask:', error);
      toast({
        title: "Fehler",
        description: "Unteraufgabe konnte nicht hinzugefügt werden.",
        variant: "destructive",
      });
    }
  };

  const addItemCommentForItem = async (itemId: string, comment: string) => {
    if (!comment.trim() || !user) return;

    try {
      const { error } = await supabase
        .from('planning_item_comments')
        .insert({
          planning_item_id: itemId,
          user_id: user.id,
          content: comment.trim(),
        });

      if (error) throw error;

      loadItemComments(itemId);
      loadAllItemCounts(); // Refresh counts

      toast({
        title: "Kommentar hinzugefügt",
        description: "Ihr Kommentar wurde erfolgreich hinzugefügt.",
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: "Fehler",
        description: "Kommentar konnte nicht hinzugefügt werden.",
        variant: "destructive",
      });
    }
  };

  // Load counts for all items
  const loadAllItemCounts = async (items?: ChecklistItem[]) => {
    if (!selectedPlanning) return;

    try {
      // Get all item IDs - use provided items or current state
      const currentItems = items || checklistItems;
      const itemIds = currentItems.map(item => item.id);
      if (itemIds.length === 0) return;

      // Load subtasks counts
      const { data: subtasksData } = await supabase
        .from('planning_item_subtasks')
        .select('planning_item_id, id, description, is_completed, assigned_to, due_date, order_index, created_at, updated_at, result_text, completed_at, user_id')
        .in('planning_item_id', itemIds);

      const subtasksMap: { [itemId: string]: PlanningSubtask[] } = {};
      (subtasksData || []).forEach(subtask => {
        if (!subtasksMap[subtask.planning_item_id]) {
          subtasksMap[subtask.planning_item_id] = [];
        }
        subtasksMap[subtask.planning_item_id].push({
          ...subtask,
          user_id: subtask.user_id || user?.id || ''
        });
      });
      setItemSubtasks(subtasksMap);

      // Load comments counts
      const { data: commentsData } = await supabase
        .from('planning_item_comments')
        .select('planning_item_id, id, content, user_id, created_at')
        .in('planning_item_id', itemIds);

      // Get profile data for comments
      const userIds = [...new Set(commentsData?.map(c => c.user_id) || [])];
      let profiles: any[] = [];
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', userIds);
        profiles = profilesData || [];
      }

      const commentsMap: { [itemId: string]: PlanningComment[] } = {};
      (commentsData || []).forEach(comment => {
        if (!commentsMap[comment.planning_item_id]) {
          commentsMap[comment.planning_item_id] = [];
        }
        commentsMap[comment.planning_item_id].push({
          ...comment,
          profile: profiles.find(p => p.user_id === comment.user_id) || null,
        });
      });
      setItemComments(commentsMap);

      // Load documents counts
      const { data: documentsData } = await supabase
        .from('planning_item_documents')
        .select('planning_item_id, id, file_name, file_path, file_size, file_type, created_at, user_id')
        .in('planning_item_id', itemIds);

      const documentsMap: { [itemId: string]: PlanningDocument[] } = {};
      (documentsData || []).forEach(doc => {
        if (!documentsMap[doc.planning_item_id]) {
          documentsMap[doc.planning_item_id] = [];
        }
        documentsMap[doc.planning_item_id].push({
          ...doc,
          user_id: doc.user_id || user?.id || ''
        });
      });
      setItemDocuments(documentsMap);
    } catch (error) {
      console.error('Error loading item counts:', error);
    }
  };

  const handleItemFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, itemId: string) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const fileExtension = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExtension}`;
      const filePath = `${user.id}/${itemId}/${fileName}`;

      console.log('Uploading file:', { fileName, filePath, fileSize: file.size, fileType: file.type });

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('planning-documents')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(`Upload fehlgeschlagen: ${uploadError.message}`);
      }

      console.log('Upload successful:', uploadData);

      const { error: dbError } = await supabase
        .from('planning_item_documents')
        .insert({
          planning_item_id: itemId,
          user_id: user.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type,
        });

      if (dbError) {
        console.error('Database error:', dbError);
        throw new Error(`Datenbank-Fehler: ${dbError.message}`);
      }

      loadItemDocuments(itemId);
      loadAllItemCounts();
      
      toast({
        title: "Dokument hochgeladen",
        description: "Das Dokument wurde erfolgreich hinzugefügt.",
      });
    } catch (error) {
      console.error('Error uploading document:', error);
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Das Dokument konnte nicht hochgeladen werden.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const deleteItemDocument = async (doc: PlanningDocument) => {
    try {
      const { error: storageError } = await supabase.storage
        .from('planning-documents')
        .remove([doc.file_path]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('planning_item_documents')
        .delete()
        .eq('id', doc.id);

      if (dbError) throw dbError;

      loadItemDocuments(selectedItemId!);
      loadAllItemCounts(); // Refresh counts
      
      toast({
        title: "Dokument gelöscht",
        description: "Das Dokument wurde erfolgreich entfernt.",
      });
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: "Fehler",
        description: "Das Dokument konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const downloadItemDocument = async (doc: PlanningDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('planning-documents')
        .download(doc.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      toast({
        title: "Fehler",
        description: "Das Dokument konnte nicht heruntergeladen werden.",
        variant: "destructive",
      });
    }
  };

  const deleteItemComment = async (comment: PlanningComment) => {
    if (!user || comment.user_id !== user.id) return;

    try {
      const { error } = await supabase
        .from('planning_item_comments')
        .delete()
        .eq('id', comment.id);

      if (error) throw error;

      loadItemComments(comment.planning_item_id);
      loadAllItemCounts();

      toast({
        title: "Kommentar gelöscht",
        description: "Der Kommentar wurde erfolgreich entfernt.",
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({
        title: "Fehler",
        description: "Kommentar konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const handleSubtaskComplete = async (subtaskId: string, isCompleted: boolean, result: string, itemId: string) => {
    try {
      const updateData = isCompleted 
        ? { 
            is_completed: true, 
            result_text: result || null,
            completed_at: new Date().toISOString()
          }
        : { 
            is_completed: false, 
            result_text: null,
            completed_at: null
          };

      const { error } = await supabase
        .from('planning_item_subtasks')
        .update(updateData)
        .eq('id', subtaskId);

      if (error) throw error;

      loadItemSubtasks(itemId);
      loadAllItemCounts();

      if (isCompleted) {
        toast({
          title: "Unteraufgabe abgeschlossen",
          description: "Die Unteraufgabe wurde erfolgreich als erledigt markiert.",
        });
      }
    } catch (error) {
      console.error('Error updating subtask:', error);
      toast({
        title: "Fehler",
        description: "Unteraufgabe konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  const updateItemComment = async (commentId: string, newContent: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('planning_item_comments')
        .update({ content: newContent, updated_at: new Date().toISOString() })
        .eq('id', commentId)
        .eq('user_id', user.id); // Ensure user can only edit their own comments

      if (error) throw error;

      // Find the comment to get the planning_item_id
      const comment = Object.values(itemComments).flat().find(c => c.id === commentId);
      if (comment) {
        loadItemComments(comment.planning_item_id);
        loadAllItemCounts();
      }

      setEditingComment(prev => ({ ...prev, [commentId]: '' }));

      toast({
        title: "Kommentar aktualisiert",
        description: "Der Kommentar wurde erfolgreich bearbeitet.",
      });
    } catch (error) {
      console.error('Error updating comment:', error);
      toast({
        title: "Fehler",
        description: "Kommentar konnte nicht bearbeitet werden.",
        variant: "destructive",
      });
    }
  };


  if (!selectedPlanning) {
    return (
      <div className="min-h-screen bg-gradient-subtle p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Veranstaltungsplanung</h1>
            <div className="flex items-center gap-4">
              {/* View Toggle for Event Planning */}
              <div className="flex items-center border rounded-lg p-1">
                <Button
                  variant={eventPlanningView === 'card' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => saveViewPreferences('event', 'card')}
                  className="h-8 px-2"
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={eventPlanningView === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => saveViewPreferences('event', 'table')}
                  className="h-8 px-2"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Neue Planung
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Neue Veranstaltungsplanung</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Titel</Label>
                    <Input
                      id="title"
                      value={newPlanningTitle}
                      onChange={(e) => setNewPlanningTitle(e.target.value)}
                      placeholder="Veranstaltungstitel eingeben..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="template">Template</Label>
                    <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Template auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Kein Template</SelectItem>
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
                      id="private"
                      checked={newPlanningIsPrivate}
                      onCheckedChange={setNewPlanningIsPrivate}
                    />
                    <Label htmlFor="private">Nur für mich sichtbar</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={createPlanning}>Erstellen</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </div>
          </div>

          {eventPlanningView === 'card' ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {plannings.map((planning) => {
                // Get collaborators for this planning
                const planningCollaborators = collaborators.filter(c => c.event_planning_id === planning.id);
                
                return (
                  <Card
                    key={planning.id}
                    className="cursor-pointer hover:shadow-md transition-shadow relative"
                    onClick={() => setSelectedPlanning(planning)}
                  >
                    <NewItemIndicator isVisible={isItemNew(planning.id, planning.created_at)} />
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="truncate">{planning.title}</span>
                        {planning.is_private && (
                          <Badge variant="outline" className="ml-2">
                            Privat
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {planning.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {planning.description}
                        </p>
                      )}
                      
                      {planning.location && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <MapPin className="mr-2 h-3 w-3" />
                          {planning.location}
                        </div>
                      )}

                      {planning.confirmed_date && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <CalendarIcon className="mr-2 h-3 w-3" />
                          {format(new Date(planning.confirmed_date), "dd.MM.yyyy", { locale: de })}
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <Badge variant={planning.confirmed_date ? "default" : "secondary"}>
                          {planning.confirmed_date ? "Bestätigt" : "In Planung"}
                        </Badge>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(planning.created_at), "dd.MM.yyyy", { locale: de })}
                        </div>
                      </div>

                      {planningCollaborators.length > 0 && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Users className="mr-2 h-3 w-3" />
                          <div className="flex -space-x-2">
                            {planningCollaborators.slice(0, 3).map((collab) => (
                              <Avatar key={collab.id} className="h-6 w-6 border-2 border-background">
                                <AvatarImage src={collab.profiles?.avatar_url} />
                                <AvatarFallback className="text-xs">
                                  {collab.profiles?.display_name?.[0] || "?"}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                            {planningCollaborators.length > 3 && (
                              <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs">
                                +{planningCollaborators.length - 3}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <EventPlanningTable plannings={plannings} />
          )}

          {/* Separator */}
          <div className="flex items-center my-8">
            <Separator className="flex-1" />
            <div className="px-4 text-muted-foreground text-sm font-medium">
              Terminplanungen
            </div>
            <Separator className="flex-1" />
          </div>

          {/* Appointment Preparations Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Terminplanungen</h2>
              <div className="flex items-center gap-4">
                {/* View Toggle */}
                <div className="flex items-center border rounded-lg p-1">
                  <Button
                    variant={appointmentPreparationView === 'card' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => saveViewPreferences('appointment', 'card')}
                    className="h-8 px-2"
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={appointmentPreparationView === 'table' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => saveViewPreferences('appointment', 'table')}
                    className="h-8 px-2"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant={showArchived ? "outline" : "default"}
                    onClick={() => setShowArchived(false)}
                  >
                    Aktive ({appointmentPreparations.length})
                  </Button>
                  <Button
                    variant={showArchived ? "default" : "outline"}
                    onClick={() => setShowArchived(true)}
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    Archiv ({archivedPreparations.length})
                  </Button>
                </div>
              </div>
            </div>

            {/* Active Preparations */}
            {!showArchived && (
              appointmentPreparationView === 'card' ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {appointmentPreparations.length === 0 ? (
                    <div className="col-span-full text-center py-8 text-muted-foreground">
                      Keine aktiven Terminplanungen vorhanden
                    </div>
                  ) : (
                    appointmentPreparations.map((preparation) => (
                      <Card 
                        key={preparation.id} 
                        className="cursor-pointer hover:shadow-md transition-shadow relative"
                        onClick={() => handlePreparationClick(preparation)}
                      >
                        <NewItemIndicator isVisible={isItemNew(preparation.id, preparation.created_at)} />
                        <CardHeader>
                          <CardTitle className="flex items-center justify-between">
                            <span className="truncate">{preparation.title}</span>
                            <Badge 
                              variant={preparation.status === 'completed' ? 'default' : 
                                     preparation.status === 'in_progress' ? 'secondary' : 'outline'}
                            >
                              {preparation.status === 'completed' ? 'Abgeschlossen' :
                               preparation.status === 'in_progress' ? 'In Bearbeitung' : 'Entwurf'}
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {preparation.notes && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {preparation.notes}
                            </p>
                          )}
                          <p className="text-sm text-muted-foreground">
                            Erstellt am {format(new Date(preparation.created_at), "dd.MM.yyyy", { locale: de })}
                          </p>
                          {preparation.updated_at !== preparation.created_at && (
                            <p className="text-xs text-muted-foreground">
                              Zuletzt bearbeitet am {format(new Date(preparation.updated_at), "dd.MM.yyyy HH:mm", { locale: de })}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              ) : (
                appointmentPreparations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Keine aktiven Terminplanungen vorhanden
                  </div>
                ) : (
                  <AppointmentPreparationTable preparations={appointmentPreparations} />
                )
              )
            )}

            {/* Archived Preparations */}
            {showArchived && (
              appointmentPreparationView === 'card' ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {archivedPreparations.length === 0 ? (
                    <div className="col-span-full text-center py-8 text-muted-foreground">
                      Keine archivierten Terminplanungen vorhanden
                    </div>
                  ) : (
                    archivedPreparations.map((preparation) => (
                      <Card 
                        key={preparation.id} 
                        className="cursor-pointer opacity-75 hover:opacity-100 hover:shadow-md transition-all"
                        onClick={() => handlePreparationClick(preparation)}
                      >
                        <CardHeader>
                          <CardTitle className="flex items-center justify-between">
                            <span className="truncate">{preparation.title}</span>
                            <Badge variant="secondary">
                              Archiviert
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {preparation.notes && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {preparation.notes}
                            </p>
                          )}
                          <p className="text-sm text-muted-foreground">
                            Erstellt am {format(new Date(preparation.created_at), "dd.MM.yyyy", { locale: de })}
                          </p>
                          {preparation.archived_at && (
                            <p className="text-xs text-muted-foreground">
                              Archiviert am {format(new Date(preparation.archived_at), "dd.MM.yyyy HH:mm", { locale: de })}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              ) : (
                archivedPreparations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Keine archivierten Terminplanungen vorhanden
                  </div>
                ) : (
                  <AppointmentPreparationTable preparations={archivedPreparations} isArchived />
                )
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
      <div className="min-h-screen bg-gradient-subtle p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => setSelectedPlanning(null)}>
              ← Zurück
            </Button>
            <h1 className="text-3xl font-bold text-foreground">
              Veranstaltungsplanung
            </h1>
          </div>
          <div className="flex items-center space-x-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Löschen
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Planung löschen</AlertDialogTitle>
                  <AlertDialogDescription>
                    Sind Sie sicher, dass Sie diese Planung löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deletePlanning(selectedPlanning.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Löschen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Grunddaten */}
          <Card className="bg-card shadow-card border-border">
            <CardHeader>
              <CardTitle>Grunddaten</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Titel der Veranstaltung</Label>
                <div className="flex items-center space-x-2">
                  {editingTitle ? (
                    <Input
                      value={tempTitle}
                      onChange={(e) => setTempTitle(e.target.value)}
                      onBlur={() => {
                        updatePlanningField("title", tempTitle);
                        setEditingTitle(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          updatePlanningField("title", tempTitle);
                          setEditingTitle(false);
                        }
                        if (e.key === "Escape") {
                          setTempTitle(selectedPlanning.title);
                          setEditingTitle(false);
                        }
                      }}
                      className="flex-1"
                      autoFocus
                    />
                  ) : (
                    <Input
                      value={selectedPlanning.title}
                      onClick={() => {
                        setTempTitle(selectedPlanning.title);
                        setEditingTitle(true);
                      }}
                      readOnly
                      className="flex-1 cursor-pointer"
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setTempTitle(selectedPlanning.title);
                      setEditingTitle(true);
                    }}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="description">Beschreibung</Label>
                <Textarea
                  id="description"
                  value={selectedPlanning.description || ""}
                  onChange={(e) => updatePlanningField("description", e.target.value)}
                  placeholder="Beschreibung der Veranstaltung..."
                  rows={3}
                  className="min-h-[80px] resize-none"
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = target.scrollHeight + 'px';
                  }}
                />
              </div>
              <div>
                <Label htmlFor="location">Ort</Label>
                <Input
                  id="location"
                  value={selectedPlanning.location || ""}
                  onChange={(e) => updatePlanningField("location", e.target.value)}
                  placeholder="Veranstaltungsort..."
                />
                {!selectedPlanning.is_digital && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDigitalEvent({
                        platform: selectedPlanning.digital_platform || "",
                        link: selectedPlanning.digital_link || "",
                        access_info: selectedPlanning.digital_access_info || "",
                      });
                      setIsDigitalDialogOpen(true);
                    }}
                    className="mt-2"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Digital
                  </Button>
                )}
                {selectedPlanning.is_digital && (
                  <div className="mt-2 p-2 bg-muted rounded-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Digital: {selectedPlanning.digital_platform}</p>
                        {selectedPlanning.digital_link && (
                          <p className="text-xs text-muted-foreground">{selectedPlanning.digital_link}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDigitalEvent({
                              platform: selectedPlanning.digital_platform || "",
                              link: selectedPlanning.digital_link || "",
                              access_info: selectedPlanning.digital_access_info || "",
                            });
                            setIsDigitalDialogOpen(true);
                          }}
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={removeDigitalEventSettings}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="background">Hintergründe</Label>
                <Textarea
                  id="background"
                  value={selectedPlanning.background_info || ""}
                  onChange={(e) => updatePlanningField("background_info", e.target.value)}
                  placeholder="Hintergrundinformationen..."
                  rows={3}
                  className="min-h-[80px] resize-none"
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = target.scrollHeight + 'px';
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Mitarbeiter */}
          <Card className="bg-card shadow-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Mitarbeiter
                <Dialog open={isCollaboratorDialogOpen} onOpenChange={setIsCollaboratorDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Users className="mr-2 h-4 w-4" />
                      Hinzufügen
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Mitarbeiter hinzufügen</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      {allProfiles
                        .filter(profile => 
                          profile.user_id !== user?.id && 
                          !collaborators.some(c => c.user_id === profile.user_id)
                        )
                        .map((profile) => (
                          <div key={profile.user_id} className="flex items-center justify-between">
                            <span>{profile.display_name || 'Unbenannt'}</span>
                            <div className="space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => addCollaborator(profile.user_id, false)}
                              >
                                Nur ansehen
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => addCollaborator(profile.user_id, true)}
                              >
                                Bearbeiten
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </DialogContent>
                </Dialog>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {collaborators.length > 0 ? (
                <div className="space-y-2">
                  {collaborators.map((collaborator) => (
                    <div key={collaborator.id} className="flex items-center justify-between p-2 rounded-md border">
                      <div className="flex items-center space-x-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={collaborator.profiles?.avatar_url} />
                          <AvatarFallback>
                            {collaborator.profiles?.display_name?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <span>{collaborator.profiles?.display_name || 'Unbenannt'}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Select
                          value={collaborator.can_edit ? "edit" : "view"}
                          onValueChange={(value) => updateCollaboratorPermission(collaborator.id, value === "edit")}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="view">Ansehen</SelectItem>
                            <SelectItem value="edit">Bearbeiten</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCollaborator(collaborator.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Noch keine Mitarbeiter hinzugefügt</p>
              )}
            </CardContent>
          </Card>

          {/* Ansprechpersonen */}
          <Card className="bg-card shadow-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Ansprechpersonen
                <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Ansprechperson
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Ansprechperson hinzufügen</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Aus vorhandenen Kontakten wählen</Label>
                          <Select onValueChange={(value) => {
                            if (value !== "none") {
                              fillFromContact(value);
                            }
                          }}>
                            <SelectTrigger>
                              <SelectValue placeholder="Kontakt auswählen..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Manuell eingeben</SelectItem>
                              {availableContacts.map((contact) => (
                                <SelectItem key={contact.id} value={contact.id}>
                                  {contact.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Aus Büro-Mitarbeitern wählen</Label>
                          <Select onValueChange={(value) => {
                            if (value !== "none") {
                              fillFromProfile(value);
                            }
                          }}>
                            <SelectTrigger>
                              <SelectValue placeholder="Mitarbeiter auswählen..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Manuell eingeben</SelectItem>
                              {allProfiles.map((profile) => (
                                <SelectItem key={profile.user_id} value={profile.user_id}>
                                  {profile.display_name || 'Unbenannt'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <Label htmlFor="contact-name">Name</Label>
                        <Input
                          id="contact-name"
                          value={newContact.name}
                          onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                          placeholder="Name der Ansprechperson"
                        />
                      </div>
                      <div>
                        <Label htmlFor="contact-email">E-Mail</Label>
                        <Input
                          id="contact-email"
                          type="email"
                          value={newContact.email}
                          onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                          placeholder="email@beispiel.de"
                        />
                      </div>
                      <div>
                        <Label htmlFor="contact-phone">Telefon</Label>
                        <Input
                          id="contact-phone"
                          type="tel"
                          value={newContact.phone}
                          onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                          placeholder="+49 123 456789"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={addContact}>Hinzufügen</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contacts.length > 0 ? (
                <div className="space-y-2">
                  {contacts.map((contact) => (
                    <div key={contact.id} className="flex items-center justify-between p-2 rounded-md border">
                      <div>
                        <p className="font-medium">{contact.name}</p>
                        <div className="text-sm text-muted-foreground space-y-1">
                          {contact.email && <p>📧 {contact.email}</p>}
                          {contact.phone && <p>📞 {contact.phone}</p>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingContact(contact);
                            setIsEditContactDialogOpen(true);
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeContact(contact.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Noch keine Ansprechpersonen hinzugefügt</p>
              )}
            </CardContent>

            {/* Edit Contact Dialog */}
            <Dialog open={isEditContactDialogOpen} onOpenChange={setIsEditContactDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Ansprechperson bearbeiten</DialogTitle>
                </DialogHeader>
                {editingContact && (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="edit-contact-name">Name</Label>
                      <Input
                        id="edit-contact-name"
                        value={editingContact.name}
                        onChange={(e) => setEditingContact({ ...editingContact, name: e.target.value })}
                        placeholder="Name der Ansprechperson"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-contact-email">E-Mail</Label>
                      <Input
                        id="edit-contact-email"
                        type="email"
                        value={editingContact.email || ""}
                        onChange={(e) => setEditingContact({ ...editingContact, email: e.target.value })}
                        placeholder="email@beispiel.de"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-contact-phone">Telefon</Label>
                      <Input
                        id="edit-contact-phone"
                        type="tel"
                        value={editingContact.phone || ""}
                        onChange={(e) => setEditingContact({ ...editingContact, phone: e.target.value })}
                        placeholder="+49 123 456789"
                      />
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsEditContactDialogOpen(false)}>
                    Abbrechen
                  </Button>
                  <Button onClick={editContact}>Speichern</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Card>

          {/* Referenten */}
          <Card className="bg-card shadow-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Referenten
                <Dialog open={isSpeakerDialogOpen} onOpenChange={setIsSpeakerDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Referent
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Referent hinzufügen</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Aus vorhandenen Kontakten wählen</Label>
                        <Select onValueChange={(value) => {
                          if (value !== "none") {
                            fillSpeakerFromContact(value);
                          }
                        }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Kontakt auswählen..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Manuell eingeben</SelectItem>
                            {availableContacts.map((contact) => (
                              <SelectItem key={contact.id} value={contact.id}>
                                {contact.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Separator />
                      <div>
                        <Label htmlFor="speaker-name">Name</Label>
                        <Input
                          id="speaker-name"
                          value={newSpeaker.name}
                          onChange={(e) => setNewSpeaker({ ...newSpeaker, name: e.target.value })}
                          placeholder="Name des Referenten"
                        />
                      </div>
                      <div>
                        <Label htmlFor="speaker-topic">Thema</Label>
                        <Input
                          id="speaker-topic"
                          value={newSpeaker.topic}
                          onChange={(e) => setNewSpeaker({ ...newSpeaker, topic: e.target.value })}
                          placeholder="Vortragsthema"
                        />
                      </div>
                      <div>
                        <Label htmlFor="speaker-email">E-Mail</Label>
                        <Input
                          id="speaker-email"
                          type="email"
                          value={newSpeaker.email}
                          onChange={(e) => setNewSpeaker({ ...newSpeaker, email: e.target.value })}
                          placeholder="email@beispiel.de"
                        />
                      </div>
                      <div>
                        <Label htmlFor="speaker-phone">Telefon</Label>
                        <Input
                          id="speaker-phone"
                          type="tel"
                          value={newSpeaker.phone}
                          onChange={(e) => setNewSpeaker({ ...newSpeaker, phone: e.target.value })}
                          placeholder="+49 123 456789"
                        />
                      </div>
                      <div>
                        <Label htmlFor="speaker-bio">Biografie</Label>
                        <Textarea
                          id="speaker-bio"
                          value={newSpeaker.bio}
                          onChange={(e) => setNewSpeaker({ ...newSpeaker, bio: e.target.value })}
                          placeholder="Kurze Biografie oder Qualifikation"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={addSpeaker}>Hinzufügen</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {speakers.length > 0 ? (
                <div className="space-y-2">
                  {speakers.map((speaker) => (
                    <div key={speaker.id} className="flex items-center justify-between p-2 rounded-md border">
                      <div>
                        <p className="font-medium">{speaker.name}</p>
                        {speaker.topic && <p className="text-sm font-medium text-primary">{speaker.topic}</p>}
                        <div className="text-sm text-muted-foreground space-y-1">
                          {speaker.email && <p>📧 {speaker.email}</p>}
                          {speaker.phone && <p>📞 {speaker.phone}</p>}
                          {speaker.bio && <p className="mt-1">{speaker.bio}</p>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingSpeaker(speaker);
                            setIsEditSpeakerDialogOpen(true);
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSpeaker(speaker.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Noch keine Referenten hinzugefügt</p>
              )}
            </CardContent>

            {/* Edit Speaker Dialog */}
            <Dialog open={isEditSpeakerDialogOpen} onOpenChange={setIsEditSpeakerDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Referent bearbeiten</DialogTitle>
                </DialogHeader>
                {editingSpeaker && (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="edit-speaker-name">Name</Label>
                      <Input
                        id="edit-speaker-name"
                        value={editingSpeaker.name}
                        onChange={(e) => setEditingSpeaker({ ...editingSpeaker, name: e.target.value })}
                        placeholder="Name des Referenten"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-speaker-topic">Thema</Label>
                      <Input
                        id="edit-speaker-topic"
                        value={editingSpeaker.topic || ""}
                        onChange={(e) => setEditingSpeaker({ ...editingSpeaker, topic: e.target.value })}
                        placeholder="Vortragsthema"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-speaker-email">E-Mail</Label>
                      <Input
                        id="edit-speaker-email"
                        type="email"
                        value={editingSpeaker.email || ""}
                        onChange={(e) => setEditingSpeaker({ ...editingSpeaker, email: e.target.value })}
                        placeholder="email@beispiel.de"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-speaker-phone">Telefon</Label>
                      <Input
                        id="edit-speaker-phone"
                        type="tel"
                        value={editingSpeaker.phone || ""}
                        onChange={(e) => setEditingSpeaker({ ...editingSpeaker, phone: e.target.value })}
                        placeholder="+49 123 456789"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-speaker-bio">Biografie</Label>
                      <Textarea
                        id="edit-speaker-bio"
                        value={editingSpeaker.bio || ""}
                        onChange={(e) => setEditingSpeaker({ ...editingSpeaker, bio: e.target.value })}
                        placeholder="Kurze Biografie oder Qualifikation"
                      />
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsEditSpeakerDialogOpen(false)}>
                    Abbrechen
                  </Button>
                  <Button onClick={editSpeaker}>Speichern</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Card>

          {/* Termine */}
          <Card className="bg-card shadow-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Termine
                {!planningDates.some(d => d.is_confirmed) && (
                  <Dialog open={isDateDialogOpen} onOpenChange={setIsDateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        Termin hinzufügen
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Neuen Termin hinzufügen</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Datum</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !selectedDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {selectedDate ? format(selectedDate, "dd.MM.yyyy", { locale: de }) : "Datum wählen"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={selectedDate}
                                onSelect={setSelectedDate}
                                initialFocus
                                className="pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div>
                          <Label htmlFor="time">Uhrzeit</Label>
                          <Input
                            id="time"
                            type="time"
                            value={selectedTime}
                            onChange={(e) => setSelectedTime(e.target.value)}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={addPlanningDate}>Hinzufügen</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {planningDates.map((date) => (
                  <div key={date.id}>
                    {date.is_confirmed ? (
                      <div className="flex items-center justify-between p-3 rounded-md border bg-primary/10 border-primary">
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4" />
                          <input
                            type="datetime-local"
                            value={new Date(date.date_time).toISOString().slice(0, 16)}
                            onChange={(e) => updateConfirmedDate(date.id, new Date(e.target.value).toISOString())}
                            className="bg-transparent border-none outline-none font-medium"
                          />
                          <Badge variant="default">Bestätigt</Badge>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-3 rounded-md border">
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4" />
                          <span>
                            {format(new Date(date.date_time), "dd.MM.yyyy HH:mm", { locale: de })}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => confirmDate(date.id)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
                {planningDates.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Noch keine Termine hinzugefügt
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Checkliste */}
          <Card className="lg:col-span-2 bg-card shadow-card border-border">
            <CardHeader>
              <CardTitle>Checkliste</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="checklist">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="space-y-2"
                      >
                        {checklistItems.map((item: any, index: number) => (
                          <Draggable key={item.id} draggableId={item.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={cn(
                                  "group",
                                  snapshot.isDragging && "z-50"
                                )}
                              >
                                {item.type === 'separator' ? (
                                  <div className="flex items-center gap-2 py-3 group">
                                    <div {...provided.dragHandleProps} className="text-muted-foreground">
                                      <GripVertical className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1 border-t border-dashed border-border"></div>
                                    <Input
                                      value={item.title || 'Trenner'}
                                      onChange={(e) => updateChecklistItemTitle(item.id, e.target.value)}
                                      className="text-muted-foreground italic text-sm px-2 border-none bg-transparent text-center w-32"
                                      placeholder="Trenner-Text eingeben..."
                                    />
                                    <div className="flex-1 border-t border-dashed border-border"></div>
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => deleteChecklistItem(item.id)}
                                      className="text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                      title="Trenner löschen"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    <div className="flex items-center space-x-2 p-3 border border-border rounded-md bg-background hover:bg-muted/50 transition-colors">
                                      <div {...provided.dragHandleProps} className="text-muted-foreground hover:text-foreground">
                                        <GripVertical className="h-4 w-4" />
                                      </div>
                                      <Checkbox
                                        checked={item.is_completed}
                                        onCheckedChange={() => toggleChecklistItem(item.id, item.is_completed)}
                                      />
                                      <Input
                                        value={item.title}
                                        onChange={(e) => updateChecklistItemTitle(item.id, e.target.value)}
                                        className={cn(
                                          "flex-1 border-none bg-transparent focus:bg-background",
                                          item.is_completed && "line-through text-muted-foreground"
                                        )}
                                      />
                                      <div className="flex items-center space-x-1">
                                        {/* Clickable badges to expand sections */}
                                        {(itemSubtasks[item.id]?.length || 0) > 0 && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setShowItemSubtasks(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                                            className="h-auto p-1"
                                          >
                                            <Badge variant="secondary" className="text-xs">
                                              <ListTodo className="h-3 w-3 mr-1" />
                                              {itemSubtasks[item.id].length}
                                            </Badge>
                                          </Button>
                                        )}
                                        {(itemComments[item.id]?.length || 0) > 0 && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setShowItemComments(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                                            className="h-auto p-1"
                                          >
                                            <Badge variant="secondary" className="text-xs">
                                              <MessageCircle className="h-3 w-3 mr-1" />
                                              {itemComments[item.id].length}
                                            </Badge>
                                          </Button>
                                        )}
                                        {(itemDocuments[item.id]?.length || 0) > 0 && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setShowItemDocuments(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                                            className="h-auto p-1"
                                          >
                                            <Badge variant="secondary" className="text-xs">
                                              <Paperclip className="h-3 w-3 mr-1" />
                                              {itemDocuments[item.id].length}
                                            </Badge>
                                          </Button>
                                        )}
                                        
                                         {/* Add new subtask/comment/document buttons - always visible when there are items */}
                                         <Button 
                                           variant="ghost" 
                                           size="sm"
                                           onClick={() => setShowItemSubtasks(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                                           className="text-muted-foreground hover:text-foreground transition-opacity"
                                           title="Unteraufgabe hinzufügen"
                                         >
                                           <ListTodo className="h-3 w-3" />
                                         </Button>
                                         <Button 
                                           variant="ghost" 
                                           size="sm"
                                           onClick={() => setShowItemComments(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                                           className="text-muted-foreground hover:text-foreground transition-opacity"
                                           title="Kommentar hinzufügen"
                                         >
                                           <MessageCircle className="h-3 w-3" />
                                         </Button>
                                         <Button 
                                           variant="ghost" 
                                           size="sm"
                                           onClick={() => setShowItemDocuments(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                                           className="text-muted-foreground hover:text-foreground transition-opacity"
                                           title="Dokument hinzufügen"
                                         >
                                          <Paperclip className="h-3 w-3" />
                                         </Button>
                                         <Button 
                                           variant="ghost" 
                                           size="sm"
                                           onClick={() => deleteChecklistItem(item.id)}
                                           className="text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                           title="Punkt löschen"
                                         >
                                           <Trash2 className="h-3 w-3" />
                                         </Button>
                                       </div>
                                     </div>

                                    {/* Expanded Subtasks */}
                                    {showItemSubtasks[item.id] && (
                                      <div className="ml-8 space-y-2 border-l-2 border-border pl-4">
                                        <div className="flex items-center space-x-2 text-sm font-medium text-muted-foreground">
                                          <ListTodo className="h-4 w-4" />
                                          Unteraufgaben
                                        </div>
                                         {itemSubtasks[item.id]?.map((subtask) => (
                                           <div key={subtask.id} className="space-y-2 p-2 border border-border rounded bg-muted/30">
                                             <div className="flex items-center space-x-2">
                                               <Checkbox
                                                 checked={subtask.is_completed}
                                                 onCheckedChange={(checked) => {
                                                   if (checked) {
                                                     setCompletingSubtask(subtask.id);
                                                     setCompletionResult('');
                                                   } else {
                                                     // When unchecking, directly update
                                                     supabase
                                                       .from('planning_item_subtasks')
                                                       .update({ 
                                                         is_completed: false,
                                                         result_text: null,
                                                         completed_at: null
                                                       })
                                                       .eq('id', subtask.id)
                                                       .then(() => {
                                                         loadItemSubtasks(item.id);
                                                         loadAllItemCounts();
                                                       });
                                                   }
                                                 }}
                                               />
                                               <Input
                                                 value={subtask.description}
                                                 onChange={(e) => {
                                                   supabase
                                                     .from('planning_item_subtasks')
                                                     .update({ description: e.target.value })
                                                     .eq('id', subtask.id)
                                                     .then(() => {
                                                       loadItemSubtasks(item.id);
                                                     });
                                                 }}
                                                 className={cn(
                                                   "flex-1 text-sm border-none bg-transparent focus:bg-background",
                                                   subtask.is_completed && "line-through text-muted-foreground"
                                                 )}
                                               />
                                               <Select
                                                 value={subtask.assigned_to || 'unassigned'}
                                                 onValueChange={(value) => {
                                                   supabase
                                                     .from('planning_item_subtasks')
                                                     .update({ assigned_to: value === 'unassigned' ? null : value })
                                                     .eq('id', subtask.id)
                                                     .then(() => {
                                                       loadItemSubtasks(item.id);
                                                     });
                                                 }}
                                               >
                                                 <SelectTrigger className="w-[140px] h-8 text-xs">
                                                   <SelectValue placeholder="Zuweisen..." />
                                                 </SelectTrigger>
                                                 <SelectContent>
                                                   <SelectItem value="unassigned">Niemand</SelectItem>
                                                   {allProfiles.map((profile) => (
                                                     <SelectItem key={profile.user_id} value={profile.user_id}>
                                                       {profile.display_name || 'Unbekannt'}
                                                     </SelectItem>
                                                   ))}
                                                 </SelectContent>
                                               </Select>
                                               <Input
                                                 type="date"
                                                 value={subtask.due_date ? format(new Date(subtask.due_date), "yyyy-MM-dd") : ''}
                                                 onChange={(e) => {
                                                   supabase
                                                     .from('planning_item_subtasks')
                                                     .update({ due_date: e.target.value || null })
                                                     .eq('id', subtask.id)
                                                     .then(() => {
                                                       loadItemSubtasks(item.id);
                                                     });
                                                 }}
                                                 className="w-[130px] h-8 text-xs"
                                                 placeholder="Frist..."
                                               />
                                               <Button
                                                 variant="ghost"
                                                 size="sm"
                                                 onClick={() => {
                                                   supabase
                                                     .from('planning_item_subtasks')
                                                     .delete()
                                                     .eq('id', subtask.id)
                                                     .then(() => {
                                                       loadItemSubtasks(item.id);
                                                       loadAllItemCounts();
                                                     });
                                                 }}
                                                 className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                               >
                                                 <Trash2 className="h-3 w-3" />
                                               </Button>
                                             </div>
                                             {/* Result text display */}
                                             {subtask.result_text && (
                                               <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded border-l-4 border-green-500">
                                                 <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">Ergebnis:</p>
                                                 <p className="text-sm text-green-800 dark:text-green-200">{subtask.result_text}</p>
                                                 {subtask.completed_at && (
                                                   <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                                     Abgeschlossen: {format(new Date(subtask.completed_at), "dd.MM.yyyy HH:mm", { locale: de })}
                                                   </p>
                                                 )}
                                               </div>
                                             )}
                                           </div>
                                         ))}
                                         {/* Add new subtask form */}
                                         <div className="space-y-2 pt-2">
                                           <Input
                                             placeholder="Neue Unteraufgabe..."
                                             className="text-sm"
                                              onKeyPress={(e) => {
                                                if (e.key === 'Enter') {
                                                  const input = e.target as HTMLInputElement;
                                                  if (input.value.trim() && user) {
                                                    addItemSubtask(input.value.trim(), 'unassigned', '', item.id);
                                                    input.value = '';
                                                  }
                                                }
                                              }}
                                           />
                                           {/* Quick assignment dropdown */}
                                           <div className="flex gap-2">
                                             <Select
                                               value=""
                                                onValueChange={(value) => {
                                                  const description = (document.querySelector(`input[placeholder="Neue Unteraufgabe..."]`) as HTMLInputElement)?.value;
                                                  if (description?.trim() && user) {
                                                    const assignedTo = value === 'unassigned' ? '' : value;
                                                    addItemSubtask(description.trim(), assignedTo, '', item.id);
                                                    (document.querySelector(`input[placeholder="Neue Unteraufgabe..."]`) as HTMLInputElement).value = '';
                                                  }
                                                }}
                                             >
                                               <SelectTrigger className="w-[200px] h-8 text-xs">
                                                 <SelectValue placeholder="Schnell zuweisen..." />
                                               </SelectTrigger>
                                               <SelectContent>
                                                 <SelectItem value="unassigned">Niemand</SelectItem>
                                                 {allProfiles.map((profile) => (
                                                   <SelectItem key={profile.user_id} value={profile.user_id}>
                                                     {profile.display_name || 'Unbekannt'}
                                                   </SelectItem>
                                                 ))}
                                               </SelectContent>
                                             </Select>
                                           </div>
                                         </div>
                                      </div>
                                    )}

                                    {/* Expanded Comments */}
                                    {showItemComments[item.id] && (
                                      <div className="ml-8 space-y-2 border-l-2 border-border pl-4">
                                        <div className="flex items-center space-x-2 text-sm font-medium text-muted-foreground">
                                          <MessageCircle className="h-4 w-4" />
                                          Kommentare
                                        </div>
                                         {itemComments[item.id]?.map((comment) => (
                                           <div key={comment.id} className="p-2 border border-border rounded bg-muted/30">
                                             <div className="flex items-center justify-between mb-1">
                                               <div className="flex items-center space-x-2">
                                                 <span className="text-xs font-medium">
                                                   {comment.profile?.display_name || 'Unbekannt'}
                                                 </span>
                                                 <span className="text-xs text-muted-foreground">
                                                   {format(new Date(comment.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                                                 </span>
                                               </div>
                                               {comment.user_id === user?.id && (
                                                 <div className="flex space-x-1">
                                                   <Button
                                                     variant="ghost"
                                                     size="sm"
                                                     onClick={() => {
                                                       setEditingComment(prev => ({ 
                                                         ...prev, 
                                                         [comment.id]: comment.content 
                                                       }));
                                                     }}
                                                     className="h-6 w-6 p-0"
                                                   >
                                                     <Edit2 className="h-3 w-3" />
                                                   </Button>
                                                   <Button
                                                     variant="ghost"
                                                     size="sm"
                                                     onClick={() => deleteItemComment(comment)}
                                                     className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                                   >
                                                     <Trash2 className="h-3 w-3" />
                                                   </Button>
                                                 </div>
                                               )}
                                             </div>
                                             {editingComment[comment.id] !== undefined ? (
                                               <div className="space-y-2">
                                                 <Input
                                                   value={editingComment[comment.id]}
                                                   onChange={(e) => setEditingComment(prev => ({
                                                     ...prev,
                                                     [comment.id]: e.target.value
                                                   }))}
                                                   className="text-sm"
                                                   onKeyPress={(e) => {
                                                     if (e.key === 'Enter') {
                                                       updateItemComment(comment.id, editingComment[comment.id]);
                                                     }
                                                     if (e.key === 'Escape') {
                                                       setEditingComment(prev => {
                                                         const newState = { ...prev };
                                                         delete newState[comment.id];
                                                         return newState;
                                                       });
                                                     }
                                                   }}
                                                 />
                                                 <div className="flex space-x-2">
                                                   <Button
                                                     size="sm"
                                                     onClick={() => updateItemComment(comment.id, editingComment[comment.id])}
                                                     className="h-6 text-xs"
                                                   >
                                                     Speichern
                                                   </Button>
                                                   <Button
                                                     size="sm"
                                                     variant="outline"
                                                     onClick={() => {
                                                       setEditingComment(prev => {
                                                         const newState = { ...prev };
                                                         delete newState[comment.id];
                                                         return newState;
                                                       });
                                                     }}
                                                     className="h-6 text-xs"
                                                   >
                                                     Abbrechen
                                                   </Button>
                                                 </div>
                                               </div>
                                             ) : (
                                               <p className="text-sm">{comment.content}</p>
                                             )}
                                           </div>
                                         ))}
                                        {/* Add new comment form */}
                                        <div className="pt-2">
                                          <Input
                                            placeholder="Kommentar hinzufügen..."
                                            className="text-sm"
                                            onKeyPress={(e) => {
                                              if (e.key === 'Enter') {
                                                const input = e.target as HTMLInputElement;
                                                if (input.value.trim()) {
                                                  addItemCommentForItem(item.id, input.value);
                                                  input.value = '';
                                                }
                                              }
                                            }}
                                          />
                                        </div>
                                      </div>
                                    )}

                                    {/* Expanded Documents */}
                                    {showItemDocuments[item.id] && (
                                      <div className="ml-8 space-y-2 border-l-2 border-border pl-4">
                                        <div className="flex items-center space-x-2 text-sm font-medium text-muted-foreground">
                                          <Paperclip className="h-4 w-4" />
                                          Dokumente
                                        </div>
                                        {itemDocuments[item.id]?.map((doc) => (
                                          <div key={doc.id} className="flex items-center justify-between p-2 border border-border rounded bg-muted/30">
                                            <div className="flex items-center space-x-2">
                                              <Paperclip className="h-3 w-3" />
                                              <span className="text-sm truncate">{doc.file_name}</span>
                                            </div>
                                            <div className="flex space-x-1">
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => downloadItemDocument(doc)}
                                              >
                                                <Download className="h-3 w-3" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => deleteItemDocument(doc)}
                                                className="text-destructive hover:text-destructive"
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          </div>
                                        ))}
                                        {/* Add new document form */}
                                        <div className="pt-2">
                                          <Input
                                            type="file"
                                            onChange={(e) => handleItemFileUpload(e, item.id)}
                                            className="text-sm"
                                            disabled={uploading}
                                          />
                                        </div>
                                      </div>
                                    )}

                                    {/* Legacy sub-items (will be migrated to new system) */}
                                    {item.sub_items && Array.isArray(item.sub_items) && item.sub_items.length > 0 && (
                                      <div className="ml-12 space-y-1">
                                        {item.sub_items.map((subItem: any, index: number) => (
                                          <div key={index} className="flex items-center space-x-2">
                                            <Checkbox
                                              checked={subItem.is_completed || false}
                                              onCheckedChange={() => toggleSubItem(item.id, index, subItem.is_completed || false)}
                                            />
                                            <Input
                                              value={subItem.title || ''}
                                              onChange={(e) => updateSubItemTitle(item.id, index, e.target.value)}
                                              className={cn(
                                                "flex-1 text-sm",
                                                subItem.is_completed && "line-through text-muted-foreground"
                                              )}
                                              placeholder="Unterpunkt..."
                                            />
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => removeSubItem(item.id, index)}
                                              className="text-muted-foreground hover:text-destructive"
                                            >
                                              <X className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
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
                
                <div className="flex items-center space-x-2 mt-4">
                  <Input
                    value={newChecklistItem}
                    onChange={(e) => setNewChecklistItem(e.target.value)}
                    placeholder="Neuen Punkt hinzufügen (--- für Trenner)..."
                    onKeyPress={(e) => e.key === "Enter" && addChecklistItem()}
                  />
                  <Button onClick={addChecklistItem}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Result Dialog for Subtasks */}
      <Dialog open={!!completingSubtask} onOpenChange={() => setCompletingSubtask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unteraufgabe abschließen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Wie wurde die Unteraufgabe gelöst?</Label>
              <Textarea
                placeholder="Beschreiben Sie, wie die Unteraufgabe erledigt wurde..."
                value={completionResult}
                onChange={(e) => setCompletionResult(e.target.value)}
                className="mt-2"
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCompletingSubtask(null);
                  setCompletionResult('');
                }}
              >
                Abbrechen
              </Button>
              <Button
                onClick={() => {
                  if (completingSubtask) {
                    // Find the parent item for this subtask
                    const parentItemId = Object.keys(itemSubtasks).find(itemId =>
                      itemSubtasks[itemId].some(subtask => subtask.id === completingSubtask)
                    );
                    if (parentItemId) {
                      handleSubtaskComplete(completingSubtask, true, completionResult, parentItemId);
                      setCompletingSubtask(null);
                      setCompletionResult('');
                    }
                  }
                }}
                disabled={!completionResult.trim()}
              >
                Als erledigt markieren
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Digital Event Dialog */}
      <Dialog open={isDigitalDialogOpen} onOpenChange={setIsDigitalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Digitale Veranstaltung einrichten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="digital-platform">Plattform</Label>
              <Input
                id="digital-platform"
                value={digitalEvent.platform}
                onChange={(e) => setDigitalEvent({ ...digitalEvent, platform: e.target.value })}
                placeholder="z.B. Zoom, Microsoft Teams, etc."
              />
            </div>
            <div>
              <Label htmlFor="digital-link">Meeting-Link</Label>
              <Input
                id="digital-link"
                value={digitalEvent.link}
                onChange={(e) => setDigitalEvent({ ...digitalEvent, link: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label htmlFor="digital-access">Einwahldaten</Label>
              <Textarea
                id="digital-access"
                value={digitalEvent.access_info}
                onChange={(e) => setDigitalEvent({ ...digitalEvent, access_info: e.target.value })}
                placeholder="Meeting-ID, Passwort, Telefonnummer etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={updateDigitalEventSettings}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}