import type React from 'react';
import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockSupabaseClient } from '@/test/mockSupabaseClient';

const toastSpy = vi.fn();
const archiveLetterMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabaseClient.supabase,
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
  useToast: () => ({ toast: toastSpy }),
}));

vi.mock('@/lib/notify', () => ({
  notify: {
    success: (title: string, options?: { description?: string }) => toastSpy({ title, ...options }),
    error: (title: string, options?: { description?: string }) => toastSpy({ title, ...options, variant: 'destructive' }),
  },
}));

vi.mock('@/utils/debugConsole', () => ({
  debugConsole: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/utils/letterArchiving', () => ({
  archiveLetter: (...args: unknown[]) => archiveLetterMock(...args),
}));

import { useLetterOperations } from '@/components/letters/hooks/useLetterOperations';
import type { Letter } from '@/components/letters/types';

const baseLetter: Letter = {
  id: 'letter-1',
  tenant_id: 'tenant-1',
  created_by: 'user-1',
  title: 'Testbrief',
  content: 'Hallo Welt',
  status: 'pending_approval',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  recipient_name: null,
  recipient_address: null,
  contact_id: null,
  template_id: null,
  subject: 'Betreff',
  reference_number: null,
  sender_info_id: null,
  information_block_ids: [],
  letter_date: null,
  expected_response_date: '2024-02-01',
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

type HookProps = {
  editedLetter: Partial<Letter>;
  setEditedLetter: React.Dispatch<React.SetStateAction<Partial<Letter>>>;
};

function renderWorkflow(status: Letter['status'], overrides: Partial<Letter> = {}) {
  const letter: Letter = { ...baseLetter, status, ...overrides };
  let state: Partial<Letter> = { ...letter };
  const setEditedLetter: React.Dispatch<React.SetStateAction<Partial<Letter>>> = update => {
    state = typeof update === 'function' ? update(state) : update;
  };
  const hook = renderHook(() => useLetterOperations({
    letter, editedLetter: state, setEditedLetter, canEdit: true,
    userId: 'user-1', tenantId: 'tenant-1', showPagination: false,
    latestContentRef: { current: { content: 'Hallo Welt', contentNodes: null } },
    isUpdatingFromRemoteRef: { current: false }, pendingMentionsRef: { current: new Set<string>() },
    onSave: vi.fn(), setSaving: vi.fn(), setLastSaved: vi.fn(), setIsProofreadingMode: vi.fn(),
    setShowAssignmentDialog: vi.fn(), fetchComments: vi.fn(), fetchCollaborators: vi.fn(), senderInfos: [], informationBlocks: [],
  }));
  return { hook, state: () => state };
}

function renderSaving(letter: Letter | undefined, content = 'Hallo Welt') {
  let state: Partial<Letter> = letter ? { ...letter } : { title: 'Neuer Brief', content, status: 'draft' };
  const setEditedLetter: React.Dispatch<React.SetStateAction<Partial<Letter>>> = update => {
    state = typeof update === 'function' ? update(state) : update;
  };
  const onSave = vi.fn();
  const { result } = renderHook(() => useLetterOperations({
    letter, editedLetter: state, setEditedLetter, canEdit: true,
    userId: 'user-1', tenantId: 'tenant-1', showPagination: false,
    latestContentRef: { current: { content, contentNodes: null } },
    isUpdatingFromRemoteRef: { current: false }, pendingMentionsRef: { current: new Set<string>() },
    onSave, setSaving: vi.fn(), setLastSaved: vi.fn(), setIsProofreadingMode: vi.fn(),
    setShowAssignmentDialog: vi.fn(), fetchComments: vi.fn(), fetchCollaborators: vi.fn(), senderInfos: [], informationBlocks: [],
  }));
  return { result, state: () => state, onSave };
}

describe('useLetterOperations integration', () => {
  beforeEach(() => {
    mockSupabaseClient.reset();
    toastSpy.mockClear();
    archiveLetterMock.mockReset();
    mockSupabaseClient.setTableResult('letters', { data: [], error: null });
  });

  it('gibt einen Brief über das RPC zurück und übernimmt den neuen Status', async () => {
    mockSupabaseClient.setRpcResult('return_letter_for_revision', { data: 'draft', error: null });
    const flow = renderWorkflow('review', { created_by: 'author-1' });
    let returned: boolean | undefined;
    await act(async () => { returned = await flow.hook.result.current.handleReturnLetter('Absatz 2 bitte kürzen.'); });

    expect(returned).toBe(true);
    expect(mockSupabaseClient.rpcCalls).toEqual([
      expect.objectContaining({
        fn: 'return_letter_for_revision',
        params: { _letter_id: 'letter-1', _reason: 'Absatz 2 bitte kürzen.' },
      }),
    ]);
    expect(flow.state().status).toBe('draft');
    expect(flow.state().revision_comment).toBe('Absatz 2 bitte kürzen.');
    expect(flow.state().revision_requested_by).toBe('user-1');
    expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ title: 'Brief zurückgegeben' }));
  });

  it('meldet eine fehlgeschlagene Rückgabe als nicht erfolgreich, damit der Dialog nicht schließt', async () => {
    mockSupabaseClient.setRpcResult('return_letter_for_revision', { data: null, error: new Error('Nur zugewiesene Prüfer dürfen den Brief zurückgeben') });
    const flow = renderWorkflow('review', { created_by: 'author-1' });
    let returned: boolean | undefined;
    await act(async () => { returned = await flow.hook.result.current.handleReturnLetter('Absatz 2 bitte kürzen.'); });

    expect(returned).toBe(false);
    expect(flow.state().status).toBe('review');
    expect(flow.state().revision_comment).toBeUndefined();
    expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ title: 'Fehler beim Zurückgeben', variant: 'destructive' }));
  });

  it('verweigert die Rückgabe ohne Begründung ohne Schreibzugriff', async () => {
    const flow = renderWorkflow('review', { created_by: 'author-1' });
    await act(async () => { await flow.hook.result.current.handleReturnLetter('   '); });

    expect(flow.state().status).toBe('review');
    expect(mockSupabaseClient.rpcCalls).toHaveLength(0);
    expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ title: 'Begründung fehlt', variant: 'destructive' }));
  });

  it('behält bei fehlgeschlagenem Speichern den bisherigen Status und zeigt keinen Erfolg', async () => {
    mockSupabaseClient.setTableResult('letters', { data: null, error: new Error('Datenbank nicht erreichbar') });
    const flow = renderWorkflow('pending_approval');
    await act(async () => { await flow.hook.result.current.handleStatusTransition('approved'); });
    expect(flow.state().status).toBe('pending_approval');
    expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ title: 'Fehler beim Workflow-Update', variant: 'destructive' }));
    expect(toastSpy).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Status geändert' }));
  });

  it('zeigt einen Brief bei fehlgeschlagener Archivierung nicht als versendet an', async () => {
    archiveLetterMock.mockResolvedValue({ success: false, error: 'PDF fehlgeschlagen' });
    const flow = renderWorkflow('approved');
    await act(async () => { await flow.hook.result.current.handleStatusTransition('sent'); });
    expect(flow.state().status).toBe('approved');
    expect(flow.state().workflow_locked).toBe(false);
    expect(toastSpy).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Brief versendet und archiviert' }));
  });

  it('meldet ein erfolgreiches Speichern als true, ohne den Editor zu schließen', async () => {
    const flow = renderSaving(baseLetter);
    let saved: boolean | undefined;
    await act(async () => { saved = await flow.result.current.handleManualSave(); });

    expect(saved).toBe(true);
    expect(flow.onSave).toHaveBeenCalledTimes(1);
  });

  it('übernimmt die ID eines neu angelegten Briefs, damit er nicht doppelt entsteht', async () => {
    mockSupabaseClient.setTableResult('letters', {
      data: { id: 'letter-new', status: 'draft', created_at: '2024-01-01T00:00:00.000Z', updated_at: '2024-01-01T00:00:00.000Z' },
      error: null,
    });
    const flow = renderSaving(undefined);
    let saved: boolean | undefined;
    await act(async () => { saved = await flow.result.current.handleManualSave(); });

    expect(saved).toBe(true);
    expect(flow.state().id).toBe('letter-new');
  });

  it('meldet ein fehlgeschlagenes Speichern als false, damit der Editor offen bleibt', async () => {
    mockSupabaseClient.setTableResult('letters', { data: null, error: new Error('Datenbank nicht erreichbar') });
    const flow = renderSaving(baseLetter);
    let saved: boolean | undefined;
    await act(async () => { saved = await flow.result.current.handleManualSave(); });

    expect(saved).toBe(false);
    expect(flow.onSave).not.toHaveBeenCalled();
    expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ title: 'Fehler beim Speichern' }));
  });

  it('covers the approved -> sent -> archived flow and stores archive metadata', async () => {
    archiveLetterMock.mockResolvedValue({
      success: true,
      documentId: 'doc-99',
      archivedAt: '2024-01-03T10:15:00.000Z',
      archivedBy: 'user-1',
      followUpTaskId: 'task-77',
    });

    let editedLetterState: Partial<Letter> = { ...baseLetter };
    const setEditedLetter: React.Dispatch<React.SetStateAction<Partial<Letter>>> = vi.fn((updater) => {
      editedLetterState = typeof updater === 'function'
        ? updater(editedLetterState)
        : updater;
    });

    const { result, rerender } = renderHook(
      ({ editedLetter, setEditedLetter }: HookProps) =>
        useLetterOperations({
          letter: baseLetter,
          editedLetter,
          setEditedLetter,
          canEdit: true,
          userId: 'user-1',
          tenantId: 'tenant-1',
          showPagination: false,
          latestContentRef: { current: { content: 'Hallo Welt', contentNodes: null } },
          isUpdatingFromRemoteRef: { current: false },
          pendingMentionsRef: { current: new Set<string>() },
          onSave: vi.fn(),
          setSaving: vi.fn(),
          setLastSaved: vi.fn(),
          setIsProofreadingMode: vi.fn(),
          setShowAssignmentDialog: vi.fn(),
          fetchComments: vi.fn(),
          fetchCollaborators: vi.fn(),
          senderInfos: [],
          informationBlocks: [],
        }),
      {
        initialProps: { editedLetter: editedLetterState, setEditedLetter },
      },
    );

    await act(async () => {
      await result.current.handleStatusTransition('approved');
    });
    rerender({ editedLetter: editedLetterState, setEditedLetter });

    expect(editedLetterState.status).toBe('approved');
    expect(editedLetterState.approved_by).toBe('user-1');

    await act(async () => {
      await result.current.handleStatusTransition('sent');
    });
    rerender({ editedLetter: editedLetterState, setEditedLetter });

    expect(archiveLetterMock).toHaveBeenCalledWith('letter-1', 'user-1');
    expect(editedLetterState.status).toBe('sent');
    expect(editedLetterState.archived_document_id).toBe('doc-99');
    expect(editedLetterState.archived_at).toBe('2024-01-03T10:15:00.000Z');
    expect(editedLetterState.archived_by).toBe('user-1');
    expect(editedLetterState.sent_by).toBe('user-1');
    expect(editedLetterState.workflow_locked).toBe(true);
    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Brief versendet und archiviert' }),
    );
  });
});
