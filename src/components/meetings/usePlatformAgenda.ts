import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { agendaHorizon, criticalTaskReason, pastAppointmentReview } from './platformAgendaRules';
import type { PlatformAgendaType } from './systemAgendaRegistry';

export interface PlatformAgendaEntry {
  id: string; title: string; detail?: string; date?: string | null; status?: string;
  ownerId?: string | null; path: string; content?: string | null;
  approval?: 'social';
  decisionId?: string;
}

/** Bounded, cached source queries shared by editor, meeting, focus mode and My Work. */
export async function loadPlatformAgenda(type: PlatformAgendaType, tenantId: string, date: string | Date): Promise<PlatformAgendaEntry[]> {
  const horizon = agendaHorizon(date, type === 'event_plannings' ? 60 : type === 'redaktion' ? 10 : 14);
  if (type === 'redaktion') {
    const { data, error } = await supabase.from('social_content_items')
      .select('id, workflow_status, approval_state, scheduled_for, responsible_user_id, draft_text, core_message, topic_backlog(topic), social_content_item_channels(social_content_channels(name))')
      .eq('tenant_id', tenantId).neq('workflow_status', 'published')
      .or(`and(scheduled_for.gte.${horizon.start},scheduled_for.lte.${horizon.end}),and(scheduled_for.is.null,workflow_status.in.(idea,draft,approval)),approval_state.eq.pending_approval`)
      .order('scheduled_for', { ascending: true, nullsFirst: false }).limit(200);
    if (error) throw error;
    return (data ?? []).map(row => ({ id: row.id, title: row.topic_backlog?.topic || 'Ohne Thema', date: row.scheduled_for,
      detail: row.social_content_item_channels.map(link => link.social_content_channels?.name).filter(Boolean).join(' · '),
      status: row.approval_state === 'approved' ? 'Freigegeben' : row.approval_state === 'pending_approval' ? 'Zur Freigabe' : row.workflow_status === 'scheduled' ? 'Geplant' : row.workflow_status === 'idea' ? 'Idee' : 'Entwurf',
      ownerId: row.responsible_user_id, path: `/redaktion?highlight=${row.id}`, content: row.draft_text || row.core_message,
      approval: row.approval_state === 'pending_approval' ? 'social' : undefined }));
  }
  if (type === 'leave_requests') {
    // No tenant_id on leave_requests: scope via active memberships; RLS still controls visibility.
    const members = await supabase.from('user_tenant_memberships').select('user_id').eq('tenant_id', tenantId).eq('is_active', true);
    if (members.error) throw members.error;
    const ids = (members.data ?? []).map(member => member.user_id);
    if (!ids.length) return [];
    const profiles = await supabase.from('profiles').select('user_id, display_name').eq('tenant_id', tenantId).in('user_id', ids);
    if (profiles.error) throw profiles.error;
    const name = (id: string | null) => profiles.data?.find(profile => profile.user_id === id)?.display_name || 'Unbekannt';
    const { data, error } = await supabase.from('leave_requests').select('id, user_id, start_date, end_date, status, deputy_user_id')
      .in('user_id', ids).in('status', ['pending', 'approved', 'cancel_requested'])
      .lte('start_date', horizon.end.slice(0, 10)).gte('end_date', horizon.start.slice(0, 10)).order('start_date').limit(200);
    if (error) throw error;
    return (data ?? []).map(row => ({ id: row.id, title: name(row.user_id), date: row.start_date,
      detail: `Bis ${new Date(row.end_date).toLocaleDateString('de-DE')} · ${row.deputy_user_id ? `Vertretung: ${name(row.deputy_user_id)}` : 'Vertretung fehlt'}`,
      status: row.status === 'approved' ? 'Genehmigt' : row.status === 'cancel_requested' ? 'Stornierung beantragt' : 'Beantragt',
      ownerId: row.user_id, path: '/mywork?tab=time' }));
  }
  if (type === 'event_plannings') {
    const { data, error } = await supabase.from('event_plannings')
      .select('id, title, location, confirmed_date, user_id, event_planning_checklist_items(is_completed, type)')
      .eq('tenant_id', tenantId).eq('is_archived', false).eq('is_completed', false)
      .or(`confirmed_date.is.null,and(confirmed_date.gte.${horizon.start},confirmed_date.lte.${horizon.end})`)
      .order('confirmed_date', { nullsFirst: false }).limit(200);
    if (error) throw error;
    return (data ?? []).map(row => {
      const checklist = row.event_planning_checklist_items.filter(item => item.type !== 'phase_start');
      const open = checklist.filter(item => !item.is_completed).length;
      return { id: row.id, title: row.title, date: row.confirmed_date, detail: `${row.location || 'Ort offen'} · ${open}/${checklist.length} Punkte offen`,
        status: row.confirmed_date ? 'Datum bestätigt' : 'Datum offen', ownerId: row.user_id, path: `/eventplanning/${row.id}` };
    });
  }
  if (type === 'letters_for_signature') {
    const { data, error } = await supabase.from('letters').select('id, title, subject, recipient_name, status, content_html, created_by')
      .eq('tenant_id', tenantId).in('status', ['review', 'pending_approval', 'approved']).order('updated_at').limit(200);
    if (error) throw error;
    const decisions = await supabase.from('task_decisions').select('id, description').eq('tenant_id', tenantId)
      .in('status', ['active', 'open']).like('description', '%letter_approval_letter_id:%').limit(200);
    if (decisions.error) throw decisions.error;
    return (data ?? []).map(row => ({ id: row.id, title: row.subject || row.title, detail: row.recipient_name || 'Empfänger offen',
      status: row.status === 'approved' ? 'Freigegeben · Versand offen' : row.status === 'review' ? 'Kollegenprüfung' : 'Zur Freigabe',
      path: `/letters/${row.id}`, content: row.content_html,
      decisionId: decisions.data?.find(decision => decision.description?.split('\n').some(line => line.trim() === `letter_approval_letter_id:${row.id}`))?.id }));
  }
  if (type === 'critical_radar') {
    const until = agendaHorizon(date, 7).end;
    const [cases, tasks] = await Promise.all([
      supabase.from('case_items').select('id, subject, next_action_due_at, next_action_label, owner_user_id')
        .eq('tenant_id', tenantId).eq('ball_owner', 'ministry').not('status', 'in', '(erledigt,archiviert)')
        .lte('next_action_due_at', until).order('next_action_due_at').limit(200),
      supabase.from('tasks').select('id, title, status, nudge_count, next_action_due, due_date, ball_assignee_id')
        .eq('tenant_id', tenantId).neq('status', 'completed')
        .or(`nudge_count.gte.2,next_action_due.lt.${horizon.start},due_date.lt.${horizon.start}`).limit(200),
    ]);
    if (cases.error) throw cases.error;
    if (tasks.error) throw tasks.error;
    const critical: PlatformAgendaEntry[] = (cases.data ?? []).map(row => ({ id: row.id, title: row.subject || 'Vorgang',
      detail: row.next_action_label || 'Antwort nachhalten', date: row.next_action_due_at, status: 'Ministeriumsfrist', ownerId: row.owner_user_id, path: `/mywork?tab=cases&highlight=${row.id}` }));
    for (const task of tasks.data ?? []) {
      const reason = criticalTaskReason(task, new Date(date));
      if (reason) critical.push({ id: task.id, title: task.title, date: task.next_action_due || task.due_date, status: reason, ownerId: task.ball_assignee_id, path: `/tasks?highlight=${task.id}` });
    }
    return critical.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }
  if (type === 'past_appointments') {
    const end = agendaHorizon(date, 0).start;
    const start = agendaHorizon(new Date(new Date(date).getTime() - 7 * 86_400_000), 0).start;
    const { data, error } = await supabase.from('appointments').select('id, title, start_time, location, user_id')
      .eq('tenant_id', tenantId).gte('start_time', start).lt('start_time', end).order('start_time', { ascending: false }).limit(100);
    if (error) throw error;
    const ids = (data ?? []).map(row => row.id);
    const feedback = ids.length ? await supabase.from('appointment_feedback').select('appointment_id, feedback_status, notes, has_tasks')
      .eq('tenant_id', tenantId).in('appointment_id', ids).limit(500) : { data: [], error: null };
    if (feedback.error) throw feedback.error;
    return (data ?? []).map(row => {
      const fb = feedback.data?.find(entry => entry.appointment_id === row.id);
      const review = pastAppointmentReview(fb);
      return { id: row.id, title: row.title, date: row.start_time, detail: [row.location, fb?.notes?.trim().slice(0, 140)].filter(Boolean).join(' · ') || undefined,
        status: review.status, ownerId: row.user_id, path: `/calendar?appointment=${row.id}`, content: fb?.notes };
    });
  }
  return [];
}

export function usePlatformAgenda(type: PlatformAgendaType, date: string | Date) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const day = new Date(date).toISOString().slice(0, 10);
  return useQuery({ queryKey: ['jour-fixe-platform', tenantId, type, day], enabled: !!tenantId && type !== 'appointment_requests', staleTime: 60_000,
    queryFn: () => { if (!tenantId) throw new Error('Büro fehlt'); return loadPlatformAgenda(type, tenantId, date); } });
}