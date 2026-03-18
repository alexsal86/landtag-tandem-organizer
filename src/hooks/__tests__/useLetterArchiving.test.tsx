import { renderHook, act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const toastSpy = vi.fn();
const useAuthMock = vi.fn();
const useTenantMock = vi.fn();
const generateLetterPDFMock = vi.fn();

const state = vi.hoisted(() => ({
  attachmentResult: { data: [], error: null as unknown },
  documentInsertResult: { data: { id: 'doc-1' }, error: null as unknown },
  letterUpdateResult: { data: [], error: null as unknown },
  uploadResult: { data: null as unknown, error: null as unknown },
}));

class QueryBuilder {
  private table: string;
  private mode: 'select' | 'insert' | 'update' | null = null;

  constructor(table: string) {
    this.table = table;
  }

  select = vi.fn(() => {
    this.mode = 'select';
    return this;
  });

  insert = vi.fn(() => {
    this.mode = 'insert';
    return this;
  });

  update = vi.fn(() => {
    this.mode = 'update';
    return this;
  });

  eq = vi.fn(() => this);
  order = vi.fn(async () => state.attachmentResult);
  single = vi.fn(async () => state.documentInsertResult);
  then = (onfulfilled?: (value: { data: unknown; error: unknown }) => unknown, onrejected?: (reason: unknown) => unknown) => {
    const value = this.mode === 'update' ? state.letterUpdateResult : state.attachmentResult;
    return Promise.resolve(value).then(onfulfilled, onrejected);
  };
}

const fromMock = vi.fn((table: string) => new QueryBuilder(table));
const uploadMock = vi.fn(async () => state.uploadResult);

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: fromMock,
    storage: {
      from: vi.fn(() => ({ upload: uploadMock })),
    },
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('@/hooks/useTenant', () => ({
  useTenant: () => useTenantMock(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastSpy }),
}));

vi.mock('@/utils/letterPDFGenerator', () => ({
  generateLetterPDF: (...args: unknown[]) => generateLetterPDFMock(...args),
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
    useTenantMock.mockReturnValue({ currentTenant: { id: 'tenant-1' } });
    generateLetterPDFMock.mockResolvedValue({
      blob: new Blob(['pdf'], { type: 'application/pdf' }),
      filename: 'letter.pdf',
    });
    state.attachmentResult = { data: [{ id: 'attachment-1' }], error: null };
    state.documentInsertResult = { data: { id: 'doc-1' }, error: null };
    state.letterUpdateResult = { data: [], error: null };
    state.uploadResult = { data: null, error: null };
  });

  it('archives a letter, stores metadata and marks the letter as sent', async () => {
    const { result } = renderHook(() => useLetterArchiving());

    let archived = false;
    await act(async () => {
      archived = await result.current.archiveLetter(letterFixture);
    });

    await waitFor(() => {
      expect(result.current.isArchiving).toBe(false);
    });

    expect(archived).toBe(true);
    expect(uploadMock).toHaveBeenCalled();
    expect(fromMock).toHaveBeenCalledWith('documents');
    expect(fromMock).toHaveBeenCalledWith('letters');
    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Brief archiviert' }),
    );
  });

  it('fails fast with a destructive toast when user or tenant context is missing', async () => {
    useAuthMock.mockReturnValue({ user: null });

    const { result } = renderHook(() => useLetterArchiving());

    let archived = true;
    await act(async () => {
      archived = await result.current.archiveLetter(letterFixture);
    });

    expect(archived).toBe(false);
    expect(generateLetterPDFMock).not.toHaveBeenCalled();
    expect(uploadMock).not.toHaveBeenCalled();
    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Fehler',
        variant: 'destructive',
      }),
    );
  });

  it('surfaces upload failures with a destructive archiving toast and resets the loading state', async () => {
    state.uploadResult = { data: null, error: new Error('upload failed') };

    const { result } = renderHook(() => useLetterArchiving());

    let archived = true;
    await act(async () => {
      archived = await result.current.archiveLetter(letterFixture);
    });

    await waitFor(() => {
      expect(result.current.isArchiving).toBe(false);
    });

    expect(archived).toBe(false);
    expect(generateLetterPDFMock).toHaveBeenCalledWith(letterFixture);
    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Archivierungsfehler',
        description: 'upload failed',
        variant: 'destructive',
      }),
    );
  });
});
