import { combineAgendaItems } from "@/components/meetings/agenda-editor/combineAgendaItems";
import { agendaTiming } from "@/components/meetings/agenda-editor/agendaTiming";
import type { TablesInsert } from "@/integrations/supabase/types";
import { supabase } from '@/integrations/supabase/client';
import { persistMeetingArchive } from '@/components/meetings/archiveMeeting';
import { criticalTaskReason } from '@/components/meetings/platformAgendaRules';
import { loadPlatformAgenda } from '@/components/meetings/usePlatformAgenda';
import { SYSTEM_AGENDA_OPTIONS, PLATFORM_AGENDA_TYPES } from '@/components/meetings/systemAgendaRegistry';
import { agendaHorizon } from '@/components/meetings/platformAgendaRules';
import { SELFTEST_MARKER, SELFTEST_PREFIX } from '../runner';
import { describeError } from '../verify';
import type { TestScenario } from '../types';

export const jourFixePlatformIntegrationScenario: TestScenario = {
  id: 'jour-fixe-platform-integration', title: 'Jour Fixe: Plattformquellen & Stafetten-Abschluss',
  description: 'Prüft Quellenabfragen, 12 Systemtypen, echte Entscheidungs-IDs, atomaren Sitzungsabschluss und doppelfreie Wiederholung.',
  touches: ['meetings', 'meeting_agenda_items', 'tasks', 'task_decisions'], features: ['meetings', 'tasks', 'decisions'],
  writes: [
    { table: 'meetings', columns: ['title', 'description', 'meeting_date', 'status', 'user_id', 'tenant_id'] },
    { table: 'meeting_agenda_items', columns: ['meeting_id', 'title', 'assigned_to', 'result_text', 'order_index', 'system_type', 'is_completed', 'is_recurring'] },
    { table: 'task_decisions', columns: ['title', 'description', 'created_by', 'tenant_id', 'status', 'meeting_id', 'meeting_result'] },
    { table: 'tasks', columns: ['meeting_id', 'source_type', 'source_id', 'ball_owner', 'ball_assignee_id', 'next_action', 'next_action_due', 'timeline'] },
  ],
  checks: ['Quellenabfragen unter bestehenden Zugriffsrechten', 'Folgeaufgaben mit Zuständigkeit und Verlauf', 'Notizen ändern keine Abstimmung', 'Wiederholung erzeugt keine Duplikate'],
  limitations: ['Quellenabfragen bestätigen bei leerem Bestand nur die Erreichbarkeit.', 'Freigaben und Sichtbarkeit für andere Rollen erfordern zusätzliche persönliche Sitzungen.'],
  collectArtifacts: async ctx => {
    const id = ctx.data.jourFixeId;
    if (typeof id !== 'string') return;
    const { data } = await supabase.from('tasks').select('id').eq('tenant_id', ctx.tenantId).eq('meeting_id', id).like('source_type', 'jour_fixe_%');
    for (const row of data ?? []) if (!ctx.created.some(record => record.table === 'tasks' && record.id === row.id)) ctx.trackRecord({ table: 'tasks', id: row.id });
  },
  steps: [
    { id: 'agenda-combine', label: 'Agenda: Hauptpunkt mit Unterpunkten unter anderen Hauptpunkt verschieben', kind: 'logic', run: async () => {
      const base = {title:'Punkt',order_index:0,is_completed:false,is_recurring:false};
      const source = [{...base,id:'a'},{...base,id:'child',parent_id:'a'},{...base,id:'b'}];
      const moved = combineAgendaItems(source,'a','b');
      const ok = moved?.map(item => item.id).join(',') === 'b,a,child' && moved.slice(1).every(item => item.parent_id === 'b') && !('parent_id' in source[0]) && combineAgendaItems(source,'a','child') === null;
      return {ok, message:ok ? 'Hierarchie und Inhalte bleiben erhalten.' : 'Verschieben verletzt die Agenda-Hierarchie.'};
    } },
    { id: 'agenda-timing', label: 'Agenda: nur Hauptpunkte zählen, Altbestand ohne erfundene Endzeit', kind: 'logic', run: async () => {
      const base = { title: 'Punkt', is_completed: false, is_recurring: false, order_index: 0 };
      const legacy = agendaTiming([base], '10:00');
      const planned = agendaTiming([{ ...base, id: 'main', duration_minutes: 20 }, { ...base, parent_id: 'main', duration_minutes: 99 }], '23:50');
      const ok = legacy.total === 0 && legacy.end === null && planned.total === 20 && planned.end === '00:10';
      return { ok, message: ok ? 'Dauer, Unterpunkte und Tageswechsel korrekt.' : 'Agenda-Zeitberechnung weicht ab.' };
    } },
    { id: 'radar-rules', label: 'Radar: mehrfache Anstupser, 7-Tage-Grenze und abgeschlossene Aufgaben', kind: 'logic', run: async () => {
      const now = new Date('2026-11-08T12:00:00Z');
      const base = { status: 'todo', due_date: null, next_action_due: null, nudge_count: 1 };
      const ok = criticalTaskReason(base, now) === null && criticalTaskReason({ ...base, nudge_count: 2 }, now) !== null
        && criticalTaskReason({ ...base, due_date: '2026-11-01T12:00:00Z' }, now) === null
        && criticalTaskReason({ ...base, due_date: '2026-11-01T11:59:59Z' }, now) !== null
        && criticalTaskReason({ ...base, status: 'completed', nudge_count: 2 }, now) === null;
      return { ok, message: ok ? 'Radarregeln korrekt.' : 'Radarregel verletzt.' };
    } },
    { id: 'horizon-rules', label: 'Zeitfenster: Redaktion 10, Briefings/Abwesenheiten 14 und Veranstaltungen 60 Tage', kind: 'logic', run: async () => {
      const date = new Date(2026,10,8,12);
      const ok = [7,10,14,60].every(days => new Date(agendaHorizon(date,days).end).getDate() === new Date(2026,10,8+days).getDate());
      return { ok, message: ok ? 'Alle Sitzungszeitfenster korrekt.' : 'Zeitfenster weichen ab.' };
    } },
    ...PLATFORM_AGENDA_TYPES.filter(type => type !== 'appointment_requests').map(type => ({
      id: `source-${type}`, label: `Plattformquelle: ${type}`, critical: false, run: async (ctx: Parameters<NonNullable<TestScenario['collectArtifacts']>>[0]) => {
        try { const rows = await loadPlatformAgenda(type, ctx.tenantId, new Date()); return { ok: true, message: `${rows.length} zugängliche Einträge geladen.` }; }
        catch (error) { return { ok: false, message: describeError(error) }; }
      },
    })),
    { id: 'create', label: 'Sitzung, Hauptpunkt, alle Systemtypen und zwei gleichnamige Entscheidungen', run: async ctx => {
      const id = crypto.randomUUID(); ctx.data.jourFixeId = id;
      const meeting = await supabase.from('meetings').insert({ id, user_id: ctx.userId, tenant_id: ctx.tenantId, title: `${SELFTEST_PREFIX} Jour Fixe ${ctx.runId}`, description: SELFTEST_MARKER, meeting_date: new Date().toISOString().slice(0,10), status: 'planned' });
      if (meeting.error) return { ok: false, message: describeError(meeting.error) };
      ctx.trackRecord({ table: 'meetings', id });
      const decisionId = crypto.randomUUID(); const otherId = crypto.randomUUID(); ctx.data.jourFixeDecisionId = decisionId; ctx.data.jourFixeOtherDecisionId = otherId;
      for (const did of [decisionId, otherId]) {
        const d = await supabase.from('task_decisions').insert({ id: did, title: `${SELFTEST_PREFIX} Gleicher Titel ${ctx.runId}`, description: SELFTEST_MARKER, created_by: ctx.userId, tenant_id: ctx.tenantId, status: 'active' });
        if (d.error) return { ok: false, message: describeError(d.error) };
        ctx.trackRecord({ table: 'task_decisions', id: did });
      }
      const rows: (TablesInsert<"meeting_agenda_items"> & { id: string })[] = [{ id: crypto.randomUUID(), meeting_id: id, title: `${SELFTEST_PREFIX} Auftrag ${ctx.runId}`, assigned_to: [ctx.userId], result_text: 'Rückmeldung einholen', order_index: 0, is_completed: true, is_recurring: false, system_type: null as string | null },
        ...SYSTEM_AGENDA_OPTIONS.map((option, i) => ({ id: crypto.randomUUID(), meeting_id: id, title: option.label, assigned_to: null, result_text: option.type === 'decisions' ? JSON.stringify({ [decisionId]: { result: 'Besprochen, Abstimmung bleibt offen' } }) : null, order_index: i+1, is_completed: false, is_recurring: false, system_type: option.type }))];
      for (const row of rows) {
        const r = await supabase.from('meeting_agenda_items').insert(row);
        if (r.error) return { ok: false, message: describeError(r.error) };
        ctx.trackRecord({ table: 'meeting_agenda_items', id: row.id });
      }
      return { ok: true, message: 'Sitzung und Prüfdaten angelegt.' };
    } },
    { id: 'archive', label: 'Gemeinsamen Sitzungsabschluss ausführen und Stafetten-Aufgabe zurücklesen', kind: 'workflow', run: async ctx => {
      try { await persistMeetingArchive(String(ctx.data.jourFixeId)); } catch (error) { return { ok: false, message: describeError(error) }; }
      const [meeting, tasks, decisions] = await Promise.all([
        supabase.from('meetings').select('status').eq('tenant_id', ctx.tenantId).eq('id', String(ctx.data.jourFixeId)).single(),
        supabase.from('tasks').select('id, ball_owner, ball_assignee_id, next_action, next_action_due, timeline').eq('tenant_id', ctx.tenantId).eq('meeting_id', String(ctx.data.jourFixeId)).like('source_type', 'jour_fixe_%'),
        supabase.from('task_decisions').select('id, status, meeting_result').eq('tenant_id', ctx.tenantId).in('id', [String(ctx.data.jourFixeDecisionId), String(ctx.data.jourFixeOtherDecisionId)]),
      ]);
      for (const row of tasks.data ?? []) ctx.trackRecord({ table: 'tasks', id: row.id });
      if (meeting.error || tasks.error || decisions.error) return { ok: false, message: describeError(meeting.error || tasks.error || decisions.error) };
      const task = tasks.data?.[0];
      const target = decisions.data?.find(row => row.id === ctx.data.jourFixeDecisionId);
      const other = decisions.data?.find(row => row.id === ctx.data.jourFixeOtherDecisionId);
      const ok = meeting.data.status === 'archived' && tasks.data?.length === 1 && task?.ball_owner === 'office' && task.ball_assignee_id === ctx.userId
        && !!task.next_action?.includes('Beschluss aus Jour Fixe umsetzen') && !!task.next_action_due && Array.isArray(task.timeline) && task.timeline.length > 0
        && target?.status === 'active' && target.meeting_result === 'Besprochen, Abstimmung bleibt offen' && other?.meeting_result === null;
      return { ok, message: ok ? 'Stafette und ID-sicheres Ergebnis korrekt; keine erfundene Abstimmung.' : 'Abschluss oder Ergebnis weicht ab.' };
    } },
    { id: 'retry', label: 'Erneuter Abschluss erzeugt keine zweite Folgeaufgabe', kind: 'workflow', run: async ctx => {
      try { await persistMeetingArchive(String(ctx.data.jourFixeId)); } catch (error) { return { ok: false, message: describeError(error) }; }
      const { data, error } = await supabase.from('tasks').select('id').eq('tenant_id', ctx.tenantId).eq('meeting_id', String(ctx.data.jourFixeId)).like('source_type', 'jour_fixe_%');
      return { ok: !error && data?.length === 1, message: error ? describeError(error) : `${data?.length} Folgeaufgabe nach Wiederholung.` };
    } },
  ],
};