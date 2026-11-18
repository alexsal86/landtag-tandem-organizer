import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ useQuery: vi.fn(), from: vi.fn() }));
vi.mock('@tanstack/react-query', () => ({ useQuery: mock.useQuery }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'admin' } }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mock.from } }));
import { useCandidacyStateListPlaces } from './useCandidacyStateListPlaces';
function query(data: unknown[], error: Error | null = null) {
  const value = { select: vi.fn(), in: vi.fn(), eq: vi.fn(), limit: vi.fn(), abortSignal: vi.fn().mockResolvedValue({ data, error }) };
  for (const key of ['select', 'in', 'eq', 'limit'] as const) value[key].mockReturnValue(value);
  return value;
}
beforeEach(() => vi.resetAllMocks());
describe('Begrenzte Listenplatzabfragen der Kandidaturtabelle', () => {
  it('fragt nur sichtbare Identitäten und Listen der ausgewählten Periode ab', async () => {
    const mapping = query([{ person_id: 'p1', connection_id: 'c1' }]);
    const roster = query([{ id: 'entry', list_id: 'list', position: 3, connection_id: 'c1', list: { period_id: 'lp18', party: 'GRÜNE', source_url: 'https://example.org' } }]);
    mock.from.mockImplementation((table: string) => table === 'election_history_connection_people' ? mapping : roster);
    useCandidacyStateListPlaces('lp18', ['p1', 'p1'], true);
    const config = mock.useQuery.mock.calls[0][0];
    const signal = new AbortController().signal;
    expect(await config.queryFn({ signal })).toEqual([{ id: 'entry', list_id: 'list', person_id: 'p1', period_id: 'lp18', party: 'GRÜNE', position: 3, source_url: 'https://example.org' }]);
    expect(mapping.in).toHaveBeenCalledWith('person_id', ['p1']);
    expect(mapping.limit).toHaveBeenCalledWith(100);
    expect(roster.in).toHaveBeenCalledWith('connection_id', ['c1']);
    expect(roster.eq).toHaveBeenCalledWith('list.period_id', 'lp18');
    expect(roster.limit).toHaveBeenCalledWith(1000);
    expect(roster.abortSignal).toHaveBeenCalledWith(signal);
    expect(config.queryKey).toContain('admin');
  });
  it('lädt ohne sichtbare Personen oder außerhalb der aktiven Ansicht keine Listenplätze', () => {
    useCandidacyStateListPlaces('p17', ['person'], false);
    expect(mock.useQuery.mock.calls[0][0].enabled).toBe(false);
    useCandidacyStateListPlaces('p18', [], true);
    expect(mock.useQuery.mock.calls[1][0].enabled).toBe(false);
  });
  it('teilt ausdrücklich zusätzlich angezeigte Personen in Pakete mit höchstens 100 IDs', async () => {
    const mapping = query([]);
    mock.from.mockReturnValue(mapping);
    const ids = Array.from({ length: 201 }, (_, index) => `person-${index}`);
    useCandidacyStateListPlaces('p18', ids, true);
    await mock.useQuery.mock.calls[0][0].queryFn({ signal: new AbortController().signal });
    expect(mapping.in.mock.calls.map(call => call[1].length)).toEqual([100, 100, 1]);
    expect(mock.from.mock.calls.every(call => call[0] === 'election_history_connection_people')).toBe(true);
  });
  it('zeigt fehlgeschlagene Zuordnungsabfragen als Fehler statt als fehlende Listenplätze', async () => {
    mock.from.mockReturnValue(query([], new Error('Zuordnung nicht geladen')));
    useCandidacyStateListPlaces('p18', ['person'], true);
    await expect(mock.useQuery.mock.calls[0][0].queryFn({ signal: new AbortController().signal })).rejects.toThrow('Zuordnung nicht geladen');
    expect(mock.from).toHaveBeenCalledTimes(1);
  });
});
