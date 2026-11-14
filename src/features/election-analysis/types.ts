export type Ballot = 'single' | 'first' | 'second';
export interface AnalysisYear { year: number; period_number: number; is_published: boolean; notes: string | null }
export interface StateResult { year: number; ballot: Ballot; party: string; votes: number | null; share: number | null; seats: number | null; valid_votes: number | null; notes: string | null }
export interface DistrictResult { year: number; ballot: Ballot; district_number: number; district_name: string; party: string; votes: number | null; share: number | null; preliminary: boolean; notes: string | null }
export interface Turnout { year: number; ballot: Ballot; district_number: number; district_name: string; eligible: number | null; voters: number | null; valid_votes: number | null; turnout: number | null; preliminary: boolean; notes: string | null }
export interface VoterFlow { year: number; previous_year: number; target_party: string; partner: string; inflow: number | null; outflow: number | null; balance: number | null; notes: string | null }
export interface Demographic { year: number; ballot: Ballot; party: string; gender: string; age_group: string; share: number | null; notes: string | null }
type Table<T> = { Row: { [K in keyof T]: T[K] }; Insert: { [K in keyof T]: T[K] }; Update: Partial<T>; Relationships: [] };
export type ElectionAnalysisTables = {
  election_analysis_years: Table<AnalysisYear>;
  election_analysis_state: Table<StateResult>;
  election_analysis_districts: Table<DistrictResult>;
  election_analysis_turnout: Table<Turnout>;
  election_analysis_flows: Table<VoterFlow>;
  election_analysis_demographics: Table<Demographic>;
};
export interface AnalysisRows { state: StateResult; districts: DistrictResult; turnout: Turnout; flows: VoterFlow; demographics: Demographic }
export type AnalysisSection = keyof AnalysisRows;
