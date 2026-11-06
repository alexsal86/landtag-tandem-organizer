import { describe, expect, it } from "vitest";
import { BALL_OWNERS, ballMeta, countTriage, daysUntilNextAction, matchesTriage, withAutoDeadline } from "./ball";

const now = new Date(2026, 10, 6, 11, 0);

describe("Vorgänge: Wer ist am Zug", () => {
  it("fasst Behörde und Ministerium in einer Verwaltungsauswahl zusammen", () => {
    expect(ballMeta("ministry").value).toBe("authority");
    expect(ballMeta("authority").short).toBe("Verwaltung");
    expect(BALL_OWNERS.filter((owner) => owner.short === "Verwaltung")).toHaveLength(1);
    expect(BALL_OWNERS.some((owner) => owner.value === "ministry")).toBe(false);
    expect(matchesTriage({ ball_owner: "ministry" }, "waiting", null, now)).toBe(true);
    expect(matchesTriage({ ball_owner: "authority" }, "waiting", null, now)).toBe(true);
  });

  it("setzt für Verwaltung 21 Tage Frist und erhält bestehende Schritte", () => {
    const patch = withAutoDeadline({}, { ball_owner: "authority" }, now);
    expect(daysUntilNextAction(patch, now)).toBe(21);
    expect(patch.next_action_label).toBe("Antwort der Verwaltung nachhalten");
    const existing = new Date(2026, 10, 10).toISOString();
    expect(withAutoDeadline({ next_action_due_at: existing }, { ball_owner: "authority" }, now).next_action_due_at).toBeUndefined();
    expect(withAutoDeadline({ next_action_label: "Bestehender Schritt" }, { ball_owner: "authority" }, now).next_action_label).toBe("Bestehender Schritt");
  });

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

  it("setzt beim Wechsel zum Ministerium automatisch 21 Tage Frist", () => {
    const p = withAutoDeadline({}, { ball_owner: "ministry" }, now);
    expect(daysUntilNextAction(p, now)).toBe(21);
    expect(p.next_action_label).toBe("Antwort des Ministeriums nachhalten");
  });

  it("überschreibt keine bestehende Frist", () => {
    const existing = new Date(2026, 10, 10).toISOString();
    expect(withAutoDeadline({ next_action_due_at: existing }, { ball_owner: "ministry" }, now).next_action_due_at).toBeUndefined();
    expect(daysUntilNextAction(withAutoDeadline({}, { ball_owner: "citizen" }, now), now)).toBe(14);
  });

  it("schlägt für jede Zuständigkeit eine Frist vor ohne explizite Fristen zu ersetzen", () => {
    for (const [owner, days] of [["office", 3], ["citizen", 14], ["authority", 21], ["fraction", 7], ["snoozed", 14]] as const) {
      expect(daysUntilNextAction(withAutoDeadline({}, { ball_owner: owner }, now), now)).toBe(days);
      expect(withAutoDeadline({}, { ball_owner: owner, next_action_due_at: null }, now).next_action_due_at).toBeNull();
      const explicit = new Date(2026, 11, 1).toISOString();
      expect(withAutoDeadline({}, { ball_owner: owner, next_action_due_at: explicit }, now).next_action_due_at).toBe(explicit);
    }
    expect(withAutoDeadline({}, { next_action_label: "Nur Text ändern" }, now).next_action_due_at).toBeUndefined();
  });

  it("berechnet Kalendertage bis zur Frist", () => {
    expect(daysUntilNextAction({ next_action_due_at: new Date(2026, 10, 7, 8).toISOString() }, now)).toBe(1);
    expect(daysUntilNextAction({}, now)).toBeNull();
  });
});

import { isOnResubmission as _isR, stepState as _st, ballChangeEvents as _bce } from "./ball";
describe("Wiedervorlage", () => {
  const now = new Date(2026, 10, 6, 10);
  const tomorrow = new Date(2026, 10, 7, 12).toISOString();
  const today = new Date(2026, 10, 6, 18).toISOString();
  it("Schritt mit Frist morgen liegt auf Wiedervorlage", () => {
    expect(_isR({ next_action_label: "Nachhalten", next_action_due_at: tomorrow }, now)).toBe(true);
  });
  it("Frist heute kehrt in die Liste zurück", () => {
    expect(_isR({ next_action_label: "Nachhalten", next_action_due_at: today }, now)).toBe(false);
  });
  it("ohne Schritt keine Wiedervorlage", () => {
    expect(_isR({ next_action_label: "", next_action_due_at: tomorrow }, now)).toBe(false);
    expect(_st({ next_action_label: " " })).toBe("none");
  });
  it("Wechsel Büro → Verwaltung erzeugt Verlaufseintrag", () => {
    const ev = _bce({ ball_owner: "office" }, { ball_owner: "authority" }, () => null, now);
    expect(ev).toEqual([{ title: "Am Zug geändert", note: "Büro → Verwaltung" }]);
  });
});
