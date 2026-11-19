import { isRecord } from "@/utils/typeSafety";
import type { Database } from "@/integrations/supabase/types";
import { roundDistrictVotes } from "./districtModel";
import type { SeatParty } from "./types";

export const POLL_FEATURED_PARTIES = [
  "GRÜNE",
  "CDU",
  "AfD",
  "SPD",
  "Die Linke",
  "FDP",
] as const;
export const POLL_METHODS = [
  "Telefon",
  "Online",
  "Persönlich",
  "Telefon und Online",
  "Gemischt",
  "Nicht angegeben",
];
export type BwPoll =
  Database["public"]["Tables"]["election_analysis_bw_polls"]["Row"];

export function pollDate(date: string) {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : new Intl.DateTimeFormat("de-DE", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(parsed);
}

export function pollPartyBasis(
  parties: SeatParty[],
  valid: number,
  poll: BwPoll,
) {
  if (
    !isRecord(poll.shares) ||
    !Number.isFinite(poll.others) ||
    poll.others < 0 ||
    !POLL_FEATURED_PARTIES.every((id) =>
      Object.prototype.hasOwnProperty.call(poll.shares, id),
    )
  )
    throw new Error(
      "Die Umfrage enthält keine vollständigen Zweitstimmenanteile.",
    );
  const entries = Object.entries(poll.shares);
  if (
    entries.some(
      ([id, share]) =>
        typeof share !== "number" ||
        !Number.isFinite(share) ||
        share < 0 ||
        share > 100 ||
        !parties.some((party) => party.hasList && party.id === id),
    ) ||
    Math.abs(
      entries.reduce((sum, [, share]) => sum + Number(share), poll.others) -
        100,
    ) > 1e-8
  )
    throw new Error(
      "Umfrageanteile müssen zusammen 100 % ergeben und zu den Landeslisten passen.",
    );
  const shares = new Map(entries.map(([id, share]) => [id, Number(share)]));
  const remaining = parties.filter(
    (party) => party.hasList && !shares.has(party.id),
  );
  const remainingVotes = remaining.reduce((sum, party) => sum + party.votes, 0);
  if (poll.others && !remainingVotes)
    throw new Error(
      "Die übrigen Umfrageanteile können keiner Landesliste zugeordnet werden.",
    );
  const weights = parties.map(
    (party) =>
      shares.get(party.id) ??
      (party.hasList && remainingVotes
        ? (poll.others * party.votes) / remainingVotes
        : 0),
  );
  const votes = roundDistrictVotes(weights, valid);
  return parties.map((party, index) => ({ ...party, votes: votes[index] }));
}

export function readBwPoll(value: unknown): BwPoll | undefined {
  if (
    !isRecord(value) ||
    !isRecord(value.shares) ||
    typeof value.others !== "number" ||
    typeof value.respondents !== "number" ||
    ![
      "id",
      "institute",
      "commissioner",
      "published_on",
      "field_start",
      "field_end",
      "method",
      "question_type",
      "source_url",
    ].every((key) => typeof value[key] === "string")
  )
    return undefined;
  return value as BwPoll;
}
