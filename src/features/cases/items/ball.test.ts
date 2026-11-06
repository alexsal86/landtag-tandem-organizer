import { describe, expect, it } from "vitest";
import { countTriage, daysUntilNextAction, matchesTriage } from "./ball";

const now = new Date(2026, 10, 6, 11, 0);

describe("Vorgänge: Wer ist am Zug", () => {
  it("Frist nah umfasst überfällige und bis zu 3 Tage entfernte nächste Schritte", () => {
    expect(matchesTriage({ next_action_due_at: new Date(2026, 10, 9).toISOString() }, "due_soon", null, now)).toBe(true);
    expect(matchesTriage({ next_action_due_at: new Date(2026, 10, 10).toISOString() }, "due_soon", null, now)).toBe(false);
    expect(matchesTriage({ next_action_due_at: new Date(2026, 10, 1).toISOString() }, "due_soon", null, now)).toBe(true);
  });

  it("Mein Ball nutzt die zuständige Person des nächsten Schritts, sonst die Bearbeitung", () => {
    expect(matchesTriage({ ball_owner: "office", next_action_assignee_id: "u1", owner_user_id: "u2" }, "mine", "u1", now)).toBe(true);
    expect(matchesTriage({ ball_owner: "office", owner_user_id: "u1" }, "mine", "u1", now)).toBe(true);
    expect(matchesTriage({ ball_owner: "ministry", owner_user_id: "u1" }, "mine", "u1", now)).toBe(false);
  });

  it("Wartet zählt Bürger, Ministerium, Behörde und Fraktion, aber nicht ruhend", () => {
    const c = countTriage(
      [{ ball_owner: "citizen" }, { ball_owner: "ministry" }, { ball_owner: "authority" }, { ball_owner: "fraction" }, { ball_owner: "snoozed" }, { ball_owner: null }],
      null,
      now,
    );
    expect(c.waiting).toBe(4);
    expect(c.office).toBe(1);
  });

  it("Ohne nächsten Schritt nur, wenn das Büro am Zug ist", () => {
    expect(matchesTriage({ ball_owner: "office", next_action_label: "  " }, "no_next_action", null, now)).toBe(true);
    expect(matchesTriage({ ball_owner: "citizen" }, "no_next_action", null, now)).toBe(false);
  });

  it("berechnet Kalendertage bis zur Frist", () => {
    expect(daysUntilNextAction({ next_action_due_at: new Date(2026, 10, 7, 8).toISOString() }, now)).toBe(1);
    expect(daysUntilNextAction({}, now)).toBeNull();
  });
});
