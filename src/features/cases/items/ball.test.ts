import { describe, expect, it } from "vitest";
import { BALL_OWNERS, TRIAGE_FILTERS, ballMeta, countTriage, daysUntilNextAction, matchesTriage, withAutoDeadline } from "./ball";

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

  it("Mein Ball berücksichtigt Bearbeitung und Schrittzuständigkeit unabhängig davon, wer am Zug ist", () => {
    expect(matchesTriage({ ball_owner: "office", next_action_assignee_id: "u1", owner_user_id: "u2" }, "mine", "u1", now)).toBe(true);
    expect(matchesTriage({ ball_owner: "office", owner_user_id: "u1" }, "mine", "u1", now)).toBe(true);
    expect(matchesTriage({ ball_owner: "ministry", owner_user_id: "u1" }, "mine", "u1", now)).toBe(true);
    expect(matchesTriage({ owner_user_id: "u1", next_action_assignee_id: "u2" }, "mine", "u1", now)).toBe(true);
    expect(matchesTriage({ owner_user_id: "u2", intake_payload: { assignee_ids: ["u2", "u1"] } }, "mine", "u1", now)).toBe(true);
    expect(matchesTriage({ ball_owner: "citizen", next_action_assignee_id: "u1" }, "mine", "u1", now)).toBe(true);
    expect(matchesTriage({ owner_user_id: "u2", next_action_assignee_id: "u3" }, "mine", "u1", now)).toBe(false);
    expect(matchesTriage({ owner_user_id: null, next_action_assignee_id: null }, "mine", null, now)).toBe(false);
  });

  it("bietet nur Mein Ball, Wiedervorlage und Alle in dieser Reihenfolge an", () => {
    expect(TRIAGE_FILTERS.map((filter) => filter.value)).toEqual(["mine", "resubmission", "all"]);
  });

  it("filtert und zählt Wiedervorlagen ohne fällige oder unvollständige Schritte", () => {
    const tomorrow = new Date(2026, 10, 7, 12).toISOString();
    const items = [
      { owner_user_id: "u1", next_action_assignee_id: "u1", next_action_label: "Nachfragen", next_action_due_at: tomorrow },
      { owner_user_id: "u2", next_action_label: "Nachfragen", next_action_due_at: tomorrow },
      { owner_user_id: "u1", next_action_label: "Heute", next_action_due_at: now.toISOString() },
      { owner_user_id: "u2", next_action_label: "Überfällig", next_action_due_at: new Date(2026, 10, 5).toISOString() },
      { owner_user_id: "u2", next_action_due_at: tomorrow },
    ];
    const counts = countTriage(items, "u1", now);
    expect(counts.mine).toBe(2);
    expect(counts.resubmission).toBe(2);
    expect(counts.all).toBe(5);
    expect(items.filter((item) => matchesTriage(item, "resubmission", "u1", now))).toHaveLength(2);
    expect(matchesTriage({ next_action_label: "Ungültig", next_action_due_at: "invalid" }, "resubmission", "u1", now)).toBe(false);
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
  it("fasst Zuständigkeitswechsel, Schritt und Wiedervorlage in genau einem Eintrag zusammen", () => {
    const ev = _bce({ ball_owner: "citizen", owner_user_id: "bearbeiter" }, {
      ball_owner: "authority", next_action_label: "Antwort des Ministeriums nachhalten", next_action_due_at: tomorrow, next_action_assignee_id: "zustandig",
    }, (id) => id === "zustandig" ? "Rudolf Salomon" : "Alexander Salomon", now);
    expect(ev).toEqual([{
      title: "Neuer Schritt festgelegt + Wiedervorlage",
      note: "Bürger → Verwaltung · Antwort des Ministeriums nachhalten · Frist: 07.11.2026",
      responsibleName: "Rudolf Salomon",
    }]);
  });
  it("fasst Änderungen eines bestehenden Schritts zusammen und verwendet sonst den Bearbeiter", () => {
    const ev = _bce({ ball_owner: "office", owner_user_id: "bearbeiter", next_action_label: "Nachhalten" }, {
      ball_owner: "citizen", next_action_due_at: tomorrow,
    }, (id) => id === "bearbeiter" ? "Alexander Salomon" : null, now);
    expect(ev).toHaveLength(1);
    expect(ev[0].title).toBe("Schritt geändert + Wiedervorlage");
    expect(ev[0].note).toBe("Büro → Bürger · Nachhalten · Frist: 07.11.2026");
    expect(ev[0].responsibleName).toBe("Alexander Salomon");
    expect(_bce({}, {}, () => null, now)).toEqual([]);
  });
  it("Wechsel Büro → Verwaltung erzeugt Verlaufseintrag", () => {
    const ev = _bce({ ball_owner: "office" }, { ball_owner: "authority" }, () => null, now);
    expect(ev).toEqual([{ title: "Am Zug geändert", note: "Büro → Verwaltung" }]);
  });
});
