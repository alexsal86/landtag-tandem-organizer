export const BW_RULES_VERSION = "bw-lwg-2026-v1" as const;
export interface SeatParty {
  id: string;
  name: string;
  votes: number;
  hasList: boolean;
  direct: number;
}
export interface SeatPerson {
  id: string;
  name: string;
}
export interface SeatCandidate extends SeatPerson {
  partyId: string | null;
  votes: number;
}
export interface SeatDistrict {
  number: number;
  validFirst: number;
  candidates: SeatCandidate[];
}
export interface ElectionFile {
  version: typeof BW_RULES_VERSION;
  year: 2026;
  source_url: string;
  data_release: string;
  validSecond: number;
  parties: SeatParty[];
  districts: SeatDistrict[];
  lists: Record<string, SeatPerson[]>;
  listsComplete: boolean;
  excludedSecondVotes?: Record<string, number>;
  districtLots?: Record<string, string>;
  baseSeatLots?: string[];
}
export interface SeatInput {
  parties: SeatParty[];
  validSecond: number;
  specialDirect?: number;
  specialFirstVotes?: number;
  excludedSecondVotes?: Record<string, number>;
  baseSeatLots?: string[];
}
export interface SeatRow {
  id: string;
  name: string;
  votes: number;
  eligible: boolean;
  direct: number;
  base: number;
  total: number;
  list: number;
  overhang: number;
  balance: number;
  majorityBonus: number;
}
export interface SeatResult {
  rows: SeatRow[];
  total: number;
  base: number;
  overhang: number;
  balance: number;
  majorityBonus: number;
  specialDirect: number;
  unallocated: number;
  warnings: string[];
}
