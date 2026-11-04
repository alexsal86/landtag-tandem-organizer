import { beforeEach, describe, expect, it, vi } from 'vitest';
import { changeDeadline } from '../useDeadlineActions';
import { performSnooze } from '../useSnoozeDeadline';
import { supabase } from '@/integrations/supabase/client';
import type { DeadlineItem } from '@/types/dashboardDeadlines';

const base: DeadlineItem = { id: 'id', title: 'Frist', dueDate: '2026-02-01', type: 'task', canSnooze: true };
function mockQuery(data: unknown = { id: 'id' }, error: { message: string } | null = null) {
  const query = {
    update: vi.fn().mockReturnThis(), delete: vi.fn().mockReturnThis(), insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  };
  vi.mocked(supabase.from).mockReturnValue(query as unknown as ReturnType<typeof supabase.from>);
  return query;
}
describe('deadline mutations', () => {
  beforeEach(() => vi.clearAllMocks());
  it('rejects read-only records before writing', async () => {
    const query = mockQuery();
    await expect(changeDeadline({ ...base, canSnooze: false }, 'complete')).rejects.toThrow('Berechtigung');
    await expect(performSnooze({ item: { ...base, canSnooze: false }, newDate: new Date() })).rejects.toThrow('Berechtigung');
    expect(query.update).not.toHaveBeenCalled();
  });
  it('uses the existing atomic archive operation for completed tasks', async () => {
    const query = mockQuery();
    Object.defineProperty(supabase.auth, 'getUser', { configurable: true, value: vi.fn().mockResolvedValue({ data: { user: { id: 'actor' } }, error: null }) });
    const archive = vi.fn().mockResolvedValue({ data: 'archived-id', error: null });
    Object.defineProperty(supabase, 'rpc', { configurable: true, value: archive });
    await changeDeadline(base, 'complete');
    expect(archive).toHaveBeenCalledWith('archive_completed_task', { p_task_id: 'id', p_user_id: 'actor' });
    expect(query.update).not.toHaveBeenCalled();
  });
  it('archives completed decisions using the authenticated actor', async () => {
    const query = mockQuery();
    Object.defineProperty(supabase.auth, 'getUser', { configurable: true, value: vi.fn().mockResolvedValue({ data: { user: { id: 'actor' } }, error: null }) });
    await changeDeadline({ ...base, type: 'decision' }, 'complete');
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'archived', archived_by: 'actor' }));
  });
  it('discards only the deadline and restores it without overwriting a new date', async () => {
    const query = mockQuery();
    const undo = await changeDeadline(base, 'discard');
    expect(query.update).toHaveBeenCalledWith({ due_date: null });
    expect(query.eq).toHaveBeenCalledWith('due_date', base.dueDate);
    await undo!();
    expect(query.update).toHaveBeenLastCalledWith({ due_date: base.dueDate });
    expect(query.is).toHaveBeenCalledWith('due_date', null);
  });
  it('reports rejected and zero-row writes as failures', async () => {
    mockQuery(null, { message: 'RLS rejected' });
    await expect(changeDeadline(base, 'discard')).rejects.toThrow('RLS rejected');
    mockQuery(null);
    await expect(changeDeadline(base, 'discard')).rejects.toThrow('Eintrag wurde geändert');
  });
  it('completes the event checklist item without completing the event', async () => {
    const query = mockQuery();
    await changeDeadline({ ...base, type: 'eventPlanning', planningId: 'event', checklistItemId: 'check' }, 'complete');
    expect(supabase.from).toHaveBeenCalledWith('event_planning_checklist_items');
    expect(query.eq).toHaveBeenCalledWith('id', 'check');
    expect(query.update).toHaveBeenCalledWith({ is_completed: true });
    expect(supabase.from).not.toHaveBeenCalledWith('event_plannings');
  });
  it('moves only the event checklist assignment date', async () => {
    const query = mockQuery();
    await performSnooze({ item: { ...base, type: 'eventPlanning' }, newDate: new Date(2027, 0, 12) });
    expect(supabase.from).toHaveBeenCalledWith('event_planning_timeline_assignments');
    expect(query.update).toHaveBeenCalledWith({ due_date: '2027-01-12' });
    expect(query.eq).toHaveBeenCalledWith('due_date', base.dueDate);
    expect(supabase.from).not.toHaveBeenCalledWith('event_plannings');
  });
  it('restores discarded event deadline assignments, preserving their metadata', async () => {
    const original = { id: 'id', event_planning_id: 'event', checklist_item_id: 'check', due_date: base.dueDate, notes: 'Keep me' };
    const query = mockQuery(original);
    const undo = await changeDeadline({ ...base, type: 'eventPlanning' }, 'discard');
    expect(query.delete).toHaveBeenCalledOnce();
    await undo!();
    expect(query.insert).toHaveBeenCalledWith(original);
  });
});
