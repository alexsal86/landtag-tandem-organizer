import type { Ballot } from './types';
export interface StateTotal {
    year: number;
    ballot: Ballot;
    election_date: string;
    eligible: number;
    voters: number;
    valid_votes: number;
    invalid_votes: number;
    source_url: string;
    source_sheet: string;
    source_row: number;
    workbook_sha256: string;
    source_verified: boolean;
}
export interface FlowCell {
    year: number;
    previous_year: number;
    origin: string;
    destination: string;
    persons: number;
    source_url: string;
    source_sheet: string;
    source_row: number;
    workbook_sha256: string;
    source_verified: boolean;
}
export interface WorkbookAudit {
    id: string;
    year: number;
    section: 'state' | 'totals' | 'flows' | 'matrix';
    record_key: string;
    source_url: string;
    source_sheet: string;
    source_row: number;
    workbook_sha256: string;
    compared_at: string;
    status: 'added' | 'matched' | 'conflict';
    incoming: import('@/integrations/supabase/types').Json;
    existing: import('@/integrations/supabase/types').Json;
    notes: string;
}
type Relation<T> = {
    Row: {
        [K in keyof T]: T[K];
    };
    Insert: {
        [K in keyof T]?: T[K];
    };
    Update: {
        [K in keyof T]?: T[K];
    };
    Relationships: [
    ];
};
export type StateHistoryTables = {
    election_analysis_state_totals: Relation<StateTotal>;
    election_analysis_flow_matrix: Relation<FlowCell>;
    election_analysis_workbook_audit: Relation<WorkbookAudit>;
};
/** One electorate per year; no second addition of first-vote denominators. */
export function stateTotalMetrics(row: StateTotal) {
    return { ...row, nonvoters: row.eligible - row.voters,
        turnout: row.voters / row.eligible * 100,
        invalidShare: row.voters > 0 ? row.invalid_votes / row.voters * 100 : null };
}
/** Matrix axes are asymmetric: newcomers are origins, deaths are destinations.
 * Do not mirror cells or turn a missing flow into zero. */
export function matrixAxes(cells: FlowCell[]) {
    return { origins: [...new Set(cells.map(c => c.origin))], destinations: [...new Set(cells.map(c => c.destination))] };
}
export function matrixCell(cells: FlowCell[], origin: string, destination: string): number | null {
    return cells.find(c => c.origin === origin && c.destination === destination)?.persons ?? null;
}
