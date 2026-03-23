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
  useToast: () => ({ toast: toastSpy }),
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
  status: 'review',
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

describe('useLetterOperations integration', () => {
  beforeEach(() => {
    mockSupabaseClient.reset();
    toastSpy.mockClear();
    archiveLetterMock.mockReset();
    mockSupabaseClient.setTableResult('letters', { data: [], error: null });
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
