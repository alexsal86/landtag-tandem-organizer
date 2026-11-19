import { useQuery } from "@tanstack/react-query";
import {
  factionKey,
  factionResultCode,
  type HistoryFaction,
} from "@/features/election-history/factions";
import {
  useElectionHistory,
  useElectionPeriods,
} from "@/features/election-history/useElectionHistory";
import { useHistoryFactions } from "@/features/election-history/useHistoryFactions";
import type { ElectionHistoryData } from "@/features/election-history/types";
import { electionMandates, parseElectionFile } from "./electionFile";
import { officialDistrictWinner } from "./districtLabels";
import { referenceComparison } from "./model";
import { BW_RULES_VERSION, type SeatParty } from "./types";

export const DISTRICT_RELEASE = "official-final-2026-districts-20260327";
export const DISTRICT_PARTY_RELEASE = `${DISTRICT_RELEASE}-parties`;
const loadVoteReference = async () =>
  (await import("./officialDistricts2026.json")).default;
type VoteReference = Awaited<ReturnType<typeof loadVoteReference>>;

export function useOfficialDistricts(enabled: boolean, includePeople: boolean) {
  const periods = useElectionPeriods(enabled && includePeople);
  const period = periods.data?.find(
    (entry) =>
      entry.number === 18 && entry.election_year === 2026 && entry.is_published,
  );
  const history = useElectionHistory(
    enabled && includePeople ? period?.id : undefined,
  );
  const factions = useHistoryFactions(enabled && includePeople);
  const voteReference = useQuery({
    queryKey: ["election-research", "seat-district-votes", DISTRICT_RELEASE],
    enabled,
    retry: false,
    staleTime: Infinity,
    queryFn: loadVoteReference,
  });
  return {
    ...voteReference,
    history: includePeople ? history.data : undefined,
    factions: includePeople ? factions.data : undefined,
  };
}

export function officialDistrictFile(
  voteReference: VoteReference,
  parties: SeatParty[],
  history?: ElectionHistoryData,
  factions?: HistoryFaction[],
) {
  if (
    voteReference.data_release !== DISTRICT_RELEASE ||
    voteReference.districts.length !== 70 ||
    voteReference.districts.reduce(
      (sum, district) => sum + district.validFirst,
      0,
    ) !== 5359187 ||
    voteReference.districts.reduce(
      (sum, district) => sum + district.validSecond,
      0,
    ) !== 5375109
  )
    throw new Error("Amtliche Wahlkreisgrundlage ist unvollständig.");

  const districtOnlyParties = ["BÜNDNIS DEUTSCHLAND", "PIRATEN"].map((id) => ({
    id,
    name: id,
    votes: 0,
    direct: 0,
    hasList: false,
  }));
  const allParties = [...parties, ...districtOnlyParties];
  const partyByCode = new Map(
    allParties.map((party) => [factionKey(party.id), party]),
  );
  const people = new Map(
    history?.people.map((person) => [person.id, person.name]),
  );
  let hasAllNames = !!history && !!factions;
  const districts = voteReference.districts.map((reference) => {
    const incumbent = officialDistrictWinner(reference.number);
    const district = history?.districts.find(
      (entry) => entry.district_number === reference.number,
    );
    const entries =
      district && factions
        ? (history?.candidacies.filter(
            (entry) =>
              entry.district_id === district.id &&
              entry.ballot_type === "first_vote",
          ) ?? [])
        : [];
    const candidates = Object.entries(reference.firstVotesByParty)
      .filter(
        (entry): entry is [string, number] => typeof entry[1] === "number",
      )
      .map(([code, votes]) => {
        const key = factionKey(code);
        const party = partyByCode.get(key);
        const independent = key === "einzelbewerber";
        if (!party && !independent)
          throw new Error(
            `Wahlkreis ${reference.number}: Unbekannter Wahlvorschlag ${code}.`,
          );
        const matches = entries.filter((entry) => {
          const resultCode = factionKey(
            factionResultCode(entry.party, factions ?? []),
          );
          return independent
            ? [
                "einzelbewerber",
                "einzelbewerberin",
                "einzelbewerbung",
                "parteilos",
              ].includes(resultCode)
            : resultCode === key;
        });
        const name =
          matches.length === 1 ? people.get(matches[0].person_id) : undefined;
        if (!name) hasAllNames = false;
        return {
          id: `wk-${reference.number}-${party?.id ?? "einzelbewerbung"}`,
          name:
            party && incumbent?.party === party.id
              ? incumbent.name
              : (name ?? party?.name ?? "Einzelbewerbung"),
          partyId: party?.id ?? null,
          votes,
        };
      });
    return {
      number: reference.number,
      name: incumbent?.district ?? district?.name,
      validFirst: reference.validFirst,
      candidates,
    };
  });

  const file = parseElectionFile({
    version: BW_RULES_VERSION,
    year: 2026,
    source_url: voteReference.source_url,
    data_release: hasAllNames ? DISTRICT_RELEASE : DISTRICT_PARTY_RELEASE,
    validSecond: 5375109,
    parties: allParties,
    districts,
    lists: {},
    listsComplete: false,
  });
  const { parties: elected } = electionMandates(file);
  if (
    !referenceComparison(elected).matches ||
    elected.some(
      (party) =>
        party.direct !==
        allParties.find((official) => official.id === party.id)?.direct,
    )
  )
    throw new Error(
      "Die Wahlkreissieger stimmen nicht mit der amtlichen Landesreferenz überein.",
    );
  return file;
}
