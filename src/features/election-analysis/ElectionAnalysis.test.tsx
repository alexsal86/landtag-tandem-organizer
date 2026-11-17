import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ElectionAnalysis from './ElectionAnalysis';

const queries = vi.hoisted(() => ({ years: vi.fn() }));
const result = { data: [], isLoading: false, error: null, refetch: vi.fn() };
vi.mock('./useElectionAnalysis', () => ({
  useAnalysisYears: (enabled: boolean) => {
    queries.years(enabled);
    return { ...result, data: [2026, 2021, 2006, 1988, 1952].map((year, index) => ({ year, period_number: 18 - index })) };
  },
  useAnalysisRows: () => result,
  useStateComparisonSeries: () => result,
}));
vi.mock('./StateShareChart', () => ({ StateShareChart: () => null }));
vi.mock('./StateSeatDistribution', () => ({ StateSeatDistribution: () => null }));
vi.mock('./StateHistoryPanels', () => ({
  StateHistoryPanel: ({ year, initiallyShowTurnout }: { year: number; initiallyShowTurnout: boolean }) => <p>Historie {year} {initiallyShowTurnout ? 'mit Wahlkreisen' : ''}</p>,
  FlowMatrixPanel: () => <p>Wanderungsmatrix</p>,
  WorkbookAuditPanel: ({ year }: { year: number }) => <p>Quellenprotokoll {year}</p>,
  WorkbookSourceNotice: () => null,
}));
vi.mock('./DeputyDirectory', () => ({ default: () => <p>Personenarchiv</p> }));
vi.mock('./research/ResearchWorkbench', () => ({ default: ({ section, year }: { section: string; year: number }) => <p>Modul {section} {year}</p> }));

function Location() {
  const location = useLocation();
  const navigate = useNavigate();
  return <><output aria-label="Auswahl-URL">{location.search}</output><button onClick={() => navigate(-1)}>Zurück</button><button onClick={() => navigate(1)}>Vorwärts</button></>;
}
function open(query: string) {
  render(<MemoryRouter initialEntries={[`/daten?${query}`]}><ElectionAnalysis /><Location /></MemoryRouter>);
}

describe('Navigation der Wahlanalyse', () => {
  it('zeigt vier Säulen und nur deren Unterauswahl, unterstützt Browsernavigation', async () => {
    open('dataTab=land&sub=state');
    expect(within(screen.getByRole('navigation', { name: 'Datenbereiche' })).getAllByRole('button')).toHaveLength(4);
    expect(screen.queryByRole('button', { name: 'Wahlkreisvergleich' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Wahlkreise & Regionen' }));
    await screen.findByText('Modul profile 2026');
    expect(screen.getByLabelText('Auswahl-URL')).toHaveTextContent('dataTab=wahlkreise&sub=profile');
    expect(screen.getByRole('button', { name: 'Wahlkreisvergleich' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Aktuelle Wahl' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Vorwärts' }));
    await screen.findByText('Modul profile 2026');
  });

  it('öffnet den gesetzlichen Rechner direkt und behält die Forschung separat', async () => {
    open('dataTool=rechner&analysisYear=2021');
    await screen.findByText('Modul seats 2026');
    expect(screen.queryByRole('button', { name: 'Sitzrechner & weitere Werkzeuge' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Szenariolabor & Typologien' }));
    await screen.findByText('Modul research 2021');
    expect(screen.getByLabelText('Auswahl-URL')).not.toHaveTextContent('researchTool=seats');
  });

  it('lässt Datenprüfung in der Fußzeile unabhängig von der Hauptauswahl öffnen und schließen', async () => {
    open('dataTab=wahlkreise&sub=profile&analysisYear=2021');
    await screen.findByText('Modul profile 2021');
    fireEvent.click(screen.getByRole('button', { name: 'Quellenabgleich' }));
    await screen.findByText('Quellenprotokoll 2021');
    fireEvent.change(screen.getByLabelText('Wahl für Datenprüfung'), { target: { value: '1952' } });
    await screen.findByText('Quellenprotokoll 1952');
    expect(screen.getByText('Modul profile 2021')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quellenabgleich' }));
    await waitFor(() => expect(screen.queryByText('Quellenprotokoll 1952')).not.toBeInTheDocument());
  });

  it('öffnet das Personenarchiv ohne die Wahljahre abzufragen', async () => {
    open('dataTab=parlament&sub=deputies');
    await screen.findByText('Personenarchiv');
    expect(queries.years).toHaveBeenLastCalledWith(false);
    expect(screen.queryByLabelText('Wahl / Legislaturperiode')).not.toBeInTheDocument();
  });

  it('erhält auch historische Wahlkreisansichten aus älteren Importen', async () => {
    open('dataTab=wahlkreise&sub=profile&analysisYear=1988');
    await screen.findByText('Modul profile 1988');
    expect(screen.getByLabelText('Wahl / Legislaturperiode')).toHaveValue('1988');
  });

  it('erhält alte Beteiligungslinks samt ausgewählter Wahl', async () => {
    open('analysisSection=turnout&analysisYear=2021&analysisBallot=single');
    await screen.findByText('Historie 2021 mit Wahlkreisen');
    expect(screen.getByLabelText('Auswahl-URL')).toHaveTextContent('sub=history');
    expect(screen.getByLabelText('Auswahl-URL')).toHaveTextContent('historyDetails=turnout');
  });
});
