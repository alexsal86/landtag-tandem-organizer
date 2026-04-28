import { supabase } from "@/integrations/supabase/client";

export type PendingMeetingRequest = {
  id: string;
  employee_id: string;
  reason: string;
  status: string;
  created_at: string;
  employee_name?: string;
};

export async function fetchPendingMeetingRequests(tenantId: string): Promise<PendingMeetingRequest[]> {
  const { data: requestsData, error: requestsError } = await supabase
    .from("employee_meeting_requests")
    .select("id, employee_id, reason, status, created_at, scheduled_meeting_id")
    .eq("status", "pending")
    .is("scheduled_meeting_id", null)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (requestsError) throw requestsError;

  const employeeIds = Array.from(new Set((requestsData || []).map((request: Record<string, any>) => request.employee_id)));

  // Cleanup: pending requests are considered processed if a meeting was already created afterwards
  if (employeeIds.length > 0 && requestsData && requestsData.length > 0) {
    const { data: existingMeetings } = await supabase
      .from("employee_meetings")
      .select("id, employee_id, created_at")
      .in("employee_id", employeeIds)
      .eq("tenant_id", tenantId);

    const latestMeetingByEmployee = new Map<string, { id: string; created_at: string }>();
    (existingMeetings || []).forEach((meeting: { id: string; employee_id: string; created_at: string }) => {
      const current = latestMeetingByEmployee.get(meeting.employee_id);
      if (!current || new Date(meeting.created_at).getTime() > new Date(current.created_at).getTime()) {
        latestMeetingByEmployee.set(meeting.employee_id, { id: meeting.id, created_at: meeting.created_at });
      }
    });

    const staleRequestUpdates = requestsData
      .filter((request: Record<string, any>) => {
        const latestMeeting = latestMeetingByEmployee.get(request.employee_id);
        return latestMeeting && new Date(latestMeeting.created_at).getTime() >= new Date(request.created_at).getTime();
      })
      .map((request: Record<string, any>) => {
        const latestMeeting = latestMeetingByEmployee.get(request.employee_id);
        return latestMeeting
          ? supabase
              .from("employee_meeting_requests")
              .update({
                status: "completed",
                scheduled_meeting_id: latestMeeting.id,
                updated_at: new Date().toISOString(),
              })
              .eq("id", request.id)
          : null;
      })
      .filter(Boolean) as PromiseLike<unknown>[];

    if (staleRequestUpdates.length > 0) {
      await Promise.all(staleRequestUpdates);
    }
  }

  const { data: refreshedRequests, error: refreshedRequestsError } = await supabase
    .from("employee_meeting_requests")
    .select("id, employee_id, reason, status, created_at")
    .eq("status", "pending")
    .is("scheduled_meeting_id", null)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (refreshedRequestsError) throw refreshedRequestsError;

  const effectiveRequests = refreshedRequests || [];
  const effectiveEmployeeIds = effectiveRequests.map((request: Record<string, any>) => request.employee_id);

  if (effectiveEmployeeIds.length === 0) {
    return [];
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, display_name")
    .in("user_id", effectiveEmployeeIds);

  const profileMap = new Map(profiles?.map((profile: Record<string, any>) => [profile.user_id, profile.display_name]) || []);

  return effectiveRequests.map((request: Record<string, any>) => ({
    ...request,
    employee_name: profileMap.get(request.employee_id) || "Unbekannt",
  }));
}

export async function fetchPendingMeetingRequestsCount(tenantId: string): Promise<number> {
  const { count, error } = await supabase
    .from("employee_meeting_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .is("scheduled_meeting_id", null)
    .eq("tenant_id", tenantId);

  if (error) throw error;
  return count || 0;
}
