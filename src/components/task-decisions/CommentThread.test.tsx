import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CommentThread, type CommentData } from "./CommentThread";

vi.mock("@/components/ui/SimpleRichTextEditor", () => ({
  default: ({ onChange }: { onChange: (value: string) => void }) => (
    <textarea aria-label="editor" onChange={(event) => onChange(event.target.value)} />
  ),
}));

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);

const baseComment: CommentData = {
  id: "comment-1",
  user_id: "user-1",
  content: "Hallo",
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
  parent_id: null,
  replies: [],
  reactions: [{ emoji: "👍", count: 1, currentUserReacted: false }],
  profile: {
    display_name: "Max Mustermann",
    badge_color: null,
    avatar_url: null,
  },
};

describe("CommentThread reactions", () => {
  it("toggles existing reaction with current state", () => {
    const onToggleReaction = vi.fn().mockResolvedValue(undefined);

    render(
      <CommentThread
        comment={baseComment}
        onReply={vi.fn().mockResolvedValue(undefined)}
        onEdit={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onToggleReaction={onToggleReaction}
        currentUserId="user-1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /👍\s*1/i }));

    expect(onToggleReaction).toHaveBeenCalledWith("comment-1", "👍", false);
  });

  it("renders updated count after rerender", () => {
    const onToggleReaction = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <CommentThread
        comment={baseComment}
        onReply={vi.fn().mockResolvedValue(undefined)}
        onEdit={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onToggleReaction={onToggleReaction}
        currentUserId="user-1"
      />,
    );

    expect(screen.getByText("1")).toBeInTheDocument();

    rerender(
      <CommentThread
        comment={{
          ...baseComment,
          reactions: [{ emoji: "👍", count: 2, currentUserReacted: true }],
        }}
        onReply={vi.fn().mockResolvedValue(undefined)}
        onEdit={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onToggleReaction={onToggleReaction}
        currentUserId="user-1"
      />,
    );

    expect(screen.getByRole("button", { name: /👍\s*2/i })).toBeInTheDocument();
  });
});
