import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from '@/utils/debugConsole';
import { format } from "date-fns";
import { de } from "date-fns/locale";
import type { AgendaItem, Meeting, Profile } from "@/components/meetings/types";
import type { MeetingsDataReturn } from "./useMeetingsData";
import { normalizeTaskAssigneeIds, serializeLegacyTaskAssignees, syncTaskAssignees } from "@/lib/taskAssignees";

type ArchiveDeps = Pick<MeetingsDataReturn, 
  'user' | 'currentTenant' | 'toast' | 'profiles' | 'linkedQuickNotes' | 'meetingLinkedCaseItems' |
  'loadMeetings' | 'loadCarryoverBufferItems' | 'loadAgendaItems' |
  'setActiveMeeting' | 'setActiveMeetingId' | 'setAgendaItems' | 'setLinkedQuickNotes' |
  'setSelectedMeeting' | 'setIsFocusMode' | 'setArchivedMeetingId'
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
    setSelectedMeeting, setIsFocusMode, setArchivedMeetingId,
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
    let existingSet = new Set((existingChildren || []).map(i => `${i.source_meeting_id}::${i.title}`));

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

      const existingSet = new Set((existingItems || []).map(i => `${i.source_meeting_id}::${i.title}`));
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

      // Step 1: Get agenda items
      const { data: agendaItemsData, error: agendaError } = await supabase
        .from('meeting_agenda_items').select('*').eq('meeting_id', meeting.id);
      if (agendaError) throw agendaError;

      // Step 2: Process carryover items
      const carryoverItems = agendaItemsData?.filter(item => item.carry_over_to_next) || [];
      if (carryoverItems.length > 0) {
        try { await processCarryoverItems(meeting, carryoverItems); } catch (e) { debugConsole.error('Carryover error (non-fatal):', e); }
      }

      // Step 3a: Linked task results → child tasks
      const itemsWithLinkedTaskResult = agendaItemsData?.filter(item => item.task_id && item.result_text?.trim()) || [];
      for (const item of itemsWithLinkedTaskResult) {
        try {
          const { data: existingTask } = await supabase.from('tasks').select('id, user_id, assigned_to, tenant_id').eq('id', item.task_id!).maybeSingle();
          if (existingTask) {
            const meetingContext = `Ergebnis aus Besprechung "${meeting.title}" vom ${format(new Date(meeting.meeting_date), 'dd.MM.yyyy', { locale: de })}`;
            await supabase.from('tasks').insert([{
              user_id: user.id, tenant_id: existingTask.tenant_id || currentTenant?.id || '',
              parent_task_id: existingTask.id, title: item.result_text!.substring(0, 200),
              description: `**${meetingContext}**\n\n${item.result_text}`,
              assigned_to: existingTask.assigned_to || existingTask.user_id || user.id,
              status: 'todo', priority: 'medium', category: 'meeting',
              due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            }]);
          }
        } catch (e) { debugConsole.error('Error creating child task for linked item (non-fatal):', e); }
      }

      // Step 3b: Create tasks for assigned items without linked task
      const itemsWithAssignment = agendaItemsData?.filter(item => item.assigned_to && !item.task_id) || [];
      for (const item of itemsWithAssignment) {
        try {
          let assignedUserId: string | null = null;
          if (Array.isArray(item.assigned_to)) {
            const flattened = item.assigned_to.flat().filter(Boolean) as string[];
            assignedUserId = flattened[0] || null;
          } else if (typeof item.assigned_to === 'string') {
            assignedUserId = item.assigned_to;
          }

          const assigneeNames = Array.isArray(item.assigned_to)
            ? item.assigned_to.flat().filter(Boolean).map(id => {
                const profile = profiles.find(p => p.user_id === id);
                return profile?.display_name || 'Unbekannt';
              }).join(', ')
            : '';

          const detailsBlock = item.description?.trim() ? `\n\n**Details:**\n${item.description}` : '';
          const notesBlock = item.notes?.trim() ? `\n\n**Notizen:**\n${item.notes}` : '';
          const resultBlock = item.result_text?.trim() ? `\n\n**Ergebnis:**\n${item.result_text}` : '';
          const multiAssigneeNote = assigneeNames && item.assigned_to && item.assigned_to.length > 1
            ? `\n\n**Zuständige:** ${assigneeNames}` : '';

          const taskDescription = `**Aus Besprechung:** ${meeting.title} vom ${format(new Date(meeting.meeting_date), 'dd.MM.yyyy', { locale: de })}${resultBlock}${detailsBlock}${notesBlock}${multiAssigneeNote}`;
          const assigneeIds = normalizeTaskAssigneeIds(Array.isArray(item.assigned_to) ? item.assigned_to : assignedUserId);

          const { data: createdTask } = await supabase.from('tasks').insert([{
            user_id: user.id, title: item.title, description: taskDescription,
            priority: 'medium', category: 'meeting', status: 'todo',
            assigned_to: serializeLegacyTaskAssignees(assigneeIds), tenant_id: currentTenant?.id || '',
            due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          }]).select('id').single();
          if (createdTask) await syncTaskAssignees({ taskId: createdTask.id, assigneeIds, assignedBy: user.id });
        } catch (e) { debugConsole.error('Error creating task for assigned item (non-fatal):', e); }
      }

      // Step 3c: Birthday follow-up tasks
      const birthdayItems = agendaItemsData?.filter(item => item.system_type === 'birthdays' && item.result_text?.trim()) || [];
      for (const birthdayItem of birthdayItems) {
        try {
          const parsedResults = JSON.parse(birthdayItem.result_text || '{}') as Record<string, { action?: 'card' | 'mail' | 'call' | 'gift'; assigned_to?: string[] }>;
          const selectedContactIds = Object.keys(parsedResults).filter(contactId => parsedResults[contactId]?.action);
          if (selectedContactIds.length === 0) continue;

          const { data: contactsData, error: contactsError } = await supabase
            .from('contacts').select('id, name, birthday').in('id', selectedContactIds).eq('tenant_id', currentTenant?.id || '');
          if (contactsError || !contactsData || contactsData.length === 0) continue;

          const actionLabelMap: Record<string, string> = { card: 'Karte', mail: 'Mail', call: 'Anruf', gift: 'Geschenk' };

          const tasksToInsert = contactsData.map(contact => {
            const result = parsedResults[contact.id];
            const action = result?.action;
            if (!action) return null;
            const birthdayDate = contact.birthday ? format(new Date(contact.birthday), 'dd.MM.yyyy', { locale: de }) : 'unbekannt';
            const assignedUserIds = result.assigned_to && result.assigned_to.length > 0 ? result.assigned_to : profiles.map(p => p.user_id);
            const assigneeNames = assignedUserIds.map(id => { const p = profiles.find(pr => pr.user_id === id); return p?.display_name || 'Unbekannt'; }).join(', ');
            return {
              user_id: user.id,
              title: `Geburtstag: ${actionLabelMap[action]} für ${contact.name}`,
              description: `**Aus Besprechung:** ${meeting.title} vom ${format(new Date(meeting.meeting_date), 'dd.MM.yyyy', { locale: de })}\n\n**Aktion:** ${actionLabelMap[action]}\n**Kontakt:** ${contact.name}\n**Geburtstag:** ${birthdayDate}\n**Zuständig:** ${assigneeNames}`,
              priority: 'medium', category: 'meeting', status: 'todo', assigned_to: serializeLegacyTaskAssignees(normalizeTaskAssigneeIds(assignedUserIds)),
              tenant_id: currentTenant?.id || '',
              due_date: new Date(new Date(meeting.meeting_date).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
            };
          }).filter((t): t is NonNullable<typeof t> => t !== null);

          if (tasksToInsert.length > 0) {
            const { data: createdTasks } = await supabase.from('tasks').insert(tasksToInsert).select('id, assigned_to');
            for (const createdTask of createdTasks || []) {
              await syncTaskAssignees({
                taskId: createdTask.id,
                assigneeIds: normalizeTaskAssigneeIds(createdTask.assigned_to),
                assignedBy: user.id,
              });
            }
          }
        } catch (e) { debugConsole.error('Error processing birthday tasks (non-fatal):', e); }
      }

      // Step 4: Follow-up task with subtasks
      let followUpTask: any = null;
      try {
        const { data: createdTask, error: taskError } = await supabase.from('tasks').insert([{
          user_id: user.id,
          title: `Nachbereitung ${meeting.title} vom ${format(new Date(), 'dd.MM.yyyy')}`,
          description: `Nachbereitung der Besprechung "${meeting.title}"`,
          priority: 'medium', category: 'meeting', status: 'todo',
          tenant_id: currentTenant?.id || '',
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          assigned_to: user.id,
        }]).select().single();
        if (createdTask?.id) await syncTaskAssignees({ taskId: createdTask.id, assigneeIds: [user.id], assignedBy: user.id });
        if (taskError) throw taskError;
        followUpTask = createdTask;
      } catch (e) { debugConsole.error('Error creating follow-up task (non-fatal):', e); }

      // Step 5: Child tasks for items with results but no assignment
      if (followUpTask && agendaItemsData) {
        const childTasksToCreate: any[] = [];
        for (const item of agendaItemsData) {
          if (item.assigned_to) continue;
          if (item.task_id) continue;
          if (item.result_text?.trim()) {
            let description = item.title;
            if (item.description?.trim()) description += `: ${item.description}`;
            if (item.notes?.trim()) description += (item.description ? ' - ' : ': ') + item.notes;
            childTasksToCreate.push({
              user_id: user.id, tenant_id: currentTenant?.id || '', parent_task_id: followUpTask.id,
              title: description, description: item.result_text || '', assigned_to: user.id,
              status: 'todo', priority: 'medium', category: 'meeting',
              due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            });
          }
        }
        if (childTasksToCreate.length > 0) {
          try { await supabase.from('tasks').insert(childTasksToCreate); } catch (e) { debugConsole.error('Error creating child tasks (non-fatal):', e); }
        }
      }

      // Step 5b: Process quick note results
      try {
        for (const note of linkedQuickNotes) {
          if (note.meeting_result?.trim()) {
            await supabase.from('quick_notes').update({ meeting_result: note.meeting_result }).eq('id', note.id);
          }
        }
      } catch (e) { debugConsole.error('Error processing quick note results (non-fatal):', e); }

      // Step 5c: Process case item results
      try {
        for (const ci of meetingLinkedCaseItems) {
          const meetingResult = (ci as { meeting_result?: string }).meeting_result;
          if (meetingResult?.trim()) {
            // case_item_notes is not in generated Supabase types – use fetch directly
            try {
              const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/case_item_notes`;
              await fetch(url, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                  'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
                },
                body: JSON.stringify({
                  case_item_id: ci.id,
                  content: meetingResult,
                  created_by: user.id,
                  note_type: 'meeting_result',
                }),
              });
            } catch {
              // Table may not exist yet
            }
          }
        }
      } catch (e) { debugConsole.error('Error processing case item results (non-fatal):', e); }

      // Step 5d: Starred appointments → tasks
      try {
        const meetingTenantId = currentTenant?.id || meeting.tenant_id;
        if (meetingTenantId) {
          const { data: starredAppts } = await supabase
            .from('starred_appointments').select('id, appointment_id, external_event_id, assigned_to').eq('meeting_id', meeting.id);
          if (starredAppts && starredAppts.length > 0) {
            const starredAssignmentMap = new Map<string, string[] | null>();
            const appointmentIds = starredAppts.filter(s => s.appointment_id).map(s => {
              starredAssignmentMap.set(s.appointment_id!, s.assigned_to || null);
              return s.appointment_id!;
            });
            const externalEventIds = starredAppts.filter(s => s.external_event_id).map(s => {
              starredAssignmentMap.set(s.external_event_id!, s.assigned_to || null);
              return s.external_event_id!;
            });

            const allAppointments: Array<{ id: string; title: string; start_time: string }> = [];
            if (appointmentIds.length > 0) {
              const { data: appointments } = await supabase.from('appointments').select('id, title, start_time').in('id', appointmentIds);
              if (appointments) allAppointments.push(...appointments);
            }
            if (externalEventIds.length > 0) {
              const { data: externalEvents } = await supabase.from('external_events').select('id, title, start_time').in('id', externalEventIds);
              if (externalEvents) allAppointments.push(...externalEvents);
            }

            if (allAppointments.length > 0) {
              const { data: participants } = await supabase.from('meeting_participants').select('user_id').eq('meeting_id', meeting.id);
              const allParticipantIds = Array.from(new Set([
                ...(participants?.map(p => p.user_id).filter(Boolean) || []), meeting.user_id,
              ].filter(Boolean))) as string[];
              if (allParticipantIds.length === 0) allParticipantIds.push(user.id);

              allAppointments.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
              const allAssignedIds = `{${allParticipantIds.join(',')}}`;
              const { data: apptTask } = await supabase.from('tasks').insert([{
                user_id: user.id, title: `Vorbereitung: Markierte Termine aus ${meeting.title}`,
                description: `Folgende Termine wurden in der Besprechung als wichtig markiert.`,
                priority: 'medium', category: 'meeting', status: 'todo', assigned_to: allAssignedIds,
                tenant_id: meetingTenantId,
                due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
              }]).select().single();

              if (apptTask) {
                await syncTaskAssignees({ taskId: apptTask.id, assigneeIds: allParticipantIds, assignedBy: user.id });
                const childTasks = allAppointments.map(apt => {
                  const specificAssignment = starredAssignmentMap.get(apt.id);
                  const assignedTo = specificAssignment && specificAssignment.length > 0
                    ? `{${specificAssignment.join(',')}}` : allAssignedIds;
                  return {
                    user_id: user.id, tenant_id: meetingTenantId, parent_task_id: apptTask.id,
                    title: `${apt.title} (${format(new Date(apt.start_time), 'dd.MM.yyyy HH:mm', { locale: de })})`,
                    description: null, assigned_to: assignedTo, status: 'todo', priority: 'medium', category: 'meeting',
                  };
                });
                const { data: createdChildTasks } = await supabase.from('tasks').insert(childTasks).select('id, assigned_to');
                for (const childTask of createdChildTasks || []) {
                  await syncTaskAssignees({
                    taskId: childTask.id,
                    assigneeIds: normalizeTaskAssigneeIds(childTask.assigned_to),
                    assignedBy: user.id,
                  });
                }
              }
            }
          }
        }
      } catch (e) { debugConsole.error('Error creating starred appointments tasks (non-fatal):', e); }

      // Step 5e: Clear completed carryover buffer
      await clearCompletedCarryoverBuffer(meeting);

      // Step 5f: Write back decision results
      try {
        const decisionItems = agendaItemsData?.filter(item => item.system_type === 'decisions' && item.result_text?.trim()) || [];
        for (const dItem of decisionItems) {
          // Try to find matching decision by title and update it
          const { data: matchedDecisions } = await supabase
            .from('decisions')
            .select('id')
            .eq('title', dItem.title)
            .limit(1);
          if (matchedDecisions && matchedDecisions.length > 0) {
            await supabase
              .from('decisions')
              .update({ status: 'decided', result: dItem.result_text })
              .eq('id', matchedDecisions[0].id);
          }
        }
      } catch (e) { debugConsole.error('Error writing back decision results (non-fatal):', e); }

      // Step 6: Archive meeting
      const { error: archiveError } = await supabase.from('meetings').update({ status: 'archived' }).eq('id', meeting.id).select();
      if (archiveError) throw archiveError;

      // Step 6b: Notify participants
      try {
        const { data: meetingParticipants } = await supabase.from('meeting_participants').select('user_id').eq('meeting_id', meeting.id);
        const notifyUserIds = Array.from(new Set([
          ...(meetingParticipants?.map(p => p.user_id).filter(Boolean) || []),
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
      const archivedId = meeting.id!;
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
