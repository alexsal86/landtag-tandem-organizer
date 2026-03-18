import { renderHook, waitFor, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const toastSpy = vi.fn();
const useAuthMock = vi.fn();

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  notification_types: { name: string; label: string };
};

type NotificationResult = { data: NotificationRow[] | null; error: unknown };

type UnreadResult = { data: Array<{ id: string }> | null; error: unknown };

type UpdateResult = { error: unknown };

const state = vi.hoisted(() => ({
  notificationsResult: { data: [], error: null } as NotificationResult,
  unreadResult: { data: [], error: null } as UnreadResult,
  updateResult: { error: null } as UpdateResult,
}));

class NotificationsQueryBuilder {
  private selectClause: string | undefined;

  select = vi.fn((query?: string) => {
    this.selectClause = query;
    return this;
  });

  eq = vi.fn(() => this);
  order = vi.fn(() => this);
  limit = vi.fn(async () => {
    if (this.selectClause === 'id') {
      return state.unreadResult;
    }
    return state.notificationsResult;
  });
  update = vi.fn(() => this);
  in = vi.fn(async () => state.updateResult);
  then = (onfulfilled?: (value: NotificationResult | UnreadResult) => unknown, onrejected?: (reason: unknown) => unknown) =>
    Promise.resolve(
      this.selectClause === 'id' ? state.unreadResult : state.notificationsResult,
    ).then(onfulfilled, onrejected);
}

const fromMock = vi.fn((_table: string) => new NotificationsQueryBuilder());

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: fromMock,
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastSpy }),
}));

vi.mock('@/utils/debugConsole', () => ({
  debugConsole: {
    error: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

import { useNotifications } from '@/hooks/useNotifications';

const notificationsFixture: NotificationRow[] = [
  {
    id: 'n1',
    title: 'Neu',
    message: 'Bitte lesen',
    is_read: false,
    priority: 'medium',
    created_at: '2024-01-01T00:00:00.000Z',
    notification_types: { name: 'info', label: 'Info' },
  },
  {
    id: 'n2',
    title: 'Alt',
    message: 'Schon gelesen',
    is_read: true,
    priority: 'low',
    created_at: '2024-01-02T00:00:00.000Z',
    notification_types: { name: 'info', label: 'Info' },
  },
];

describe('useNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAuthMock.mockReturnValue({ user: { id: 'user-1' } });
    state.notificationsResult = { data: notificationsFixture, error: null };
    state.unreadResult = { data: [{ id: 'n1' }], error: null };
    state.updateResult = { error: null };
  });

  it('loads notifications and persists markAllAsRead through Supabase', async () => {
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.notifications).toHaveLength(2);
    });

    expect(result.current.unreadCount).toBe(1);

    await act(async () => {
      await result.current.markAllAsRead();
    });

    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications.every((notification) => notification.is_read)).toBe(true);
    expect(fromMock).toHaveBeenCalledWith('notifications');
    expect(localStorage.getItem('notifications_marked_read')).toBeNull();
    expect(toastSpy).not.toHaveBeenCalled();
  });

  it('rolls back optimistic markAllAsRead and shows a destructive toast on Supabase errors', async () => {
    state.updateResult = { error: new Error('update failed') };

    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(1);
    });

    await act(async () => {
      await result.current.markAllAsRead();
    });

    expect(result.current.unreadCount).toBe(1);
    expect(result.current.notifications.find((notification) => notification.id === 'n1')?.is_read).toBe(false);
    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Fehler',
        variant: 'destructive',
      }),
    );
  });
});
