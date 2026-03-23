import { renderHook, act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const toastSpy = vi.fn();
const useAuthMock = vi.fn();
const archiveLetterMock = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastSpy }),
}));

vi.mock('@/utils/letterArchiving', () => ({
  archiveLetter: (...args: unknown[]) => archiveLetterMock(...args),
}));

vi.mock('@/utils/debugConsole', () => ({
  debugConsole: {
    error: vi.fn(),
  },
}));

import { useLetterArchiving } from '@/hooks/useLetterArchiving';

const letterFixture = {
  id: 'letter-1',
  title: 'Testbrief',
  content: 'Hallo Welt',
  status: 'draft',
  created_at: '2024-01-01T00:00:00.000Z',
};

describe('useLetterArchiving', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ user: { id: 'user-1' } });
    archiveLetterMock.mockResolvedValue({
      success: true,
      documentId: 'doc-1',
      archivedAt: '2024-01-02T10:00:00.000Z',
      archivedBy: 'user-1',
      followUpTaskId: 'task-1',
    });
  });

  it('archives a letter through the edge function path', async () => {
    const { result } = renderHook(() => useLetterArchiving());

    let archived = false;
    await act(async () => {
      archived = await result.current.archiveLetter(letterFixture);
    });

    await waitFor(() => {
      expect(result.current.isArchiving).toBe(false);
    });

    expect(archived).toBe(true);
    expect(archiveLetterMock).toHaveBeenCalledWith('letter-1', 'user-1');
    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Brief archiviert' }),
    );
  });

  it('fails fast with a destructive toast when user context is missing', async () => {
    useAuthMock.mockReturnValue({ user: null });

    const { result } = renderHook(() => useLetterArchiving());

    let archived = true;
    await act(async () => {
      archived = await result.current.archiveLetter(letterFixture);
    });

    expect(archived).toBe(false);
    expect(archiveLetterMock).not.toHaveBeenCalled();
    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Fehler',
        variant: 'destructive',
      }),
    );
  });

  it('surfaces edge-function failures with a destructive archiving toast and resets the loading state', async () => {
    archiveLetterMock.mockResolvedValue({ success: false, error: 'upload failed' });

    const { result } = renderHook(() => useLetterArchiving());

    let archived = true;
    await act(async () => {
      archived = await result.current.archiveLetter(letterFixture);
    });

    await waitFor(() => {
      expect(result.current.isArchiving).toBe(false);
    });

    expect(archived).toBe(false);
    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Archivierungsfehler',
        description: 'upload failed',
        variant: 'destructive',
      }),
    );
  });
});
