import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Mock useAuth
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '@/hooks/useAuth';
import { ProtectedRoute } from '../ProtectedRoute';

const mockUseAuth = vi.mocked(useAuth);

describe('ProtectedRoute', () => {
  it('zeigt einen Spinner während des Ladens', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      loading: true,
      authError: null,
      signOut: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Dashboard</div>} />
          </Route>
          <Route path="/auth" element={<div>Auth-Seite</div>} />
        </Routes>
      </MemoryRouter>
    );

    // Spinner wird angezeigt, nicht die Seite
    expect(screen.queryByText('Dashboard')).toBeNull();
    expect(screen.queryByText('Auth-Seite')).toBeNull();
  });

  it('leitet zu /auth weiter wenn nicht eingeloggt', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      loading: false,
      authError: null,
      signOut: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Dashboard</div>} />
          </Route>
          <Route path="/auth" element={<div>Auth-Seite</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Auth-Seite')).toBeDefined();
    expect(screen.queryByText('Dashboard')).toBeNull();
  });

  it('rendert Kind-Route wenn eingeloggt', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com' } as Parameters<typeof useAuth>[0] extends never ? never : ReturnType<typeof useAuth>['user'],
      session: null,
      loading: false,
      authError: null,
      signOut: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Dashboard</div>} />
          </Route>
          <Route path="/auth" element={<div>Auth-Seite</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Dashboard')).toBeDefined();
    expect(screen.queryByText('Auth-Seite')).toBeNull();
  });
});
