import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { StateHistoryPanel } from './StateHistoryPanels';

vi.mock('./useStateHistory', () => ({
  useStateHistory: () => ({ data: { totals: [], state: [] }, isLoading: false, error: null, refetch: vi.fn() }),
}));
vi.mock('./TurnoutPanel', () => ({
  TurnoutPanel: ({ year, ballot }: { year: number; ballot: string }) => <p>Wahlkreise {year} {ballot}</p>,
}));
function Location() {
  const location = useLocation();
  const navigate = useNavigate();
  return <><output aria-label="Auswahl-URL">{location.search}</output><button onClick={() => navigate(-1)}>Zurück</button></>;
}
function open(query = '') {
  render(<MemoryRouter initialEntries={[`/daten?${query}`]}><StateHistoryPanel year={2026} years={[2026, 2021, 1952]} /><Location /></MemoryRouter>);
}

describe('Beteiligungsdetails in vergangenen Wahlen', () => {
  it('lädt Wahlkreise erst nach Auswahl und macht die Auswahl bookmarkbar', async () => {
    open();
    expect(screen.queryByText(/Wahlkreise 2026/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Landes- und Wahlkreisdaten anzeigen' }));
    expect(screen.getByText('Wahlkreise 2026 second')).toBeInTheDocument();
    expect(screen.getByLabelText('Auswahl-URL')).toHaveTextContent('historyDetails=turnout');
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    await waitFor(() => expect(screen.queryByText(/Wahlkreise 2026/)).not.toBeInTheDocument());
  });
  it('öffnet gespeicherte Erststimmen-Details und lässt sie vollständig schließen', () => {
    open('historyDetails=turnout&analysisBallot=first');
    expect(screen.getByText('Wahlkreise 2026 first')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Stimmenart der Beteiligungsdetails'), { target: { value: 'second' } });
    expect(screen.getByText('Wahlkreise 2026 second')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Details ausblenden' }));
    expect(screen.queryByText(/Wahlkreise 2026/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Auswahl-URL')).not.toHaveTextContent('historyDetails');
  });
});
