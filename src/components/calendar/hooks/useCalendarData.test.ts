import { describe, expect, it, vi } from 'vitest';
import { fetchCalendarData } from './useCalendarData';

const mock = vi.hoisted(() => ({
  queries: [] as Array<{ table: string; select?: string; filters: Array<[string, string, unknown]> }>,
  profiles: [{ user_id: 'team-user', display_name: 'Teammitglied' }],
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: 'team-user' } } }) },
    from: (table: string) => {
      const query: typeof mock.queries[number] = { table, filters: [] };
      mock.queries.push(query);
      const result = () => ({ data: table === 'profiles' ? mock.profiles : table === 'leave_requests' ? [
        { id: 'leave-1', user_id: 'team-user', start_date: '2026-11-10', end_date: '2026-11-12', status: 'approved' },
      ] : [], error: null });
      const builder = {
        select: (columns: string) => { query.select = columns; return builder; },
        eq: (column: string, value: unknown) => { query.filters.push(['eq', column, value]); return builder; },
        in: (column: string, value: unknown) => { query.filters.push(['in', column, value]); return builder; },
        lte: () => builder, gte: () => builder, or: () => builder,
        is: () => builder, not: () => builder, order: () => builder,
        then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
      };
      return builder;
    },
  },
}));

describe('calendar leave loading', () => {
  it('loads leave without a profiles FK and joins names using tenant profile user IDs', async () => {
    mock.queries.length = 0;
    mock.profiles = [{ user_id: 'team-user', display_name: 'Teammitglied' }];
    const events = await fetchCalendarData(new Date('2026-11-10T12:00:00Z'), 'month', 'tenant-1');
    expect(events.find(event => event.id === 'leave-leave-1')?.title).toBe('🏖️ Teammitglied - Urlaub');
    expect(mock.queries.find(query => query.table === 'profiles')?.filters).toContainEqual(['eq', 'tenant_id', 'tenant-1']);
    const leaveQuery = mock.queries.find(query => query.table === 'leave_requests');
    expect(leaveQuery?.select).toBe('id, user_id, start_date, end_date, status');
    expect(leaveQuery?.filters).toContainEqual(['in', 'user_id', ['team-user']]);
    for (const query of mock.queries.filter(query => query.table === 'appointments')) {
      expect(query.filters).toContainEqual(['eq', 'tenant_id', 'tenant-1']);
    }
  });

  it('does not issue an unscoped leave query when no tenant profiles are visible', async () => {
    mock.queries.length = 0;
    mock.profiles = [];
    const events = await fetchCalendarData(new Date('2026-11-10T12:00:00Z'), 'month', 'tenant-1');
    expect(mock.queries.some(query => query.table === 'leave_requests')).toBe(false);
    expect(events).toEqual([]);
  });
});