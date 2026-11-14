import type { Json } from "@/integrations/supabase/types";
import type { Ballot, DistrictResult, Turnout, StateResult } from "../types";
export interface Geography {
  id: string;
  year: number;
  source_url: string;
  sha256: string;
  asset_path: string | null;
  verified: boolean;
  notes: string | null;
}
export interface DistrictVersion {
  year: number;
  district_number: number;
  district_name: string;
  geography_id: string | null;
  identity_key: string | null;
  historical_district_id: string | null;
  history_link_verified: boolean;
  notes: string | null;
}
export interface VerifiedCandidate {
  data_release?: string | null;
  year: number;
  district_number: number;
  party: string;
  candidate_name: string;
  votes: number | null;
  share: number | null;
  source_url: string;
  verified: boolean;
  person_id: string | null;
}
export interface SourceReview {
  id: string;
  kind: string;
  source_url: string;
  sha256: string;
  retrieved_at: string;
  status: "pending" | "verified" | "conflict";
  summary: Json;
}
export interface PeriodProposal {
  period_number: number;
  election_year: number;
  election_date: string | null;
  starts_on: string | null;
  ends_on: string | null;
  expected_ends_on: string | null;
  election_source_url: string;
  term_source_url: string;
  verified: boolean;
  notes: string | null;
}
type Table<T> = {
  Row: { [K in keyof T]: T[K] };
  Insert: { [K in keyof T]: T[K] };
  Update: Partial<T>;
  Relationships: [];
};
export interface CandidateCoverage {
  period_id: string;
  is_complete: boolean;
  expected_district_candidacies: number | null;
  source_url: string | null;
  reviewed_at: string | null;
  notes: string | null;
}
export type ElectionResearchTables = {
  election_analysis_candidate_coverage: Table<CandidateCoverage>;
  election_analysis_geographies: Table<Geography>;
  election_analysis_versions: Table<DistrictVersion>;
  election_analysis_candidates: Table<VerifiedCandidate>;
  election_analysis_source_reviews: Table<SourceReview>;
  election_analysis_period_proposals: Table<PeriodProposal>;
};
export interface DistrictSeries {
  results: DistrictResult[];
  turnout: Turnout[];
  state: StateResult[];
  versions: DistrictVersion[];
}
export interface DistrictHistoryRow {
  period_id: string;
  period_name: string;
  period_number: number;
  district_id: string;
  district_name: string;
  mandate_id: string;
  person_id: string | null;
  person_name: string;
  party: string;
  mandate_type: string;
  original_mandate: string | null;
  entry_type: string;
  starts_on: string | null;
  ends_on: string | null;
  start_from_period: boolean;
  end_from_period: boolean;
  end_is_expected: boolean;
  notes: string | null;
}
export type Metric = "pp" | "votes" | "relative";
export interface ComparisonValue {
  districtNumber: number;
  districtName: string;
  party: string;
  before: DistrictResult | undefined;
  after: DistrictResult | undefined;
  swing: number | null;
  voteDelta: number | null;
  stateSwing: number | null;
  relativeSwing: number | null;
  comparable: boolean;
  warnings: string[];
}
export interface ValidationIssue {
  code: string;
  severity: "error" | "warning";
  year: number;
  district?: number;
  party?: string;
  ballot?: Ballot;
  message: string;
}
