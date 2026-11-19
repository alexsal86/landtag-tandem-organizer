import winners from "./officialDistrictWinners2026.json";
import type { SeatCandidate, SeatDistrict } from "./types";

// Source: https://wahlen.statistik-bw.de/ltw26/ (Gewählte in Wahlkreisen).
const officialWinners: Record<
  string,
  { district: string; name: string; party: string }
> = winners;

export function officialDistrictWinner(number: number) {
  return officialWinners[number];
}

export function districtLabel(district: SeatDistrict) {
  const name =
    officialDistrictWinner(district.number)?.district ?? district.name;
  return name ? `${district.number} · ${name}` : String(district.number);
}

export function districtCandidateLabel(candidate: SeatCandidate) {
  const party = candidate.partyId ?? "Einzelbewerbung";
  return candidate.name === party ? party : `${candidate.name} · ${party}`;
}

export function officialDistrictWinnerLabel(number: number) {
  const winner = officialDistrictWinner(number);
  return winner ? `${winner.name} · ${winner.party}` : "—";
}
