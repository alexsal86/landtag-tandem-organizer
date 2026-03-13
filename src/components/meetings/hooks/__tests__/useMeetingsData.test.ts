import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const { mockSupabase, mockToast, mockUser, mockTenant, enqueue, responses } = vi.hoisted(() => {
  type QueryResponse = { data: any; error: any };
  const responses = new Map<string, QueryResponse[]>();

  const enqueue = (table: string, response: QueryResponse) => {
    const queue = responses.get(table) || [];
    queue.push(response);
    responses.set(table, queue);
  };

  const createChain = (table: string) => {
    const chain: any = {};
    const methods = ["select", "eq", "neq", "order", "in", "not", "is", "gt", "limit", "single", "maybeSingle", "insert", "update", "delete"];
    methods.forEach((m) => {
      chain[m] = vi.fn(() => chain);
    });
    chain.then = (resolve: (value: QueryResponse) => unknown) => {
      const queue = responses.get(table) || [];
      const next = queue.shift() || { data: [], error: null };
      responses.set(table, queue);
      return Promise.resolve(next).then(resolve);
    };
    return chain;
  };

  const mockSupabase = {
    from: vi.fn((table: string) => createChain(table)),
    storage: { from: vi.fn(() => ({ upload: vi.fn(), remove: vi.fn() })) },
  };
  const mockToast = vi.fn();
  const mockUser = { id: "user-1", email: "test@example.com" };
  const mockTenant = { id: "tenant-1", name: "Test" };

  return { mockSupabase, mockToast, mockUser, mockTenant, enqueue, responses };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: mockSupabase }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mockUser }) }));
vi.mock("@/hooks/useTenant", () => ({ useTenant: () => ({ currentTenant: mockTenant }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mockToast }) }));
vi.mock("@/hooks/useNotificationHighlight", () => ({
  useNotificationHighlight: () => ({ isHighlighted: false, highlightRef: { current: null } }),
}));
vi.mock("react-router-dom", () => {
  const searchParams = new URLSearchParams();
  return {
    useSearchParams: () => [searchParams, vi.fn()],
  };
});
vi.mock("../useMeetingSidebarData", () => ({
  useMeetingSidebarData: () => ({
    loadLinkedQuickNotes: vi.fn(),
    loadMeetingLinkedTasks: vi.fn(),
    loadMeetingLinkedCaseItems: vi.fn(),
    loadMeetingRelevantDecisions: vi.fn(),
    loadMeetingUpcomingAppointments: vi.fn(),
    loadStarredAppointments: vi.fn(),
    loadCarryoverBufferItems: vi.fn(),
    updateTimeouts: { current: {} },
    linkedQuickNotes: [],
    setLinkedQuickNotes: vi.fn(),
    meetingLinkedTasks: [],
    meetingRelevantDecisions: [],
    meetingLinkedCaseItems: [],
    meetingUpcomingAppointments: [],
    isMeetingLinkedDataLoading: false,
    starredAppointmentIds: [],
    expandedApptNotes: {},
    setExpandedApptNotes: vi.fn(),
    toggleStarAppointment: vi.fn(),
  }),
}));

import { useMeetingsData } from "../useMeetingsData";

describe("useMeetingsData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    responses.clear();
  });

  it("normalizes meetings, auto-selects next meeting and loads ordered agenda items", async () => {
    enqueue("meetings", {
      data: [
        { id: "own-1", user_id: "user-1", title: "Own", status: "planned", meeting_date: "2100-01-10" },
      ],
      error: null,
    });
    enqueue("meeting_participants", {
      data: [
        { meeting_id: "own-1", meetings: { id: "own-1", status: "planned", meeting_date: "2100-01-10" } },
        { meeting_id: "part-1", meetings: { id: "part-1", user_id: "other", title: "Participant", status: "planned", meeting_date: "2100-01-05" } },
        { meeting_id: "archived", meetings: { id: "archived", status: "archived", meeting_date: "2100-01-01" } },
      ],
      error: null,
    });

    enqueue("user_tenant_memberships", { data: [], error: null });
    enqueue("tasks", { data: [], error: null });
    enqueue("meeting_templates", { data: [], error: null });

    enqueue("meeting_agenda_items", {
      data: [
        { id: "parent-1", meeting_id: "part-1", title: "Top", order_index: 1, parent_id: null },
        { id: "child-1", meeting_id: "part-1", title: "Child", order_index: 1, parent_id: "parent-1" },
        { id: "parent-2", meeting_id: "part-1", title: "Top 2", order_index: 2, parent_id: null },
      ],
      error: null,
    });
    enqueue("meeting_agenda_documents", { data: [], error: null });
    enqueue("meeting_participants", { data: null, error: null });

    const { result } = renderHook(() => useMeetingsData());

    await waitFor(() => {
      expect(result.current.meetings).toHaveLength(2);
      expect(result.current.selectedMeeting?.id).toBe("part-1");
      expect(result.current.agendaItems.map((i) => i.id)).toEqual(["parent-1", "child-1", "parent-2"]);
    });

    expect(result.current.meetings.every((m) => m.meeting_date instanceof Date)).toBe(true);
    expect(result.current.selectedMeeting?.meeting_date instanceof Date).toBe(true);
  });

  it("sets profiles with current user first and filters tasks to relevant assignees", async () => {
    enqueue("meetings", { data: [], error: null });
    enqueue("meeting_participants", { data: [], error: null });

    enqueue("user_tenant_memberships", { data: [{ user_id: "user-2" }, { user_id: "user-1" }], error: null });
    enqueue("profiles", {
      data: [
        { user_id: "user-2", display_name: "Other" },
        { user_id: "user-1", display_name: "Me" },
      ],
      error: null,
    });

    enqueue("tasks", {
      data: [
        { id: "t-1", user_id: "user-1", assigned_to: null, tenant_id: "tenant-1", status: "todo" },
        { id: "t-2", user_id: "user-9", assigned_to: ["user-1"], tenant_id: "tenant-1", status: "todo" },
        { id: "t-3", user_id: "user-9", assigned_to: ["user-8"], tenant_id: "tenant-1", status: "todo" },
      ],
      error: null,
    });
    enqueue("task_documents", { data: [{ id: "d-1", task_id: "t-1" }], error: null });
    enqueue("meeting_templates", { data: [], error: null });

    const { result } = renderHook(() => useMeetingsData());

    await waitFor(() => {
      expect(result.current.profiles.map((p) => p.user_id)).toEqual(["user-1", "user-2"]);
      expect(result.current.tasks.map((t) => t.id)).toEqual(["t-1", "t-2"]);
      expect(result.current.taskDocuments["t-1"]).toHaveLength(1);
    });
  });

  it("keeps state stable on supabase errors or empty partial responses", async () => {
    enqueue("meetings", { data: null, error: { message: "boom" } });
    enqueue("user_tenant_memberships", { data: [], error: null });
    enqueue("tasks", { data: null, error: { message: "tasks boom" } });
    enqueue("meeting_templates", { data: [], error: null });

    const { result } = renderHook(() => useMeetingsData());

    await waitFor(() => {
      expect(result.current.meetings).toEqual([]);
      expect(result.current.selectedMeeting).toBeNull();
      expect(result.current.profiles).toEqual([]);
      expect(result.current.tasks).toEqual([]);
      expect(result.current.agendaItems).toEqual([]);
    });
  });

  it("updates meeting status and shows success feedback", async () => {
    enqueue("meetings", {
      data: [{ id: "meeting-1", user_id: "user-1", title: "Jour Fixe", status: "planned", meeting_date: "2100-01-11" }],
      error: null,
    });
    enqueue("meeting_participants", { data: [], error: null });
    enqueue("user_tenant_memberships", { data: [], error: null });
    enqueue("tasks", { data: [], error: null });
    enqueue("meeting_templates", { data: [], error: null });

    enqueue("meetings", { data: null, error: null });

    const { result } = renderHook(() => useMeetingsData());

    await waitFor(() => {
      expect(result.current.meetings).toHaveLength(1);
    });

    await act(async () => {
      await result.current.updateMeeting("meeting-1", { status: "in_progress" });
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Meeting aktualisiert", description: "Das Meeting wurde erfolgreich aktualisiert." }),
    );
  });

  it("restores meetings and shows destructive toast on update failure, then allows retry", async () => {
    enqueue("meetings", {
      data: [{ id: "meeting-2", user_id: "user-1", title: "Ausschuss", status: "planned", meeting_date: "2100-02-01" }],
      error: null,
    });
    enqueue("meeting_participants", { data: [], error: null });
    enqueue("user_tenant_memberships", { data: [], error: null });
    enqueue("tasks", { data: [], error: null });
    enqueue("meeting_templates", { data: [], error: null });

    enqueue("meetings", { data: null, error: { message: "update failed" } });
    enqueue("meetings", {
      data: [{ id: "meeting-2", user_id: "user-1", title: "Ausschuss", status: "planned", meeting_date: "2100-02-01" }],
      error: null,
    });
    enqueue("meeting_participants", { data: [], error: null });

    enqueue("meetings", { data: null, error: null });

    const { result } = renderHook(() => useMeetingsData());

    await waitFor(() => {
      expect(result.current.meetings.map((m) => m.id)).toEqual(["meeting-2"]);
    });

    await act(async () => {
      await result.current.updateMeeting("meeting-2", { title: "Ausschuss (neu)" });
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Fehler", variant: "destructive" }),
    );

    await act(async () => {
      await result.current.updateMeeting("meeting-2", { title: "Ausschuss (retry)" });
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Meeting aktualisiert" }),
    );
  });
});
