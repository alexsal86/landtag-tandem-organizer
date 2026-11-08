import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from '@/utils/debugConsole';
import { format } from "date-fns";
import { de } from "date-fns/locale";
import type { AgendaItem, Meeting, Profile } from "@/components/meetings/types";
import type { MeetingsDataReturn } from "./useMeetingsData";
import { normalizeTaskAssigneeIds, serializeLegacyTaskAssignees, syncTaskAssignees } from "@/lib/taskAssignees";
import { persistMeetingArchive } from "../archiveMeeting";

type ArchiveDeps = Pick<MeetingsDataReturn, 
  'user' | 'currentTenant' | 'toast' | 'profiles' | 'linkedQuickNotes' | 'meetingLinkedCaseItems' |
  'loadMeetings' | 'loadCarryoverBufferItems' | 'loadAgendaItems' |
  'setActiveMeeting' | 'setActiveMeetingId' | 'setAgendaItems' | 'setLinkedQuickNotes' |
  'setSelectedMeeting' | 'setIsFocusMode' | 'setArchivedMeetingId' | 'agendaItems' | 'updateTimeouts'
>;

export const mapBirthdayAssignedToValue = (
  assignedToFromResult: string[] | undefined,
  profiles: Pick<Profile, 'user_id'>[],
  fallbackUserId: string,
): string => {
  const explicitAssignees = (assignedToFromResult || []).filter(Boolean);
  if (explicitAssignees.length > 0) return explicitAssignees[0];

  const profileAssignees = profiles.map(profile => profile.user_id).filter(Boolean);
  if (profileAssignees.length > 0) return profileAssignees[0];

  return fallbackUserId;
};

export function useMeetingArchive(deps: ArchiveDeps) {
  const {
    user, currentTenant, toast, profiles, linkedQuickNotes, meetingLinkedCaseItems,
    loadMeetings, loadCarryoverBufferItems, loadAgendaItems,
    setActiveMeeting, setActiveMeetingId, setAgendaItems, setLinkedQuickNotes,
    setSelectedMeeting, setIsFocusMode, setArchivedMeetingId, agendaItems, updateTimeouts,
  } = deps;

  const ensureReviewParentItem = async (meetingId: string) => {
    const { data: existing } = await supabase
      .from('meeting_agenda_items').select('id, order_index').eq('meeting_id', meetingId)
      .eq('title', 'Rückblick').is('parent_id', null).maybeSingle();
    if (existing?.id) return existing.id;

    const { data: topLevelItems } = await supabase
      .from('meeting_agenda_items').select('id, order_index').eq('meeting_id', meetingId)
      .is('parent_id', null).order('order_index', { ascending: true });

    if (topLevelItems && topLevelItems.length > 0) {
      for (const item of topLevelItems) {
        await supabase.from('meeting_agenda_items').update({ order_index: (item.order_index || 0) + 1 }).eq('id', item.id);
      }
    }

    const { data: created, error: createError } = await supabase
      .from('meeting_agenda_items')
      .insert([{ meeting_id: meetingId, title: 'Rückblick', description: 'Übertragene Punkte aus vorherigen Besprechungen', order_index: 0, is_completed: false, is_recurring: false }])
      .select('id').single();
    if (createError) throw createError;
    return created.id;
  };

  const transferItemsToMeeting = async (items: AgendaItem[], targetMeetingId: string, sourceMeeting: Meeting) => {
    const reviewParentId = await ensureReviewParentItem(targetMeetingId);
    const { data: existingChildren } = await supabase
      .from('meeting_agenda_items').select('title, source_meeting_id').eq('meeting_id', targetMeetingId).eq('parent_id', reviewParentId);
    let existingSet = new Set((existingChildren || []).map((i: Record<string, any>) => `${i.source_meeting_id}::${i.title}`));

    const { data: maxOrderData } = await supabase
      .from('meeting_agenda_items').select('order_index').eq('meeting_id', targetMeetingId).eq('parent_id', reviewParentId)
      .order('order_index', { ascending: false }).limit(1);
    let nextOrderIndex = (maxOrderData?.[0]?.order_index || 0) + 1;

    for (const item of items) {
      try {
        const dedupeKey = `${sourceMeeting.id}::${item.title}`;
        if (existingSet.has(dedupeKey)) continue;
        const { error } = await supabase.from('meeting_agenda_items').insert([{
          meeting_id: targetMeetingId, parent_id: reviewParentId, title: item.title,
          description: item.description, notes: item.notes, result_text: item.result_text,
          assigned_to: item.assigned_to, order_index: nextOrderIndex++,
          source_meeting_id: sourceMeeting.id,
          original_meeting_date: typeof sourceMeeting.meeting_date === 'string' ? sourceMeeting.meeting_date : sourceMeeting.meeting_date?.toISOString().split('T')[0],
          original_meeting_title: sourceMeeting.title,
          carryover_notes: `Übertragen von: ${sourceMeeting.title} (${sourceMeeting.meeting_date})`
        }]);
        if (error) debugConsole.error('Error transferring item:', error);
        else existingSet.add(dedupeKey);
      } catch (error) {
        debugConsole.error('Error transferring agenda item:', item.title, error);
      }
    }
  };

  const storeCarryoverItems = async (items: AgendaItem[], sourceMeeting: Meeting) => {
    if (!user) return;
    for (const item of items) {
      try {
        const { error } = await supabase.from('carryover_items').insert([{
          user_id: user.id, template_id: sourceMeeting.template_id, title: item.title,
          description: item.description, notes: item.notes, result_text: item.result_text,
          assigned_to: item.assigned_to, order_index: item.order_index,
          original_meeting_id: sourceMeeting.id,
          original_meeting_date: typeof sourceMeeting.meeting_date === 'string' ? sourceMeeting.meeting_date : sourceMeeting.meeting_date?.toISOString().split('T')[0],
          original_meeting_title: sourceMeeting.title
        }]);
        if (error) debugConsole.error('Error storing carryover item:', error);
      } catch (error) {
        debugConsole.error('Error storing carryover item:', item.title, error);
      }
    }
  };

  const processCarryoverItems = async (meeting: Meeting, carryoverItems: AgendaItem[]) => {
    if (!user || !meeting.template_id) return;
    try {
      const { data: nextMeeting } = await supabase
        .from('meetings').select('*').eq('user_id', user.id).eq('template_id', meeting.template_id)
        .eq('status', 'planned').gt('meeting_date', meeting.meeting_date)
        .order('meeting_date', { ascending: true }).limit(1).maybeSingle();

      if (nextMeeting) {
        await transferItemsToMeeting(carryoverItems, nextMeeting.id, meeting);
        toast({ title: "Punkte übertragen", description: `${carryoverItems.length} Punkte wurden auf die nächste Besprechung übertragen` });
      } else {
        await storeCarryoverItems(carryoverItems, meeting);
        toast({ title: "Punkte vorgemerkt", description: `${carryoverItems.length} Punkte wurden für die nächste Besprechung vorgemerkt` });
      }
      await loadCarryoverBufferItems();
    } catch (error) {
      debugConsole.error('Error processing carryover items:', error);
      toast({ title: "Fehler", description: "Fehler beim Übertragen der Agenda-Punkte", variant: "destructive" });
    }
  };

  const clearCompletedCarryoverBuffer = async (meeting: Meeting) => {
    if (!user?.id || !meeting.id || !meeting.template_id) return;
    const { data: carriedItems } = await supabase
      .from('meeting_agenda_items').select('title, source_meeting_id').eq('meeting_id', meeting.id).not('source_meeting_id', 'is', null);
    if (!carriedItems || carriedItems.length === 0) return;
    for (const item of carriedItems) {
      await supabase.from('carryover_items').delete()
        .eq('user_id', user.id).eq('template_id', meeting.template_id!)
        .eq('title', item.title).eq('original_meeting_id', item.source_meeting_id!);
    }
    await loadCarryoverBufferItems();
  };

  const loadAndApplyCarryoverItems = async (meetingId: string, templateId: string) => {
    if (!user) return;
    try {
      const { data: pendingItems, error } = await supabase
        .from('carryover_items').select('*').eq('user_id', user.id).eq('template_id', templateId);
      if (error || !pendingItems || pendingItems.length === 0) return;

      const reviewParentId = await ensureReviewParentItem(meetingId);
      const { data: existingItems } = await supabase
        .from('meeting_agenda_items').select('order_index, title, source_meeting_id')
        .eq('meeting_id', meetingId).eq('parent_id', reviewParentId).order('order_index', { ascending: false });

      const existingSet = new Set((existingItems || []).map((i: Record<string, any>) => `${i.source_meeting_id}::${i.title}`));
      let nextOrderIndex = (existingItems?.[0]?.order_index || 0) + 1;

      for (const item of pendingItems) {
        const dedupeKey = `${item.original_meeting_id}::${item.title}`;
        if (existingSet.has(dedupeKey)) continue;
        await supabase.from('meeting_agenda_items').insert([{
          meeting_id: meetingId, parent_id: reviewParentId, title: item.title,
          description: item.description, notes: item.notes, result_text: item.result_text,
          assigned_to: item.assigned_to, order_index: nextOrderIndex++,
          source_meeting_id: item.original_meeting_id,
          original_meeting_date: item.original_meeting_date, original_meeting_title: item.original_meeting_title,
          carryover_notes: `Übertragen von: ${item.original_meeting_title} (${item.original_meeting_date})`
        }]);
      }
      await loadAgendaItems(meetingId);
      toast({ title: "Punkte übertragen", description: `${pendingItems.length} vorgemerkte Punkte wurden in die Agenda eingefügt.` });
    } catch (error) {
      debugConsole.error('Error applying carryover items:', error);
    }
  };

  const archiveMeeting = async (meeting: Meeting) => {
    try {
      if (!meeting?.id) throw new Error('Meeting hat keine ID');
      if (!user?.id) throw new Error('Benutzer nicht angemeldet');

      if (!currentTenant?.id) throw new Error('Büro fehlt');
      // Flush current edits before the transaction; cancelled debounces cannot overwrite them later.
      for (const item of agendaItems) {
        if (!item.id) continue;
        for (const key of ['result_text', 'notes', 'description']) {
          const timeout = updateTimeouts.current[`${item.id}-${key}`];
          if (timeout) clearTimeout(timeout);
        }
        const { error } = await supabase.from('meeting_agenda_items').update({ result_text: item.result_text, notes: item.notes })
          .eq('id', item.id).eq('meeting_id', meeting.id);
        if (error) throw error;
      }
      const { data: agendaItemsData, error: agendaError } = await supabase
        .from('meeting_agenda_items').select('*').eq('meeting_id', meeting.id);
      if (agendaError) throw agendaError;
      await persistMeetingArchive(meeting.id);
      const carryoverItems = agendaItemsData?.filter(item => item.carry_over_to_next) || [];
      if (carryoverItems.length) await processCarryoverItems(meeting, carryoverItems);
      await clearCompletedCarryoverBuffer(meeting);

      // Step 6b: Notify participants
      try {
        const { data: meetingParticipants } = await supabase.from('meeting_participants').select('user_id').eq('meeting_id', meeting.id);
        const notifyUserIds = Array.from(new Set([
          ...(meetingParticipants?.map((p: Record<string, any>) => p.user_id).filter(Boolean) || []),
        ].filter(id => id !== user.id)));
        const meetingDateFormatted = format(new Date(meeting.meeting_date), 'dd.MM.yyyy', { locale: de });
        for (const recipientId of notifyUserIds) {
          try {
            await supabase.rpc('create_notification', {
              user_id_param: recipientId, type_name: 'meeting_archived',
              title_param: `Besprechung archiviert: ${meeting.title}`,
              message_param: `Die Besprechung "${meeting.title}" vom ${meetingDateFormatted} wurde archiviert. Prüfen Sie Ihre neuen Aufgaben.`,
              priority_param: 'medium',
              data_param: JSON.stringify({ meeting_id: meeting.id, meeting_title: meeting.title, meeting_date: meeting.meeting_date }),
            });
          } catch (e) { debugConsole.error(`Notification to ${recipientId} failed (non-fatal):`, e); }
        }
      } catch (e) { debugConsole.error('Error sending archive notifications (non-fatal):', e); }

      // Step 7: Reset state and show protocol
      const archivedId = meeting.id;
      setActiveMeeting(null);
      setActiveMeetingId(null);
      setAgendaItems([]);
      setLinkedQuickNotes([]);
      setSelectedMeeting(null);
      setIsFocusMode(false);

      await loadMeetings();
      
      // Show protocol as confirmation
      setArchivedMeetingId(archivedId);
      
      toast({ title: "Besprechung archiviert", description: "Die Besprechung wurde erfolgreich archiviert und Aufgaben wurden erstellt. Teilnehmer wurden benachrichtigt." });
    } catch (error) {
      debugConsole.error('Archive meeting error:', error);
      const errorMessage = error instanceof Error ? error.message : (typeof error === 'string' ? error : JSON.stringify(error));
      toast({ title: "Fehler", description: `Die Besprechung konnte nicht archiviert werden: ${errorMessage}`, variant: "destructive" });
    }
  };

  return { archiveMeeting, loadAndApplyCarryoverItems };
}
