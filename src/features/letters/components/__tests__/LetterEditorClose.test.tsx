import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockSupabaseClient } from '@/test/mockSupabaseClient';
import LetterEditor from '../LetterEditor';
import type { Letter } from '@/components/letters/types';

const toastSpy = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, loading: false }),
}));

vi.mock('@/hooks/useTenant', () => ({
  useTenant: () => ({ currentTenant: { id: 'tenant-1' }, loading: false }),
}));

vi.mock('@/lib/notify', () => ({
  notify: {
    success: (title: string, options?: { description?: string }) => toastSpy({ title, ...options }),
    error: (title: string, options?: { description?: string }) => toastSpy({ title, ...options, variant: 'destructive' }),
  },
}));

// Der Test prüft den Dirty-Guard, nicht den Lexical-Editor: ein Textfeld löst
// denselben onChange-Pfad aus und macht den Brief zuverlässig "schmutzig".
vi.mock('@/components/lexical/EnhancedLexicalEditor', () => ({
  default: ({ onChange }: { onChange: (payload: { plainText: string; nodesJson: string; html: string }) => void }) => (
    <textarea
      aria-label="Brieftext"
      onChange={(event) => onChange({
        plainText: event.target.value,
        nodesJson: '{"root":{"children":[]}}',
        html: `<p>${event.target.value}</p>`,
      })}
    />
  ),
}));

vi.mock('@/components/letters/LetterEditorCanvas', () => ({
  LetterEditorCanvas: ({ inlineEditor }: { inlineEditor?: React.ReactNode }) => <div>{inlineEditor}</div>,
}));

vi.mock('@/components/letters/DIN5008LetterLayout', () => ({
  DIN5008LetterLayout: () => null,
}));

vi.mock('@/components/admin/ReviewAssignmentDialog', () => ({ default: () => null }));
vi.mock('@/components/admin/UserAssignmentDialog', () => ({ default: () => null }));
vi.mock('@/components/letters/LetterCommentDialog', () => ({ default: () => null }));

const baseLetter: Letter = {
  id: 'letter-1',
  tenant_id: 'tenant-1',
  created_by: 'user-1',
  title: 'Alter Betreff',
  content: 'Alter Text',
  status: 'draft',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  recipient_name: null,
  recipient_address: null,
  contact_id: null,
  template_id: null,
  subject: 'Alter Betreff',
  reference_number: null,
  sender_info_id: null,
  information_block_ids: [],
  letter_date: null,
  expected_response_date: null,
  show_pagination: false,
  salutation_override: null,
  closing_formula: null,
  closing_name: null,
  content_html: null,
  content_nodes: null,
  user_id: null,
  workflow_locked: false,
  submitted_for_review_at: null,
  submitted_for_review_by: null,
  approved_at: null,
  approved_by: null,
  sent_at: null,
  sent_by: null,
  sent_date: null,
  archived_document_id: null,
  archived_at: null,
  archived_by: null,
};

const renderEditor = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = vi.fn();
  const onSave = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <LetterEditor letter={baseLetter} isOpen onClose={onClose} onSave={onSave} />
    </QueryClientProvider>,
  );
  return { onClose, onSave };
};

const letterWrites = () =>
  (mockSupabaseClient.supabase.from as unknown as { mock: { calls: string[][] } }).mock.calls
    .filter(([table]) => table === 'letters').length;

const makeDirty = async () => {
  fireEvent.change(screen.getByLabelText('Brieftext'), { target: { value: 'Geänderter Text' } });
  // Der Live-Sync übernimmt den Entwurf mit 300 ms Verzögerung in den Editor-Stand.
  await screen.findByText(/Wird gespeichert/, {}, { timeout: 2000 });
};

const openCloseDialog = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
  return screen.findByRole('alertdialog');
};

describe('LetterEditor: Schließen mit ungespeicherten Änderungen', () => {
  beforeEach(() => {
    toastSpy.mockClear();
    mockSupabaseClient.setTableResult('letters', { data: [], error: null });
  });

  it('fragt vor dem Schließen ungespeicherter Änderungen nach', async () => {
    const { onClose } = renderEditor();
    await makeDirty();

    const dialog = await openCloseDialog();

    expect(within(dialog).getByText('Änderungen sind noch nicht gespeichert')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('behält den Editor bei "Weiter bearbeiten" offen', async () => {
    const { onClose } = renderEditor();
    await makeDirty();

    const dialog = await openCloseDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Weiter bearbeiten' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Brieftext')).toBeTruthy();
  });

  it('verwirft ohne Schreibzugriff', async () => {
    const { onClose, onSave } = renderEditor();
    await makeDirty();
    const writesBefore = letterWrites();

    const dialog = await openCloseDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Verwerfen' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(letterWrites()).toBe(writesBefore);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('speichert bei "Speichern und schließen" und schließt erst danach', async () => {
    const { onClose, onSave } = renderEditor();
    await makeDirty();

    const dialog = await openCloseDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern und schließen' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(letterWrites()).toBeGreaterThan(0);
    expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ title: 'Brief gespeichert' }));
  });

  it('bleibt bei fehlgeschlagenem Speichern offen und meldet den Fehler', async () => {
    const { onClose, onSave } = renderEditor();
    await makeDirty();
    mockSupabaseClient.setTableResult('letters', { data: null, error: new Error('Datenbank nicht erreichbar') });

    const dialog = await openCloseDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern und schließen' }));

    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Fehler beim Speichern', variant: 'destructive' }),
    ));
    expect(onClose).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(screen.getByLabelText('Brieftext')).toBeTruthy();
  });
});
