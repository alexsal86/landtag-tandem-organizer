import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ElectionHistoryAdmin from './ElectionHistoryAdmin';

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'admin' }, loading: false }) }));
vi.mock('@/components/administration/useAdministrationAccess', () => ({ useAdministrationAccess: () => ({ checkingAdmin: false, isSuperAdmin: true }) }));
vi.mock('./useElectionHistory', () => ({
  useElectionPeriods: () => ({ isLoading: false, error: null, data: [
    { id: 'p18', number: 18, name: '18. Legislaturperiode', is_current: true, is_published: true },
    { id: 'p17', number: 17, name: '17. Legislaturperiode', is_current: false, is_published: true },
  ] }),
  useElectionPeriodOverview: () => ({ data: [] }),
  useElectionHistory: () => ({ data: { periods: [], districts: [], people: [], candidacies: [], mandates: [] }, isLoading: false, error: null }),
  historyError: () => 'Fehler',
}));
vi.mock('./admin/HistoryDataGrid', () => ({ HistoryDataGrid: ({ entity, selectedPeriodId, onOpenStateList }: { entity: string; selectedPeriodId: string; onOpenStateList?: (list: string, entry: string) => void }) => <div>Grid {entity} {selectedPeriodId}{onOpenStateList && <button onClick={() => onOpenStateList('list', 'entry')}>Landesliste öffnen</button>}</div> }));
vi.mock('./admin/StateLists', () => ({ StateLists: ({ periodId, periodNumber, initialListId, initialEntryId }: { periodId: string; periodNumber: number; initialListId: string; initialEntryId: string }) => <p>{periodNumber < 18 ? 'Noch keine Landeslisten' : `Landesliste ${periodId} ${initialListId} ${initialEntryId}`}</p> }));
vi.mock('./admin/HistoryIssueOverview', () => ({ HistoryIssueOverview: () => <p>Problemübersicht</p> }));
vi.mock('./CandidacyAssemblyStatus', () => ({ CandidacyAssemblyStatus: () => null }));
vi.mock('@/features/election-analysis/research/CandidateCoverageReview', () => ({ CandidateCoverageReview: () => null }));
vi.mock('@/features/election-analysis/research/HistoryLinkReview', () => ({ HistoryLinkReview: () => null }));
vi.mock('./ElectionDeputyDirectory', () => ({ ElectionDeputyDirectory: () => <p>Abgeordnetenregister</p> }));
vi.mock('./PersonCareer', () => ({ PersonCareerDirectory: () => null }));
vi.mock('./admin/CandidacyImportDialog', () => ({ CandidacyImportDialog: () => null }));
vi.mock('./admin/ElectionDataChecks', () => ({ ElectionDataChecks: () => null }));
vi.mock('./admin/FactionsAdmin', () => ({ FactionsAdmin: () => null }));

const openCandidates = () => fireEvent.mouseDown(screen.getByRole('tab', { name: /Kandidaturen, Ergebnisse & Landeslisten/ }), { button: 0 });

describe('Gemeinsamer Kandidatur- und Landeslistenbereich', () => {
  it('erhält die gewählte Periode beim Wechsel der Unteransicht und platziert das Register zuletzt', () => {
    render(<ElectionHistoryAdmin />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs[tabs.length - 1]).toHaveTextContent('Gesamtregister');
    expect(tabs[tabs.length - 2]).toHaveTextContent('Problemfälle');
    openCandidates();
    expect(screen.getByText('Grid candidacies p18')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Excel / CSV importieren' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Landeslisten', exact: true }));
    fireEvent.change(screen.getByLabelText('Legislaturperiode'), { target: { value: 'p17' } });
    expect(screen.getByText('Noch keine Landeslisten')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Kandidaturen & Ergebnisse' }));
    expect(screen.getByText('Grid candidacies p17')).toBeInTheDocument();
    expect(screen.getByLabelText('Legislaturperiode')).toHaveValue('p17');
  });
  it('öffnet den passenden Landeslisteneintrag direkt aus der Ergebnistabelle', () => {
    render(<ElectionHistoryAdmin />);
    openCandidates();
    fireEvent.click(screen.getByRole('button', { name: 'Landesliste öffnen' }));
    expect(screen.getByText('Landesliste p18 list entry')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Kandidaturen, Ergebnisse & Landeslisten/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Landeslisten', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });
});
