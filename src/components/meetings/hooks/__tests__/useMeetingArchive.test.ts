import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockSupabase,
  enqueue,
  responses,
  insertsByTable,
  updatesByTable,
  deletesByTable,
} = vi.hoisted(() => {
  type QueryResponse = { data: any; error: any };
  const responses = new Map<string, QueryResponse[]>();
  const insertsByTable = new Map<string, any[]>();
  const updatesByTable = new Map<string, any[]>();
  const deletesByTable = new Map<string, any[]>();

  const enqueue = (table: string, response: QueryResponse) => {
    const queue = responses.get(table) || [];
    queue.push(response);
    responses.set(table, queue);
  };

  const record = (store: Map<string, any[]>, table: string, payload: any) => {
    const list = store.get(table) || [];
    list.push(payload);
    store.set(table, list);
  };

  const createChain = (table: string) => {
    const chain: any = {};
    const methods = ["select", "eq", "neq", "order", "in", "not", "is", "gt", "gte", "limit", "single", "maybeSingle"];
    methods.forEach((m) => {
      chain[m] = vi.fn(() => chain);
    });
    chain.insert = vi.fn((payload: any) => {
      record(insertsByTable, table, payload);
      return chain;
    });
    chain.update = vi.fn((payload: any) => {
      record(updatesByTable, table, payload);
      return chain;
    });
    chain.delete = vi.fn((payload?: any) => {
      record(deletesByTable, table, payload ?? true);
      return chain;
    });
    chain.then = (resolve: (value: QueryResponse) => unknown) => {
      const queue = responses.get(table) || [];
      const next = queue.shift() || { data: [], error: null };
      responses.set(table, queue);
      return Promise.resolve(next).then(resolve);
    };
    return chain;
  };

  return {
    mockSupabase: {
      from: vi.fn((table: string) => createChain(table)),
      rpc: vi.fn(),
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "test" } } }) },
    },
    enqueue,
    responses,
    insertsByTable,
    updatesByTable,
    deletesByTable,
  };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: mockSupabase }));

import type { AgendaItem, Meeting, Profile } from "@/components/meetings/types";
import { mapBirthdayAssignedToValue, useMeetingArchive } from "../useMeetingArchive";

describe("useMeetingArchive", () => {
  const baseMeeting: Meeting = {
    id: "meeting-1",
    user_id: "user-1",
    tenant_id: "tenant-1",
    title: "Plenum",
    meeting_date: "2100-01-02",
    template_id: "tpl-1",
    status: "planned",
  };

  const createDeps = () => ({
    user: { id: "user-1" },
    currentTenant: { id: "tenant-1" },
    toast: vi.fn(),
    profiles: [{ user_id: "user-1", display_name: "Anna" }, { user_id: "user-2", display_name: "Ben" }] as Profile[],
    linkedQuickNotes: [{ id: "qn-1", meeting_result: "Ergebnis Quick Note" }],
    meetingLinkedCaseItems: [],
    loadMeetings: vi.fn().mockResolvedValue(undefined),
    loadCarryoverBufferItems: vi.fn().mockResolvedValue(undefined),
    loadAgendaItems: vi.fn().mockResolvedValue(undefined),
    setActiveMeeting: vi.fn(),
    setActiveMeetingId: vi.fn(),
    setAgendaItems: vi.fn(),
    setLinkedQuickNotes: vi.fn(),
    setSelectedMeeting: vi.fn(),
    setIsFocusMode: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    responses.clear();
    insertsByTable.clear();
    updatesByTable.clear();
    deletesByTable.clear();
  });

  it("creates tasks during archive and resets UI state after successful flow", async () => {
    const deps = createDeps();
    const { archiveMeeting } = useMeetingArchive(deps);

    enqueue("meeting_agenda_items", {
      data: [
        { id: "ai-linked", meeting_id: "meeting-1", title: "Link", task_id: "task-1", result_text: "Follow-up linked" },
        { id: "ai-assigned", meeting_id: "meeting-1", title: "Zuweisung", description: "Details", assigned_to: ["user-2"] },
        { id: "ai-open", meeting_id: "meeting-1", title: "Offen", result_text: "Bitte nachfassen" },
      ] as AgendaItem[],
      error: null,
    });
    enqueue("tasks", { data: { id: "task-1", tenant_id: "tenant-1", assigned_to: "user-2", user_id: "user-2" }, error: null });
    enqueue("tasks", { data: null, error: null });
    enqueue("tasks", { data: null, error: null });
    enqueue("tasks", { data: { id: "followup-1" }, error: null });
    enqueue("tasks", { data: null, error: null });
    enqueue("quick_notes", { data: null, error: null });
    enqueue("starred_appointments", { data: [], error: null });
    enqueue("meeting_agenda_items", { data: [], error: null });
    enqueue("meetings", { data: [{ id: "meeting-1", status: "archived" }], error: null });
    enqueue("meeting_participants", { data: [{ user_id: "user-2" }], error: null });

    await archiveMeeting(baseMeeting);

    const taskInserts = (insertsByTable.get("tasks") || []).flat();
    expect(taskInserts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ parent_task_id: "task-1", title: "Follow-up linked" }),
        expect.objectContaining({ title: "Zuweisung", assigned_to: "user-2" }),
        expect.objectContaining({ title: expect.stringContaining("Nachbereitung Plenum") }),
        expect.objectContaining({ parent_task_id: "followup-1", title: expect.stringContaining("Offen") }),
      ]),
    );

    expect(deps.setActiveMeeting).toHaveBeenCalledWith(null);
    expect(deps.setActiveMeetingId).toHaveBeenCalledWith(null);
    expect(deps.setAgendaItems).toHaveBeenCalledWith([]);
    expect(deps.setLinkedQuickNotes).toHaveBeenCalledWith([]);
    expect(deps.setSelectedMeeting).toHaveBeenCalledWith(null);
    expect(deps.setIsFocusMode).toHaveBeenCalledWith(false);
    expect(deps.loadMeetings).toHaveBeenCalled();
    expect(deps.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Besprechung archiviert" }),
    );
  });

  it("stores carryover items when no next meeting exists and applies carryover items with dedupe", async () => {
    const deps = createDeps();
    const { archiveMeeting, loadAndApplyCarryoverItems } = useMeetingArchive(deps);

    enqueue("meeting_agenda_items", {
      data: [{ id: "ai-1", title: "Carry", carry_over_to_next: true, order_index: 1 }] as AgendaItem[],
      error: null,
    });
    enqueue("meetings", { data: null, error: null });
    enqueue("carryover_items", { data: null, error: null });
    enqueue("tasks", { data: { id: "followup-1" }, error: null });
    enqueue("starred_appointments", { data: [], error: null });
    enqueue("meeting_agenda_items", { data: [], error: null });
    enqueue("meetings", { data: [{ id: "meeting-1", status: "archived" }], error: null });
    enqueue("meeting_participants", { data: [], error: null });

    await archiveMeeting(baseMeeting);

    expect((insertsByTable.get("carryover_items") || []).flat()).toEqual(
      expect.arrayContaining([expect.objectContaining({ title: "Carry", original_meeting_id: "meeting-1" })]),
    );
    expect(deps.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Punkte vorgemerkt", description: expect.stringContaining("1 Punkte") }),
    );

    enqueue("carryover_items", {
      data: [
        { title: "Neu", original_meeting_id: "m-1", original_meeting_title: "Alt", original_meeting_date: "2099-01-01" },
        { title: "Schon da", original_meeting_id: "m-2", original_meeting_title: "Noch älter", original_meeting_date: "2099-01-02" },
      ],
      error: null,
    });
    enqueue("meeting_agenda_items", { data: { id: "review-parent" }, error: null });
    enqueue("meeting_agenda_items", {
      data: [{ order_index: 1, title: "Schon da", source_meeting_id: "m-2" }],
      error: null,
    });

    await loadAndApplyCarryoverItems("meeting-2", "tpl-1");

    const agendaInserts = (insertsByTable.get("meeting_agenda_items") || []).flat();
    expect(agendaInserts).toHaveLength(1);
    expect(agendaInserts[0]).toEqual(expect.objectContaining({ title: "Neu", source_meeting_id: "m-1", parent_id: "review-parent" }));
    expect(deps.loadAgendaItems).toHaveBeenCalledWith("meeting-2");
  });

  it("shows destructive toast on archive failure and handles empty/errored carryover responses gracefully", async () => {
    const deps = createDeps();
    const { archiveMeeting, loadAndApplyCarryoverItems } = useMeetingArchive(deps);

    enqueue("meeting_agenda_items", { data: null, error: { message: "agenda failed" } });
    await archiveMeeting(baseMeeting);

    expect(deps.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Fehler", variant: "destructive", description: expect.stringContaining("agenda failed") }),
    );

    enqueue("carryover_items", { data: null, error: { message: "carryover failed" } });
    await loadAndApplyCarryoverItems("meeting-3", "tpl-1");

    enqueue("carryover_items", { data: [], error: null });
    await loadAndApplyCarryoverItems("meeting-3", "tpl-1");

    expect(deps.loadAgendaItems).not.toHaveBeenCalled();
    expect((insertsByTable.get("meeting_agenda_items") || []).flat()).toHaveLength(0);
  });

  it("maps birthday task assignee deterministically", () => {
    const profiles: Pick<Profile, "user_id">[] = [{ user_id: "profile-user-1" }, { user_id: "profile-user-2" }];

    expect(mapBirthdayAssignedToValue(["explicit-user-1", "explicit-user-2"], profiles, "fallback-user")).toBe("explicit-user-1");
    expect(mapBirthdayAssignedToValue([], profiles, "fallback-user")).toBe("profile-user-1");
    expect(mapBirthdayAssignedToValue([], [], "fallback-user")).toBe("fallback-user");
  });
});
