import type { StateResult } from "../../types";
import { allocateBw2026 } from "./seats";
import type { SeatParty } from "./types";
export const STATE_RELEASE = "official-final-2026-state-20260327";
export const STATE_SOURCE =
  "https://im.baden-wuerttemberg.de/de/land-kommunen/lebendige-demokratie/wahlen/landtagswahl-2026";
export function parsePartyArray(value: unknown): SeatParty[] {
  if (!Array.isArray(value) || !value.length || value.length > 60)
    throw new Error("Parteienliste fehlt.");
  return value.map((v) => {
    if (
      !v ||
      typeof v !== "object" ||
      !("id" in v) ||
      typeof v.id !== "string" ||
      !("name" in v) ||
      typeof v.name !== "string" ||
      !("votes" in v) ||
      typeof v.votes !== "number" ||
      !Number.isSafeInteger(v.votes) ||
      v.votes < 0 ||
      !("direct" in v) ||
      typeof v.direct !== "number" ||
      !Number.isSafeInteger(v.direct) ||
      v.direct < 0 ||
      !("hasList" in v) ||
      typeof v.hasList !== "boolean"
    )
      throw new Error("Ungültige Partei im Schnappschuss.");
    return {
      id: v.id,
      name: v.name,
      votes: v.votes,
      direct: v.direct,
      hasList: v.hasList,
    };
  });
}
export function officialStateParties(rows: StateResult[]): SeatParty[] {
  if (
    rows.length !== 21 ||
    rows.some(
      (r) =>
        r.year !== 2026 ||
        r.ballot !== "second" ||
        r.data_release !== STATE_RELEASE ||
        r.valid_votes !== 5375109 ||
        r.votes == null ||
        r.direct_seats == null,
    )
  )
    throw new Error(
      "Vollständige amtliche Landesdaten 2026 fehlen oder wurden abweichend korrigiert. Quellenmigration und Freigabecockpit prüfen.",
    );
  return rows.map((r) => ({
    id: r.party,
    name: r.party,
    votes: r.votes!,
    hasList: true,
    direct: r.direct_seats!,
  }));
}
/** Production reference comparison, not an assertion that the unexecuted test suite passed. */
export function referenceComparison(parties: SeatParty[]) {
  const result = allocateBw2026({ parties, validSecond: 5375109 });
  const expected: Record<string, number> = {
    GRÜNE: 56,
    CDU: 56,
    SPD: 10,
    AfD: 35,
  };
  return {
    matches:
      result.total === 157 &&
      result.rows.every((r) => r.total === (expected[r.id] || 0)),
    result,
  };
}
export function secondVoteScenario(
  parties: SeatParty[],
  valid: number,
  deltas: Record<string, number>,
  balancing: string,
) {
  if (
    !parties.some((p) => p.id === balancing && p.hasList) ||
    Object.entries(deltas).some(
      ([id, n]) =>
        !parties.some((p) => p.id === id && p.hasList) ||
        !Number.isFinite(n) ||
        Math.abs(n) > 100,
    )
  )
    throw new Error("Ungültige Zweitstimmenannahme.");
  const changes = {
    ...deltas,
    [balancing]: -parties
      .filter((p) => p.hasList && p.id !== balancing)
      .reduce((s, p) => s + (deltas[p.id] || 0), 0),
  };
  const desired = parties.map(
    (p) => (p.votes / valid) * 100 + (p.hasList ? changes[p.id] || 0 : 0),
  );
  if (desired.some((n) => n < 0 || n > 100))
    throw new Error(
      "Zielanteile außerhalb 0–100 %. Ausgleichspartei oder Annahmen ändern.",
    );
  if (!Object.values(changes).some((v) => v !== 0)) return { parties, changes };
  const raw = desired.map((n) => (n / 100) * valid),
    votes = raw.map(Math.floor),
    left = valid - votes.reduce((a, b) => a + b, 0),
    order = raw
      .map((v, i) => ({ i, remainder: v - Math.floor(v) }))
      .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  if (left < 0 || left > parties.length)
    throw new Error("Stimmenrundung nicht stabil.");
  for (let i = 0; i < left; i++) votes[order[i].i]++;
  return {
    parties: parties.map((p, i) => ({ ...p, votes: votes[i] })),
    changes,
  };
}
export function directTransferThreshold(
  candidates: { id: string; votes: number }[],
  target: string,
) {
  const challenger = candidates.find((c) => c.id === target);
  if (
    !challenger ||
    candidates.some((c) => !Number.isSafeInteger(c.votes) || c.votes < 0)
  )
    return null;
  const sorted = candidates.slice().sort((a, b) => b.votes - a.votes);
  const winner = sorted.find((c) => c.id !== target);
  if (!winner) return 0;
  if (challenger.votes > winner.votes) return 0;
  const others = Math.max(
    0,
    ...candidates
      .filter((c) => c.id !== winner.id && c.id !== target)
      .map((c) => c.votes),
  );
  const transfer = Math.max(
    0,
    Math.floor((winner.votes - challenger.votes) / 2) + 1,
    others - challenger.votes + 1,
  );
  return transfer <= winner.votes ? transfer : null;
}
