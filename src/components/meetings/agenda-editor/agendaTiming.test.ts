import { describe, expect, it } from 'vitest';
import { agendaTiming } from './agendaTiming';
import type { AgendaItem } from '../types';
const item = (patch: Partial<AgendaItem> = {}): AgendaItem => ({title: 'Punkt', is_completed: false, is_recurring: false, order_index: 0, ...patch});
describe('agenda timing', () => {
 it('does not fabricate a duration or end time for legacy agendas', () => {
  expect(agendaTiming([item()], '10:00').total).toBe(0);
  expect(agendaTiming([item()], '10:00').end).toBeNull();
 });
 it('counts main points in order and rolls over midnight, ignoring subpoints', () => {
  const a = item({id: 'a', duration_minutes: 15});
  const b = item({id: 'b', order_index: 2, duration_minutes: 20});
  const child = item({parentLocalKey: 'a', duration_minutes: 100, order_index: 1});
  const timing = agendaTiming([b, child, a], '23:50:00');
  expect(timing.total).toBe(35);
  expect(timing.end).toBe('00:25');
  expect(timing.starts.get(a)).toBe('23:50');
  expect(timing.starts.get(b)).toBe('00:05');
 });
 it('retains the total without inventing a meeting start', () => {
  const timing = agendaTiming([item({duration_minutes: 10})], null);
  expect(timing.total).toBe(10);
  expect(timing.end).toBeNull();
 });
});
