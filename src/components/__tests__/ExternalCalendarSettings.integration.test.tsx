import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ExternalCalendarSettings } from "@/features/calendar/components/ExternalCalendarSettings";
import { mockSupabaseClient } from "@/test/mockSupabaseClient";

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabaseClient.supabase,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({ currentTenant: { id: "tenant-a" } }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock("@/utils/debugConsole", () => ({
  debugConsole: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

describe("ExternalCalendarSettings integration", () => {
  beforeEach(() => {
    mockSupabaseClient.reset();
    toastSuccess.mockClear();
    toastError.mockClear();

    mockSupabaseClient.setTableResult("external_calendars", {
      data: [
        {
          id: "cal-1",
          name: "Team Kalender",
          ics_url: "https://example.com/test.ics",
          calendar_type: "google",
          sync_enabled: true,
          last_sync: null,
          sync_interval: 60,
          color: "#3b82f6",
          is_active: true,
        },
      ],
      error: null,
    });
    mockSupabaseClient.setFunctionResult("sync-external-calendar", { data: { success: true }, error: null });
  });

  it("triggers sync-external-calendar function from UI", async () => {
    render(<ExternalCalendarSettings />);

    await waitFor(() => expect(screen.getByText("Team Kalender")).toBeInTheDocument());

    const syncButton = screen.getByRole("button", { name: /synchronisieren/i });
    fireEvent.click(syncButton);

    await waitFor(() =>
      expect(mockSupabaseClient.supabase.functions.invoke).toHaveBeenCalledWith(
        "sync-external-calendar",
        { body: { calendar_id: "cal-1" } },
      ),
    );
    expect(toastSuccess).toHaveBeenCalledWith("Kalender erfolgreich synchronisiert");
  });
});
