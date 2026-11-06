import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUserPreference } from './useUserPreference';

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/hooks/useTenant', () => ({ useTenant: () => ({ currentTenant: null }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

beforeEach(() => localStorage.clear());
describe('preference synchronization between pickers', () => {
  it('updates sibling palette consumers immediately without changing other preferences', async () => {
    const capture = renderHook(() => useUserPreference('palette', ['blue']));
    const menu = renderHook(() => useUserPreference('palette', ['blue']));
    const filter = renderHook(() => useUserPreference('palette', ['blue']));
    const other = renderHook(() => useUserPreference('other', ['red']));
    act(() => capture.result.current[1](['green', 'amber']));
    await waitFor(() => {
      expect(menu.result.current[0]).toEqual(['green', 'amber']);
      expect(filter.result.current[0]).toEqual(['green', 'amber']);
    });
    expect(other.result.current[0]).toEqual(['red']);
  });
});
