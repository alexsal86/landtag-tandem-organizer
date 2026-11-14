import type { Json } from "@/integrations/supabase/types";
import type { Ballot } from "../types";
export interface StoredScenario {
  id: string;
  tenant_id: string;
  owner_id: string;
  name: string;
  description: string;
  visibility: "private" | "tenant";
  year: number;
  ballot: Ballot;
  model_version: "shares-v1" | "bw-lwg-2026-v1";
  data_release: string;
  params: Json;
  input_snapshot: Json;
  result_snapshot: Json;
  revision: number;
  created_at: string;
  updated_at: string;
}
export interface LocalResult {
  year: number;
  ballot: Ballot;
  district_number: number;
  unit_type: "municipality" | "ward";
  unit_key: string;
  name: string;
  party: string;
  boundary_key: string;
  eligible: number | null;
  voters: number | null;
  valid_votes: number;
  votes: number;
  data_release: string;
  source_url: string;
  preliminary: boolean;
  is_verified: boolean;
}
type Table<T> = {
  Row: { [K in keyof T]: T[K] };
  Insert: { [K in keyof T]: T[K] };
  Update: Partial<T>;
  Relationships: [];
};
export type WorkspaceTables = {
  election_analysis_scenarios: Table<StoredScenario>;
  election_analysis_local_results: Table<LocalResult>;
};
export type ScenarioIndex = Omit<
  StoredScenario,
  "params" | "input_snapshot" | "result_snapshot"
>;
