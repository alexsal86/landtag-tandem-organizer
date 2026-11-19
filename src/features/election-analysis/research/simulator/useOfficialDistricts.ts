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
import { referenceComparison } from "./model";
import { BW_RULES_VERSION, type SeatParty } from "./types";

export const DISTRICT_RELEASE = "official-final-2026-districts-20260327";
const loadVoteReference = async () =>
  (await import("./officialDistricts2026.json")).default;
type VoteReference = Awaited<ReturnType<typeof loadVoteReference>>;

export function useOfficialDistricts(enabled: boolean) {
  const periods = useElectionPeriods(enabled);
  const period = periods.data?.find(
    (period) =>
      period.number === 18 &&
      period.election_year === 2026 &&
      period.is_published,
  );
  const history = useElectionHistory(enabled ? period?.id : undefined);
  const factions = useHistoryFactions(enabled);
  const voteReference = useQuery({
    queryKey: ["election-research", "seat-district-votes", DISTRICT_RELEASE],
    enabled,
    retry: false,
    staleTime: Infinity,
    queryFn: loadVoteReference,
  });

  return {
    data:
      enabled && history.data && factions.data && voteReference.data
        ? {
            history: history.data,
            factions: factions.data,
            voteReference: voteReference.data,
          }
        : undefined,
    isFetching:
      enabled &&
      (periods.isFetching ||
        history.isFetching ||
        factions.isFetching ||
        voteReference.isFetching),
    error:
      periods.error ||
      history.error ||
      factions.error ||
      voteReference.error ||
      (enabled && periods.isSuccess && !period
        ? new Error("Der veröffentlichte Wahlkreisbestand 2026 fehlt.")
        : null),
  };
}

export function officialDistrictFile(
  data: {
    history: ElectionHistoryData;
    factions: HistoryFaction[];
    voteReference: VoteReference;
  },
  parties: SeatParty[],
) {
  const { history, factions, voteReference } = data;
  if (
    voteReference.data_release !== DISTRICT_RELEASE ||
    history.districts.length !== 70 ||
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
  const people = new Map(
    history.people.map((person) => [person.id, person.name]),
  );
  const districts = voteReference.districts.map((reference) => {
    const district = history.districts.find(
      (entry) => entry.district_number === reference.number,
    );
    if (!district)
      throw new Error(`Wahlkreis ${reference.number} fehlt im Bestand.`);
    const votes = new Map<string, number>(
      Object.entries(reference.firstVotesByParty)
        .filter(
          (entry): entry is [string, number] => typeof entry[1] === "number",
        )
        .map(([party, count]) => [factionKey(party), count]),
    );

    const candidates = history.candidacies
      .filter(
        (candidate) =>
          candidate.district_id === district.id &&
          candidate.ballot_type === "first_vote",
      )
      .map((candidate) => {
        const code = factionKey(factionResultCode(candidate.party, factions));
        const independent = [
          "einzelbewerber",
          "einzelbewerberin",
          "einzelbewerbung",
          "parteilos",
        ].includes(code);
        const party = allParties.find((party) => factionKey(party.id) === code);
        const voteKey = independent ? "einzelbewerber" : code;
        const count = votes.get(voteKey);
        const name = people.get(candidate.person_id);
        if ((!party && !independent) || count === undefined || !name)
          throw new Error(
            `Wahlkreis ${reference.number}: Die Erststimmen für ${name || candidate.party} lassen sich nicht eindeutig zuordnen.`,
          );
        votes.delete(voteKey);
        return {
          id: candidate.person_id,
          name,
          partyId: party?.id ?? null,
          votes: count,
        };
      });
    if (votes.size)
      throw new Error(
        `Wahlkreis ${reference.number}: Zum amtlichen Erststimmenergebnis fehlen Kandidaturen im Bestand.`,
      );
    return {
      number: reference.number,
      name: district.name,
      validFirst: reference.validFirst,
      candidates,
    };
  });

  const file = parseElectionFile({
    version: BW_RULES_VERSION,
    year: 2026,
    source_url: voteReference.source_url,
    data_release: voteReference.data_release,
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
