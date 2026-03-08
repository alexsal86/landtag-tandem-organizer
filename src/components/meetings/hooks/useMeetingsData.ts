import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useNotificationHighlight } from "@/hooks/useNotificationHighlight";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, addDays } from "date-fns";
import { de } from "date-fns/locale";
import type { RecurrenceData, NewMeetingParticipant, AgendaItem, Meeting, MeetingTemplate, Profile, LinkedQuickNote, LinkedTask, LinkedCaseItem, RelevantDecision, MeetingUpcomingAppointment, MeetingParticipant, AgendaDocument } from "@/components/meetings/types";

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
  const [tasks, setTasks] = useState<any[]>([]);
  const [taskDocuments, setTaskDocuments] = useState<Record<string, any[]>>({});
  const [agendaDocuments, setAgendaDocuments] = useState<Record<string, any[]>>({});
  const [meetingTemplates, setMeetingTemplates] = useState<MeetingTemplate[]>([]);
  const [linkedQuickNotes, setLinkedQuickNotes] = useState<any[]>([]);
  const [meetingLinkedTasks, setMeetingLinkedTasks] = useState<any[]>([]);
  const [meetingRelevantDecisions, setMeetingRelevantDecisions] = useState<any[]>([]);
  const [meetingLinkedCaseItems, setMeetingLinkedCaseItems] = useState<any[]>([]);
  const [meetingUpcomingAppointments, setMeetingUpcomingAppointments] = useState<any[]>([]);
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
  const [meetingParticipants, setMeetingParticipants] = useState<any[]>([]);
  const [currentUserIsParticipant, setCurrentUserIsParticipant] = useState(false);
  const updateTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const [starredAppointmentIds, setStarredAppointmentIds] = useState<Set<string>>(new Set());
  const [expandedApptNotes, setExpandedApptNotes] = useState<Set<string>>(new Set());
  const [showCarryoverBuffer, setShowCarryoverBuffer] = useState(false);
  const [carryoverBufferItems, setCarryoverBufferItems] = useState<any[]>([]);

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
  useEffect(() => {
    const urlMeetingId = searchParams.get('id');
    if (urlMeetingId && meetings.length > 0) {
      const meetingFromUrl = meetings.find(m => m.id === urlMeetingId);
      if (meetingFromUrl && selectedMeeting?.id !== urlMeetingId) {
        setSelectedMeeting(meetingFromUrl);
        loadAgendaItems(urlMeetingId);
        loadLinkedQuickNotes(urlMeetingId);
        loadMeetingLinkedTasks(urlMeetingId);
        loadMeetingLinkedCaseItems(urlMeetingId);
        loadMeetingRelevantDecisions();
        if (meetingFromUrl?.meeting_date) loadMeetingUpcomingAppointments(urlMeetingId, meetingFromUrl.meeting_date);
        loadStarredAppointments(urlMeetingId);
        searchParams.delete('id');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, meetings]);

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

  // Auto-select next upcoming meeting
  useEffect(() => {
    if (meetings.length > 0 && !selectedMeeting && !activeMeeting) {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const nextMeeting = meetings
        .filter(m => new Date(m.meeting_date) >= startOfToday)
        .sort((a, b) => new Date(a.meeting_date).getTime() - new Date(b.meeting_date).getTime())[0];
      
      if (nextMeeting) {
        setSelectedMeeting(nextMeeting);
        if (nextMeeting.id) {
          loadAgendaItems(nextMeeting.id);
          loadLinkedQuickNotes(nextMeeting.id);
          loadMeetingLinkedTasks(nextMeeting.id);
          loadMeetingLinkedCaseItems(nextMeeting.id);
          loadMeetingRelevantDecisions();
          loadMeetingUpcomingAppointments(nextMeeting.id, nextMeeting.meeting_date);
          loadStarredAppointments(nextMeeting.id);
        }
      }
    }
  }, [meetings]);

  // Load linked data when selectedMeeting changes
  useEffect(() => {
    if (selectedMeeting?.id && !activeMeeting) {
      loadLinkedQuickNotes(selectedMeeting.id);
      loadMeetingLinkedTasks(selectedMeeting.id);
      loadMeetingLinkedCaseItems(selectedMeeting.id);
      loadMeetingRelevantDecisions();
      if (selectedMeeting.meeting_date) loadMeetingUpcomingAppointments(selectedMeeting.id, selectedMeeting.meeting_date);
      loadStarredAppointments(selectedMeeting.id);
    }
  }, [selectedMeeting?.id, activeMeeting]);

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      Object.values(updateTimeouts.current).forEach((timeout) => clearTimeout(timeout));
    };
  }, []);

  // Sync task changes to meeting agenda items
  useEffect(() => {
    const syncTaskChanges = async () => {
      if (!tasks || tasks.length === 0) return;
      try {
        const { data: agendaItemsWithTasks, error } = await supabase
          .from('meeting_agenda_items')
          .select('*')
          .not('task_id', 'is', null);
        if (error) throw error;
        if (agendaItemsWithTasks && agendaItemsWithTasks.length > 0) {
          for (const agendaItem of agendaItemsWithTasks) {
            const correspondingTask = tasks.find(task => task.id === agendaItem.task_id);
            if (correspondingTask) {
              const updates: any = {};
              if (agendaItem.title !== correspondingTask.title) updates.title = correspondingTask.title;
              if (agendaItem.description !== correspondingTask.description) updates.description = correspondingTask.description;
              if (Object.keys(updates).length > 0) {
                await supabase.from('meeting_agenda_items').update(updates).eq('id', agendaItem.id);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error syncing task changes:', error);
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
      const { data: ownMeetings, error: ownError } = await supabase
        .from('meetings').select('*').eq('user_id', user?.id).neq('status', 'archived').order('meeting_date', { ascending: false });
      if (ownError) throw ownError;

      const { data: participantMeetings, error: participantError } = await supabase
        .from('meeting_participants').select('meeting_id, meetings(*)').eq('user_id', user?.id);
      if (participantError) console.error('Error loading participant meetings:', participantError);

      const ownMeetingIds = new Set((ownMeetings || []).map(m => m.id));
      const participantMeetingsData = (participantMeetings || [])
        .filter(p => p.meetings && !ownMeetingIds.has(p.meeting_id) && p.meetings.status !== 'archived')
        .map(p => p.meetings);

      const allMeetings = [...(ownMeetings || []), ...participantMeetingsData];
      setMeetings(allMeetings.map(meeting => ({ ...meeting, meeting_date: new Date(meeting.meeting_date) })));
    } catch (error) {
      console.error('Error in loadMeetings:', error);
      toast({ title: "Fehler beim Laden der Meetings", description: "Die Meetings konnten nicht geladen werden.", variant: "destructive" });
    }
  };

  const loadProfiles = async () => {
    if (!currentTenant?.id) return;
    try {
      const { data: memberships, error: membershipError } = await supabase
        .from('user_tenant_memberships').select('user_id').eq('tenant_id', currentTenant.id).eq('is_active', true);
      if (membershipError) throw membershipError;
      if (!memberships || memberships.length === 0) { setProfiles([]); return; }

      const userIds = memberships.map(m => m.user_id);
      const { data, error } = await supabase.from('profiles').select('user_id, display_name, avatar_url').in('user_id', userIds);
      if (error) throw error;

      const currentUserProfile = data?.find(p => p.user_id === user?.id);
      const otherProfiles = data?.filter(p => p.user_id !== user?.id) || [];
      setProfiles(currentUserProfile ? [currentUserProfile, ...otherProfiles] : otherProfiles);
    } catch (error) {
      console.error('Error loading profiles:', error);
    }
  };

  const loadTasks = async () => {
    if (!user?.id || !currentTenant?.id) return;
    try {
      const { data: allTenantTasks, error } = await supabase
        .from('tasks').select('*').eq('tenant_id', currentTenant.id).eq('status', 'todo').order('created_at', { ascending: false });
      if (error) { console.error('Error loading tasks:', error); return; }

      const filteredTasks = (allTenantTasks || []).filter(task => 
        task.user_id === user.id || (task.assigned_to && task.assigned_to.includes(user.id))
      );
      setTasks(filteredTasks);
      if (filteredTasks.length > 0) await loadTaskDocuments(filteredTasks.map(task => task.id));
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  const loadTaskDocuments = async (taskIds: string[]) => {
    try {
      const { data, error } = await supabase.from('task_documents').select('*').in('task_id', taskIds);
      if (error) throw error;
      const docsByTaskId: Record<string, any[]> = {};
      data?.forEach(doc => {
        if (!docsByTaskId[doc.task_id]) docsByTaskId[doc.task_id] = [];
        docsByTaskId[doc.task_id].push(doc);
      });
      setTaskDocuments(docsByTaskId);
    } catch (error) {
      console.error('Error loading task documents:', error);
    }
  };

  const loadMeetingTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('meeting_templates').select('*').order('is_default', { ascending: false }).order('name');
      if (error) throw error;
      setMeetingTemplates(data || []);

      const defaultTemplate = data?.find(t => t.is_default);
      if (defaultTemplate) {
        setNewMeeting(prev => ({ ...prev, template_id: defaultTemplate.id }));
        if (defaultTemplate.default_participants?.length) {
          supabase.from('profiles').select('user_id, display_name, avatar_url')
            .in('user_id', defaultTemplate.default_participants)
            .then(({ data: profilesData }) => {
              if (profilesData) {
                setNewMeetingParticipants(profilesData.map(u => ({
                  userId: u.user_id, role: 'participant' as const,
                  user: { id: u.user_id, display_name: u.display_name || 'Unbekannt', avatar_url: u.avatar_url }
                })));
              }
            });
        }
        if (defaultTemplate.default_recurrence) {
          setNewMeetingRecurrence(defaultTemplate.default_recurrence as unknown as RecurrenceData);
        }
      }
    } catch (error) {
      console.error('Error loading meeting templates:', error);
    }
  };

  const loadAgendaItems = async (meetingId: string) => {
    try {
      const { data, error } = await supabase
        .from('meeting_agenda_items').select('*').eq('meeting_id', meetingId).order('order_index');
      if (error) throw error;

      const mainItems = (data || []).filter(item => !item.parent_id).sort((a, b) => a.order_index - b.order_index);
      const sortedItems: AgendaItem[] = [];
      mainItems.forEach(main => {
        sortedItems.push({ ...main, localKey: main.id, parentLocalKey: undefined });
        const children = (data || []).filter(item => item.parent_id === main.id).sort((a, b) => a.order_index - b.order_index);
        children.forEach(child => {
          sortedItems.push({ ...child, localKey: child.id, parentLocalKey: child.parent_id });
        });
      });
      setAgendaItems(sortedItems);

      if (sortedItems.length > 0) {
        await loadAgendaDocuments(sortedItems.map(item => item.id!).filter(Boolean));
      }
    } catch (error) {
      console.error('Error loading agenda items:', error);
      toast({ title: "Fehler beim Laden der Agenda", description: "Die Agenda-Punkte konnten nicht geladen werden.", variant: "destructive" });
    }
  };

  const loadAgendaDocuments = async (agendaItemIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from('meeting_agenda_documents').select('*').in('meeting_agenda_item_id', agendaItemIds);
      if (error) throw error;
      const docsByItemId: Record<string, any[]> = {};
      data?.forEach(doc => {
        if (!docsByItemId[doc.meeting_agenda_item_id]) docsByItemId[doc.meeting_agenda_item_id] = [];
        docsByItemId[doc.meeting_agenda_item_id].push(doc);
      });
      setAgendaDocuments(docsByItemId);
    } catch (error) {
      console.error('Error loading agenda documents:', error);
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
        .insert({ meeting_agenda_item_id: agendaItemId, user_id: user.id, file_name: file.name, file_path: fileName, file_type: file.type, file_size: file.size })
        .select().single();
      if (dbError) throw dbError;

      setAgendaDocuments(prev => ({ ...prev, [agendaItemId]: [...(prev[agendaItemId] || []), document] }));
      return document;
    } catch (error) {
      console.error('Error uploading agenda document:', error);
      throw error;
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
      console.error('Error deleting agenda document:', error);
      toast({ title: "Fehler", description: "Dokument konnte nicht entfernt werden.", variant: "destructive" });
    }
  };

  const loadLinkedQuickNotes = async (meetingId: string) => {
    try {
      const { data, error } = await supabase
        .from('quick_notes').select('*').eq('meeting_id', meetingId).order('created_at', { ascending: false });
      if (error) { console.error('Error loading linked quick notes:', error); return; }
      setLinkedQuickNotes(data || []);
    } catch (error) {
      console.error('Error loading linked quick notes:', error);
    }
  };

  const loadMeetingLinkedTasks = async (meetingId: string) => {
    try {
      const { data, error } = await supabase
        .from('tasks').select('id, title, description, due_date, priority, status, user_id').eq('meeting_id', meetingId).order('created_at', { ascending: false });
      if (error) throw error;
      setMeetingLinkedTasks(data || []);
    } catch (error) {
      console.error('Error loading meeting linked tasks:', error);
      setMeetingLinkedTasks([]);
    }
  };

  const loadMeetingLinkedCaseItems = async (meetingId: string) => {
    if (!currentTenant?.id) return;
    try {
      const { data, error } = await supabase
        .from('case_items').select('id, subject, status, priority, due_at, owner_user_id').eq('meeting_id', meetingId).neq('status', 'erledigt');
      if (error) throw error;
      setMeetingLinkedCaseItems(data || []);
    } catch (error) {
      console.error('Error loading meeting linked case items:', error);
      setMeetingLinkedCaseItems([]);
    }
  };

  const loadMeetingRelevantDecisions = async () => {
    if (!currentTenant?.id || !user?.id) return;
    try {
      const nowDate = new Date();
      const now = nowDate.toISOString();
      const in7Days = addDays(nowDate, 7).toISOString();
      const { data, error } = await supabase
        .from('task_decisions')
        .select('id, title, description, response_deadline, priority, created_by, status')
        .eq('tenant_id', currentTenant.id).eq('status', 'active')
        .or(`priority.gte.1,response_deadline.lt.${now},and(response_deadline.gte.${now},response_deadline.lte.${in7Days})`)
        .order('priority', { ascending: false, nullsFirst: false })
        .order('response_deadline', { ascending: true, nullsFirst: false });
      if (error) throw error;

      const decisionIds = (data || []).map(d => d.id);
      let participantRows: Array<{ decision_id: string; user_id: string }> = [];
      if (decisionIds.length > 0) {
        const { data: participants, error: participantError } = await supabase
          .from('task_decision_participants').select('decision_id, user_id').in('decision_id', decisionIds);
        if (participantError) throw participantError;
        participantRows = participants || [];
      }

      const relevant = (data || []).filter(decision =>
        decision.created_by === user.id ||
        participantRows.some(p => p.decision_id === decision.id && p.user_id === user.id)
      );
      setMeetingRelevantDecisions(relevant);
    } catch (error) {
      console.error('Error loading meeting relevant decisions:', error);
      setMeetingRelevantDecisions([]);
    }
  };

  const loadMeetingUpcomingAppointments = async (meetingId: string, meetingDate: string | Date) => {
    if (!currentTenant?.id) return;
    try {
      const baseDate = typeof meetingDate === 'string' ? new Date(meetingDate) : meetingDate;
      const start = startOfDay(baseDate);
      const end = endOfDay(addDays(baseDate, 14));

      const { data: internalData } = await supabase
        .from('appointments').select('id, title, start_time, end_time, location, category, status')
        .eq('tenant_id', currentTenant.id).gte('start_time', start.toISOString()).lte('start_time', end.toISOString())
        .order('start_time', { ascending: true });

      const { data: externalData } = await supabase
        .from('external_events').select('id, title, start_time, end_time, location, external_calendars!inner(name, color, tenant_id)')
        .eq('external_calendars.tenant_id', currentTenant.id).gte('start_time', start.toISOString()).lte('start_time', end.toISOString());

      const all = [
        ...(internalData || []).map(a => ({ ...a, isExternal: false })),
        ...(externalData || []).map((e: any) => ({
          id: e.id, title: e.title, start_time: e.start_time, end_time: e.end_time,
          location: e.location, isExternal: true,
          calendarName: e.external_calendars?.name, calendarColor: e.external_calendars?.color
        }))
      ].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
      setMeetingUpcomingAppointments(all);
    } catch (error) {
      console.error('Error loading upcoming appointments:', error);
      setMeetingUpcomingAppointments([]);
    }
  };

  const loadStarredAppointments = async (meetingId: string) => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('starred_appointments').select('id, appointment_id, external_event_id').eq('meeting_id', meetingId).eq('user_id', user.id);
      if (error) throw error;
      const ids = new Set<string>();
      data?.forEach(item => {
        if (item.appointment_id) ids.add(item.appointment_id);
        if (item.external_event_id) ids.add(item.external_event_id);
      });
      setStarredAppointmentIds(ids);
    } catch (error) {
      console.error('Error loading starred appointments:', error);
    }
  };

  const toggleStarAppointment = async (appt: any) => {
    if (!activeMeeting?.id || !user?.id || !currentTenant?.id) return;
    const isCurrentlyStarred = starredAppointmentIds.has(appt.id);
    setStarredAppointmentIds(prev => {
      const newSet = new Set(prev);
      if (isCurrentlyStarred) newSet.delete(appt.id); else newSet.add(appt.id);
      return newSet;
    });
    try {
      if (isCurrentlyStarred) {
        await supabase.from('starred_appointments').delete()
          .eq('meeting_id', activeMeeting.id).eq('user_id', user.id)
          .or(`appointment_id.eq.${appt.id},external_event_id.eq.${appt.id}`);
      } else {
        const insertData: any = { meeting_id: activeMeeting.id, user_id: user.id, tenant_id: currentTenant.id };
        if (appt.isExternal) insertData.external_event_id = appt.id; else insertData.appointment_id = appt.id;
        await supabase.from('starred_appointments').insert(insertData);
      }
    } catch (error) {
      console.error('Error toggling star:', error);
      setStarredAppointmentIds(prev => {
        const newSet = new Set(prev);
        if (isCurrentlyStarred) newSet.add(appt.id); else newSet.delete(appt.id);
        return newSet;
      });
    }
  };

  const updateQuickNoteResult = async (noteId: string, result: string) => {
    setLinkedQuickNotes(prev => prev.map(note => note.id === noteId ? { ...note, meeting_result: result } : note));
    const timeoutKey = `quick-note-${noteId}-meeting_result`;
    if (updateTimeouts.current[timeoutKey]) clearTimeout(updateTimeouts.current[timeoutKey]);
    updateTimeouts.current[timeoutKey] = setTimeout(async () => {
      try {
        const { error } = await supabase.from('quick_notes').update({ meeting_result: result }).eq('id', noteId);
        if (error) throw error;
      } catch (error) {
        console.error('Error updating quick note result:', error);
        toast({ title: "Fehler", description: "Das Ergebnis konnte nicht gespeichert werden.", variant: "destructive" });
      }
    }, 500);
  };

  const loadCarryoverBufferItems = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('carryover_items').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (error) throw error;
      setCarryoverBufferItems(data || []);
    } catch (error) {
      console.error('Error loading carryover buffer:', error);
    }
  };

  // ========== Meeting CRUD ==========

  const startMeeting = async (meeting: Meeting) => {
    if (activeMeetingId && activeMeetingId !== meeting.id) {
      setActiveMeeting(null);
      setActiveMeetingId(null);
      setLinkedQuickNotes([]);
    }
    setActiveMeeting(meeting);
    setActiveMeetingId(meeting.id || null);
    if (meeting.id) {
      await loadAgendaItems(meeting.id);
      await loadLinkedQuickNotes(meeting.id);
      await loadMeetingLinkedTasks(meeting.id);
      await loadMeetingLinkedCaseItems(meeting.id);
      await loadMeetingRelevantDecisions();
      await loadMeetingUpcomingAppointments(meeting.id, meeting.meeting_date);
      await loadStarredAppointments(meeting.id);
    }
  };

  const stopMeeting = () => {
    setActiveMeeting(null);
    setActiveMeetingId(null);
    setLinkedQuickNotes([]);
  };

  const updateMeeting = async (meetingId: string, updates: Partial<Meeting>, meetingTimeOverride?: string) => {
    const optimisticUpdates = { ...updates };
    setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, ...optimisticUpdates } : m));
    if (selectedMeeting?.id === meetingId) {
      setSelectedMeeting(prev => prev ? { ...prev, ...optimisticUpdates } : prev);
    }
    try {
      const formattedUpdates: any = {
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
      if (agendaFetchError) console.error('Error fetching agenda items:', agendaFetchError);

      if (agendaItemIds && agendaItemIds.length > 0) {
        const { error: docError } = await supabase
          .from('meeting_agenda_documents').delete().in('meeting_agenda_item_id', agendaItemIds.map(i => i.id));
        if (docError) console.error('Error deleting agenda docs:', docError);
      }

      await supabase.from('meeting_agenda_items').delete().eq('meeting_id', meetingId);
      await supabase.from('meeting_participants').delete().eq('meeting_id', meetingId);
      await supabase.from('quick_notes').update({ meeting_id: null }).eq('meeting_id', meetingId).select();
      await supabase.from('appointments').delete().eq('meeting_id', meetingId);

      const { error } = await supabase.from('meetings').delete().eq('id', meetingId).select();
      if (error) throw error;

      setMeetings(prev => prev.filter(m => m.id !== meetingId));
      if (selectedMeeting?.id === meetingId) { setSelectedMeeting(null); setAgendaItems([]); }
      if (activeMeetingId === meetingId) { setActiveMeeting(null); setActiveMeetingId(null); setLinkedQuickNotes([]); }
      toast({ title: "Meeting gelöscht", description: "Das Meeting wurde erfolgreich gelöscht." });
    } catch (error: unknown) {
      console.error('Delete meeting error:', error);
      const msg = error instanceof Error ? error.message : '';
      let errorMessage = 'Das Meeting konnte nicht gelöscht werden.';
      if (msg.includes('violates foreign key constraint')) {
        errorMessage = 'Das Meeting kann nicht gelöscht werden, da noch verknüpfte Daten existieren.';
      }
      toast({ title: "Fehler", description: errorMessage, variant: "destructive" });
    }
  };

  const getProfile = (userId: string) => profiles.find(p => p.user_id === userId);

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
    linkedQuickNotes, setLinkedQuickNotes,
    meetingLinkedTasks,
    meetingRelevantDecisions,
    meetingLinkedCaseItems,
    meetingUpcomingAppointments,
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
    starredAppointmentIds,
    expandedApptNotes, setExpandedApptNotes,
    showCarryoverBuffer, setShowCarryoverBuffer,
    carryoverBufferItems,
    hasEditPermission,
    upcomingMeetings,
    // Functions
    loadMeetings,
    loadAgendaItems,
    loadLinkedQuickNotes,
    loadMeetingLinkedTasks,
    loadMeetingLinkedCaseItems,
    loadMeetingRelevantDecisions,
    loadMeetingUpcomingAppointments,
    loadStarredAppointments,
    loadCarryoverBufferItems,
    toggleStarAppointment,
    updateQuickNoteResult,
    startMeeting,
    stopMeeting,
    updateMeeting,
    deleteMeeting,
    uploadAgendaDocument,
    deleteAgendaDocument,
    getProfile,
    updateTimeouts,
  };
}

export type MeetingsDataReturn = ReturnType<typeof useMeetingsData>;
