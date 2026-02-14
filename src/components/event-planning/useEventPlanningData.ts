import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNewItemIndicators } from "@/hooks/useNewItemIndicators";
import { usePlanningPreferences } from "@/hooks/usePlanningPreferences";
import { DropResult } from "@hello-pangea/dnd";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import type {
  EventPlanning,
  EventPlanningContact,
  EventPlanningSpeaker,
  EventPlanningDate,
  ChecklistItem,
  PlanningSubtask,
  PlanningComment,
  PlanningDocument,
  GeneralPlanningDocument,
  Collaborator,
  Profile,
  AppointmentPreparation,
} from "./types";

export function useEventPlanningData() {
  console.log('=== EventPlanningView component loaded ===');
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [itemEmailActions, setItemEmailActions] = useState<Record<string, any>>({});
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedEmailItemId, setSelectedEmailItemId] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<{ [commentId: string]: string }>({});
  const [editingSubtask, setEditingSubtask] = useState<{ [id: string]: Partial<PlanningSubtask> }>({});
  const [expandedItems, setExpandedItems] = useState<{ [itemId: string]: { subtasks: boolean; comments: boolean; documents: boolean } }>({});
  const [showItemSubtasks, setShowItemSubtasks] = useState<{ [itemId: string]: boolean }>({});
  const [showItemComments, setShowItemComments] = useState<{ [itemId: string]: boolean }>({});
  const [showItemDocuments, setShowItemDocuments] = useState<{ [itemId: string]: boolean }>({});
  
  const [completingSubtask, setCompletingSubtask] = useState<string | null>(null);
  const [completionResult, setCompletionResult] = useState('');

  const [generalDocuments, setGeneralDocuments] = useState<GeneralPlanningDocument[]>([]);

  const [appointmentPreparations, setAppointmentPreparations] = useState<AppointmentPreparation[]>([]);
  const [archivedPreparations, setArchivedPreparations] = useState<AppointmentPreparation[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  const [archivedPlannings, setArchivedPlannings] = useState<EventPlanning[]>([]);
  const [showPlanningArchive, setShowPlanningArchive] = useState(false);

  const [eventPlanningView, setEventPlanningView] = useState<'card' | 'table'>('card');
  const [appointmentPreparationView, setAppointmentPreparationView] = useState<'card' | 'table'>('card');

  const [isManageCollaboratorsOpen, setIsManageCollaboratorsOpen] = useState(false);
  const [showDefaultCollaboratorsDialog, setShowDefaultCollaboratorsDialog] = useState(false);

  const { defaultCollaborators } = usePlanningPreferences();

  // Handle URL action parameter for QuickActions
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'create-eventplanning') {
      setIsCreateDialogOpen(true);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    console.log('EventPlanningView mounted, user:', user, 'currentTenant:', currentTenant);
    if (!currentTenant || !user) {
      console.log('No currentTenant or user available, skipping data fetching');
      return;
    }
    
    const planningIdParam = searchParams.get('planningId');
    const appointmentId = searchParams.get('appointmentId');
    const appointmentTitle = searchParams.get('title');
    
    if (appointmentId && appointmentTitle) {
      setNewPlanningTitle(`Planung: ${appointmentTitle}`);
      setIsCreateDialogOpen(true);
      navigate('/eventplanning', { replace: true });
    }
    
    const loadData = async () => {
      try {
        await Promise.all([
          fetchPlannings(),
          fetchAllProfiles(),
          fetchAvailableContacts(),
          fetchPlanningTemplates(),
          fetchAppointmentPreparations()
        ]);
        loadViewPreferences();
      } catch (error) {
        console.error('Error loading planning data:', error);
      }
    };
    
    loadData();

    return () => {
      clearAllIndicators();
    };
  }, [user, currentTenant?.id, searchParams]);

  useEffect(() => {
    const planningIdParam = searchParams.get('planningId');
    if (planningIdParam && plannings.length > 0 && !selectedPlanning) {
      const planningToSelect = plannings.find(p => p.id === planningIdParam);
      if (planningToSelect) {
        setSelectedPlanning(planningToSelect);
        navigate('/eventplanning', { replace: true });
      }
    }
  }, [plannings, searchParams, selectedPlanning, navigate]);

  const loadViewPreferences = () => {
    const eventView = localStorage.getItem('eventPlanningView') as 'card' | 'table' | null;
    const appointmentView = localStorage.getItem('appointmentPreparationView') as 'card' | 'table' | null;
    if (eventView) setEventPlanningView(eventView);
    if (appointmentView) setAppointmentPreparationView(appointmentView);
  };

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
    const { data, error } = await supabase.from("planning_templates").select("*").order("name");
    if (error) { console.error("Error fetching planning templates:", error); return; }
    setPlanningTemplates(data || []);
  };

  useEffect(() => {
    if (selectedPlanning) {
      fetchPlanningDetails(selectedPlanning.id);
      loadAllItemCounts();
    }
  }, [selectedPlanning]);

  const fetchPlannings = async () => {
    console.log('fetchPlannings called, user:', user, 'currentTenant:', currentTenant);
    if (!user) { console.log('No user found, returning early'); return; }
    if (!currentTenant || !currentTenant.id) { console.log('No currentTenant or currentTenant.id found, returning early'); return; }

    try {
      setLoading(true);
      const timeoutId = setTimeout(() => { console.error('Supabase query timeout'); setLoading(false); }, 10000);

      const { data, error } = await supabase
        .from("event_plannings")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .or("is_archived.is.null,is_archived.eq.false")
        .order("created_at", { ascending: false });

      clearTimeout(timeoutId);

      if (error) {
        console.error('Error fetching plannings:', error);
        toast({ title: "Fehler", description: `Planungen konnten nicht geladen werden: ${error.message}`, variant: "destructive" });
        return;
      }

      const sortedData = (data || []).sort((a: any, b: any) => {
        if ((a.is_completed || false) !== (b.is_completed || false)) return a.is_completed ? 1 : -1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setPlannings(sortedData);
      
      if (data && data.length > 0) {
        try { await fetchAllCollaborators(data.map(p => p.id)); }
        catch (collabError) { console.error('Error fetching collaborators:', collabError); }
      }
    } catch (err) {
      console.error('Unexpected error in fetchPlannings:', err);
      toast({ title: "Fehler", description: "Ein unerwarteter Fehler ist aufgetreten beim Laden der Planungen.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchArchivedPlannings = async () => {
    if (!user || !currentTenant?.id) return;
    try {
      const { data, error } = await supabase.from("event_plannings").select("*").eq("tenant_id", currentTenant.id).eq("is_archived", true).order("archived_at", { ascending: false });
      if (error) throw error;
      setArchivedPlannings(data || []);
    } catch (error) { console.error('Error fetching archived plannings:', error); }
  };

  const archivePlanning = async (planningId: string) => {
    const planning = plannings.find(p => p.id === planningId);
    if (planning?.user_id !== user?.id) {
      toast({ title: "Keine Berechtigung", description: "Nur der Ersteller kann diese Planung archivieren.", variant: "destructive" });
      return;
    }
    try {
      const { data, error } = await supabase.from("event_plannings").update({ is_archived: true, archived_at: new Date().toISOString() }).eq("id", planningId).eq("user_id", user?.id).select();
      if (error || !data || data.length === 0) throw error || new Error("Update failed");
      toast({ title: "Planung archiviert", description: "Die Veranstaltungsplanung wurde ins Archiv verschoben." });
      if (selectedPlanning?.id === planningId) setSelectedPlanning(null);
      fetchPlannings();
    } catch (error) {
      console.error('Error archiving planning:', error);
      toast({ title: "Fehler", description: "Planung konnte nicht archiviert werden.", variant: "destructive" });
    }
  };

  const togglePlanningCompleted = async (planningId: string, isCompleted: boolean) => {
    try {
      const { error } = await supabase.from("event_plannings").update({ is_completed: isCompleted, completed_at: isCompleted ? new Date().toISOString() : null }).eq("id", planningId).select();
      if (error) throw error;
      toast({ title: isCompleted ? "Planung als erledigt markiert" : "Markierung entfernt" });
      fetchPlannings();
    } catch (error) {
      console.error('Error toggling completed:', error);
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  const restorePlanning = async (planningId: string) => {
    try {
      const { data, error } = await supabase.from("event_plannings").update({ is_archived: false, archived_at: null }).eq("id", planningId).eq("user_id", user?.id).select();
      if (error || !data || data.length === 0) throw error || new Error("Update failed");
      toast({ title: "Planung wiederhergestellt", description: "Die Veranstaltungsplanung wurde aus dem Archiv geholt." });
      fetchPlannings();
      fetchArchivedPlannings();
    } catch (error) {
      console.error('Error restoring planning:', error);
      toast({ title: "Fehler", description: "Planung konnte nicht wiederhergestellt werden.", variant: "destructive" });
    }
  };

  const archivePreparation = async (preparationId: string) => {
    try {
      const { data, error } = await supabase.from("appointment_preparations").update({ is_archived: true, archived_at: new Date().toISOString() }).eq("id", preparationId).select();
      if (error || !data || data.length === 0) throw error || new Error("Update failed");
      toast({ title: "Terminplanung archiviert", description: "Die Terminplanung wurde ins Archiv verschoben." });
      fetchAppointmentPreparations();
    } catch (error) {
      console.error('Error archiving preparation:', error);
      toast({ title: "Fehler", description: "Terminplanung konnte nicht archiviert werden.", variant: "destructive" });
    }
  };

  const fetchAllCollaborators = async (planningIds: string[]) => {
    const { data: collabs } = await supabase.from("event_planning_collaborators").select("*").in("event_planning_id", planningIds);
    if (collabs) {
      const collabsWithProfiles = await Promise.all(
        collabs.map(async (collab) => {
          const { data: profile } = await supabase.from("profiles").select("display_name, avatar_url").eq("user_id", collab.user_id).single();
          return { ...collab, profiles: profile };
        })
      );
      setCollaborators(collabsWithProfiles);
    } else {
      setCollaborators([]);
    }
  };

  const fetchAllProfiles = async () => {
    if (!currentTenant) return;
    try {
      const { data: memberships, error: memberError } = await supabase.from("user_tenant_memberships").select("user_id").eq("tenant_id", currentTenant.id).eq("is_active", true);
      if (memberError) { console.error("Error fetching memberships:", memberError); return; }
      if (!memberships || memberships.length === 0) { setAllProfiles([]); return; }
      const userIds = memberships.map(m => m.user_id);
      const { data: profiles, error: profileError } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", userIds);
      if (profileError) { console.error("Error fetching profiles:", profileError); return; }
      setAllProfiles(profiles || []);
    } catch (error) { console.error("Error in fetchAllProfiles:", error); }
  };

  const fetchAvailableContacts = async () => {
    if (!user) return;
    const { data, error } = await supabase.from("contacts").select("id, name, email, phone, role, organization").eq("user_id", user.id).order("name");
    if (error) { console.error("Error fetching contacts:", error); return; }
    setAvailableContacts(data || []);
  };

  const fetchAppointmentPreparations = async () => {
    if (!user) return;
    try {
      const { data: activeData, error: activeError } = await supabase.from("appointment_preparations").select("*").eq("is_archived", false).order("created_at", { ascending: false });
      if (activeError) console.error("Error fetching active preparations:", activeError);
      else setAppointmentPreparations(activeData || []);

      const { data: archivedData, error: archivedError } = await supabase.from("appointment_preparations").select("*").eq("is_archived", true).order("archived_at", { ascending: false });
      if (archivedError) console.error("Error fetching archived preparations:", archivedError);
      else setArchivedPreparations(archivedData || []);
    } catch (error) { console.error("Error in fetchAppointmentPreparations:", error); }
  };

  const handlePreparationClick = (preparation: AppointmentPreparation) => {
    navigate(`/appointment-preparation/${preparation.id}`);
  };

  const fetchPlanningDetails = async (planningId: string) => {
    const { data: dates } = await supabase.from("event_planning_dates").select("*").eq("event_planning_id", planningId).order("date_time");
    setPlanningDates(dates || []);

    const { data: items } = await supabase.from("event_planning_checklist_items").select("*").eq("event_planning_id", planningId).order("order_index", { ascending: true });
    const transformedItems = (items || []).map(item => ({
      ...item,
      sub_items: Array.isArray(item.sub_items) ? item.sub_items : (item.sub_items ? JSON.parse(item.sub_items as string) : [])
    }));
    setChecklistItems(transformedItems);

    if (transformedItems.length > 0) {
      loadAllItemCounts(transformedItems);
    }

    const { data: collabs } = await supabase.from("event_planning_collaborators").select("*").eq("event_planning_id", planningId);
    if (collabs) {
      const collabsWithProfiles = await Promise.all(
        collabs.map(async (collab) => {
          const { data: profile } = await supabase.from("profiles").select("display_name, avatar_url").eq("user_id", collab.user_id).single();
          return { ...collab, profiles: profile };
        })
      );
      setCollaborators(collabsWithProfiles);
    } else {
      setCollaborators([]);
    }

    const { data: contactsData } = await supabase.from("event_planning_contacts").select("*").eq("event_planning_id", planningId).order("created_at");
    setContacts(contactsData || []);

    const { data: speakersData } = await supabase.from("event_planning_speakers").select("*").eq("event_planning_id", planningId).order("order_index");
    setSpeakers(speakersData || []);

    await loadGeneralDocuments(planningId);
    await fetchEmailActions(planningId);
  };

  const fetchEmailActions = async (planningId: string) => {
    const { data: items } = await supabase.from("event_planning_checklist_items").select("id").eq("event_planning_id", planningId);
    if (!items) return;
    const itemIds = items.map((i) => i.id);
    const { data: actions } = await supabase.from("event_planning_item_actions").select("*").in("checklist_item_id", itemIds).eq("action_type", "email");
    if (actions) {
      const actionsMap: Record<string, any> = {};
      actions.forEach((action) => { actionsMap[action.checklist_item_id] = action; });
      setItemEmailActions(actionsMap);
    }
  };

  function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
    let timeout: NodeJS.Timeout;
    return ((...args: any[]) => { clearTimeout(timeout); timeout = setTimeout(() => func(...args), wait); }) as T;
  }

  const debouncedUpdate = useCallback(
    debounce(async (field: string, value: any, planningId: string) => {
      const { error } = await supabase.from("event_plannings").update({ [field]: value }).eq("id", planningId);
      if (error) toast({ title: "Fehler", description: "Änderung konnte nicht gespeichert werden.", variant: "destructive" });
    }, 500),
    []
  );

  const updatePlanningField = async (field: string, value: any) => {
    if (!selectedPlanning) return;
    setSelectedPlanning({ ...selectedPlanning, [field]: value });
    debouncedUpdate(field, value, selectedPlanning.id);
  };

  const createPlanning = async () => {
    if (!user || !newPlanningTitle.trim()) return;
    if (!currentTenant) {
      toast({ title: "Fehler", description: "Kein Tenant gefunden. Bitte laden Sie die Seite neu.", variant: "destructive" });
      return;
    }

    const { data, error } = await supabase.from("event_plannings").insert({ title: newPlanningTitle, user_id: user.id, tenant_id: currentTenant.id, is_private: newPlanningIsPrivate }).select().single();
    if (error) { toast({ title: "Fehler", description: "Planung konnte nicht erstellt werden.", variant: "destructive" }); return; }

    const templateParam = selectedTemplateId === "none" ? null : selectedTemplateId;
    await supabase.rpc("create_default_checklist_items", { planning_id: data.id, template_id_param: templateParam });

    try {
      const { data: prefs } = await supabase.from("user_planning_preferences").select("default_collaborators").eq("user_id", user.id).eq("tenant_id", currentTenant.id).maybeSingle();
      if (prefs?.default_collaborators && Array.isArray(prefs.default_collaborators)) {
        const collabs = prefs.default_collaborators as unknown as Array<{ user_id: string; can_edit: boolean }>;
        if (collabs.length > 0) {
          const collabsToInsert = collabs.map((c) => ({ event_planning_id: data.id, user_id: c.user_id, can_edit: c.can_edit }));
          await supabase.from("event_planning_collaborators").insert(collabsToInsert);
        }
      }
    } catch (prefError) { console.error("Error adding default collaborators:", prefError); }

    setNewPlanningTitle("");
    setNewPlanningIsPrivate(false);
    setSelectedTemplateId("none");
    setIsCreateDialogOpen(false);
    fetchPlannings();
    setSelectedPlanning(data);
    toast({ title: "Erfolg", description: "Planung wurde erfolgreich erstellt." });
  };

  const deletePlanning = async (planningId: string) => {
    const planningToDelete = plannings.find(p => p.id === planningId);
    if (planningToDelete && planningToDelete.user_id !== user?.id) {
      toast({ title: "Keine Berechtigung", description: "Nur der Ersteller kann diese Planung löschen.", variant: "destructive" });
      return;
    }

    const { data, error } = await supabase.from("event_plannings").delete().eq("id", planningId).eq("user_id", user?.id).select();
    if (error) { toast({ title: "Fehler", description: "Planung konnte nicht gelöscht werden.", variant: "destructive" }); return; }
    if (!data || data.length === 0) { toast({ title: "Fehler", description: "Planung konnte nicht gelöscht werden. Möglicherweise fehlt die Berechtigung.", variant: "destructive" }); return; }

    fetchPlannings();
    if (selectedPlanning?.id === planningId) setSelectedPlanning(null);
    toast({ title: "Erfolg", description: "Planung wurde gelöscht." });
  };

  const addPlanningDate = async () => {
    if (!selectedPlanning || !selectedDate) { toast({ title: "Fehler", description: "Bitte wählen Sie ein Datum aus.", variant: "destructive" }); return; }
    if (!selectedTime || selectedTime === "") { toast({ title: "Fehler", description: "Bitte wählen Sie eine Uhrzeit aus.", variant: "destructive" }); return; }
    if (!currentTenant?.id) { toast({ title: "Fehler", description: "Kein Tenant gefunden. Bitte laden Sie die Seite neu.", variant: "destructive" }); return; }

    try {
      const dateTime = new Date(selectedDate);
      if (isNaN(dateTime.getTime())) throw new Error("Ungültiges Datum");
      const [hours, minutes] = selectedTime.split(":").map(Number);
      if (isNaN(hours) || isNaN(minutes)) throw new Error("Ungültiges Zeitformat");
      dateTime.setHours(hours, minutes, 0, 0);

      const { data, error } = await supabase.from("event_planning_dates").insert({ event_planning_id: selectedPlanning.id, date_time: dateTime.toISOString() }).select().single();
      if (error) throw error;

      const { data: appointment, error: appointmentError } = await supabase.from("appointments").insert({
        user_id: user?.id, tenant_id: currentTenant.id, title: `Geplant: ${selectedPlanning.title}`,
        start_time: dateTime.toISOString(), end_time: new Date(dateTime.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        category: "blocked", status: "planned",
      }).select().single();

      if (!appointmentError && appointment) {
        await supabase.from("event_planning_dates").update({ appointment_id: appointment.id }).eq("id", data.id);
      }

      fetchPlanningDetails(selectedPlanning.id);
      toast({ title: "Erfolg", description: "Termin wurde hinzugefügt und im Kalender geblockt." });
    } catch (error: any) {
      console.error('Error in addPlanningDate:', error);
      toast({ title: "Fehler", description: error.message || "Termin konnte nicht hinzugefügt werden.", variant: "destructive" });
    } finally {
      setSelectedDate(undefined);
      setIsDateDialogOpen(false);
    }
  };

  const confirmDate = async (dateId: string) => {
    if (!selectedPlanning) return;
    await supabase.from("event_planning_dates").update({ is_confirmed: false }).eq("event_planning_id", selectedPlanning.id);
    const { data, error } = await supabase.from("event_planning_dates").update({ is_confirmed: true }).eq("id", dateId).select().single();
    if (error) { toast({ title: "Fehler", description: "Termin konnte nicht bestätigt werden.", variant: "destructive" }); return; }

    await updatePlanningField("confirmed_date", data.date_time);

    const confirmedDate = planningDates.find(d => d.id === dateId);
    if (confirmedDate?.appointment_id) {
      await supabase.from("appointments").update({ title: selectedPlanning.title, category: "appointment", status: "confirmed" }).eq("id", confirmedDate.appointment_id);
    }

    const otherDates = planningDates.filter(d => d.id !== dateId);
    for (const date of otherDates) {
      if (date.appointment_id) await supabase.from("appointments").delete().eq("id", date.appointment_id);
    }
    await supabase.from("event_planning_dates").delete().eq("event_planning_id", selectedPlanning.id).neq("id", dateId);

    fetchPlanningDetails(selectedPlanning.id);
    toast({ title: "Erfolg", description: "Termin wurde bestätigt und andere Termine entfernt." });
  };

  const updateConfirmedDate = async (dateId: string, newDateTime: string) => {
    if (!selectedPlanning) return;
    const { error } = await supabase.from("event_planning_dates").update({ date_time: newDateTime }).eq("id", dateId);
    if (error) { toast({ title: "Fehler", description: "Termin konnte nicht aktualisiert werden.", variant: "destructive" }); return; }

    const dateToUpdate = planningDates.find(d => d.id === dateId);
    if (dateToUpdate?.appointment_id) {
      const newDate = new Date(newDateTime);
      await supabase.from("appointments").update({ start_time: newDate.toISOString(), end_time: new Date(newDate.getTime() + 2 * 60 * 60 * 1000).toISOString() }).eq("id", dateToUpdate.appointment_id);
    }

    await updatePlanningField("confirmed_date", newDateTime);
    fetchPlanningDetails(selectedPlanning.id);
    toast({ title: "Erfolg", description: "Termin wurde aktualisiert." });
  };

  const toggleChecklistItem = async (itemId: string, isCompleted: boolean) => {
    const canEdit = selectedPlanning?.user_id === user?.id || collaborators.some(c => c.user_id === user?.id && c.can_edit);
    if (!canEdit) { toast({ title: "Keine Berechtigung", description: "Sie haben keine Bearbeitungsrechte für diese Checkliste.", variant: "destructive" }); return; }

    const previousItems = [...checklistItems];
    const newCompletedState = !isCompleted;
    setChecklistItems(prev => prev.map(item => item.id === itemId ? { ...item, is_completed: newCompletedState } : item));

    try {
      const { error } = await supabase.from("event_planning_checklist_items").update({ is_completed: newCompletedState }).eq("id", itemId);
      if (error) {
        const isNetworkError = error.message?.includes("Failed to fetch") || error.message?.includes("NetworkError") || error.message?.includes("TypeError");
        if (isNetworkError) {
          console.warn("Network interruption detected, verifying server state...", error);
          setTimeout(async () => {
            if (selectedPlanning) {
              const { data: freshItems } = await supabase.from("event_planning_checklist_items").select("*").eq("event_planning_id", selectedPlanning.id).order("order_index", { ascending: true });
              if (freshItems) setChecklistItems(freshItems.map(item => ({ ...item, sub_items: (item.sub_items || []) as { title: string; is_completed: boolean }[] })));
            }
          }, 500);
          return;
        }
        console.error("Checklist update error:", error);
        setChecklistItems(previousItems);
        toast({ title: "Fehler", description: "Checkliste konnte nicht aktualisiert werden.", variant: "destructive" });
        return;
      }

      const emailAction = itemEmailActions[itemId];
      if (newCompletedState && emailAction?.is_enabled) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await supabase.functions.invoke("send-checklist-email", { body: { actionId: emailAction.id, checklistItemId: itemId } });
            toast({ title: "E-Mail versendet", description: "Benachrichtigung wurde automatisch versendet." });
          }
        } catch (emailError) { console.error("Error sending email:", emailError); }
      }
    } catch (fetchError) {
      console.warn("Network error during checklist update, verifying state...", fetchError);
      setTimeout(async () => {
        if (selectedPlanning) {
          const { data: freshItems } = await supabase.from("event_planning_checklist_items").select("*").eq("event_planning_id", selectedPlanning.id).order("order_index", { ascending: true });
          if (freshItems) setChecklistItems(freshItems.map(item => ({ ...item, sub_items: (item.sub_items || []) as { title: string; is_completed: boolean }[] })));
        }
      }, 500);
    }
  };

  const updateChecklistItemTitle = async (itemId: string, title: string) => {
    const { error } = await supabase.from("event_planning_checklist_items").update({ title }).eq("id", itemId);
    if (error) { toast({ title: "Fehler", description: "Checkliste konnte nicht aktualisiert werden.", variant: "destructive" }); return; }
    setChecklistItems(items => items.map(item => item.id === itemId ? { ...item, title } : item));
  };

  const addChecklistItem = async () => {
    if (!selectedPlanning || !newChecklistItem.trim()) return;
    const maxOrder = Math.max(...checklistItems.map(item => item.order_index), -1);
    const itemType = newChecklistItem.startsWith('---') ? 'separator' : 'item';
    const title = itemType === 'separator' ? newChecklistItem.replace(/^---\s*/, '') : newChecklistItem;

    const { data, error } = await supabase.from("event_planning_checklist_items").insert({ event_planning_id: selectedPlanning.id, title, order_index: maxOrder + 1, type: itemType }).select().single();
    if (error) { toast({ title: "Fehler", description: "Checklisten-Punkt konnte nicht hinzugefügt werden.", variant: "destructive" }); return; }

    const transformedData = { ...data, sub_items: Array.isArray(data.sub_items) ? data.sub_items : (data.sub_items ? JSON.parse(data.sub_items as string) : []) };
    setChecklistItems([...checklistItems, transformedData]);
    setNewChecklistItem("");
  };

  const deleteChecklistItem = async (itemId: string) => {
    try {
      const { error } = await supabase.from("event_planning_checklist_items").delete().eq("id", itemId);
      if (error) throw error;
      setChecklistItems(items => items.filter(item => item.id !== itemId));
      toast({ title: "Erfolg", description: "Checklisten-Punkt wurde gelöscht." });
    } catch (error) {
      console.error('Error deleting checklist item:', error);
      toast({ title: "Fehler", description: "Checklisten-Punkt konnte nicht gelöscht werden.", variant: "destructive" });
    }
  };

  const addCollaborator = async (userId: string, canEdit: boolean) => {
    if (!selectedPlanning) return;
    const { error } = await supabase.from("event_planning_collaborators").insert({ event_planning_id: selectedPlanning.id, user_id: userId, can_edit: canEdit });
    if (error) { toast({ title: "Fehler", description: "Mitarbeiter konnte nicht hinzugefügt werden.", variant: "destructive" }); return; }
    fetchPlanningDetails(selectedPlanning.id);
    setIsCollaboratorDialogOpen(false);
    toast({ title: "Erfolg", description: "Mitarbeiter wurde hinzugefügt." });
  };

  const updateCollaboratorPermission = async (collaboratorId: string, canEdit: boolean) => {
    if (!selectedPlanning) { toast({ title: "Fehler", description: "Keine Planung ausgewählt.", variant: "destructive" }); return; }
    if (selectedPlanning.user_id !== user?.id) { toast({ title: "Keine Berechtigung", description: "Nur der Eigentümer der Veranstaltung kann Berechtigungen ändern.", variant: "destructive" }); return; }

    const { data, error } = await supabase.from("event_planning_collaborators").update({ can_edit: canEdit }).eq("id", collaboratorId).eq("event_planning_id", selectedPlanning.id).select();
    if (error) { toast({ title: "Fehler", description: "Berechtigung konnte nicht aktualisiert werden.", variant: "destructive" }); return; }
    if (!data || data.length === 0) { toast({ title: "Fehler", description: "Keine Änderung vorgenommen. Möglicherweise fehlt die Berechtigung.", variant: "destructive" }); return; }
    setCollaborators(collaborators.map(collab => collab.id === collaboratorId ? { ...collab, can_edit: canEdit } : collab));
    toast({ title: "Erfolg", description: "Berechtigung wurde aktualisiert." });
  };

  const addContact = async () => {
    if (!selectedPlanning || !newContact.name.trim()) return;
    const { data, error } = await supabase.from("event_planning_contacts").insert({ event_planning_id: selectedPlanning.id, name: newContact.name, email: newContact.email || null, phone: newContact.phone || null, role: "contact_person" }).select().single();
    if (error) { toast({ title: "Fehler", description: "Ansprechperson konnte nicht hinzugefügt werden.", variant: "destructive" }); return; }
    setContacts([...contacts, data]);
    setNewContact({ name: "", email: "", phone: "" });
    setIsContactDialogOpen(false);
    toast({ title: "Erfolg", description: "Ansprechperson wurde hinzugefügt." });
  };

  const removeContact = async (contactId: string) => {
    const { error } = await supabase.from("event_planning_contacts").delete().eq("id", contactId);
    if (error) { toast({ title: "Fehler", description: "Ansprechperson konnte nicht entfernt werden.", variant: "destructive" }); return; }
    setContacts(contacts.filter(contact => contact.id !== contactId));
    toast({ title: "Erfolg", description: "Ansprechperson wurde entfernt." });
  };

  const addSpeaker = async () => {
    if (!selectedPlanning || !newSpeaker.name.trim()) return;
    const maxOrder = Math.max(...speakers.map(speaker => speaker.order_index), -1);
    const { data, error } = await supabase.from("event_planning_speakers").insert({ event_planning_id: selectedPlanning.id, name: newSpeaker.name, email: newSpeaker.email || null, phone: newSpeaker.phone || null, bio: newSpeaker.bio || null, topic: newSpeaker.topic || null, order_index: maxOrder + 1 }).select().single();
    if (error) { toast({ title: "Fehler", description: "Referent konnte nicht hinzugefügt werden.", variant: "destructive" }); return; }
    setSpeakers([...speakers, data]);
    setNewSpeaker({ name: "", email: "", phone: "", bio: "", topic: "" });
    setIsSpeakerDialogOpen(false);
    toast({ title: "Erfolg", description: "Referent wurde hinzugefügt." });
  };

  const removeSpeaker = async (speakerId: string) => {
    const { error } = await supabase.from("event_planning_speakers").delete().eq("id", speakerId);
    if (error) { toast({ title: "Fehler", description: "Referent konnte nicht entfernt werden.", variant: "destructive" }); return; }
    setSpeakers(speakers.filter(speaker => speaker.id !== speakerId));
    toast({ title: "Erfolg", description: "Referent wurde entfernt." });
  };

  const editContact = async () => {
    if (!editingContact || !editingContact.name.trim()) return;
    const { data, error } = await supabase.from("event_planning_contacts").update({ name: editingContact.name, email: editingContact.email || null, phone: editingContact.phone || null }).eq("id", editingContact.id).select().single();
    if (error) { toast({ title: "Fehler", description: "Ansprechperson konnte nicht bearbeitet werden.", variant: "destructive" }); return; }
    setContacts(contacts.map(contact => contact.id === editingContact.id ? data : contact));
    setEditingContact(null);
    setIsEditContactDialogOpen(false);
    toast({ title: "Erfolg", description: "Ansprechperson wurde bearbeitet." });
  };

  const editSpeaker = async () => {
    if (!editingSpeaker || !editingSpeaker.name.trim()) return;
    const { data, error } = await supabase.from("event_planning_speakers").update({ name: editingSpeaker.name, email: editingSpeaker.email || null, phone: editingSpeaker.phone || null, bio: editingSpeaker.bio || null, topic: editingSpeaker.topic || null }).eq("id", editingSpeaker.id).select().single();
    if (error) { toast({ title: "Fehler", description: "Referent konnte nicht bearbeitet werden.", variant: "destructive" }); return; }
    setSpeakers(speakers.map(speaker => speaker.id === editingSpeaker.id ? data : speaker));
    setEditingSpeaker(null);
    setIsEditSpeakerDialogOpen(false);
    toast({ title: "Erfolg", description: "Referent wurde bearbeitet." });
  };

  const fillFromContact = (contactId: string) => {
    const contact = availableContacts.find(c => c.id === contactId);
    if (contact) setNewContact({ name: contact.name || "", email: contact.email || "", phone: contact.phone || "" });
  };

  const fillFromProfile = (profileId: string) => {
    const profile = allProfiles.find(p => p.user_id === profileId);
    if (profile) setNewContact({ name: profile.display_name || "", email: "", phone: "" });
  };

  const fillSpeakerFromContact = (contactId: string) => {
    const contact = availableContacts.find(c => c.id === contactId);
    if (contact) setNewSpeaker({ name: contact.name || "", email: contact.email || "", phone: contact.phone || "", bio: contact.role || "", topic: "" });
  };

  const updateDigitalEventSettings = async () => {
    if (!selectedPlanning) return;
    const { error } = await supabase.from("event_plannings").update({ is_digital: true, digital_platform: digitalEvent.platform || null, digital_link: digitalEvent.link || null, digital_access_info: digitalEvent.access_info || null }).eq("id", selectedPlanning.id);
    if (error) { toast({ title: "Fehler", description: "Digitale Einstellungen konnten nicht gespeichert werden.", variant: "destructive" }); return; }
    setSelectedPlanning({ ...selectedPlanning, is_digital: true, digital_platform: digitalEvent.platform, digital_link: digitalEvent.link, digital_access_info: digitalEvent.access_info });
    setIsDigitalDialogOpen(false);
    toast({ title: "Erfolg", description: "Digitale Einstellungen wurden gespeichert." });
  };

  const removeDigitalEventSettings = async () => {
    if (!selectedPlanning) return;
    const { error } = await supabase.from("event_plannings").update({ is_digital: false, digital_platform: null, digital_link: null, digital_access_info: null }).eq("id", selectedPlanning.id);
    if (error) { toast({ title: "Fehler", description: "Digitale Einstellungen konnten nicht entfernt werden.", variant: "destructive" }); return; }
    setSelectedPlanning({ ...selectedPlanning, is_digital: false, digital_platform: undefined, digital_link: undefined, digital_access_info: undefined });
    toast({ title: "Erfolg", description: "Digitale Einstellungen wurden entfernt." });
  };

  const removeCollaborator = async (collaboratorId: string) => {
    if (!selectedPlanning) { toast({ title: "Fehler", description: "Keine Planung ausgewählt.", variant: "destructive" }); return; }
    const { error } = await supabase.from("event_planning_collaborators").delete().eq("id", collaboratorId).eq("event_planning_id", selectedPlanning.id);
    if (error) { toast({ title: "Fehler", description: "Mitarbeiter konnte nicht entfernt werden.", variant: "destructive" }); return; }
    setCollaborators(collaborators.filter(collab => collab.id !== collaboratorId));
    setIsManageCollaboratorsOpen(false);
    toast({ title: "Erfolg", description: "Mitarbeiter wurde entfernt." });
  };

  const loadGeneralDocuments = async (planningId: string) => {
    const { data, error } = await supabase.from('event_planning_documents').select('*').eq('event_planning_id', planningId).order('created_at', { ascending: false });
    if (!error && data) setGeneralDocuments(data);
  };

  const handleGeneralFileUpload = async (files: FileList | null) => {
    if (!files || !selectedPlanning || !currentTenant || !user) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `${currentTenant.id}/general/${selectedPlanning.id}/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('planning-documents').upload(filePath, file);
      if (uploadError) { toast({ title: "Fehler", description: `Upload fehlgeschlagen: ${uploadError.message}`, variant: "destructive" }); continue; }
      const { error: dbError } = await supabase.from('event_planning_documents').insert({ event_planning_id: selectedPlanning.id, file_path: filePath, file_name: file.name, file_size: file.size, file_type: file.type, uploaded_by: user.id, tenant_id: currentTenant.id });
      if (dbError) toast({ title: "Fehler", description: "Dokument-Metadaten konnten nicht gespeichert werden", variant: "destructive" });
    }
    await loadGeneralDocuments(selectedPlanning.id);
    setUploading(false);
    toast({ title: "Erfolg", description: "Dokumente erfolgreich hochgeladen" });
  };

  const downloadGeneralDocument = async (doc: GeneralPlanningDocument) => {
    const { data, error } = await supabase.storage.from('planning-documents').download(doc.file_path);
    if (error) { toast({ title: "Fehler", description: "Download fehlgeschlagen", variant: "destructive" }); return; }
    const url = window.URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url; a.download = doc.file_name;
    document.body.appendChild(a); a.click();
    window.URL.revokeObjectURL(url); document.body.removeChild(a);
  };

  const deleteGeneralDocument = async (docId: string) => {
    const doc = generalDocuments.find(d => d.id === docId);
    if (!doc) return;
    await supabase.storage.from('planning-documents').remove([doc.file_path]);
    await supabase.from('event_planning_documents').delete().eq('id', docId);
    setGeneralDocuments(prev => prev.filter(d => d.id !== docId));
    toast({ title: "Erfolg", description: "Dokument gelöscht" });
  };

  const addSubItem = async (itemId: string) => {
    const currentItem = checklistItems.find(item => item.id === itemId);
    if (!currentItem) return;
    const currentSubItems = currentItem.sub_items || [];
    const newSubItems = [...currentSubItems, { title: '', is_completed: false }];
    const { error } = await supabase.from("event_planning_checklist_items").update({ sub_items: newSubItems }).eq("id", itemId);
    if (error) { toast({ title: "Fehler", description: "Unterpunkt konnte nicht hinzugefügt werden.", variant: "destructive" }); return; }
    setChecklistItems(items => items.map(item => item.id === itemId ? { ...item, sub_items: newSubItems } : item));
  };

  const toggleSubItem = async (itemId: string, subItemIndex: number, isCompleted: boolean) => {
    const currentItem = checklistItems.find(item => item.id === itemId);
    if (!currentItem || !currentItem.sub_items) return;
    const updatedSubItems = currentItem.sub_items.map((subItem: any, index: number) => index === subItemIndex ? { ...subItem, is_completed: !isCompleted } : subItem);
    const { error } = await supabase.from("event_planning_checklist_items").update({ sub_items: updatedSubItems }).eq("id", itemId);
    if (error) { toast({ title: "Fehler", description: "Unterpunkt konnte nicht aktualisiert werden.", variant: "destructive" }); return; }
    setChecklistItems(items => items.map(item => item.id === itemId ? { ...item, sub_items: updatedSubItems } : item));
  };

  const updateSubItemTitle = async (itemId: string, subItemIndex: number, title: string) => {
    const currentItem = checklistItems.find(item => item.id === itemId);
    if (!currentItem || !currentItem.sub_items) return;
    const updatedSubItems = currentItem.sub_items.map((subItem: any, index: number) => index === subItemIndex ? { ...subItem, title } : subItem);
    const { error } = await supabase.from("event_planning_checklist_items").update({ sub_items: updatedSubItems }).eq("id", itemId);
    if (error) { toast({ title: "Fehler", description: "Unterpunkt konnte nicht aktualisiert werden.", variant: "destructive" }); return; }
    setChecklistItems(items => items.map(item => item.id === itemId ? { ...item, sub_items: updatedSubItems } : item));
  };

  const removeSubItem = async (itemId: string, subItemIndex: number) => {
    const currentItem = checklistItems.find(item => item.id === itemId);
    if (!currentItem || !currentItem.sub_items) return;
    const updatedSubItems = currentItem.sub_items.filter((_: any, index: number) => index !== subItemIndex);
    const { error } = await supabase.from("event_planning_checklist_items").update({ sub_items: updatedSubItems }).eq("id", itemId);
    if (error) { toast({ title: "Fehler", description: "Unterpunkt konnte nicht entfernt werden.", variant: "destructive" }); return; }
    setChecklistItems(items => items.map(item => item.id === itemId ? { ...item, sub_items: updatedSubItems } : item));
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(checklistItems);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setChecklistItems(items);
    const updates = items.map((item, index) => ({ id: item.id, order_index: index }));
    try {
      for (const update of updates) {
        await supabase.from("event_planning_checklist_items").update({ order_index: update.order_index }).eq("id", update.id);
      }
    } catch (error) {
      console.error('Error updating item order:', error);
      toast({ title: "Fehler", description: "Reihenfolge konnte nicht gespeichert werden.", variant: "destructive" });
      fetchPlanningDetails(selectedPlanning!.id);
    }
  };

  useEffect(() => {
    if (selectedItemId) {
      loadItemComments(selectedItemId);
      loadItemSubtasks(selectedItemId);
      loadItemDocuments(selectedItemId);
    }
  }, [selectedItemId]);

  const loadItemComments = async (itemId: string) => {
    try {
      const { data: comments, error } = await supabase.from('planning_item_comments').select('*').eq('planning_item_id', itemId).order('created_at', { ascending: true });
      if (error) throw error;
      const userIds = [...new Set(comments?.map(c => c.user_id) || [])];
      let profiles: any[] = [];
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase.from('profiles').select('user_id, display_name, avatar_url').in('user_id', userIds);
        profiles = profilesData || [];
      }
      const formattedComments: PlanningComment[] = (comments || []).map(comment => ({ id: comment.id, planning_item_id: comment.planning_item_id, user_id: comment.user_id, content: comment.content, created_at: comment.created_at, profile: profiles.find(p => p.user_id === comment.user_id) || null }));
      setItemComments(prev => ({ ...prev, [itemId]: formattedComments }));
    } catch (error) { console.error('Error loading item comments:', error); }
  };

  const loadItemSubtasks = async (itemId: string) => {
    try {
      const { data, error } = await supabase.from('planning_item_subtasks').select('*').eq('planning_item_id', itemId).order('order_index', { ascending: true });
      if (error) throw error;
      setItemSubtasks(prev => ({ ...prev, [itemId]: data || [] }));
    } catch (error) { console.error('Error loading item subtasks:', error); }
  };

  const loadItemDocuments = async (itemId: string) => {
    try {
      const { data, error } = await supabase.from('planning_item_documents').select('*').eq('planning_item_id', itemId).order('created_at', { ascending: false });
      if (error) throw error;
      setItemDocuments(prev => ({ ...prev, [itemId]: data || [] }));
    } catch (error) { console.error('Error loading item documents:', error); }
  };

  const addItemComment = async () => {
    if (!newComment.trim() || !selectedItemId || !user) return;
    try {
      const { error } = await supabase.from('planning_item_comments').insert({ planning_item_id: selectedItemId, user_id: user.id, content: newComment.trim() });
      if (error) throw error;
      setNewComment('');
      loadItemComments(selectedItemId);
      loadAllItemCounts();
      toast({ title: "Kommentar hinzugefügt", description: "Ihr Kommentar wurde erfolgreich hinzugefügt." });
    } catch (error) { console.error('Error adding comment:', error); toast({ title: "Fehler", description: "Kommentar konnte nicht hinzugefügt werden.", variant: "destructive" }); }
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
      const { error } = await supabase.from('planning_item_subtasks').insert({ planning_item_id: planningItemId, user_id: user.id, description: desc, assigned_to: assigned === 'unassigned' ? null : assigned, due_date: due || null, order_index: nextOrderIndex });
      if (error) throw error;
      setNewSubtask({ description: '', assigned_to: 'unassigned', due_date: '' });
      loadItemSubtasks(planningItemId);
      loadAllItemCounts();
      toast({ title: "Unteraufgabe hinzugefügt", description: "Die Unteraufgabe wurde erfolgreich erstellt." });
    } catch (error) { console.error('Error adding subtask:', error); toast({ title: "Fehler", description: "Unteraufgabe konnte nicht hinzugefügt werden.", variant: "destructive" }); }
  };

  const addItemCommentForItem = async (itemId: string, comment: string) => {
    if (!comment.trim() || !user) return;
    try {
      const { error } = await supabase.from('planning_item_comments').insert({ planning_item_id: itemId, user_id: user.id, content: comment.trim() });
      if (error) throw error;
      loadItemComments(itemId);
      loadAllItemCounts();
      toast({ title: "Kommentar hinzugefügt", description: "Ihr Kommentar wurde erfolgreich hinzugefügt." });
    } catch (error) { console.error('Error adding comment:', error); toast({ title: "Fehler", description: "Kommentar konnte nicht hinzugefügt werden.", variant: "destructive" }); }
  };

  const loadAllItemCounts = async (items?: ChecklistItem[]) => {
    if (!selectedPlanning) return;
    try {
      const currentItems = items || checklistItems;
      const itemIds = currentItems.map(item => item.id);
      if (itemIds.length === 0) return;

      const { data: subtasksData } = await supabase.from('planning_item_subtasks').select('planning_item_id, id, description, is_completed, assigned_to, due_date, order_index, created_at, updated_at, result_text, completed_at, user_id').in('planning_item_id', itemIds);
      const subtasksMap: { [itemId: string]: PlanningSubtask[] } = {};
      (subtasksData || []).forEach(subtask => {
        if (!subtasksMap[subtask.planning_item_id]) subtasksMap[subtask.planning_item_id] = [];
        subtasksMap[subtask.planning_item_id].push({ ...subtask, user_id: subtask.user_id || user?.id || '' });
      });
      setItemSubtasks(subtasksMap);

      const { data: commentsData } = await supabase.from('planning_item_comments').select('planning_item_id, id, content, user_id, created_at').in('planning_item_id', itemIds);
      const userIds = [...new Set(commentsData?.map(c => c.user_id) || [])];
      let profiles: any[] = [];
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase.from('profiles').select('user_id, display_name, avatar_url').in('user_id', userIds);
        profiles = profilesData || [];
      }
      const commentsMap: { [itemId: string]: PlanningComment[] } = {};
      (commentsData || []).forEach(comment => {
        if (!commentsMap[comment.planning_item_id]) commentsMap[comment.planning_item_id] = [];
        commentsMap[comment.planning_item_id].push({ ...comment, profile: profiles.find(p => p.user_id === comment.user_id) || null });
      });
      setItemComments(commentsMap);

      const { data: documentsData } = await supabase.from('planning_item_documents').select('planning_item_id, id, file_name, file_path, file_size, file_type, created_at, user_id').in('planning_item_id', itemIds);
      const documentsMap: { [itemId: string]: PlanningDocument[] } = {};
      (documentsData || []).forEach(doc => {
        if (!documentsMap[doc.planning_item_id]) documentsMap[doc.planning_item_id] = [];
        documentsMap[doc.planning_item_id].push({ ...doc, user_id: doc.user_id || user?.id || '' });
      });
      setItemDocuments(documentsMap);
    } catch (error) { console.error('Error loading item counts:', error); }
  };

  const handleItemFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, itemId: string) => {
    const file = event.target.files?.[0];
    if (!file || !user || !currentTenant?.id) return;
    setUploading(true);
    try {
      const fileExtension = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExtension}`;
      const filePath = `${currentTenant.id}/planning-items/${itemId}/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('planning-documents').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { error: dbError } = await supabase.from('planning_item_documents').insert({ planning_item_id: itemId, user_id: user.id, tenant_id: currentTenant.id, file_name: file.name, file_path: filePath, file_size: file.size, file_type: file.type });
      if (dbError) throw dbError;
      loadItemDocuments(itemId);
      loadAllItemCounts();
      toast({ title: "Dokument hochgeladen", description: "Das Dokument wurde erfolgreich hinzugefügt." });
    } catch (error) {
      toast({ title: "Upload fehlgeschlagen", description: error instanceof Error ? error.message : "Das Dokument konnte nicht hochgeladen werden.", variant: "destructive" });
    } finally { setUploading(false); event.target.value = ''; }
  };

  const deleteItemDocument = async (doc: PlanningDocument) => {
    try {
      const { error: storageError } = await supabase.storage.from('planning-documents').remove([doc.file_path]);
      if (storageError) throw storageError;
      const { error: dbError } = await supabase.from('planning_item_documents').delete().eq('id', doc.id);
      if (dbError) throw dbError;
      loadItemDocuments(selectedItemId!);
      loadAllItemCounts();
      toast({ title: "Dokument gelöscht", description: "Das Dokument wurde erfolgreich entfernt." });
    } catch (error) { console.error('Error deleting document:', error); toast({ title: "Fehler", description: "Das Dokument konnte nicht gelöscht werden.", variant: "destructive" }); }
  };

  const downloadItemDocument = async (doc: PlanningDocument) => {
    try {
      const { data, error } = await supabase.storage.from('planning-documents').download(doc.file_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url; a.download = doc.file_name;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (error) { console.error('Error downloading document:', error); toast({ title: "Fehler", description: "Das Dokument konnte nicht heruntergeladen werden.", variant: "destructive" }); }
  };

  const deleteItemComment = async (comment: PlanningComment) => {
    if (!user || comment.user_id !== user.id) return;
    try {
      const { error } = await supabase.from('planning_item_comments').delete().eq('id', comment.id);
      if (error) throw error;
      loadItemComments(comment.planning_item_id);
      loadAllItemCounts();
      toast({ title: "Kommentar gelöscht", description: "Der Kommentar wurde erfolgreich entfernt." });
    } catch (error) { console.error('Error deleting comment:', error); toast({ title: "Fehler", description: "Kommentar konnte nicht gelöscht werden.", variant: "destructive" }); }
  };

  const handleSubtaskComplete = async (subtaskId: string, isCompleted: boolean, result: string, itemId: string) => {
    try {
      const updateData = isCompleted 
        ? { is_completed: true, result_text: result || null, completed_at: new Date().toISOString() }
        : { is_completed: false, result_text: null, completed_at: null };
      const { error } = await supabase.from('planning_item_subtasks').update(updateData).eq('id', subtaskId);
      if (error) throw error;
      loadItemSubtasks(itemId);
      loadAllItemCounts();
      if (isCompleted) toast({ title: "Unteraufgabe abgeschlossen", description: "Die Unteraufgabe wurde erfolgreich als erledigt markiert." });
    } catch (error) { console.error('Error updating subtask:', error); toast({ title: "Fehler", description: "Unteraufgabe konnte nicht aktualisiert werden.", variant: "destructive" }); }
  };

  const updateItemComment = async (commentId: string, newContent: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('planning_item_comments').update({ content: newContent, updated_at: new Date().toISOString() }).eq('id', commentId).eq('user_id', user.id);
      if (error) throw error;
      const comment = Object.values(itemComments).flat().find(c => c.id === commentId);
      if (comment) { loadItemComments(comment.planning_item_id); loadAllItemCounts(); }
      setEditingComment(prev => ({ ...prev, [commentId]: '' }));
      toast({ title: "Kommentar aktualisiert", description: "Der Kommentar wurde erfolgreich bearbeitet." });
    } catch (error) { console.error('Error updating comment:', error); toast({ title: "Fehler", description: "Kommentar konnte nicht bearbeitet werden.", variant: "destructive" }); }
  };

  return {
    user, currentTenant, navigate, toast,
    isItemNew,
    plannings, selectedPlanning, setSelectedPlanning,
    planningDates, checklistItems, collaborators, allProfiles,
    contacts, speakers,
    isCreateDialogOpen, setIsCreateDialogOpen,
    isCollaboratorDialogOpen, setIsCollaboratorDialogOpen,
    isDateDialogOpen, setIsDateDialogOpen,
    isContactDialogOpen, setIsContactDialogOpen,
    isSpeakerDialogOpen, setIsSpeakerDialogOpen,
    isDigitalDialogOpen, setIsDigitalDialogOpen,
    newPlanningTitle, setNewPlanningTitle,
    newPlanningIsPrivate, setNewPlanningIsPrivate,
    selectedTemplateId, setSelectedTemplateId,
    planningTemplates,
    selectedDate, setSelectedDate,
    selectedTime, setSelectedTime,
    newChecklistItem, setNewChecklistItem,
    loading,
    newContact, setNewContact,
    newSpeaker, setNewSpeaker,
    editingContact, setEditingContact,
    editingSpeaker, setEditingSpeaker,
    availableContacts,
    isEditContactDialogOpen, setIsEditContactDialogOpen,
    isEditSpeakerDialogOpen, setIsEditSpeakerDialogOpen,
    digitalEvent, setDigitalEvent,
    editingTitle, setEditingTitle,
    tempTitle, setTempTitle,
    selectedItemId, setSelectedItemId,
    itemComments, itemSubtasks, itemDocuments,
    newComment, setNewComment,
    newSubtask, setNewSubtask,
    uploading,
    itemEmailActions,
    emailDialogOpen, setEmailDialogOpen,
    selectedEmailItemId, setSelectedEmailItemId,
    editingComment, setEditingComment,
    editingSubtask, setEditingSubtask,
    expandedItems, setExpandedItems,
    showItemSubtasks, setShowItemSubtasks,
    showItemComments, setShowItemComments,
    showItemDocuments, setShowItemDocuments,
    completingSubtask, setCompletingSubtask,
    completionResult, setCompletionResult,
    generalDocuments,
    appointmentPreparations, archivedPreparations,
    showArchived, setShowArchived,
    archivedPlannings, showPlanningArchive, setShowPlanningArchive,
    eventPlanningView, appointmentPreparationView,
    isManageCollaboratorsOpen, setIsManageCollaboratorsOpen,
    showDefaultCollaboratorsDialog, setShowDefaultCollaboratorsDialog,
    // Functions
    saveViewPreferences, fetchArchivedPlannings,
    archivePlanning, togglePlanningCompleted, restorePlanning,
    archivePreparation, handlePreparationClick,
    updatePlanningField, createPlanning, deletePlanning,
    addPlanningDate, confirmDate, updateConfirmedDate,
    toggleChecklistItem, updateChecklistItemTitle, addChecklistItem, deleteChecklistItem,
    addCollaborator, updateCollaboratorPermission, removeCollaborator,
    addContact, removeContact, editContact,
    addSpeaker, removeSpeaker, editSpeaker,
    fillFromContact, fillFromProfile, fillSpeakerFromContact,
    updateDigitalEventSettings, removeDigitalEventSettings,
    handleGeneralFileUpload, downloadGeneralDocument, deleteGeneralDocument,
    addSubItem, toggleSubItem, updateSubItemTitle, removeSubItem,
    onDragEnd,
    addItemComment, addItemSubtask, addItemCommentForItem,
    handleItemFileUpload, deleteItemDocument, downloadItemDocument,
    deleteItemComment, handleSubtaskComplete, updateItemComment,
    loadItemSubtasks, loadAllItemCounts,
    fetchPlanningDetails, fetchEmailActions,
  };
}
