import type { DropResult } from "@hello-pangea/dnd";
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAgendaOperations } from '../useAgendaOperations';
import type { AgendaItem } from '../../types';
const {upsert, failure} = vi.hoisted(() => ({upsert: vi.fn(), failure: {current: false}}));
vi.mock('@tanstack/react-query', () => ({useQueryClient: () => ({invalidateQueries: vi.fn()})}));
vi.mock('@/hooks/useTenant', () => ({useTenant: () => ({currentTenant: {id: 'tenant'}})}));
vi.mock('@/integrations/supabase/client', () => ({supabase: {from: () => {
 const chain = {
  select: () => chain, eq: () => chain,
  upsert: (payload: unknown, options?: unknown) => { upsert(payload, options); return chain; },
  single: async () => ({data: {id: 'saved'}, error: null}),
  then: (resolve: (value: unknown) => unknown) => Promise.resolve({data: [], error: failure.current ? new Error('Save failed') : null}).then(resolve),
 };
 return chain;
}}}));
const base: AgendaItem = {id: 'main', title: 'Punkt', order_index: 0, is_completed: false, is_recurring: false};
function setup(items: AgendaItem[]) {
 const deps: Parameters<typeof useAgendaOperations>[0] = {
  selectedMeeting: {id: 'meeting',title: 'Jour fixe',meeting_date: '2026-11-08',status: 'planned'},
  activeMeeting: null, agendaItems: items, setAgendaItems: vi.fn(), setActiveMeeting: vi.fn(), user: null,
  toast: vi.fn(), taskDocuments: {}, agendaDocuments: {}, setAgendaDocuments: vi.fn(), profiles: [],
  loadAgendaItems: vi.fn(), updateTimeouts: {current: {}}, uploadAgendaDocument: vi.fn(),
 };
 return { ...renderHook(() => useAgendaOperations(deps)), deps };
}
describe('agenda duration persistence', () => {
 it('starts a new main point at ten minutes', () => {
  const {result, deps} = setup([]);
  act(() => result.current.addAgendaItem());
  expect(deps.setAgendaItems).toHaveBeenCalledWith([expect.objectContaining({duration_minutes: 10})]);
 });
 it('saves main duration, result and carryover but no extra subpoint time', async () => {
  failure.current = false;
  const {result} = setup([{...base, duration_minutes: 20, carry_over_to_next: true, result_text: 'Ergebnis'}, {...base, id: 'child', parent_id: 'main', duration_minutes: 30, order_index: 1}]);
  let saved = false;
  await act(async () => { saved = await result.current.saveAgendaItems(); });
  expect(saved).toBe(true);
  expect(upsert).toHaveBeenCalledWith(expect.objectContaining({id: 'main',duration_minutes: 20,carry_over_to_next: true,result_text: 'Ergebnis'}), expect.anything());
  expect(upsert).toHaveBeenCalledWith(expect.objectContaining({id: 'child',duration_minutes: null}), expect.anything());
 });
 it('returns failure so the editor retains its unsaved status', async () => {
  failure.current = true;
  const {result} = setup([base]);
  await act(async () => { expect(await result.current.saveAgendaItems()).toBe(false); });
  failure.current = false;
 });
 it('persists a main point dropped onto another main point as a child', async () => {
  const {result,deps}=setup([{...base,id:'source',duration_minutes:10},{...base,id:'target',order_index:1}]);
  const drop:DropResult={draggableId:'source',type:'DEFAULT',reason:'DROP',mode:'FLUID',source:{droppableId:'agenda-items',index:0},destination:null,combine:{droppableId:'agenda-items',draggableId:'target'}};
  await act(async()=>{await result.current.onDragEnd(drop);});
  expect(deps.setAgendaItems).toHaveBeenCalledWith([expect.objectContaining({id:'target'}),expect.objectContaining({id:'source',parent_id:'target',duration_minutes:null})]);
  expect(upsert).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({id:'source',parent_id:'target'})]),expect.anything());
 });
 it('keeps children of unsaved parents local until an explicit save can resolve IDs', async()=>{
  const {result,deps}=setup([{...base,id:'source'},{...base,id:undefined,localKey:'local-target',order_index:1}]);
  const drop:DropResult={draggableId:'source',type:'DEFAULT',reason:'DROP',mode:'FLUID',source:{droppableId:'agenda-items',index:0},destination:null,combine:{droppableId:'agenda-items',draggableId:'local-target'}};
  await act(async()=>{await result.current.onDragEnd(drop);});
  expect(deps.setAgendaItems).toHaveBeenCalledWith([expect.objectContaining({localKey:'local-target'}),expect.objectContaining({id:'source',parent_id:null,parentLocalKey:'local-target'})]);
  expect(upsert).not.toHaveBeenCalled();
 });

});
