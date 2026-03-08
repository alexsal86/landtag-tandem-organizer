import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      update: mockUpdate,
    })),
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

import { useCalendarOperations } from "../../../calendar/hooks/useCalendarOperations";
import { renderHook } from "@testing-library/react";

describe("useCalendarOperations", () => {
  const mockRefresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  });

  it("returns handleEventDrop and handleEventResize", () => {
    const { result } = renderHook(() => useCalendarOperations(mockRefresh));
    expect(result.current.handleEventDrop).toBeDefined();
    expect(result.current.handleEventResize).toBeDefined();
  });

  it("handleEventDrop ignores events with blocked IDs", async () => {
    const { result } = renderHook(() => useCalendarOperations(mockRefresh));
    const event = {
      id: "blocked-123",
      title: "Test",
      time: "",
      duration: "",
      date: new Date(),
      type: "blocked" as const,
      priority: "low" as const,
    };
    await result.current.handleEventDrop(event, new Date(), new Date());
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("handleEventDrop ignores events without ID", async () => {
    const { result } = renderHook(() => useCalendarOperations(mockRefresh));
    const event = {
      id: "",
      title: "Test",
      time: "",
      duration: "",
      date: new Date(),
      type: "appointment" as const,
      priority: "low" as const,
    };
    await result.current.handleEventDrop(event, new Date(), new Date());
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
