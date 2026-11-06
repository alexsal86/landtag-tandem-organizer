import { appendCaseSource } from "@/features/cases/items/appointmentLink";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import type { AppointmentRequest, RequestChannel, RequestRecommendation } from "./logic";

const KEY = "appointment-requests";
const SELECT =
  "id, tenant_id, created_by, title, requester, channel, requested_date, requested_time, duration_minutes, location, response_deadline, notes, recommendation, recommendation_note, status, appointment_id, created_at";

export function useOpenAppointmentRequests() {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: [KEY, "open", currentTenant?.id],
    enabled: !!currentTenant?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointment_requests")
        .select(SELECT)
        .eq("tenant_id", currentTenant!.id)
        .eq("status", "open")
        .order("requested_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AppointmentRequest[];
    },
  });
}

/** Date (YYYY-MM-DD) of the next upcoming Jour fixe in this office, or null. */
export function useNextJourFixeDate() {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: [KEY, "next-jour-fixe", currentTenant?.id],
    enabled: !!currentTenant?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("meeting_date")
        .eq("tenant_id", currentTenant!.id)
        .gte("meeting_date", format(new Date(), "yyyy-MM-dd"))
        .neq("status", "archived")
        .order("meeting_date", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data?.meeting_date as string | undefined) ?? null;
    },
  });
}

export interface NewRequestInput {
  caseItemId?: string;
  title: string;
  requester: string;
  channel: RequestChannel;
  requested_date: string;
  requested_time: string;
  duration_minutes: number;
  location: string;
  response_deadline: string;
  notes: string;
}

export function useAppointmentRequestMutations() {
  const { currentTenant } = useTenant();
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [KEY] });
    qc.invalidateQueries({ queryKey: ["calendar-data"] });
  };

  const create = useMutation({
    mutationFn: async (input: NewRequestInput) => {
      if (!currentTenant?.id) throw new Error("Kein Büro ausgewählt");
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Nicht angemeldet");
      const { error } = await supabase.from("appointment_requests").insert({
        tenant_id: currentTenant.id,
        created_by: auth.user.id,
        title: input.title.trim(),
        requester: input.requester.trim() || null,
        channel: input.channel,
        requested_date: input.requested_date,
        requested_time: input.requested_time || null,
        duration_minutes: input.duration_minutes,
        location: input.location.trim() || null,
        response_deadline: input.response_deadline || null,
        notes: appendCaseSource(input.notes, input.caseItemId, window.location.origin) || null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const recommend = useMutation({
    mutationFn: async (v: { id: string; recommendation: RequestRecommendation | null; note: string }) => {
      const { error } = await supabase
        .from("appointment_requests")
        .update({ recommendation: v.recommendation, recommendation_note: v.note.trim() || null })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const decide = useMutation({
    mutationFn: async (v: { id: string; decision: "accepted" | "declined" }) => {
      const { error } = await supabase.rpc("decide_appointment_request", { _request_id: v.id, _decision: v.decision });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointment_requests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, recommend, decide, remove };
}
