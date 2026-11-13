import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { QuestionBank } from './QuestionBank';
import { TwoTruthsWidget } from './TwoTruthsWidget';
import { partitionQuestions } from './history';
import type { TestContext } from '@/features/selftest/types';
import { teamRitualsScenario } from '@/features/selftest/scenarios/team-rituals';
const { snapshot, rpc } = vi.hoisted(() => ({
  snapshot: { enabled: true, admin: true, own: { opted_in: true }, questions: [
    { id: 'active', question: 'Wiederholbare Frage', active: true, last_used_week: '2026-11-09', usage_count: 3 },
    { id: 'paused', question: 'Pausierte Frage', active: false, last_used_week: null, usage_count: 0 },
  ] },
  rpc: vi.fn(),
}));
vi.mock('./data', async importOriginal => ({
  ...await importOriginal<typeof import('./data')>(),
  useTeamRituals: () => ({ data: snapshot, tenantId: 'tenant', userId: 'user' }),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
function show(component: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter>{component}</MemoryRouter></QueryClientProvider>);
}
describe('Ritual history presentation', () => {
  it('keeps used weekly questions active and renders paused questions in their archive', () => {
    show(<QuestionBank />);
    expect(screen.getByText('Insgesamt 3-mal gestellt')).toBeInTheDocument();
    expect(screen.getByText('9.11.2026')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Archivierte Wochenfragen' })).toHaveTextContent('Insgesamt 0-mal gestellt');
    expect(partitionQuestions(snapshot.questions).active.map(q => q.id)).toEqual(['active']);
  });
  it('shows answered current quiz in gray with a date and old prompts under the archive divider', async () => {
    rpc.mockImplementation(async (name: string) => ({ error: null, data: name === 'team_two_truths_archive'
      ? [{ id: 'old', month: '2026-10-01', subject_name: 'Alex', facts: ['Alt A', 'Alt B', 'Alt C'] }]
      : { id: 'now', month: '2026-11-01', subject_name: 'Sam', facts: ['A', 'B', 'C'], answered: true, lie_index: 2, correct: true } }));
    show(<TwoTruthsWidget />);
    expect(await screen.findByText('Archiv · bereits beantwortet')).toHaveClass('text-sm');
    expect(screen.getByText('Gestellt im November 2026')).toBeInTheDocument();
    expect(screen.getByText('Drei Aussagen von Sam').parentElement).toHaveClass('text-muted-foreground', 'border-t');
    expect(screen.getByRole('button', { name: '1. A' })).toBeDisabled();
    expect(await screen.findByText('Alex · gestellt im Oktober 2026')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Quiz-Archiv' })).toHaveClass('text-muted-foreground', 'border-t');
  });
  it('runs the team ritual logic selftest steps', async () => {
    for (const step of teamRitualsScenario.steps) {
      if (step.kind === 'logic') expect((await step.run({ runId: 'test', tenantId: 'tenant', userId: 'user', created: [], storageObjects: [], trackRecord: () => {}, trackStorage: () => {}, data: {} } satisfies TestContext)).ok, step.id).toBe(true);
    }
  });
});
