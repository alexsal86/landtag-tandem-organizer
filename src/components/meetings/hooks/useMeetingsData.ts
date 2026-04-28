import { useState, useEffect, useMemo, useRef } from "react";
import { debugConsole } from '@/utils/debugConsole';
import { handleAppError } from '@/utils/errorHandler';
import { useSearchParams } from "react-router-dom";
import { useNotificationHighlight } from "@/hooks/useNotificationHighlight";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import type { RecurrenceData, NewMeetingParticipant, AgendaItem, Meeting, MeetingTemplate, Profile, LinkedTask, MeetingParticipant, AgendaDocument } from "@/components/meetings/types";
import { useMeetingSidebarData } from "./useMeetingSidebarData";

interface MeetingTemplateRow extends Omit<MeetingTemplate, "template_items" | "default_recurrence"> {
  template_items: MeetingTemplate["template_items"] | null;
  default_recurrence?: MeetingTemplate["default_recurrence"] | null;
}

interface ParticipantMeetingRow {
  meeting_id: string;
  meetings: Meeting | Meeting[] | null;
}

const normalizeMeeting = (meeting: Meeting): Meeting => ({
  ...meeting,
  meeting_date: meeting.meeting_date instanceof Date ? meeting.meeting_date : new Date(meeting.meeting_date),
});

const normalizeMeetingTemplate = (template: MeetingTemplateRow): MeetingTemplate => ({
  ...template,
  template_items: template.template_items ?? [],
  default_recurrence: template.default_recurrence ?? null,
});

export function useMeetingsData() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isHighlighted, highlightRef } = useNotificationHighlight();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [activeMeetingItems, setActiveMeetingItems] = useState<AgendaItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<LinkedTask[]>([]);
  const [taskDocuments, setTaskDocuments] = useState<Record<string, AgendaDocument[]>>({});
  const [agendaDocuments, setAgendaDocuments] = useState<Record<string, AgendaDocument[]>>({});
  const [meetingTemplates, setMeetingTemplates] = useState<MeetingTemplate[]>([]);
  const [isNewMeetingOpen, setIsNewMeetingOpen] = useState(false);
  const [newMeeting, setNewMeeting] = useState<Meeting>({
    title: "",
    description: "",
    meeting_date: new Date(),
    location: "Stuttgart",
    status: "planned",
    is_public: false
  });
  const [newMeetingTime, setNewMeetingTime] = useState<string>("10:00");
  const [newMeetingParticipants, setNewMeetingParticipants] = useState<NewMeetingParticipant[]>([]);
  const [newMeetingRecurrence, setNewMeetingRecurrence] = useState<RecurrenceData>({
    enabled: false,
    frequency: 'weekly',
    interval: 1,
    weekdays: []
  });
  const [showTaskSelector, setShowTaskSelector] = useState<{itemIndex: number} | null>(null);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [archivedMeetingId, setArchivedMeetingId] = useState<string | null>(null);
  const [meetingParticipants, setMeetingParticipants] = useState<MeetingParticipant[]>([]);
  const [currentUserIsParticipant, setCurrentUserIsParticipant] = useState(false);
  const [showCarryoverBuffer, setShowCarryoverBuffer] = useState(false);
  const [carryoverBufferItems, setCarryoverBufferItems] = useState<AgendaItem[]>([]);
  const deepLinkIdRef = useRef<string | null>(searchParams.get('id'));

  // Delegate sidebar data management to sub-hook
  const sidebar = useMeetingSidebarData({
    userId: user?.id,
    tenantId: currentTenant?.id,
    activeMeetingId,
    toast,
  });
  const {
    loadLinkedQuickNotes,
    loadMeetingLinkedTasks,
    loadMeetingLinkedCaseItems,
    loadMeetingRelevantDecisions,
    loadMeetingUpcomingAppointments,
    loadStarredAppointments,
    updateTimeouts,
  } = sidebar;
  const searchMeetingId = searchParams.get('id');

  // URL action parameter
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'create-meeting') {
      setIsNewMeetingOpen(true);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // URL id parameter for deep-linking
  // Only sets selectedMeeting + loads agenda; linked sidebar data is loaded
  // by the selectedMeeting.id change effect below.
  useEffect(() => {
    const urlMeetingId = searchParams.get('id');
    if (!urlMeetingId || meetings.length === 0) return;

    const selectMeeting = (meeting: Meeting) => {
      if (selectedMeeting?.id === urlMeetingId) return;
      const normalized = normalizeMeeting(meeting);
      setSelectedMeeting(normalized);
      loadAgendaItems(urlMeetingId);
      searchParams.delete('id');
      setSearchParams(searchParams, { replace: true });
      deepLinkIdRef.current = null;
    };

    const meetingFromUrl = meetings.find(m => m.id === urlMeetingId);
    if (meetingFromUrl) {
      selectMeeting(meetingFromUrl);
    } else {
      supabase
        .from('meetings')
        .select("id, title, meeting_date, meeting_time, status, description, is_public, user_id, template_id, location, created_at, recurrence_rule, recurrence_end_date")
        .eq('id', urlMeetingId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) selectMeeting(data as Meeting);
        });
    }
  }, [searchParams, meetings, selectedMeeting, setSearchParams]);

  // Load data on mount
  useEffect(() => {
    if (user && currentTenant?.id) {
      loadMeetings();
      loadProfiles();
      loadTasks();
      loadMeetingTemplates();
      loadCarryoverBufferItems();
    }
  }, [user, currentTenant?.id]);

  // Auto-select next upcoming meeting (skip if URL deep-link is present)
  // Only sets selectedMeeting + loads agenda; linked sidebar data is loaded
  // by the selectedMeeting.id change effect below.
  useEffect(() => {
    if (meetings.length > 0 && !selectedMeeting && !activeMeeting && !searchMeetingId && !deepLinkIdRef.current) {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const nextMeeting = meetings
        .filter(m => new Date(m.meeting_date) >= startOfToday)
        .sort((a, b) => new Date(a.meeting_date).getTime() - new Date(b.meeting_date).getTime())[0];
      
      if (nextMeeting) {
        setSelectedMeeting(nextMeeting);
        if (nextMeeting.id) {
          loadAgendaItems(nextMeeting.id);
        }
      }
    }
  }, [meetings, selectedMeeting, activeMeeting, searchMeetingId]);

  // Load linked data when selectedMeeting.id changes (single load point)
  const prevSelectedMeetingIdRef = useRef<string | null>(null);
  useEffect(() => {
    const meetingId = selectedMeeting?.id ?? null;
    if (!meetingId || activeMeeting || meetingId === prevSelectedMeetingIdRef.current) return;
    prevSelectedMeetingIdRef.current = meetingId;
    loadLinkedQuickNotes(meetingId);
    loadMeetingLinkedTasks(meetingId);
    loadMeetingLinkedCaseItems(meetingId);
    loadMeetingRelevantDecisions();
    if (selectedMeeting?.meeting_date) loadMeetingUpcomingAppointments(meetingId, selectedMeeting.meeting_date);
    loadStarredAppointments(meetingId);
  }, [
    selectedMeeting?.id,
    selectedMeeting?.meeting_date,
    activeMeeting,
    loadLinkedQuickNotes,
    loadMeetingLinkedTasks,
    loadMeetingLinkedCaseItems,
    loadMeetingRelevantDecisions,
    loadMeetingUpcomingAppointments,
    loadStarredAppointments,
  ]);

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      Object.values(updateTimeouts.current).forEach((timeout) => clearTimeout(timeout));
    };
  }, [updateTimeouts]);

  // Sync task changes to meeting agenda items
  useEffect(() => {
    const syncTaskChanges = async () => {
      if (!tasks || tasks.length === 0) return;
      try {
        const { data: agendaItemsWithTasks, error } = await supabase
          .from('meeting_agenda_items')
          .select('id, meeting_id, task_id')
          .not('task_id', 'is', null);
        if (error) throw error;
        if (agendaItemsWithTasks && agendaItemsWithTasks.length > 0) {
          for (const agendaItem of agendaItemsWithTasks) {
            const correspondingTask = tasks.find(task => task.id === agendaItem.task_id);
            if (correspondingTask) {
              const updates: Record<string, string | null | undefined> = {};
              if (agendaItem.title !== correspondingTask.title) updates.title = correspondingTask.title;
              if (agendaItem.description !== correspondingTask.description) updates.description = correspondingTask.description;
              if (Object.keys(updates).length > 0) {
                await supabase.from('meeting_agenda_items').update(updates).eq('id', agendaItem.id);
              }
            }
          }
        }
      } catch (error) {
        handleAppError(error, { context: 'syncTaskChanges' });
      }
    };
    if (tasks.length > 0) syncTaskChanges();
  }, [tasks]);

  // Sync activeMeetingItems
  useEffect(() => {
    if (activeMeeting) {
      setActiveMeetingItems([...agendaItems]);
    } else {
      setActiveMeetingItems([]);
    }
  }, [agendaItems, activeMeeting]);

  // Force re-render on agenda changes during active meeting
  useEffect(() => {
    if (activeMeeting && agendaItems.length >= 0) {
      setActiveMeeting(prev => prev ? {...prev, lastUpdate: Date.now()} : prev);
    }
  }, [agendaItems, activeMeeting?.id]);

  // Check participation
  useEffect(() => {
    const checkParticipation = async () => {
      if (!selectedMeeting?.id || !user?.id) {
        setCurrentUserIsParticipant(false);
        return;
      }
      const { data } = await supabase
        .from('meeting_participants')
        .select('user_id')
        .eq('meeting_id', selectedMeeting.id)
        .eq('user_id', user.id)
        .maybeSingle();
      setCurrentUserIsParticipant(!!data);
    };
    checkParticipation();
  }, [selectedMeeting?.id, user?.id]);

  const hasEditPermission = useMemo(() => {
    if (!selectedMeeting || !user) return false;
    if (selectedMeeting.user_id === user.id) return true;
    if (currentUserIsParticipant) return true;
    if (selectedMeeting.is_public) return true;
    return false;
  }, [selectedMeeting, user, currentUserIsParticipant]);

  const upcomingMeetings = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return meetings
      .filter(m => new Date(m.meeting_date) >= startOfToday)
      .sort((a, b) => new Date(a.meeting_date).getTime() - new Date(b.meeting_date).getTime());
  }, [meetings]);

  // ========== Data Loading Functions ==========

  const loadMeetings = async () => {
    try {
      const meetingSelectFields = "id, title, meeting_date, meeting_time, status, description, is_public, user_id, template_id, location, created_at, recurrence_rule, recurrence_end_date";
      const { data: ownMeetings, error: ownError } = await supabase
        .from('meetings').select(meetingSelectFields).eq('user_id', user?.id ?? '').neq('status', 'archived').order('meeting_date', { ascending: false });
      if (ownError) throw ownError;

      const { data: participantMeetings, error: participantError } = await supabase
        .from('meeting_participants').select(`meeting_id, meetings(${meetingSelectFields})`).eq('user_id', user?.id ?? '');
      if (participantError) debugConsole.error('Error loading participant meetings:', participantError);

      const ownMeetingIds = new Set((ownMeetings || []).map(m: Record<string, any> => m.id));
      const participantMeetingsData = ((participantMeetings || []) as ParticipantMeetingRow[])
        .map((row) => (Array.isArray(row.meetings) ? row.meetings[0] ?? null : row.meetings))
        .filter((meeting): meeting is Meeting => Boolean(meeting && !ownMeetingIds.has(meeting.id!) && meeting.status !== 'archived'));

      const allMeetings = [...(ownMeetings || []), ...participantMeetingsData];
      setMeetings(allMeetings.map((meeting) => normalizeMeeting(meeting as Meeting)));
    } catch (error) {
      handleAppError(error, { context: 'loadMeetings', toast: { fn: toast, title: 'Fehler beim Laden der Meetings', description: 'Die Meetings konnten nicht geladen werden.' } });
    }
  };

  const loadProfiles = async () => {
    if (!currentTenant?.id) return;
    try {
      const { data: memberships, error: membershipError } = await supabase
        .from('user_tenant_memberships').select('user_id').eq('tenant_id', currentTenant.id).eq('is_active', true);
      if (membershipError) throw membershipError;
      if (!memberships || memberships.length === 0) { setProfiles([]); return; }

      const userIds = memberships.map(m: Record<string, any> => m.user_id);
      const { data, error } = await supabase.from('profiles').select('user_id, display_name, avatar_url').in('user_id', userIds);
      if (error) throw error;

      const currentUserProfile = data?.find(p: Record<string, any> => p.user_id === user?.id);
      const otherProfiles = data?.filter(p: Record<string, any> => p.user_id !== user?.id) || [];
      setProfiles(currentUserProfile ? [currentUserProfile, ...otherProfiles] : otherProfiles);
    } catch (error) {
      handleAppError(error, { context: 'loadProfiles' });
    }
  };

  const loadTasks = async () => {
    if (!user?.id || !currentTenant?.id) return;
    try {
      const { data: allTenantTasks, error } = await supabase
        .from('tasks').select('id, title, description, priority, status, due_date, assigned_to, user_id, created_at, category, meeting_id, pending_for_jour_fixe, parent_task_id, tenant_id').eq('tenant_id', currentTenant.id).eq('status', 'todo').order('created_at', { ascending: false });
      if (error) { debugConsole.error('Error loading tasks:', error); return; }

      const filteredTasks = (allTenantTasks || []).filter((task: Record<string, any>) => 
        task.user_id === user.id || (task.assigned_to && task.assigned_to.includes(user.id))
      );
      setTasks(filteredTasks);
      if (filteredTasks.length > 0) await loadTaskDocuments(filteredTasks.map((task: Record<string, any>) => task.id));
    } catch (error) {
      handleAppError(error, { context: 'loadTasks' });
    }
  };

  const loadTaskDocuments = async (taskIds: string[]) => {
    try {
      const { data, error } = await supabase.from('task_documents').select('id, task_id, file_name, file_path, file_size, file_type, created_at').in('task_id', taskIds);
      if (error) throw error;
      const docsByTaskId: Record<string, AgendaDocument[]> = {};
      data?.forEach((doc: Record<string, any>) => {
        if (!docsByTaskId[doc.task_id]) docsByTaskId[doc.task_id] = [];
        docsByTaskId[doc.task_id].push({ ...doc, meeting_agenda_item_id: doc.task_id });
      });
      setTaskDocuments(docsByTaskId);
    } catch (error) {
      handleAppError(error, { context: 'loadTaskDocuments' });
    }
  };

  const loadMeetingTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('meeting_templates').select('id, name, description, template_items, default_participants, is_default, default_recurrence, user_id, created_at').order('is_default', { ascending: false }).order('name');
      if (error) throw error;
      const normalizedTemplates = ((data || []) as MeetingTemplateRow[]).map(normalizeMeetingTemplate);
      setMeetingTemplates(normalizedTemplates);

      const defaultTemplate = normalizedTemplates.find((template) => template.is_default);
      if (defaultTemplate) {
        setNewMeeting(prev => ({ ...prev, template_id: defaultTemplate.id }));
        if (defaultTemplate.default_participants?.length) {
          supabase.from('profiles').select('user_id, display_name, avatar_url')
            .in('user_id', defaultTemplate.default_participants)
            .then(({ data: profilesData }) => {
              if (profilesData) {
                setNewMeetingParticipants(profilesData.map(u: Record<string, any> => ({
                  userId: u.user_id, role: 'participant' as const,
                  user: { id: u.user_id, display_name: u.display_name || 'Unbekannt', avatar_url: u.avatar_url }
                })));
              }
            });
        }
        if (defaultTemplate.default_recurrence) {
          setNewMeetingRecurrence(defaultTemplate.default_recurrence);
        }
      }
    } catch (error) {
      handleAppError(error, { context: 'loadMeetingTemplates' });
    }
  };

  const loadAgendaItems = async (meetingId: string) => {
    try {
      const { data, error } = await supabase
        .from('meeting_agenda_items').select('id, meeting_id, title, description, duration_minutes, order_index, type, parent_id, task_id, result_text, assigned_to, is_completed, completed_at, planning_item_id').eq('meeting_id', meetingId).order('order_index');
      if (error) throw error;

      const mainItems = (data || []).filter((item: Record<string, any>) => !item.parent_id).sort((a: Record<string, any>, b: Record<string, any>) => a.order_index - b.order_index);
      const sortedItems: AgendaItem[] = [];
      mainItems.forEach((main: Record<string, any>) => {
        sortedItems.push({ ...main, localKey: main.id, parentLocalKey: undefined });
        const children = (data || []).filter((item: Record<string, any>) => item.parent_id === main.id).sort((a: Record<string, any>, b: Record<string, any>) => a.order_index - b.order_index);
        children.forEach((child: Record<string, any>) => {
          sortedItems.push({ ...child, localKey: child.id, parentLocalKey: child.parent_id ?? undefined });
        });
      });
      setAgendaItems(sortedItems);

      if (sortedItems.length > 0) {
        await loadAgendaDocuments(sortedItems.map(item => item.id!).filter(Boolean));
      }
    } catch (error) {
      handleAppError(error, { context: 'loadAgendaItems', toast: { fn: toast, title: 'Fehler beim Laden der Agenda', description: 'Die Agenda-Punkte konnten nicht geladen werden.' } });
    }
  };

  const loadAgendaDocuments = async (agendaItemIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from('meeting_agenda_documents').select('id, meeting_agenda_item_id, file_name, file_path, file_size, file_type, created_at').in('meeting_agenda_item_id', agendaItemIds);
      if (error) throw error;
      const docsByItemId: Record<string, AgendaDocument[]> = {};
      data?.forEach((doc: Record<string, any>) => {
        if (!docsByItemId[doc.meeting_agenda_item_id]) docsByItemId[doc.meeting_agenda_item_id] = [];
        docsByItemId[doc.meeting_agenda_item_id].push(doc);
      });
      setAgendaDocuments(docsByItemId);
    } catch (error) {
      handleAppError(error, { context: 'loadAgendaDocuments' });
    }
  };

  const uploadAgendaDocument = async (agendaItemId: string, file: File) => {
    if (!user) return null;
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${agendaItemId}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('documents').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: document, error: dbError } = await supabase
        .from('meeting_agenda_documents')
        .insert([{ meeting_agenda_item_id: agendaItemId, user_id: user.id, file_name: file.name, file_path: fileName, file_type: file.type, file_size: file.size }])
        .select().single();
      if (dbError) throw dbError;

      setAgendaDocuments(prev => ({ ...prev, [agendaItemId]: [...(prev[agendaItemId] || []), document] }));
      return document;
    } catch (error) {
      handleAppError(error, { context: 'uploadAgendaDocument', rethrow: true });
      throw error; // unreachable but satisfies TS
    }
  };

  const deleteAgendaDocument = async (documentId: string, agendaItemId: string, filePath: string) => {
    try {
      const { error: storageError } = await supabase.storage.from('documents').remove([filePath]);
      if (storageError) throw storageError;
      const { error: dbError } = await supabase.from('meeting_agenda_documents').delete().eq('id', documentId);
      if (dbError) throw dbError;
      setAgendaDocuments(prev => ({ ...prev, [agendaItemId]: (prev[agendaItemId] || []).filter(doc => doc.id !== documentId) }));
      toast({ title: "Dokument entfernt", description: "Das Dokument wurde erfolgreich entfernt." });
    } catch (error) {
      handleAppError(error, { context: 'deleteAgendaDocument', toast: { fn: toast, title: 'Fehler', description: 'Dokument konnte nicht entfernt werden.' } });
    }
  };

  const loadCarryoverBufferItems = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('carryover_items').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (error) throw error;
      setCarryoverBufferItems((data || []).map(d: Record<string, any> => ({ ...d, is_completed: false, is_recurring: false })));
    } catch (error) {
      debugConsole.error('Error loading carryover buffer:', error);
    }
  };

  // ========== Meeting CRUD ==========

  const startMeeting = async (meeting: Meeting) => {
    if (activeMeetingId && activeMeetingId !== meeting.id) {
      setActiveMeeting(null);
      setActiveMeetingId(null);
      sidebar.setLinkedQuickNotes([]);
    }
    setActiveMeeting(meeting);
    setActiveMeetingId(meeting.id || null);
    if (meeting.id) {
      await loadAgendaItems(meeting.id);
      await sidebar.loadLinkedQuickNotes(meeting.id);
      await sidebar.loadMeetingLinkedTasks(meeting.id);
      await sidebar.loadMeetingLinkedCaseItems(meeting.id);
      await sidebar.loadMeetingRelevantDecisions();
      await sidebar.loadMeetingUpcomingAppointments(meeting.id, meeting.meeting_date);
      await sidebar.loadStarredAppointments(meeting.id);
    }
  };

  const stopMeeting = () => {
    setActiveMeeting(null);
    setActiveMeetingId(null);
    sidebar.setLinkedQuickNotes([]);
  };

  const updateMeeting = async (meetingId: string, updates: Partial<Meeting>, meetingTimeOverride?: string) => {
    const optimisticUpdates = { ...updates };
    setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, ...optimisticUpdates } : m));
    if (selectedMeeting?.id === meetingId) {
      setSelectedMeeting(prev => prev ? { ...prev, ...optimisticUpdates } : prev);
    }
    try {
      const formattedUpdates: Record<string, unknown> = {
        ...updates,
        meeting_date: updates.meeting_date instanceof Date ? format(updates.meeting_date, 'yyyy-MM-dd') : updates.meeting_date
      };
      let timeToUse = meetingTimeOverride || updates.meeting_time?.substring(0, 5) || editingMeeting?.meeting_time?.substring(0, 5);
      if (!timeToUse) {
        const { data: currentMeeting } = await supabase.from('meetings').select('meeting_time').eq('id', meetingId).single();
        timeToUse = currentMeeting?.meeting_time?.substring(0, 5) || '10:00';
      }
      formattedUpdates.meeting_time = timeToUse;

      const { error } = await supabase.from('meetings').update(formattedUpdates).eq('id', meetingId);
      if (error) {
        const errorMsg = error.message || '';
        const isNetworkError = errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError');
        if (!isNetworkError) throw error;
      }

      if (updates.meeting_date) {
        const dateStr = format(new Date(updates.meeting_date), 'yyyy-MM-dd');
        const localStartTime = new Date(`${dateStr}T${timeToUse}:00`);
        const localEndTime = new Date(localStartTime.getTime() + 60 * 60 * 1000);
        await supabase.from('appointments').update({
          title: updates.title, description: updates.description, location: updates.location,
          start_time: localStartTime.toISOString(), end_time: localEndTime.toISOString(),
        }).eq('meeting_id', meetingId);
      } else {
        await supabase.from('appointments').update({
          title: updates.title, description: updates.description, location: updates.location,
        }).eq('meeting_id', meetingId);
      }
      toast({ title: "Meeting aktualisiert", description: "Das Meeting wurde erfolgreich aktualisiert." });
    } catch (error) {
      await loadMeetings();
      toast({ title: "Fehler", description: "Das Meeting konnte nicht aktualisiert werden.", variant: "destructive" });
    }
  };

  const deleteMeeting = async (meetingId: string) => {
    try {
      const { data: agendaItemIds, error: agendaFetchError } = await supabase
        .from('meeting_agenda_items').select('id').eq('meeting_id', meetingId);
      if (agendaFetchError) debugConsole.error('Error fetching agenda items:', agendaFetchError);

      if (agendaItemIds && agendaItemIds.length > 0) {
        const { error: docError } = await supabase
          .from('meeting_agenda_documents').delete().in('meeting_agenda_item_id', agendaItemIds.map(i: Record<string, any> => i.id));
        if (docError) debugConsole.error('Error deleting agenda docs:', docError);
      }

      await supabase.from('meeting_agenda_items').delete().eq('meeting_id', meetingId);
      await supabase.from('meeting_participants').delete().eq('meeting_id', meetingId);
      await supabase.from('quick_notes').update({ meeting_id: null }).eq('meeting_id', meetingId).select();
      await supabase.from('appointments').delete().eq('meeting_id', meetingId);

      const { error } = await supabase.from('meetings').delete().eq('id', meetingId).select();
      if (error) throw error;

      setMeetings(prev => prev.filter(m => m.id !== meetingId));
      if (selectedMeeting?.id === meetingId) { setSelectedMeeting(null); setAgendaItems([]); }
      if (activeMeetingId === meetingId) { setActiveMeeting(null); setActiveMeetingId(null); sidebar.setLinkedQuickNotes([]); }
      toast({ title: "Meeting gelöscht", description: "Das Meeting wurde erfolgreich gelöscht." });
    } catch (error: unknown) {
      debugConsole.error('Delete meeting error:', error);
      const msg = error instanceof Error ? error.message : '';
      let errorMessage = 'Das Meeting konnte nicht gelöscht werden.';
      if (msg.includes('violates foreign key constraint')) {
        errorMessage = 'Das Meeting kann nicht gelöscht werden, da noch verknüpfte Daten existieren.';
      }
      toast({ title: "Fehler", description: errorMessage, variant: "destructive" });
    }
  };

  const getProfile = (userId: string) => profiles.find(p => p.user_id === userId);

  // Wrap toggleStarAppointment to inject activeMeetingId
  const toggleStarAppointment = (appt: Parameters<typeof sidebar.toggleStarAppointment>[0]) =>
    sidebar.toggleStarAppointment(appt, activeMeetingId);

  return {
    // Auth & tenant
    user, currentTenant, toast,
    // Notification
    isHighlighted, highlightRef,
    // State
    meetings, setMeetings,
    selectedMeeting, setSelectedMeeting,
    agendaItems, setAgendaItems,
    activeMeetingItems, setActiveMeetingItems,
    profiles,
    tasks,
    taskDocuments,
    agendaDocuments, setAgendaDocuments,
    meetingTemplates,
    linkedQuickNotes: sidebar.linkedQuickNotes,
    setLinkedQuickNotes: sidebar.setLinkedQuickNotes,
    meetingLinkedTasks: sidebar.meetingLinkedTasks,
    meetingRelevantDecisions: sidebar.meetingRelevantDecisions,
    meetingLinkedCaseItems: sidebar.meetingLinkedCaseItems,
    meetingUpcomingAppointments: sidebar.meetingUpcomingAppointments,
    isMeetingLinkedDataLoading: sidebar.isMeetingLinkedDataLoading,
    isNewMeetingOpen, setIsNewMeetingOpen,
    newMeeting, setNewMeeting,
    newMeetingTime, setNewMeetingTime,
    newMeetingParticipants, setNewMeetingParticipants,
    newMeetingRecurrence, setNewMeetingRecurrence,
    showTaskSelector, setShowTaskSelector,
    editingMeeting, setEditingMeeting,
    activeMeeting, setActiveMeeting,
    activeMeetingId, setActiveMeetingId,
    showArchive, setShowArchive,
    isFocusMode, setIsFocusMode,
    archivedMeetingId, setArchivedMeetingId,
    starredAppointmentIds: sidebar.starredAppointmentIds,
    expandedApptNotes: sidebar.expandedApptNotes,
    setExpandedApptNotes: sidebar.setExpandedApptNotes,
    showCarryoverBuffer, setShowCarryoverBuffer,
    carryoverBufferItems,
    hasEditPermission,
    upcomingMeetings,
    // Functions
    loadMeetings,
    loadAgendaItems,
    loadLinkedQuickNotes: sidebar.loadLinkedQuickNotes,
    loadMeetingLinkedTasks: sidebar.loadMeetingLinkedTasks,
    loadMeetingLinkedCaseItems: sidebar.loadMeetingLinkedCaseItems,
    loadMeetingRelevantDecisions: sidebar.loadMeetingRelevantDecisions,
    loadMeetingUpcomingAppointments: sidebar.loadMeetingUpcomingAppointments,
    loadStarredAppointments: sidebar.loadStarredAppointments,
    loadCarryoverBufferItems,
    toggleStarAppointment,
    updateQuickNoteResult: sidebar.updateQuickNoteResult,
    startMeeting,
    stopMeeting,
    updateMeeting,
    deleteMeeting,
    uploadAgendaDocument,
    deleteAgendaDocument,
    getProfile,
    updateTimeouts: sidebar.updateTimeouts,
  };
}

export type MeetingsDataReturn = ReturnType<typeof useMeetingsData>;
