import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

import { mockSupabaseClient } from "@/test/mockSupabaseClient";

const toastSpy = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabaseClient.supabase,
}));

vi.mock("@/utils/debugConsole", () => ({
  debugConsole: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/hooks/useAuditLog", () => ({
  logAuditEvent: vi.fn(),
  AuditActions: { LOGOUT: "LOGOUT" },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastSpy }),
}));

import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { TenantProvider, useTenant } from "@/hooks/useTenant";
import { useNotifications } from "@/hooks/useNotifications";
import { useLetterArchiving } from "@/hooks/useLetterArchiving";

const tenantMemberships = [
  {
    id: "m1",
    user_id: "user-1",
    tenant_id: "tenant-a",
    role: "mitarbeiter",
    is_active: true,
    tenant: {
      id: "tenant-a",
      name: "Tenant A",
      description: null,
      settings: {},
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-01-01T00:00:00.000Z",
      is_active: true,
    },
  },
  {
    id: "m2",
    user_id: "user-1",
    tenant_id: "tenant-b",
    role: "mitarbeiter",
    is_active: true,
    tenant: {
      id: "tenant-b",
      name: "Tenant B",
      description: null,
      settings: {},
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-01-01T00:00:00.000Z",
      is_active: true,
    },
  },
];

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>
    <TenantProvider>{children}</TenantProvider>
  </AuthProvider>
);

describe("Core flows integration", () => {
  beforeEach(() => {
    mockSupabaseClient.reset();
    localStorage.clear();
    toastSpy.mockClear();

    mockSupabaseClient.setSession({ user: { id: "user-1", email: "user@example.com" } });
    mockSupabaseClient.setTenantMemberships(tenantMemberships);
    mockSupabaseClient.setTableResult("notifications", {
      data: [
        {
          id: "n1",
          title: "Neu",
          message: "Ungelesen",
          is_read: false,
          priority: "medium",
          created_at: "2024-01-01T00:00:00.000Z",
          notification_types: { name: "info", label: "Info" },
        },
      ],
      error: null,
    });
    mockSupabaseClient.setFunctionResult('archive-letter', {
      data: { success: true, documentId: 'doc-1', archivedAt: '2024-01-02T10:00:00.000Z', archivedBy: 'user-1', followUpTaskId: 'task-1' },
      error: null,
    });
  });

  it("authenticates user and persists tenant switch per user", async () => {
    const authHook = renderHook(() => useAuth(), { wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider> });
    await waitFor(() => expect(authHook.result.current.loading).toBe(false));
    expect(authHook.result.current.user?.id).toBe("user-1");

    const tenantHook = renderHook(() => useTenant(), { wrapper });
    await waitFor(() => expect(tenantHook.result.current.loading).toBe(false));

    act(() => tenantHook.result.current.switchTenant("tenant-b"));
    expect(tenantHook.result.current.currentTenant?.id).toBe("tenant-b");
    expect(localStorage.getItem("currentTenantId_user-1")).toBe("tenant-b");
  });

  it("marks notifications as read through optimistic+db flow", async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    await waitFor(() => expect(result.current.notifications).toHaveLength(1));
    expect(result.current.unreadCount).toBe(1);

    await act(async () => {
      await result.current.markAllAsRead();
    });

    expect(result.current.unreadCount).toBe(0);
    expect(mockSupabaseClient.supabase.from).toHaveBeenCalledWith("notifications");
  });

  it("archives letter through the unified edge-function path", async () => {
    const { result } = renderHook(() => useLetterArchiving(), { wrapper });

    let archived = false;
    await act(async () => {
      archived = await result.current.archiveLetter({
        id: "letter-1",
        title: "Testbrief",
        content: "Hallo",
        status: "draft",
        created_at: "2024-01-01T00:00:00.000Z",
      });
    });

    expect(archived).toBe(true);
    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Brief archiviert" }),
    );
  });

  it("returns destructive toast when brief archiving preconditions are missing", async () => {
    mockSupabaseClient.setSession(null);
    const { result } = renderHook(() => useLetterArchiving(), { wrapper });

    let archived = false;
    await act(async () => {
      archived = await result.current.archiveLetter({
        id: "letter-2",
        title: "Fehlerbrief",
        content: "Hallo",
        status: "draft",
        created_at: "2024-01-01T00:00:00.000Z",
      });
    });

    expect(archived).toBe(false);
    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Fehler", variant: "destructive" }),
    );
  });
});
