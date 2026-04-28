import { useState, useEffect, useCallback } from "react";
import { addDays, format } from "date-fns";
import { useNavigate, useSearchParams, useLocation, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useCurrentProfileId } from "@/hooks/useCurrentProfileId";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNewItemIndicators } from "@/hooks/useNewItemIndicators";
import { usePlanningPreferences } from "@/hooks/usePlanningPreferences";
import { debugConsole } from '@/utils/debugConsole';
import { handleAppError } from '@/utils/errorHandler';
import { debounce } from '@/utils/debounce';
import { useChecklistOperations } from "./hooks/useChecklistOperations";
import { useItemDetails } from "./hooks/useItemDetails";
import type {
  EventPlanning,
  EventPlanningContact,
  EventPlanningSpeaker,
  EventPlanningDate,
  EventPlanningTimelineAssignment,
  GeneralPlanningDocument,
  Collaborator,
  Profile,
  AppointmentPreparation,
} from "./types";

interface PlanningTemplateDto {
  id: string;
  name: string;
  [key: string]: unknown;
}

interface ContactOptionDto {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  organization: string | null;
}

interface ItemActionDto {
  id: string;
  checklist_item_id: string;
  action_type: 'email' | 'social_planner' | 'rsvp' | 'social_media';
  [key: string]: unknown;
}

export function useEventPlanningData() {
  debugConsole.log('=== EventPlanningView component loaded ===');
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const currentProfileId = useCurrentProfileId();
  const navigate = useNavigate();
  const location = useLocation();
  const { subId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { isItemNew, clearAllIndicators } = useNewItemIndicators('eventplanning');

  // ── Core state ──
  const [plannings, setPlannings] = useState<EventPlanning[]>([]);
  const [selectedPlanning, setSelectedPlanning] = useState<EventPlanning | null>(null);
  const [planningDates, setPlanningDates] = useState<EventPlanningDate[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [contacts, setContacts] = useState<EventPlanningContact[]>([]);
  const [speakers, setSpeakers] = useState<EventPlanningSpeaker[]>([]);
  const [timelineAssignments, setTimelineAssignments] = useState<EventPlanningTimelineAssignment[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Dialog state ──
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCollaboratorDialogOpen, setIsCollaboratorDialogOpen] = useState(false);
  const [isDateDialogOpen, setIsDateDialogOpen] = useState(false);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [isSpeakerDialogOpen, setIsSpeakerDialogOpen] = useState(false);
  const [isDigitalDialogOpen, setIsDigitalDialogOpen] = useState(false);
  const [isEditContactDialogOpen, setIsEditContactDialogOpen] = useState(false);
  const [isEditSpeakerDialogOpen, setIsEditSpeakerDialogOpen] = useState(false);
  const [isManageCollaboratorsOpen, setIsManageCollaboratorsOpen] = useState(false);
  const [showDefaultCollaboratorsDialog, setShowDefaultCollaboratorsDialog] = useState(false);

  // ── Form state ──
  const [newPlanningTitle, setNewPlanningTitle] = useState("");
  const [newPlanningIsPrivate, setNewPlanningIsPrivate] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("none");
  const [planningTemplates, setPlanningTemplates] = useState<ReadonlyArray<PlanningTemplateDto>>([]);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState("10:00");
  const [newContact, setNewContact] = useState({ name: "", email: "", phone: "" });
  const [newSpeaker, setNewSpeaker] = useState({ name: "", email: "", phone: "", bio: "", topic: "" });
  const [editingContact, setEditingContact] = useState<EventPlanningContact | null>(null);
  const [editingSpeaker, setEditingSpeaker] = useState<EventPlanningSpeaker | null>(null);
  const [availableContacts, setAvailableContacts] = useState<ReadonlyArray<ContactOptionDto>>([]);
  const [digitalEvent, setDigitalEvent] = useState({ platform: "", link: "", access_info: "" });
  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState("");

  // ── Email actions ──
  const [itemEmailActions, setItemEmailActions] = useState<Record<string, ItemActionDto>>({});
  const [itemSocialPlannerActions, setItemSocialPlannerActions] = useState<Record<string, ItemActionDto>>({});
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedEmailItemId, setSelectedEmailItemId] = useState<string | null>(null);

  // ── Documents ──
  const [generalDocuments, setGeneralDocuments] = useState<GeneralPlanningDocument[]>([]);
  const [uploading, setUploading] = useState(false);

  // ── Archive ──
  const [appointmentPreparations, setAppointmentPreparations] = useState<AppointmentPreparation[]>([]);
  const [archivedPreparations, setArchivedPreparations] = useState<AppointmentPreparation[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedPlannings, setArchivedPlannings] = useState<EventPlanning[]>([]);
  const [showPlanningArchive, setShowPlanningArchive] = useState(false);

  // ── View preferences ──
  const [eventPlanningView, setEventPlanningView] = useState<'card' | 'table'>('card');
  const [appointmentPreparationView, setAppointmentPreparationView] = useState<'card' | 'table'>('card');

  const { defaultCollaborators } = usePlanningPreferences();

  // ── Fetch details (needed by sub-hooks) ──
  const fetchPlanningDetails = useCallback(async (planningId: string) => {
    const { data: dates } = await supabase.from("event_planning_dates").select("id, event_planning_id, date_time, is_confirmed, appointment_id, created_at").eq("event_planning_id", planningId).order("date_time");
    setPlanningDates(dates || []);

    const { data: items } = await supabase.from("event_planning_checklist_items").select("id, event_planning_id, title, is_completed, order_index, created_at, updated_at, sub_items, type, relative_due_days, color").eq("event_planning_id", planningId).order("order_index", { ascending: true });
    const transformedItems = (items || []).map((item: Record<string, any>) => ({
      ...item,
      sub_items: Array.isArray(item.sub_items) ? item.sub_items : (item.sub_items ? JSON.parse(item.sub_items as string) : [])
    }));
    checklist.setChecklistItems(transformedItems);

    if (transformedItems.length > 0) {
      itemDetails.loadAllItemCounts(transformedItems);
    }

    const { data: collabs } = await supabase.from("event_planning_collaborators").select("id, event_planning_id, user_id, can_edit, created_at").eq("event_planning_id", planningId);
    if (collabs) {
      const collabsWithProfiles = await Promise.all(
        collabs.map(async (collab: Record<string, any>) => {
          const { data: profile } = await supabase.from("profiles").select("display_name, avatar_url").eq("user_id", collab.user_id).single();
          return { ...collab, profiles: profile };
        })
      );
      setCollaborators(collabsWithProfiles);
    } else {
      setCollaborators([]);
    }

    const { data: contactsData } = await supabase.from("event_planning_contacts").select("id, event_planning_id, name, email, phone, role, created_at, updated_at").eq("event_planning_id", planningId).order("created_at");
    setContacts(contactsData || []);

    const { data: speakersData } = await supabase.from("event_planning_speakers").select("id, event_planning_id, name, email, phone, bio, topic, order_index, created_at, updated_at").eq("event_planning_id", planningId).order("order_index");
    setSpeakers(speakersData || []);

    const { data: timelineData } = await supabase
      .from("event_planning_timeline_assignments")
      .select("id, event_planning_id, checklist_item_id, due_date, notes, created_at, updated_at")
      .eq("event_planning_id", planningId)
      .order("due_date", { ascending: true });
    setTimelineAssignments(timelineData || []);

    await loadGeneralDocuments(planningId);
    await fetchEmailActions(planningId);
  }, []);

  // ── Sub-hooks ──
  const checklist = useChecklistOperations({
    user,
    selectedPlanningId: selectedPlanning?.id,
    collaborators,
    selectedPlanningUserId: selectedPlanning?.user_id,
    itemEmailActions,
    currentTenantId: currentTenant?.id,
    currentProfileId,
    selectedPlanningTitle: selectedPlanning?.title,
    selectedPlanningConfirmedDate: selectedPlanning?.confirmed_date,
    toast,
    onRefreshDetails: fetchPlanningDetails,
    onSocialPlannerActionCreated: (itemId: string, action: ItemActionDto) => {
      setItemSocialPlannerActions((prev) => ({ ...prev, [itemId]: action } as Record<string, ItemActionDto>));
    },
  });

  const itemDetails = useItemDetails({
    user,
    currentTenantId: currentTenant?.id,
    selectedPlanningId: selectedPlanning?.id,
    checklistItems: checklist.checklistItems,
    toast,
  });

  // ── URL actions ──
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'create-eventplanning') {
      setIsCreateDialogOpen(true);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // ── Initial data load ──
  useEffect(() => {
    debugConsole.log('EventPlanningView mounted, user:', user, 'currentTenant:', currentTenant);
    if (!currentTenant || !user) {
      debugConsole.log('No currentTenant or user available, skipping data fetching');
      return;
    }

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
        debugConsole.error('Error loading planning data:', error);
      }
    };

    loadData();
    return () => { clearAllIndicators(); };
  }, [user, currentTenant?.id, searchParams]);

  // ── Deep-link to planning ──
  useEffect(() => {
    const planningIdParam = subId || searchParams.get('planningId');
    if (!planningIdParam || plannings.length === 0) return;

    const planningToSelect = plannings.find((planning) => planning.id === planningIdParam);
    if (!planningToSelect) return;

    if (selectedPlanning?.id !== planningToSelect.id) {
      setSelectedPlanning(planningToSelect);
    }

    if (!subId && searchParams.get('planningId')) {
      navigate(`/eventplanning/${planningToSelect.id}${location.hash || ''}`, { replace: true });
    }
  }, [location.hash, navigate, plannings, searchParams, selectedPlanning?.id, subId]);

  // ── Load details on selection ──
  useEffect(() => {
    if (selectedPlanning) {
      fetchPlanningDetails(selectedPlanning.id);
      itemDetails.loadAllItemCounts();
    }
  }, [selectedPlanning]);

  // ── View preferences ──
  const loadViewPreferences = () => {
    const eventView = localStorage.getItem('eventPlanningView') as 'card' | 'table' | null;
    const appointmentView = localStorage.getItem('appointmentPreparationView') as 'card' | 'table' | null;
    if (eventView) setEventPlanningView(eventView);
    if (appointmentView) setAppointmentPreparationView(appointmentView);
  };

  const saveViewPreferences = (section: 'event' | 'appointment', view: 'card' | 'table') => {
    if (section === 'event') { setEventPlanningView(view); localStorage.setItem('eventPlanningView', view); }
    else { setAppointmentPreparationView(view); localStorage.setItem('appointmentPreparationView', view); }
  };

  // ── Queries ──
  const fetchPlanningTemplates = async () => {
    if (!user) return;
    const { data, error } = await supabase.from("planning_templates").select("id, name, description, template_data, is_default, created_at").order("name");
    if (error) { debugConsole.error("Error fetching planning templates:", error); return; }
    setPlanningTemplates((data ?? []) as ReadonlyArray<PlanningTemplateDto>);
  };

  const fetchPlannings = async () => {
    debugConsole.log('fetchPlannings called, user:', user, 'currentTenant:', currentTenant);
    if (!user) { debugConsole.log('No user found, returning early'); return; }
    if (!currentTenant || !currentTenant.id) { debugConsole.log('No currentTenant or currentTenant.id found, returning early'); return; }

    try {
      setLoading(true);
      const timeoutId = setTimeout(() => { debugConsole.error('Supabase query timeout'); setLoading(false); }, 10000);
      const { data, error } = await supabase.from("event_plannings").select("id, user_id, title, description, location, contact_person, background_info, confirmed_date, is_private, created_at, updated_at, template_id, tenant_id, is_digital, digital_platform, digital_link, digital_access_info, is_archived, archived_at, is_completed, completed_at").eq("tenant_id", currentTenant.id).or("is_archived.is.null,is_archived.eq.false").order("created_at", { ascending: false });
      clearTimeout(timeoutId);
      if (error) {
        debugConsole.error('Error fetching plannings:', error);
        toast({ title: "Fehler", description: `Planungen konnten nicht geladen werden: ${error.message}`, variant: "destructive" });
        return;
      }
      const sortedData = [...((data ?? []) as ReadonlyArray<EventPlanning>)].sort((a, b) => {
        if ((a.is_completed || false) !== (b.is_completed || false)) return a.is_completed ? 1 : -1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setPlannings(sortedData);
      if (data && data.length > 0) {
        try { await fetchAllCollaborators(data.map(p: Record<string, any> => p.id)); }
        catch (collabError) { debugConsole.error('Error fetching collaborators:', collabError); }
      }
    } catch (err) {
      handleAppError(err, { context: 'fetchPlannings', toast: { fn: toast, title: 'Fehler', description: 'Ein unerwarteter Fehler ist aufgetreten beim Laden der Planungen.' } });
    } finally { setLoading(false); }
  };

  const fetchArchivedPlannings = async () => {
    if (!user || !currentTenant?.id) return;
    try {
      const { data, error } = await supabase.from("event_plannings").select("id, user_id, title, description, location, contact_person, background_info, confirmed_date, is_private, created_at, updated_at, template_id, tenant_id, is_digital, digital_platform, digital_link, digital_access_info, is_archived, archived_at, is_completed, completed_at").eq("tenant_id", currentTenant.id).eq("is_archived", true).order("archived_at", { ascending: false });
      if (error) throw error;
      setArchivedPlannings([...(data ?? [])] as EventPlanning[]);
    } catch (error) { handleAppError(error, { context: 'fetchArchivedPlannings' }); }
  };

  const fetchAllCollaborators = async (planningIds: string[]) => {
    const { data: collabs } = await supabase.from("event_planning_collaborators").select("id, event_planning_id, user_id, can_edit, created_at").in("event_planning_id", planningIds);
    if (collabs) {
      const collabsWithProfiles = await Promise.all(
        collabs.map(async (collab: Record<string, any>) => {
          const { data: profile } = await supabase.from("profiles").select("display_name, avatar_url").eq("user_id", collab.user_id).single();
          return { ...collab, profiles: profile };
        })
      );
      setCollaborators(collabsWithProfiles);
    } else { setCollaborators([]); }
  };

  const fetchAllProfiles = async () => {
    if (!currentTenant) return;
    try {
      const { data: memberships, error: memberError } = await supabase.from("user_tenant_memberships").select("user_id").eq("tenant_id", currentTenant.id).eq("is_active", true);
      if (memberError) { debugConsole.error("Error fetching memberships:", memberError); return; }
      if (!memberships || memberships.length === 0) { setAllProfiles([]); return; }
      const userIds = memberships.map(m: Record<string, any> => m.user_id);
      const { data: profiles, error: profileError } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", userIds);
      if (profileError) { debugConsole.error("Error fetching profiles:", profileError); return; }
      setAllProfiles(profiles || []);
    } catch (error) { handleAppError(error, { context: 'fetchAllProfiles' }); }
  };

  const fetchAvailableContacts = async () => {
    if (!user) return;
    const { data, error } = await supabase.from("contacts").select("id, name, email, phone, role, organization").eq("user_id", user.id).order("name");
    if (error) { debugConsole.error("Error fetching contacts:", error); return; }
    setAvailableContacts((data ?? []) as ReadonlyArray<ContactOptionDto>);
  };

  const fetchAppointmentPreparations = async () => {
    if (!user) return;
    try {
      const { data: activeData, error: activeError } = await supabase.from("appointment_preparations").select("id, appointment_id, title, status, is_archived, archived_at, created_at, updated_at, created_by, tenant_id, template_id, notes, checklist_items").eq("is_archived", false).order("created_at", { ascending: false });
      if (activeError) debugConsole.error("Error fetching active preparations:", activeError);

      const { data: archivedData, error: archivedError } = await supabase.from("appointment_preparations").select("id, appointment_id, title, status, is_archived, archived_at, created_at, updated_at, created_by, tenant_id, template_id, notes, checklist_items").eq("is_archived", true).order("archived_at", { ascending: false });
      if (archivedError) debugConsole.error("Error fetching archived preparations:", archivedError);

      // Sync titles with current appointment titles
      const allPreps = [...(activeData || []), ...(archivedData || [])];
      const appointmentIds = allPreps.map(p => p.appointment_id).filter(Boolean) as string[];
      if (appointmentIds.length > 0) {
        const { data: appointments } = await supabase
          .from("appointments")
          .select("id, title")
          .in("id", appointmentIds);
        if (appointments) {
          const titleMap = new Map(appointments.map(a: Record<string, any> => [a.id, a.title]));
          const updateTitle = (prep: any) => {
            const apptTitle = prep.appointment_id ? titleMap.get(prep.appointment_id) : null;
            if (apptTitle) return { ...prep, title: `Terminplanung: ${apptTitle}` };
            return prep;
          };
          setAppointmentPreparations((activeData || []).map(updateTitle));
          setArchivedPreparations((archivedData || []).map(updateTitle));
          return;
        }
      }

      setAppointmentPreparations(activeData || []);
      setArchivedPreparations(archivedData || []);
    } catch (error) { handleAppError(error, { context: 'fetchAppointmentPreparations' }); }
  };

  const fetchEmailActions = async (planningId: string) => {
    const { data: items } = await supabase.from("event_planning_checklist_items").select("id").eq("event_planning_id", planningId);
    if (!items) return;
    const itemIds = items.map((i: Record<string, any>) => i.id);
    const { data: actions } = await supabase.from("event_planning_item_actions").select("*").in("checklist_item_id", itemIds).in("action_type", ["email", "social_planner", "rsvp"]);
    const emailActionsMap: Record<string, ItemActionDto> = {};
    const socialPlannerActionsMap: Record<string, ItemActionDto> = {};
    ((actions ?? []) as ReadonlyArray<ItemActionDto>).forEach((action) => {
      if (action.action_type === "email") {
        emailActionsMap[action.checklist_item_id] = action;
      }
      if (action.action_type === "social_planner" || action.action_type === "rsvp") {
        socialPlannerActionsMap[action.checklist_item_id] = action;
      }
    });
    setItemEmailActions(emailActionsMap);
    setItemSocialPlannerActions(socialPlannerActionsMap);
  };

  const loadGeneralDocuments = async (planningId: string) => {
    const { data, error } = await supabase.from('event_planning_documents').select('*').eq('event_planning_id', planningId).order('created_at', { ascending: false });
    if (!error && data) setGeneralDocuments(data);
  };

  // ── Mutations ──
  const debouncedUpdate = useCallback(
    debounce(async (field: string, value: unknown, planningId: string): Promise<void> => {
      const { error } = await supabase.from("event_plannings").update({ [field]: value }).eq("id", planningId);
      if (error) toast({ title: "Fehler", description: "Änderung konnte nicht gespeichert werden.", variant: "destructive" });
    }, 500),
    []
  );

  const updatePlanningField = async (field: string, value: unknown): Promise<void> => {
    if (!selectedPlanning) return;
    const currentPlanningId = selectedPlanning.id;

    setSelectedPlanning((prev) => (prev ? { ...prev, [field]: value } : prev));
    setPlannings((prev) => prev.map((planning) => (
      planning.id === currentPlanningId
        ? { ...planning, [field]: value }
        : planning
    )));
    debouncedUpdate(field, value, currentPlanningId);

    if (field === "title") {
      const confirmedAppointmentId = planningDates.find((date) => date.is_confirmed && date.appointment_id)?.appointment_id;

      if (confirmedAppointmentId) {
        const { error } = await supabase
          .from("appointments")
          .update({ title: value })
          .eq("id", confirmedAppointmentId);

        if (error) {
          toast({
            title: "Fehler",
            description: "Der verknüpfte Termin konnte nicht umbenannt werden.",
            variant: "destructive",
          });
        }
      }
    }
  };

  const syncRelativeTimelineAssignments = async (planningId: string, confirmedDate: string | null | undefined) => {
    if (!confirmedDate) return;

    const eventDate = new Date(confirmedDate);
    if (Number.isNaN(eventDate.getTime())) return;

    const { data: relativeItems, error: relativeItemsError } = await supabase
      .from("event_planning_checklist_items")
      .select("id, relative_due_days")
      .eq("event_planning_id", planningId)
      .not("relative_due_days", "is", null);

    if (relativeItemsError || !relativeItems?.length) {
      return;
    }

    const assignments = relativeItems
      .filter((item: Record<string, any>) => typeof item.relative_due_days === "number")
      .map((item: Record<string, any>) => ({
        event_planning_id: planningId,
        checklist_item_id: item.id,
        due_date: format(addDays(eventDate, item.relative_due_days as number), "yyyy-MM-dd"),
      }));

    if (!assignments.length) {
      return;
    }

    const { data, error } = await supabase
      .from("event_planning_timeline_assignments")
      .upsert(assignments, { onConflict: "event_planning_id,checklist_item_id" })
      .select();

    if (error || !data) {
      toast({ title: "Fehler", description: "Relative Fristen konnten nicht in den Zeitstrahl übernommen werden.", variant: "destructive" });
      return;
    }

    setTimelineAssignments((prev) => {
      const updatedIds = new Set(data.map((assignment: Record<string, any>) => assignment.checklist_item_id));
      const remaining = prev.filter((assignment) => !updatedIds.has(assignment.checklist_item_id));
      return [...remaining, ...data].sort((a, b) => a.due_date.localeCompare(b.due_date));
    });
  };

  const upsertTimelineAssignment = async (checklistItemId: string, dueDate: string) => {
    if (!selectedPlanning) return { success: false as const };

    const { data, error } = await supabase
      .from("event_planning_timeline_assignments")
      .upsert(
        [{
          event_planning_id: selectedPlanning.id,
          checklist_item_id: checklistItemId,
          due_date: dueDate,
        }],
        { onConflict: "event_planning_id,checklist_item_id" },
      )
      .select()
      .single();

    if (error || !data) {
      toast({ title: "Fehler", description: "Zeitstrahl-Punkt konnte nicht gespeichert werden.", variant: "destructive" });
      return { success: false as const };
    }

    setTimelineAssignments((prev) => {
      const withoutCurrent = prev.filter((assignment) => assignment.checklist_item_id !== checklistItemId);
      return [...withoutCurrent, data].sort((a, b) => a.due_date.localeCompare(b.due_date));
    });

    return { success: true as const, data };
  };

  const removeTimelineAssignment = async (checklistItemId: string) => {
    if (!selectedPlanning) return { success: false as const };

    const { error } = await supabase
      .from("event_planning_timeline_assignments")
      .delete()
      .eq("event_planning_id", selectedPlanning.id)
      .eq("checklist_item_id", checklistItemId);

    if (error) {
      toast({ title: "Fehler", description: "Zeitstrahl-Punkt konnte nicht entfernt werden.", variant: "destructive" });
      return { success: false as const };
    }

    setTimelineAssignments((prev) => prev.filter((assignment) => assignment.checklist_item_id !== checklistItemId));
    return { success: true as const };
  };

  const createPlanning = async () => {
    if (!user || !newPlanningTitle.trim()) return;
    if (!currentTenant) { toast({ title: "Fehler", description: "Kein Tenant gefunden. Bitte laden Sie die Seite neu.", variant: "destructive" }); return; }

    const { data, error } = await supabase.from("event_plannings").insert([{ title: newPlanningTitle, user_id: user.id, tenant_id: currentTenant.id, is_private: newPlanningIsPrivate }]).select().single();
    if (error) { toast({ title: "Fehler", description: "Planung konnte nicht erstellt werden.", variant: "destructive" }); return; }

    const templateParam: string | null = selectedTemplateId === "none" ? null : selectedTemplateId;
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
    } catch (prefError) { debugConsole.error("Error adding default collaborators:", prefError); }

    setNewPlanningTitle("");
    setNewPlanningIsPrivate(false);
    setSelectedTemplateId("none");
    setIsCreateDialogOpen(false);
    fetchPlannings();
    setSelectedPlanning(data);
    toast({ title: "Erfolg", description: "Planung wurde erfolgreich erstellt." });
  };

  const deletePlanning = async (planningId: string) => {
    if (!user?.id) return;
    const planningToDelete = plannings.find(p => p.id === planningId);
    if (planningToDelete && planningToDelete.user_id !== user.id) { toast({ title: "Keine Berechtigung", description: "Nur der Ersteller kann diese Planung löschen.", variant: "destructive" }); return; }
    const { data, error } = await supabase.from("event_plannings").delete().eq("id", planningId).eq("user_id", user.id).select();
    if (error) { toast({ title: "Fehler", description: "Planung konnte nicht gelöscht werden.", variant: "destructive" }); return; }
    if (!data || data.length === 0) { toast({ title: "Fehler", description: "Planung konnte nicht gelöscht werden. Möglicherweise fehlt die Berechtigung.", variant: "destructive" }); return; }
    fetchPlannings();
    if (selectedPlanning?.id === planningId) setSelectedPlanning(null);
    toast({ title: "Erfolg", description: "Planung wurde gelöscht." });
  };

  const archivePlanning = async (planningId: string) => {
    if (!user?.id) return;
    const planning = plannings.find(p => p.id === planningId);
    if (planning?.user_id !== user.id) { toast({ title: "Keine Berechtigung", description: "Nur der Ersteller kann diese Planung archivieren.", variant: "destructive" }); return; }
    try {
      const { data, error } = await supabase.from("event_plannings").update({ is_archived: true, archived_at: new Date().toISOString() }).eq("id", planningId).eq("user_id", user.id).select();
      if (error || !data || data.length === 0) throw error || new Error("Update failed");
      toast({ title: "Planung archiviert", description: "Die Veranstaltungsplanung wurde ins Archiv verschoben." });
      if (selectedPlanning?.id === planningId) setSelectedPlanning(null);
      fetchPlannings();
    } catch (error) { handleAppError(error, { context: 'archivePlanning', toast: { fn: toast, title: 'Fehler', description: 'Planung konnte nicht archiviert werden.' } }); }
  };

  const togglePlanningCompleted = async (planningId: string, isCompleted: boolean) => {
    try {
      const { error } = await supabase.from("event_plannings").update({ is_completed: isCompleted, completed_at: isCompleted ? new Date().toISOString() : null }).eq("id", planningId).select();
      if (error) throw error;
      toast({ title: isCompleted ? "Planung als erledigt markiert" : "Markierung entfernt" });
      fetchPlannings();
    } catch (error) { handleAppError(error, { context: 'togglePlanningCompleted', toast: { fn: toast, title: 'Fehler' } }); }
  };

  const restorePlanning = async (planningId: string) => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase.from("event_plannings").update({ is_archived: false, archived_at: null }).eq("id", planningId).eq("user_id", user.id).select();
      if (error || !data || data.length === 0) throw error || new Error("Update failed");
      toast({ title: "Planung wiederhergestellt", description: "Die Veranstaltungsplanung wurde aus dem Archiv geholt." });
      fetchPlannings();
      fetchArchivedPlannings();
    } catch (error) { handleAppError(error, { context: 'restorePlanning', toast: { fn: toast, title: 'Fehler', description: 'Planung konnte nicht wiederhergestellt werden.' } }); }
  };

  const archivePreparation = async (preparationId: string) => {
    try {
      const { data, error } = await supabase.from("appointment_preparations").update({ is_archived: true, archived_at: new Date().toISOString() }).eq("id", preparationId).select();
      if (error || !data || data.length === 0) throw error || new Error("Update failed");
      toast({ title: "Terminplanung archiviert", description: "Die Terminplanung wurde ins Archiv verschoben." });
      fetchAppointmentPreparations();
    } catch (error) { handleAppError(error, { context: 'archivePreparation', toast: { fn: toast, title: 'Fehler', description: 'Terminplanung konnte nicht archiviert werden.' } }); }
  };

  const handlePreparationClick = (preparation: AppointmentPreparation) => {
    navigate(`/appointment-preparation/${preparation.id}`);
  };

  // ── Date operations ──
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

      const { data, error } = await supabase.from("event_planning_dates").insert([{ event_planning_id: selectedPlanning.id, date_time: dateTime.toISOString() }]).select().single();
      if (error) throw error;

      const { data: appointment, error: appointmentError } = await supabase.from("appointments").insert([{
        user_id: user!.id, tenant_id: currentTenant.id, title: `Geplant: ${selectedPlanning.title}`,
        start_time: dateTime.toISOString(), end_time: new Date(dateTime.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        category: "blocked", status: "planned",
      }]).select().single();

      if (!appointmentError && appointment) {
        await supabase.from("event_planning_dates").update({ appointment_id: appointment.id }).eq("id", data.id);
      }

      fetchPlanningDetails(selectedPlanning.id);
      toast({ title: "Erfolg", description: "Termin wurde hinzugefügt und im Kalender geblockt." });
    } catch (error: unknown) {
      debugConsole.error('Error in addPlanningDate:', error);
      toast({ title: "Fehler", description: error instanceof Error ? error.message : "Termin konnte nicht hinzugefügt werden.", variant: "destructive" });
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
    await syncRelativeTimelineAssignments(selectedPlanning.id, data.date_time);
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
    await syncRelativeTimelineAssignments(selectedPlanning.id, newDateTime);
    fetchPlanningDetails(selectedPlanning.id);
    toast({ title: "Erfolg", description: "Termin wurde aktualisiert." });
  };

  // ── Collaborator operations ──
  const addCollaborator = async (userId: string, canEdit: boolean) => {
    if (!selectedPlanning) return;
    const existingCollaborator = collaborators.find((collab) => collab.event_planning_id === selectedPlanning.id && collab.user_id === userId);
    if (existingCollaborator) {
      if (existingCollaborator.can_edit === canEdit) { toast({ title: "Hinweis", description: "Mitarbeiter ist bereits mit dieser Berechtigung freigegeben." }); return; }
      await updateCollaboratorPermission(existingCollaborator.id, canEdit);
      setIsCollaboratorDialogOpen(false);
      return;
    }
    const { error } = await supabase.from("event_planning_collaborators").upsert({ event_planning_id: selectedPlanning.id, user_id: userId, can_edit: canEdit }, { onConflict: "event_planning_id,user_id" });
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

  const removeCollaborator = async (collaboratorId: string) => {
    if (!selectedPlanning) { toast({ title: "Fehler", description: "Keine Planung ausgewählt.", variant: "destructive" }); return; }
    const { error } = await supabase.from("event_planning_collaborators").delete().eq("id", collaboratorId).eq("event_planning_id", selectedPlanning.id);
    if (error) { toast({ title: "Fehler", description: "Mitarbeiter konnte nicht entfernt werden.", variant: "destructive" }); return; }
    setCollaborators(collaborators.filter(collab => collab.id !== collaboratorId));
    setIsManageCollaboratorsOpen(false);
    toast({ title: "Erfolg", description: "Mitarbeiter wurde entfernt." });
  };

  // ── Contact operations ──
  const addContact = async () => {
    if (!selectedPlanning || !newContact.name.trim()) return;
    const { data, error } = await supabase.from("event_planning_contacts").insert([{ event_planning_id: selectedPlanning.id, name: newContact.name, email: newContact.email || null, phone: newContact.phone || null, role: "contact_person" }]).select().single();
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

  const editContact = async () => {
    if (!editingContact || !editingContact.name.trim()) return;
    const { data, error } = await supabase.from("event_planning_contacts").update({ name: editingContact.name, email: editingContact.email || null, phone: editingContact.phone || null }).eq("id", editingContact.id).select().single();
    if (error) { toast({ title: "Fehler", description: "Ansprechperson konnte nicht bearbeitet werden.", variant: "destructive" }); return; }
    setContacts(contacts.map(contact => contact.id === editingContact.id ? data : contact));
    setEditingContact(null);
    setIsEditContactDialogOpen(false);
    toast({ title: "Erfolg", description: "Ansprechperson wurde bearbeitet." });
  };

  const fillFromContact = (contactId: string) => {
    const contact = availableContacts.find(c => c.id === contactId);
    if (contact) setNewContact({ name: contact.name || "", email: contact.email || "", phone: contact.phone || "" });
  };

  const fillFromProfile = (profileId: string) => {
    const profile = allProfiles.find(p => p.user_id === profileId);
    if (profile) setNewContact({ name: profile.display_name || "", email: "", phone: "" });
  };

  // ── Speaker operations ──
  const addSpeaker = async () => {
    if (!selectedPlanning || !newSpeaker.name.trim()) return;
    const maxOrder = Math.max(...speakers.map(speaker => speaker.order_index ?? 0), -1);
    const { data, error } = await supabase.from("event_planning_speakers").insert([{ event_planning_id: selectedPlanning.id, name: newSpeaker.name, email: newSpeaker.email || null, phone: newSpeaker.phone || null, bio: newSpeaker.bio || null, topic: newSpeaker.topic || null, order_index: maxOrder + 1 }]).select().single();
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

  const editSpeaker = async () => {
    if (!editingSpeaker || !editingSpeaker.name.trim()) return;
    const { data, error } = await supabase.from("event_planning_speakers").update({ name: editingSpeaker.name, email: editingSpeaker.email || null, phone: editingSpeaker.phone || null, bio: editingSpeaker.bio || null, topic: editingSpeaker.topic || null }).eq("id", editingSpeaker.id).select().single();
    if (error) { toast({ title: "Fehler", description: "Referent konnte nicht bearbeitet werden.", variant: "destructive" }); return; }
    setSpeakers(speakers.map(speaker => speaker.id === editingSpeaker.id ? data : speaker));
    setEditingSpeaker(null);
    setIsEditSpeakerDialogOpen(false);
    toast({ title: "Erfolg", description: "Referent wurde bearbeitet." });
  };

  const fillSpeakerFromContact = (contactId: string) => {
    const contact = availableContacts.find(c => c.id === contactId);
    if (contact) setNewSpeaker({ name: contact.name || "", email: contact.email || "", phone: contact.phone || "", bio: contact.role || "", topic: "" });
  };

  // ── Digital event ──
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

  // ── General documents ──
  const handleGeneralFileUpload = async (files: FileList | null) => {
    if (!files || !selectedPlanning || !currentTenant || !user) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `${currentTenant.id}/general/${selectedPlanning.id}/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('planning-documents').upload(filePath, file);
      if (uploadError) { toast({ title: "Fehler", description: `Upload fehlgeschlagen: ${uploadError.message}`, variant: "destructive" }); continue; }
      const { error: dbError } = await supabase.from('event_planning_documents').insert([{ event_planning_id: selectedPlanning.id, file_path: filePath, file_name: file.name, file_size: file.size, file_type: file.type, uploaded_by: user.id, tenant_id: currentTenant.id }]);
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

  // ── Return (same shape as before) ──
  return {
    user, currentTenant, navigate, toast,
    isItemNew,
    plannings, selectedPlanning, setSelectedPlanning,
    planningDates, checklistItems: checklist.checklistItems, collaborators, allProfiles,
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
    newChecklistItem: checklist.newChecklistItem, setNewChecklistItem: checklist.setNewChecklistItem,
    newChecklistItemType: checklist.newChecklistItemType, setNewChecklistItemType: checklist.setNewChecklistItemType,
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
    selectedItemId: itemDetails.selectedItemId, setSelectedItemId: itemDetails.setSelectedItemId,
    itemComments: itemDetails.itemComments, itemSubtasks: itemDetails.itemSubtasks, itemDocuments: itemDetails.itemDocuments,
    newComment: itemDetails.newComment, setNewComment: itemDetails.setNewComment,
    newSubtask: itemDetails.newSubtask, setNewSubtask: itemDetails.setNewSubtask,
    uploading: uploading || itemDetails.uploading,
    itemEmailActions, itemSocialPlannerActions,
    emailDialogOpen, setEmailDialogOpen,
    selectedEmailItemId, setSelectedEmailItemId,
    editingComment: itemDetails.editingComment, setEditingComment: itemDetails.setEditingComment,
    editingSubtask: itemDetails.editingSubtask, setEditingSubtask: itemDetails.setEditingSubtask,
    expandedItems: itemDetails.expandedItems, setExpandedItems: itemDetails.setExpandedItems,
    showItemSubtasks: itemDetails.showItemSubtasks, setShowItemSubtasks: itemDetails.setShowItemSubtasks,
    showItemComments: itemDetails.showItemComments, setShowItemComments: itemDetails.setShowItemComments,
    showItemDocuments: itemDetails.showItemDocuments, setShowItemDocuments: itemDetails.setShowItemDocuments,
    completingSubtask: itemDetails.completingSubtask, setCompletingSubtask: itemDetails.setCompletingSubtask,
    completionResult: itemDetails.completionResult, setCompletionResult: itemDetails.setCompletionResult,
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
    toggleChecklistItem: checklist.toggleChecklistItem,
    updateChecklistItemTitle: checklist.updateChecklistItemTitle,
    addChecklistItem: checklist.addChecklistItem,
    deleteChecklistItem: checklist.deleteChecklistItem,
    addCollaborator, updateCollaboratorPermission, removeCollaborator,
    addContact, removeContact, editContact,
    addSpeaker, removeSpeaker, editSpeaker,
    fillFromContact, fillFromProfile, fillSpeakerFromContact,
    updateDigitalEventSettings, removeDigitalEventSettings,
    handleGeneralFileUpload, downloadGeneralDocument, deleteGeneralDocument,
    addSubItem: checklist.addSubItem,
    toggleSubItem: checklist.toggleSubItem,
    updateSubItemTitle: checklist.updateSubItemTitle,
    removeSubItem: checklist.removeSubItem,
    onDragEnd: checklist.onDragEnd,
    updateChecklistItemColor: checklist.updateChecklistItemColor,
    addItemComment: itemDetails.addItemComment,
    addItemSubtask: itemDetails.addItemSubtask,
    addItemCommentForItem: itemDetails.addItemCommentForItem,
    handleItemFileUpload: itemDetails.handleItemFileUpload,
    deleteItemDocument: itemDetails.deleteItemDocument,
    downloadItemDocument: itemDetails.downloadItemDocument,
    deleteItemComment: itemDetails.deleteItemComment,
    handleSubtaskComplete: itemDetails.handleSubtaskComplete,
    updateItemComment: itemDetails.updateItemComment,
    loadItemSubtasks: itemDetails.loadItemSubtasks,
    loadAllItemCounts: itemDetails.loadAllItemCounts,
    fetchPlanningDetails, fetchEmailActions,
    timelineAssignments, upsertTimelineAssignment, removeTimelineAssignment,
  };
}
