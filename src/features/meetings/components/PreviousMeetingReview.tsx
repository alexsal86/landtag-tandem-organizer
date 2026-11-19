import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import type { Meeting } from "@/components/meetings/types";
import { supabase } from "@/integrations/supabase/client";
import { protocolTaskProgress, useProtocolTasks } from "../protocolTasks";

export function PreviousMeetingReview({ meeting, tenantId, onOpen }: {
  meeting: Meeting;
  tenantId: string;
  onOpen: (meetingId: string) => void;
}) {
  const date = typeof meeting.meeting_date === "string"
    ? meeting.meeting_date.slice(0, 10)
    : format(meeting.meeting_date, "yyyy-MM-dd");
  const series = meeting.parent_meeting_id ?? meeting.id;
  const previous = useQuery({
    queryKey: ["previous-meeting-review", tenantId, meeting.id, date, meeting.meeting_time, meeting.template_id, series],
    queryFn: async () => {
      let query = supabase.from("meetings")
        .select("id, title, meeting_date")
        .eq("tenant_id", tenantId)
        .eq("status", "archived")
        .neq("id", meeting.id!);
      query = meeting.meeting_time
        ? query.or(`meeting_date.lt.${date},and(meeting_date.eq.${date},meeting_time.lt.${meeting.meeting_time})`)
        : query.lt("meeting_date", date);
      if (meeting.template_id) {
        query = query.eq("template_id", meeting.template_id);
      } else if (meeting.parent_meeting_id || meeting.recurrence_rule) {
        query = query.or(`id.eq.${series},parent_meeting_id.eq.${series}`);
      } else {
        query = query.is("template_id", null);
      }
      const { data, error } = await query
        .order("meeting_date", { ascending: false })
        .order("meeting_time", { ascending: false, nullsFirst: false })
        .order("id")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const tasks = useProtocolTasks(previous.data?.id, tenantId);

  if (previous.isError) return <p className="text-sm text-muted-foreground">Der Rückblick konnte nicht geladen werden.</p>;
  if (!previous.data) return null;

  const previousMeeting = previous.data;
  const { completed, total } = protocolTaskProgress(tasks.data ?? []);
  return (
    <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3">
      <div>
        <h2 className="text-sm font-semibold">Rückblick letzter Jour Fixe</h2>
        <p className="text-sm text-muted-foreground">
          {previousMeeting.title} · {format(parseISO(previousMeeting.meeting_date), "d. MMMM yyyy", { locale: de })}
        </p>
        <p className="text-sm">
          {tasks.isError ? "Aufgabenstatus nicht verfügbar" : tasks.isPending ? "Aufgaben werden geladen …" :
            total ? `${completed} von ${total} Aufgaben erledigt` : "Keine Folgeaufgaben"}
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={() => onOpen(previousMeeting.id)}>Protokoll öffnen</Button>
    </section>
  );
}
