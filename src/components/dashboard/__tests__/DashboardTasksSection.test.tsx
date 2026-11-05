import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardTasksSection } from '../DashboardTasksSection';
import { groupDeadlineItems } from '@/utils/deadlineFormatting';
import type { DeadlineItem } from '@/types/dashboardDeadlines';
const items: DeadlineItem[] = [
  { id: '1', title: 'Heute bearbeiten', dueDate: '2026-11-04', type: 'task', canSnooze: true },
  { id: '2', title: 'Am Freitag', dueDate: '2026-11-06', type: 'eventPlanning', canSnooze: false, planningId: 'plan' },
  { id: '3', title: 'Alte Entscheidung', dueDate: '2026-02-01', type: 'decision', canSnooze: true },
  { id: '4', title: 'Nur lesbarer Vorgang', dueDate: '2026-02-01', type: 'case', canSnooze: false },
  { id: '5', title: 'Im Dezember', dueDate: '2026-12-01', type: 'note', canSnooze: true },
];
function setup() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><DashboardTasksSection items={items} grouped={groupDeadlineItems(items)} /></MemoryRouter></QueryClientProvider>);
}
describe('deadline dashboard interactions', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 10, 4, 15)); });
  afterEach(() => vi.useRealTimers());
  it('places current deadlines first and keeps later deadlines collapsed', () => {
    setup();
    expect(screen.queryByText('Alte Entscheidung')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /älter als 30 Tage/ }));
    const today = screen.getByText('Heute bearbeiten');
    const overdue = screen.getByText('Alte Entscheidung');
    expect(today.compareDocumentPosition(overdue) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText('Im Dezember')).not.toBeInTheDocument();
  });
  it('toggles filters and opens later deadlines directly', () => {
    setup();
    const todayFilter = screen.getByRole('button', { name: 'Heute 1' });
    fireEvent.click(todayFilter);
    expect(todayFilter).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Am Freitag')).not.toBeInTheDocument();
    fireEvent.click(todayFilter);
    expect(screen.getByText('Am Freitag')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Später 1', pressed: false }));
    expect(screen.getByText('Im Dezember')).toBeInTheDocument();
    expect(screen.queryByText('Heute bearbeiten')).not.toBeInTheDocument();
  });
  it('reviews real old deadlines and selects only editable records', () => {
    setup();
    expect(screen.getByRole('button', { name: '+ 2 älter als 30 Tage · anzeigen' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Alte Fristen prüfen' }));
    fireEvent.click(screen.getByLabelText('Alle bearbeitbaren Fristen auswählen (1)'));
    expect(screen.getByText('1 ausgewählt')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Erledigt', exact: true })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Neue Frist setzen', exact: true })).toBeDisabled();
    expect(screen.getByLabelText(/Nur lesbarer Vorgang/)).toBeDisabled();
  });
});
