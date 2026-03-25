import { describe, expect, it, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { DecisionComments } from "./DecisionComments";

const mockToast = vi.fn();

interface MockReactionComment {
  id: string;
  reactions?: Array<{
    emoji: string;
    count: number;
    currentUserReacted: boolean;
  }>;
}


interface MockConfig {
  initialReacted: boolean;
  initialCount: number;
  insertError: Error | null;
  deleteError: Error | null;
  notificationFails: boolean;
  insertDeferred: boolean;
}

const config: MockConfig = {
  initialReacted: false,
  initialCount: 0,
  insertError: null,
  deleteError: null,
  notificationFails: false,
  insertDeferred: false,
};

const insertSpy = vi.fn();
const deleteSpy = vi.fn();
let resolveDeferredInsert: (() => void) | null = null;

const commentRow = {
  id: "comment-1",
  user_id: "other-user",
  content: "Kommentar",
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
  parent_id: null,
};

const makeThenable = <T,>(payload: T) => ({
  then: (resolve: (value: T) => unknown) => Promise.resolve(payload).then(resolve),
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("@/utils/debugConsole", () => ({
  debugConsole: {
    error: vi.fn(),
  },
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <h1>{children}</h1>,
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/SimpleRichTextEditor", () => ({
  default: () => <div data-testid="editor" />,
}));

vi.mock("./CommentThread", () => ({
  CommentThread: ({ comment, onToggleReaction }: { comment: MockReactionComment; onToggleReaction: (commentId: string, emoji: string, currentlyReacted: boolean) => Promise<void> }) => {
    const reaction = comment.reactions?.[0] ?? { emoji: "👍", count: 0, currentUserReacted: false };
    return (
      <button
        type="button"
        aria-label="toggle-reaction"
        onClick={() => onToggleReaction(comment.id, "👍", Boolean(reaction.currentUserReacted))}
      >
        {`count:${reaction.count};reacted:${String(Boolean(reaction.currentUserReacted))}`}
      </button>
    );
  },
}));

const supabaseMock = {
  from: vi.fn((table: string) => {
    if (table === "task_decision_comments") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [commentRow], error: null })),
            single: vi.fn(() => Promise.resolve({ data: { id: "comment-1", user_id: "other-user", decision_id: "decision-1" }, error: null })),
          })),
        })),
      };
    }

    if (table === "task_decision_comment_reactions") {
      return {
        select: vi.fn(() => ({
          in: vi.fn(() => Promise.resolve({
            data: [{ comment_id: "comment-1", emoji: "👍", user_id: config.initialReacted ? "user-1" : "user-2", profile: { display_name: "Name" } }].slice(0, config.initialCount),
            error: null,
          })),
        })),
        insert: vi.fn(() => {
          insertSpy();
          if (config.insertDeferred) {
            return new Promise<{ error: Error | null }>((resolve) => {
              resolveDeferredInsert = () => resolve({ error: null });
            });
          }
          return Promise.resolve({ error: config.insertError });
        }),
        delete: vi.fn(() => {
          deleteSpy();
          const result = { error: config.deleteError };
          const chain = {
            eq: vi.fn(() => chain),
            ...makeThenable(result),
          };
          return chain;
        }),
      };
    }

    if (table === "profiles") {
      return {
        select: vi.fn(() => ({
          in: vi.fn(() => Promise.resolve({ data: [{ user_id: "other-user", display_name: "Other", badge_color: null, avatar_url: null }], error: null })),
          eq: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: { display_name: "Tester" }, error: null })) })),
        })),
      };
    }

    if (table === "task_decisions") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: { created_by: "owner-1", title: "Titel" }, error: null })),
          })),
        })),
      };
    }

    if (table === "task_decision_participants") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: [{ user_id: "participant-1" }], error: null })),
        })),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  }),
  rpc: vi.fn(() => (config.notificationFails ? Promise.reject(new Error("notification failed")) : Promise.resolve({ data: null, error: null }))),
  functions: { invoke: vi.fn(() => Promise.resolve({ data: null, error: null })) },
  channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn(() => ({})) })),
  removeChannel: vi.fn(),
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: supabaseMock,
}));

function renderComponent() {
  return render(
    <DecisionComments
      decisionId="decision-1"
      decisionTitle="Titel"
      isOpen
      onClose={vi.fn()}
    />,
  );
}

describe("DecisionComments reaction toggles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    config.initialReacted = false;
    config.initialCount = 0;
    config.insertError = null;
    config.deleteError = null;
    config.notificationFails = false;
    config.insertDeferred = false;
    resolveDeferredInsert = null;
    window.localStorage.clear();
  });

  it("keeps optimistic insert state when notification dispatch fails", async () => {
    config.notificationFails = true;

    renderComponent();

    const toggleButton = await screen.findByRole("button", { name: "toggle-reaction" });
    expect(toggleButton).toHaveTextContent("count:0;reacted:false");

    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(toggleButton).toHaveTextContent("count:1;reacted:true");
      expect(insertSpy).toHaveBeenCalledTimes(1);
    });

    expect(mockToast).not.toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });

  it("rolls back optimistic updates and shows error toast when insert fails", async () => {
    config.insertError = new Error("insert failed");
    renderComponent();

    const toggleButton = await screen.findByRole("button", { name: "toggle-reaction" });
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(toggleButton).toHaveTextContent("count:0;reacted:false");
    });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Fehler",
      variant: "destructive",
    }));
  });

  it("rolls back optimistic updates and shows error toast when delete fails", async () => {
    config.initialReacted = true;
    config.initialCount = 1;
    config.deleteError = new Error("delete failed");

    renderComponent();
    const deleteToggleButton = await screen.findByRole("button", { name: "toggle-reaction" });
    expect(deleteToggleButton).toHaveTextContent("count:1;reacted:true");

    fireEvent.click(deleteToggleButton);

    await waitFor(() => {
      expect(deleteToggleButton).toHaveTextContent("count:1;reacted:true");
    });
    expect(deleteSpy).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Fehler",
      variant: "destructive",
    }));
  });

  it("executes only one toggle operation for a double click within debounce window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));

    renderComponent();
    const toggleButton = await screen.findByRole("button", { name: "toggle-reaction" });

    fireEvent.click(toggleButton);
    await waitFor(() => expect(insertSpy).toHaveBeenCalledTimes(1));

    fireEvent.click(toggleButton);
    await Promise.resolve();

    expect(insertSpy).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("prevents parallel duplicate requests for the same action key while pending", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
    config.insertDeferred = true;

    renderComponent();
    const toggleButton = await screen.findByRole("button", { name: "toggle-reaction" });

    fireEvent.click(toggleButton);
    expect(insertSpy).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2024-01-01T00:00:01.000Z"));
    fireEvent.click(toggleButton);

    expect(insertSpy).toHaveBeenCalledTimes(1);

    resolveDeferredInsert?.();
    await waitFor(() => {
      expect(toggleButton).toHaveTextContent("count:1;reacted:true");
    });

    vi.useRealTimers();
  });
});
