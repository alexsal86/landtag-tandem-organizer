import { describe, expect, it } from "vitest";
import {
  countPromiseHint, countPromiseHintShown, emptyPromiseHintStats, normalizePromiseHintStats,
  promiseHintOutcome, promiseHintsWithoutFeedback,
} from "./officeFeedbackPromiseHintStats";

describe("promiseHintOutcome", () => {
  it("zählt nichts ohne erkannten Vorschlag", () => {
    expect(promiseHintOutcome(undefined, "Rückruf am Freitag")).toBeNull();
    expect(promiseHintOutcome("   ", "Rückruf am Freitag")).toBeNull();
  });

  it("erkennt unverändert, geändert und verworfen", () => {
    expect(promiseHintOutcome("Rückruf am Freitag", "Rückruf am Freitag")).toBe("unchanged");
    expect(promiseHintOutcome("Rückruf am Freitag", "  Rückruf am Freitag  ")).toBe("unchanged");
    expect(promiseHintOutcome("Rückruf am Freitag", "Rückruf am Montag")).toBe("edited");
    expect(promiseHintOutcome("Rückruf am Freitag", "")).toBe("discarded");
    expect(promiseHintOutcome("Rückruf am Freitag", undefined)).toBe("discarded");
  });
});

describe("normalizePromiseHintStats", () => {
  it("macht fehlende, alte und kaputte Werte zu 0 statt zu NaN", () => {
    const cases: unknown[] = [
      undefined, null, "kaputt", 42, [], {}, { shown: 3 },
      { unchanged: "2", edited: null, discarded: -5 },
      { unchanged: Number.NaN, edited: Number.POSITIVE_INFINITY, discarded: 1.7 },
    ];
    for (const value of cases) {
      const stats = normalizePromiseHintStats(value);
      const total = stats.shown + stats.unchanged + stats.edited + stats.discarded;
      expect(Number.isFinite(total)).toBe(true);
      expect(total).toBeGreaterThanOrEqual(0);
    }
    expect(normalizePromiseHintStats({ shown: 3 })).toEqual({ shown: 3, unchanged: 0, edited: 0, discarded: 0 });
    expect(normalizePromiseHintStats({ unchanged: 2, edited: Number.NaN, discarded: 1.7 }))
      .toEqual({ shown: 3, unchanged: 2, edited: 0, discarded: 1 });
  });

  it("hebt shown mindestens auf die Summe der Ausgänge", () => {
    // Altbestand von vor dem shown-Zähler: Ausgänge belegen erschienene Vorschläge.
    expect(normalizePromiseHintStats({ unchanged: 2, edited: 1, discarded: 1 }).shown).toBe(4);
    expect(normalizePromiseHintStats({ shown: 1, unchanged: 2 }).shown).toBe(2);
    expect(promiseHintsWithoutFeedback({ unchanged: 2, edited: 1 })).toBe(0);
  });

  it("zählt auch auf kaputtem Bestand weiter, ohne zu werfen", () => {
    expect(countPromiseHint({ shown: 9 } as unknown, "edited")).toEqual({ shown: 9, unchanged: 0, edited: 1, discarded: 0 });
    expect(countPromiseHint(undefined, "discarded")).toEqual({ shown: 1, unchanged: 0, edited: 0, discarded: 1 });
  });
});

describe("countPromiseHint", () => {
  it("erhöht genau einen Zähler und lässt die Eingabe unverändert", () => {
    const start = { ...emptyPromiseHintStats };
    const next = countPromiseHint(start, "edited");
    expect(next).toEqual({ shown: 1, unchanged: 0, edited: 1, discarded: 0 });
    expect(start).toEqual({ shown: 0, unchanged: 0, edited: 0, discarded: 0 });
  });

  it("summiert mehrere Sends und ignoriert fehlende Vorschläge", () => {
    const stats = [("unchanged" as const), ("edited" as const), null, ("unchanged" as const), ("discarded" as const)]
      .reduce(countPromiseHint, emptyPromiseHintStats);
    expect(stats).toEqual({ shown: 4, unchanged: 2, edited: 1, discarded: 1 });
    expect(promiseHintsWithoutFeedback(stats)).toBe(0);
  });
});

describe("countPromiseHintShown", () => {
  it("zählt einen erschienenen Vorschlag ohne jede Rückmeldung", () => {
    const once = countPromiseHintShown(emptyPromiseHintStats);
    expect(once).toEqual({ shown: 1, unchanged: 0, edited: 0, discarded: 0 });
    expect(promiseHintsWithoutFeedback(once)).toBe(1);
    expect(promiseHintsWithoutFeedback(countPromiseHintShown(once))).toBe(2);
  });

  it("lässt eine später gesendete Rückmeldung als Ausgang danebenstehen", () => {
    const stats = countPromiseHint(countPromiseHintShown(emptyPromiseHintStats), "unchanged");
    expect(stats).toEqual({ shown: 1, unchanged: 1, edited: 0, discarded: 0 });
    expect(promiseHintsWithoutFeedback(stats)).toBe(0);
    // Erschienen, dann verworfen, aber „Nichts zu berichten“: bleibt wirkungslos.
    expect(promiseHintsWithoutFeedback(countPromiseHintShown(emptyPromiseHintStats))).toBe(1);
  });
});
