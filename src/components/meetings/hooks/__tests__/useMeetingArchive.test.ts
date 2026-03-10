import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockIs = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockMaybeSingle = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockNot = vi.fn();
const mockGt = vi.fn();
const mockIn = vi.fn();
const mockNeq = vi.fn();
const mockGte = vi.fn();
const mockSingle = vi.fn();
const mockRpc = vi.fn();

const chainMock = () => ({
  select: mockSelect,
  eq: mockEq,
  is: mockIs,
  order: mockOrder,
  limit: mockLimit,
  maybeSingle: mockMaybeSingle,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
  not: mockNot,
  gt: mockGt,
  in: mockIn,
  neq: mockNeq,
  gte: mockGte,
  single: mockSingle,
});

// Make each chainable method return the chain
const chain = chainMock();
Object.values(chain).forEach(fn => fn.mockReturnValue(chain));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => chain),
    rpc: mockRpc,
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'test' } } }) },
  },
}));

import type { AgendaItem, Meeting, LinkedQuickNote, LinkedCaseItem, Profile } from "@/components/meetings/types";
import { mapBirthdayAssignedToValue } from "../useMeetingArchive";

describe("useMeetingArchive - transferItemsToMeeting logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(chain).forEach(fn => fn.mockReturnValue(chain));
  });

  it("should deduplicate items by source_meeting_id::title", () => {
    const existingChildren = [
      { title: "Item A", source_meeting_id: "meeting-1" },
    ];
    const existingSet = new Set(
      existingChildren.map(i => `${i.source_meeting_id}::${i.title}`)
    );

    const items: Partial<AgendaItem>[] = [
      { title: "Item A", description: "desc" },
      { title: "Item B", description: "desc" },
    ];
    const sourceMeetingId = "meeting-1";

    const toTransfer = items.filter(item => {
      const key = `${sourceMeetingId}::${item.title}`;
      return !existingSet.has(key);
    });

    expect(toTransfer).toHaveLength(1);
    expect(toTransfer[0].title).toBe("Item B");
  });

  it("should transfer all items when no existing children", () => {
    const existingSet = new Set<string>();
    const items = [
      { title: "Item A" },
      { title: "Item B" },
      { title: "Item C" },
    ];
    const sourceMeetingId = "meeting-1";

    const toTransfer = items.filter(item => {
      const key = `${sourceMeetingId}::${item.title}`;
      return !existingSet.has(key);
    });

    expect(toTransfer).toHaveLength(3);
  });
});

describe("useMeetingArchive - carryover item detection", () => {
  it("filters agenda items with carry_over_to_next flag", () => {
    const agendaItems: Partial<AgendaItem>[] = [
      { title: "Done item", is_completed: true, carry_over_to_next: false },
      { title: "Carry item", is_completed: false, carry_over_to_next: true },
      { title: "Regular item", is_completed: false, carry_over_to_next: false },
    ];

    const carryoverItems = agendaItems.filter(item => item.carry_over_to_next);
    expect(carryoverItems).toHaveLength(1);
    expect(carryoverItems[0].title).toBe("Carry item");
  });
});

describe("useMeetingArchive - birthday task creation logic", () => {
  it("parses birthday result_text JSON and filters by action", () => {
    const resultText = JSON.stringify({
      "contact-1": { action: "card", assigned_to: ["user-1"] },
      "contact-2": { action: null },
      "contact-3": { action: "call", assigned_to: ["user-2", "user-3"] },
    });

    const parsed = JSON.parse(resultText) as Record<string, { action?: string; assigned_to?: string[] }>;
    const selectedIds = Object.keys(parsed).filter(id => parsed[id]?.action);

    expect(selectedIds).toHaveLength(2);
    expect(selectedIds).toContain("contact-1");
    expect(selectedIds).toContain("contact-3");
  });

  it("returns empty when no actions selected", () => {
    const resultText = JSON.stringify({
      "contact-1": {},
      "contact-2": { action: null },
    });

    const parsed = JSON.parse(resultText) as Record<string, { action?: string | null }>;
    const selectedIds = Object.keys(parsed).filter(id => parsed[id]?.action);

    expect(selectedIds).toHaveLength(0);
  });

  it("maps birthday task assignee to a single string user id", () => {
    const profiles: Pick<Profile, 'user_id'>[] = [
      { user_id: 'profile-user-1' },
      { user_id: 'profile-user-2' },
    ];

    expect(mapBirthdayAssignedToValue(['explicit-user-1', 'explicit-user-2'], profiles, 'fallback-user')).toBe('explicit-user-1');
    expect(mapBirthdayAssignedToValue([], profiles, 'fallback-user')).toBe('profile-user-1');
    expect(mapBirthdayAssignedToValue([], [], 'fallback-user')).toBe('fallback-user');
  });
});

describe("useMeetingArchive - assigned item task creation", () => {
  it("extracts first assigned user from array", () => {
    const assignedTo = ["user-1", "user-2", "user-3"];
    const flattened = assignedTo.flat().filter(Boolean) as string[];
    const firstUser = flattened[0] || null;

    expect(firstUser).toBe("user-1");
  });

  it("builds assignee names from profiles", () => {
    const profiles: Profile[] = [
      { user_id: "user-1", display_name: "Alice" },
      { user_id: "user-2", display_name: "Bob" },
    ];
    const assignedTo = ["user-1", "user-2"];

    const names = assignedTo.map(id => {
      const profile = profiles.find(p => p.user_id === id);
      return profile?.display_name || "Unbekannt";
    }).join(", ");

    expect(names).toBe("Alice, Bob");
  });

  it("returns 'Unbekannt' for missing profiles", () => {
    const profiles: Profile[] = [];
    const assignedTo = ["user-unknown"];

    const names = assignedTo.map(id => {
      const profile = profiles.find(p => p.user_id === id);
      return profile?.display_name || "Unbekannt";
    }).join(", ");

    expect(names).toBe("Unbekannt");
  });
});
