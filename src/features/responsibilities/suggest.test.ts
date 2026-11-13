import { describe, it, expect } from "vitest";
import {
  suggestResponsible,
  findCoverageGaps,
  type Responsibility,
} from "./suggest";
const r = (
  user_id: string,
  kind: "topic" | "region" | "committee",
  level: "primary" | "secondary" = "primary",
): Responsibility => ({ user_id, kind, level, [`${kind}_id`]: "x" });
describe("Zuständigkeitsvorschlag", () => {
  const context = { topicIds: ["x"], regionIds: ["x"], committeeIds: ["x"] };
  it("ordnet Kombination vor Thema vor Region vor Ausschuss, dann Primär vor Sekundär", () => {
    expect(
      suggestResponsible(
        context,
        [
          r("combo", "topic", "secondary"),
          r("combo", "region", "secondary"),
          r("topic", "topic"),
          r("region", "region"),
          r("committee", "committee"),
          r("secondary", "topic", "secondary"),
        ],
        [],
      ).map((c) => c.userId),
    ).toEqual(["combo", "topic", "secondary", "region", "committee"]);
  });
  it("stuft Abwesende hinter verfügbare Sekundärzuständigkeit und liefert Hinweis-IDs", () => {
    const result = suggestResponsible(
      context,
      [r("a", "topic"), r("b", "topic", "secondary")],
      ["a"],
    );
    expect(result[0]).toMatchObject({ userId: "b", absentUserIds: ["a"] });
    expect(result[1].reason).toContain("abwesend");
  });
  it("liefert ohne Treffer keine Kandidaten", () =>
    expect(suggestResponsible({}, [r("a", "topic")], [])).toEqual([]));
  it("bricht Gleichstand stabil nach User-ID, unabhängig von Eingabereihenfolge", () => {
    const rows = [r("b", "topic"), r("a", "topic"), r("a", "topic")];
    expect(suggestResponsible(context, rows, [])).toEqual(
      suggestResponsible(context, [...rows].reverse(), []),
    );
    expect(suggestResponsible(context, rows, []).map((c) => c.userId)).toEqual([
      "a",
      "b",
    ]);
  });
  it("findet aktive Lücken aller Kategorien und verändert Eingaben nicht", () => {
    const catalog = {
      topics: [{ id: "x" }, { id: "inactive", is_active: false }],
      committees: [{ id: "c", name: "Ausschuss" }],
      regions: [{ id: "r", name: "Region" }],
    };
    expect(
      findCoverageGaps(catalog, [r("a", "topic", "secondary")]).map(
        (g) => g.id,
      ),
    ).toEqual(["c", "r"]);
    expect(catalog.topics).toHaveLength(2);
  });
});
