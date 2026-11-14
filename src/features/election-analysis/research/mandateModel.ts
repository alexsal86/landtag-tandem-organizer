import type {
  ElectionHistoryData,
  ElectionPeriod,
  HistoricalMandate,
} from "@/features/election-history/types";
import type { DistrictVersion } from "./types";

export type MandateKind = "direct" | "second" | "list" | "unclassified";
export function mandateKind(m: HistoricalMandate): MandateKind {
  if (m.mandate_type === "direct") return "direct";
  if (/zweitmandat/i.test(m.original_mandate || "")) return "second";
  if (/liste/i.test(m.original_mandate || "")) return "list";
  return "unclassified";
}
/** Deduplicate only confirmed identity, never historical names. Contradictory entries are excluded. */
export function electedMandates(mandates: HistoricalMandate[]) {
  const grouped = new Map<string, HistoricalMandate[]>();
  for (const m of mandates.filter((m) => m.entry_type === "election")) {
    const key = m.person_id ? `${m.period_id}:${m.person_id}` : m.id;
    grouped.set(key, [...(grouped.get(key) || []), m]);
  }
  const rows: HistoricalMandate[] = [];
  let conflicts = 0,
    duplicates = 0;
  for (const group of grouped.values()) {
    if (new Set(group.map((m) => `${m.party}:${mandateKind(m)}`)).size > 1) {
      conflicts += group.length;
      continue;
    }
    rows.push(group[0]);
    duplicates += group.length - 1;
  }
  return { rows, conflicts, duplicates };
}
export function mandateCounts(data: ElectionHistoryData) {
  const elected = electedMandates(data.mandates);
  const parties = new Set(data.mandates.map((m) => m.party));
  return {
    conflicts: elected.conflicts,
    duplicates: elected.duplicates,
    rows: [...parties]
      .sort()
      .map((party) => ({
        party,
        direct: elected.rows.filter(
          (m) => m.party === party && mandateKind(m) === "direct",
        ).length,
        second: elected.rows.filter(
          (m) => m.party === party && mandateKind(m) === "second",
        ).length,
        list: elected.rows.filter(
          (m) => m.party === party && mandateKind(m) === "list",
        ).length,
        unclassified: elected.rows.filter(
          (m) => m.party === party && mandateKind(m) === "unclassified",
        ).length,
        successors: data.mandates.filter(
          (m) => m.party === party && m.entry_type === "succession",
        ).length,
        unlinked: data.mandates.filter((m) => m.party === party && !m.person_id)
          .length,
      })),
  };
}
/** Closed intervals only; dates inclusive. Never turn an expected future term end into service already performed. */
export function mandateDays(
  m: HistoricalMandate,
  period: ElectionPeriod,
  asOf: string,
): number | null {
  const parse = (s: string | null) => {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const n = Date.parse(`${s}T00:00:00Z`);
    return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === s
      ? n
      : null;
  };
  const start = parse(m.starts_on),
    end = parse(m.ends_on),
    today = parse(asOf);
  if (
    start == null ||
    end == null ||
    today == null ||
    end < start ||
    end > today ||
    (m.end_from_period && period.ends_on_is_expected)
  )
    return null;
  return (end - start) / 86_400_000 + 1;
}
export interface PersonTransition {
  personId: string;
  name: string;
  partyBefore: string;
  partyAfter: string;
  kindBefore: MandateKind;
  kindAfter: MandateKind;
  reelected: boolean;
  typeChanged: boolean;
}
export function personTransitions(
  before: ElectionHistoryData,
  after: ElectionHistoryData,
): PersonTransition[] {
  const previous = electedMandates(before.mandates).rows.filter(
    (m) => m.person_id,
  );
  const current = electedMandates(after.mandates).rows.filter(
    (m) => m.person_id,
  );
  return current.flatMap((m) => {
    const old = previous.find((p) => p.person_id === m.person_id);
    if (!old || !m.person_id) return [];
    const kindBefore = mandateKind(old),
      kindAfter = mandateKind(m);
    return [
      {
        personId: m.person_id,
        name:
          after.people.find((p) => p.id === m.person_id)?.name ||
          m.person_name ||
          "Name fehlt",
        partyBefore: old.party,
        partyAfter: m.party,
        kindBefore,
        kindAfter,
        reelected: true,
        typeChanged:
          kindBefore !== "unclassified" &&
          kindAfter !== "unclassified" &&
          (kindBefore === "direct") !== (kindAfter === "direct"),
      },
    ];
  });
}
export interface DirectPartyChange {
  districtNumber: number;
  districtName: string;
  partyBefore: string | null;
  partyAfter: string | null;
  changed: boolean | null;
  reason: string | null;
}
export function directPartyChanges(
  before: ElectionHistoryData,
  after: ElectionHistoryData,
  versions: DistrictVersion[],
): DirectPartyChange[] {
  const beforePeriod = before.periods[0],
    afterPeriod = after.periods[0];
  return after.districts.map((d) => {
    const anchor = versions.find(
      (v) =>
        v.historical_district_id === d.id &&
        v.history_link_verified &&
        v.year === afterPeriod?.election_year,
    );
    const matches = anchor?.identity_key
      ? versions.filter(
          (v) =>
            v.year === beforePeriod?.election_year &&
            v.identity_key === anchor.identity_key &&
            v.history_link_verified,
        )
      : [];
    const oldDistrict =
      matches.length === 1
        ? before.districts.find(
            (p) => p.id === matches[0].historical_district_id,
          )
        : undefined;
    const old = before.mandates.filter(
      (m) =>
        oldDistrict &&
        m.district_id === oldDistrict.id &&
        m.mandate_type === "direct" &&
        m.entry_type === "election",
    );
    const next = after.mandates.filter(
      (m) =>
        m.district_id === d.id &&
        m.mandate_type === "direct" &&
        m.entry_type === "election",
    );
    const oldParties = new Set(old.map((m) => m.party)),
      nextParties = new Set(next.map((m) => m.party));
    // An identical party label does not resolve two different or unlinked elected people.
    const unambiguous = (rows: HistoricalMandate[]) =>
      rows.length === 1 ||
      (rows.length > 1 &&
        rows.every(
          (m) =>
            !!m.person_id &&
            m.person_id === rows[0].person_id &&
            m.party === rows[0].party,
        ));
    const comparable =
      !!oldDistrict &&
      oldParties.size === 1 &&
      nextParties.size === 1 &&
      unambiguous(old) &&
      unambiguous(next);
    return {
      districtNumber: d.district_number ?? 0,
      districtName: d.name,
      partyBefore: comparable ? old[0].party : null,
      partyAfter: comparable ? next[0].party : null,
      changed: comparable ? old[0].party !== next[0].party : null,
      reason: !oldDistrict
        ? "Keine bestätigte gemeinsame Gebietsidentität."
        : !comparable
          ? "Direktmandat fehlt oder ist mehrdeutig."
          : null,
    };
  });
}

/** A reviewer attests completeness; structural checks also run against the currently loaded period. */
export function candidateCoverageReady(
  data: ElectionHistoryData,
  coverage: import("./types").CandidateCoverage | null | undefined,
): boolean {
  const period = data.periods[0];
  const rows = data.candidacies.filter((c) => c.district_id != null);
  return (
    !!period &&
    !!coverage?.is_complete &&
    coverage.period_id === period.id &&
    !!coverage.reviewed_at &&
    !!coverage.source_url?.startsWith("https://") &&
    coverage.expected_district_candidacies === rows.length &&
    data.districts.length > 0 &&
    new Set(rows.map((c) => c.district_id)).size === data.districts.length &&
    rows.every(
      (c) =>
        c.votes != null &&
        c.vote_share != null &&
        c.outcome !== "unknown" &&
        data.districts.some((d) => d.id === c.district_id),
    )
  );
}
export function candidateComparison(
  data: ElectionHistoryData,
  versions: DistrictVersion[],
  reference: import("../types").DistrictResult[],
  verified: import("./types").VerifiedCandidate[],
) {
  const period = data.periods[0];
  return data.candidacies
    .filter((c) => c.district_id != null)
    .map((c) => {
      const version = versions.find(
        (v) =>
          v.history_link_verified &&
          v.historical_district_id === c.district_id &&
          v.year === period?.election_year,
      );
      const party = version
        ? reference.find(
            (r) =>
              r.year === version.year &&
              r.ballot === "second" &&
              r.district_number === version.district_number &&
              r.party === c.party,
          )
        : undefined;
      const official = version
        ? verified.find(
            (r) =>
              r.year === version.year &&
              r.district_number === version.district_number &&
              r.party === c.party &&
              r.verified &&
              r.person_id === c.person_id,
          )
        : undefined;
      const ready =
        !!party &&
        party.share != null &&
        !party.preliminary &&
        !!official?.data_release &&
        official.data_release === party.data_release &&
        c.ballot_type === "first_vote" &&
        c.votes != null &&
        official.votes === c.votes &&
        c.vote_share != null &&
        official.share != null &&
        Math.abs(official.share - c.vote_share) <= 0.051;
      return {
        candidacy: c,
        districtNumber: version?.district_number ?? null,
        partyResult: party,
        difference:
          ready && party.share != null ? c.vote_share! - party.share : null,
        reason: ready
          ? null
          : "Gebiets-/Personenverknüpfung oder gemeinsamer endgültiger Datenstand nicht bestätigt.",
      };
    });
}
