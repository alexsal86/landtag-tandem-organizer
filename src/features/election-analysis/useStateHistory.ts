import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { parties } from './model';
import type { Ballot } from './types';
/** The selected, bounded range is loaded only in the state-history section. */
export function useStateHistory(from: number, to: number) {
    const { user } = useAuth();
    return useQuery({ queryKey: ['election-state-history', user?.id, from, to], enabled: !!user && from > 0 && to >= from,
        queryFn: async ({ signal }) => {
            const replies = await Promise.all([
                supabase.from('election_analysis_state_totals').select('*').gte('year', from).lte('year', to).order('year').limit(40).abortSignal(signal),
                supabase.from('election_analysis_state').select('*').gte('year', from).lte('year', to).in('ballot', ['single', 'second']).in('party', parties).order('year').order('party').limit(200).abortSignal(signal),
            ]);
            const [totals, state] = replies;
            if (totals.error)
                throw totals.error;
            if (state.error)
                throw state.error;
            // One selected denominator per election. Never aggregate first and second votes.
            return { totals: (totals.data || []).filter(r => r.ballot === (r.year >= 2026 ? 'second' : 'single')),
                state: (state.data || []).filter(r => r.ballot === (r.year >= 2026 ? 'second' : 'single') && !(r.party === 'AfD' && r.year < 2013)) };
        }, staleTime: 300000, gcTime: 120000, retry: false });
}
export function useFlowMatrix(year: number) {
    const { user } = useAuth();
    return useQuery({ queryKey: ['election-flow-matrix', user?.id, year], enabled: !!user && year > 0,
        queryFn: async ({ signal }) => {
            const { data, error } = await supabase.from('election_analysis_flow_matrix').select('*').eq('year', year).order('source_row').order('origin').limit(200).abortSignal(signal);
            if (error)
                throw error;
            return data || [];
        }, staleTime: 300000, gcTime: 120000, retry: false });
}
export function useWorkbookAudit(year: number, section?: 'state' | 'flows' | 'matrix' | 'totals') {
    const { user } = useAuth();
    return useQuery({ queryKey: ['election-workbook-audit', user?.id, year, section], enabled: !!user && year > 0,
        queryFn: async ({ signal }) => {
            let query = supabase.from('election_analysis_workbook_audit').select('*').eq('year', year);
            if (section)
                query = query.eq('section', section);
            const { data, error } = await query.order('status').order('section').order('record_key').limit(300).abortSignal(signal);
            if (error)
                throw error;
            return data || [];
        }, staleTime: 300000, gcTime: 120000, retry: false });
}
export function useStateTotal(year: number, ballot: Ballot) {
    const { user } = useAuth();
    return useQuery({ queryKey: ['election-state-total', user?.id, year, ballot], enabled: !!user && year > 0,
        queryFn: async ({ signal }) => {
            const { data, error } = await supabase.from('election_analysis_state_totals').select('*').eq('year', year).eq('ballot', ballot).abortSignal(signal).maybeSingle();
            if (error)
                throw error;
            return data;
        }, staleTime: 300000, gcTime: 120000, retry: false });
}
