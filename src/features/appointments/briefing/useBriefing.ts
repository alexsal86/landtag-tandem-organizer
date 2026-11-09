import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { BRIEFING_HORIZON_DAYS, type BriefingAction } from "../briefing";

export interface BriefingAppointment {
  id: string;
  title: string;
  start_time: string;
  location: string | null;
  briefing_status: string;
  briefing_assignee_id: string | null;
  briefing_due_at: string | null;
  briefing_instructions: string | null;
}

const KEY = "appointment-briefing";
const COLS = "id, title, start_time, location, briefing_status, briefing_assignee_id, briefing_due_at, briefing_instructions";

export function useUndecidedBriefings() {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: [KEY, "undecided", currentTenant?.id],
    enabled: !!currentTenant?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const now = new Date();
      const until = new Date(now.getTime() + BRIEFING_HORIZON_DAYS * 86400_000);
      const { data, error } = await supabase.from("appointments").select(COLS)
        .eq("tenant_id", currentTenant!.id).eq("briefing_status", "undecided")
        .gte("start_time", now.toISOString()).lte("start_time", until.toISOString())
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BriefingAppointment[];
    },
  });
}

export function useTodayApprovedBriefings(enabled = true) {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: [KEY, "today-approved", currentTenant?.id],
    enabled: enabled && !!currentTenant?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const s = new Date(); s.setHours(0, 0, 0, 0);
      const e = new Date(s); e.setDate(e.getDate() + 1);
      const { data, error } = await supabase.from("appointments").select(COLS)
        .eq("tenant_id", currentTenant!.id).eq("briefing_status", "approved")
        .gte("start_time", s.toISOString()).lt("start_time", e.toISOString())
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BriefingAppointment[];
    },
  });
}

export function useAppointmentBriefing(appointmentId: string | undefined) {
  return useQuery({
    queryKey: [KEY, "one", appointmentId],
    enabled: !!appointmentId,
    queryFn: async () => {
      const { data, error } = await supabase.from("appointments").select(COLS).eq("id", appointmentId!).maybeSingle();
      if (error) throw error;
      return data as BriefingAppointment | null;
    },
  });
}

export interface SetBriefingInput { appointmentId: string; decision: "none" | "assigned"; assignee?: string; due?: string; instructions?: string }

export function useBriefingMutations() {
  const qc = useQueryClient();
  const done = () => { qc.invalidateQueries({ queryKey: [KEY] }); qc.invalidateQueries({ queryKey: ["my-work-tasks"] }); };
  const setBriefing = useMutation({
    mutationFn: async (v: SetBriefingInput) => {
      const { error } = await supabase.rpc("set_appointment_briefing", {
        _appointment_id: v.appointmentId, _decision: v.decision,
        _assignee: v.assignee, _due: v.due, _instructions: v.instructions,
      });
      if (error) throw error;
    },
    onSuccess: done,
  });
  const advance = useMutation({
    mutationFn: async (v: { appointmentId: string; action: BriefingAction; note?: string }) => {
      const { error } = await supabase.rpc("advance_appointment_briefing", { _appointment_id: v.appointmentId, _action: v.action, _note: v.note });
      if (error) throw error;
    },
    onSuccess: done,
  });
  return { setBriefing, advance };
}
