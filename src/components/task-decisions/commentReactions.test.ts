import { describe, expect, it } from "vitest";
import { buildReactionMap, sortReactionEntries, splitVisibleReactions } from "./commentReactions";

describe("commentReactions", () => {
  it("aggregates rows by comment and emoji and marks current user reactions", () => {
    const result = buildReactionMap(
      [
        { comment_id: "c1", emoji: "👍", user_id: "u1" },
        { comment_id: "c1", emoji: "👍", user_id: "u2" },
        { comment_id: "c1", emoji: "🎉", user_id: "u1" },
        { comment_id: "c2", emoji: "❤️", user_id: "u3" },
      ],
      "u1",
    );

    expect(result.get("c1")).toEqual(
      expect.arrayContaining([
        { emoji: "👍", count: 2, currentUserReacted: true },
        { emoji: "🎉", count: 1, currentUserReacted: true },
      ]),
    );
    expect(result.get("c2")).toEqual([{ emoji: "❤️", count: 1, currentUserReacted: false }]);
  });

  it("sorts by count first, then fixed reaction order", () => {
    const sorted = sortReactionEntries([
      { emoji: "🎉", count: 3, currentUserReacted: false },
      { emoji: "👍", count: 3, currentUserReacted: false },
      { emoji: "🧠", count: 3, currentUserReacted: false },
      { emoji: "❤️", count: 2, currentUserReacted: false },
    ]);

    expect(sorted.map((item) => item.emoji)).toEqual(["👍", "🎉", "🧠", "❤️"]);
  });

  it("splits visible and overflow reactions", () => {
    const { visible, overflow } = splitVisibleReactions(
      [
        { emoji: "👍", count: 5, currentUserReacted: false },
        { emoji: "🎉", count: 4, currentUserReacted: false },
        { emoji: "❤️", count: 3, currentUserReacted: false },
        { emoji: "👀", count: 2, currentUserReacted: false },
        { emoji: "🧠", count: 1, currentUserReacted: false },
      ],
      4,
    );

    expect(visible).toHaveLength(4);
    expect(overflow).toEqual([{ emoji: "🧠", count: 1, currentUserReacted: false }]);
  });
});
