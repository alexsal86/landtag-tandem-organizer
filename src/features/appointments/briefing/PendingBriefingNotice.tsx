import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Button } from "@/components/ui/button";
import { needsBriefingReminder } from "../briefing";
import { CompactBriefingEditor } from "./CompactBriefingEditor";

const time = (value: string) => new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit",
}).format(new Date(value));

export function PendingBriefingNotice() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null);
  const { data = [], isError } = useQuery({
    queryKey: ["appointment-briefing", "pending-reminders", currentTenant?.id, user?.id],
    enabled: !!currentTenant?.id && !!user?.id,
    refetchInterval: 60_000,
    queryFn: async () => {
      const now = new Date();
      const { data, error } = await supabase.from("appointments")
        .select("id,title,start_time,briefing_status,briefing_assignee_id,briefing_due_at,status")
        .eq("tenant_id", currentTenant!.id)
        .in("briefing_status", ["undecided", "assigned"])
        .gt("start_time", now.toISOString())
        .or(`briefing_assignee_id.eq.${user!.id},briefing_assignee_id.is.null`)
        .order("start_time");
      if (error) throw error;
      return (data ?? []).filter(appointment =>
        appointment.status !== "cancelled" && appointment.status !== "canceled"
        && needsBriefingReminder(appointment, user!.id, now));
    },
  });

  return (
    <>
      {isError && <p role="status" className="text-sm text-destructive">Briefing-Hinweise konnten nicht geladen werden.</p>}
      {data.map(appointment => (
        <div key={appointment.id} role="status" className="flex flex-wrap items-center gap-2 rounded-xl bg-[#fdeeee] px-3 py-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-[#ff4b55]" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm leading-5 text-[#283342]">
            <strong className="font-semibold text-[#ff4b55]">Briefing fehlt:</strong>{" "}
            {appointment.title} {time(appointment.start_time)}
            {appointment.briefing_due_at && <span> – vorgesehen bis {new Intl.DateTimeFormat("de-DE", {
              timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
            }).format(new Date(appointment.briefing_due_at))} Uhr</span>}
          </p>
          <Button size="sm" className="h-8 shrink-0 rounded-full bg-[#55ad21] px-3 text-sm font-medium leading-5 text-white shadow-none transition-colors hover:scale-100 hover:bg-[#4c9c1e] active:scale-100" onClick={() => setEditing(appointment)}>
            Jetzt schreiben
          </Button>
        </div>
      ))}
      {editing && <CompactBriefingEditor open onOpenChange={open => { if (!open) setEditing(null); }}
        appointmentId={editing.id} title={editing.title} />}
    </>
  );
}
