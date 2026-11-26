import { useState } from "react";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LoadingState, WidgetLoadWarning } from "@/components/ui-patterns";
import { DeadlineReviewDialog } from "@/components/dashboard/DeadlineReviewDialog";
import { CompactBriefingEditor } from "@/features/appointments/briefing/CompactBriefingEditor";
import { OfficeDebriefActionDialog } from "@/features/appointments/briefing/OfficeDebriefInboxCard";
import { debriefReceivedAt } from "@/features/appointments/briefing/officeDebriefInbox";
import { usePendingBriefings } from "@/features/appointments/briefing/PendingBriefingNotice";
import { useOfficeDebriefInbox } from "@/features/appointments/briefing/useOfficeDebriefInbox";
import { useAuth } from "@/hooks/useAuth";
import type { useDashboardDeadlines } from "@/hooks/useDashboardDeadlines";
import { useResolvedUserRole } from "@/hooks/useResolvedUserRole";
import { useTenant } from "@/hooks/useTenant";
import { cn } from "@/lib/utils";
import { berlinClock, berlinDateShort, berlinDayKey, berlinDaysSince } from "@/utils/berlinDate";
import { buildTodayPriorities, type TodayPriority } from "./todayPriorities";

const badge = {
  today: ["Heute", "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"],
  promise: ["Zusage", "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"],
  report: ["Rückläufer", "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200"],
  followUp: ["Nachfrage", "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200"],
  deadlines: ["Fristen", "bg-muted text-muted-foreground"],
} as const;

function priorityLabel(entry: TodayPriority, now: Date) {
  switch (entry.kind) {
    case "today": {
      const due = entry.briefing.briefing_due_at;
      const date = due && berlinDayKey(due) !== berlinDayKey(now) ? `${berlinDateShort(due)} ` : "";
      return {
        key: `briefing-${entry.briefing.id}`,
        title: `Briefing schreiben: ${entry.briefing.title}`,
        detail: due ? `Fällig bis ${date}${berlinClock(due)} Uhr` : `Termin um ${berlinClock(entry.briefing.start_time)} Uhr`,
        action: "Schreiben",
      };
    }
    case "promise":
    case "report":
      return {
        key: `report-${entry.report.id}`,
        title: `${entry.kind === "promise" ? "Zusage braucht Frist" : "Nachbereitung"}: ${entry.report.title}`,
        detail: entry.kind === "promise" ? entry.report.promise
          : entry.report.received_at && `Eingegangen ${debriefReceivedAt(entry.report.received_at, now)}`,
        action: "Öffnen",
      };
    case "followUp": {
      const days = berlinDaysSince(entry.event.starts_at, now);
      return {
        key: `follow-up-${entry.event.is_external}-${entry.event.id}`,
        title: `Nachfrage: ${entry.event.title}`,
        detail: days <= 0 ? "Heute noch ohne Rückmeldung" : `Seit ${days === 1 ? "einem Tag" : `${days} Tagen`} ohne Rückmeldung`,
        action: "Eintragen",
      };
    }
    case "deadlines":
      return {
        key: "deadlines",
        title: entry.items.length === 1 ? "Eine überfällige Frist" : `${entry.items.length} überfällige Fristen`,
        detail: "Seit mehr als 30 Tagen überfällig",
        action: "Aufräumen",
      };
  }
}

export function TodayPrioritiesCard({ deadlines }: { deadlines: ReturnType<typeof useDashboardDeadlines> }) {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { isEmployee } = useResolvedUserRole();
  if (!currentTenant || !user) return null;
  return <TodayPriorities key={`${currentTenant.id}:${user.id}`} tenantId={currentTenant.id} userId={user.id}
    showDebriefs={isEmployee} deadlines={deadlines} />;
}

function TodayPriorities({ deadlines, tenantId, userId, showDebriefs }: {
  deadlines: ReturnType<typeof useDashboardDeadlines>;
  tenantId: string;
  userId: string;
  showDebriefs: boolean;
}) {
  const briefings = usePendingBriefings();
  const { query: debriefs, update } = useOfficeDebriefInbox(false, showDebriefs);
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null);
  const [debriefKey, setDebriefKey] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const loading = briefings.isPending || (showDebriefs && debriefs.isPending) || deadlines.isLoading;
  const failed = [
    briefings.isError && "Briefings",
    showDebriefs && debriefs.isError && "Nachbereitungen",
    (deadlines.isError || deadlines.failedSources.length > 0) && "Fristen",
  ].filter(Boolean);
  const now = new Date();
  const rows = buildTodayPriorities(
    briefings.data ?? [], showDebriefs ? debriefs.data?.reports ?? [] : [],
    showDebriefs ? debriefs.data?.missing ?? [] : [], deadlines.grouped.overdue, now,
  );
  const displayed = rows.map(entry => ({ entry, ...priorityLabel(entry, now) }));
  const debrief = displayed.find(row => row.key === debriefKey)?.entry;
  const review = rows.find(entry => entry.kind === "deadlines");

  return (
    <Card className="rounded-dashboard-card border-border/60 shadow-dashboard-card">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 px-5 pb-3 pt-5">
        <h3 className="inline-flex items-center gap-2 text-card-title">
          <Target className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> Heute zuerst
        </h3>
        {(!loading || rows.length > 0) && <span className="text-sm text-muted-foreground">
          {rows.length} {rows.length === 1 ? "Punkt" : "Punkte"}
        </span>}
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-0">
        <p className="pb-3 text-sm text-muted-foreground">Reihenfolge: Termine heute → Zusagen → Rückläufer → Nachfragen → Fristen</p>
        {failed.length > 0 && <WidgetLoadWarning message={`Unvollständige Übersicht · ${failed.join(", ")} konnten nicht vollständig geladen werden.`}
          onRetry={() => { void briefings.refetch(); if (showDebriefs) void debriefs.refetch(); deadlines.refetch(); }} />}
        {loading && rows.length === 0 && <LoadingState variant="list" rows={2} />}
        {!loading && rows.length === 0 && failed.length === 0 && <p className="text-sm text-muted-foreground">Aktuell keine offenen Punkte.</p>}
        {rows.length > 0 && <ol aria-label="Priorisierte Punkte">
          {displayed.map(({ entry, key, title, detail, action }, index) => (
            <li key={key} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t py-3">
              <span aria-hidden="true" className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">{index + 1}</span>
              <div className="min-w-0 grow basis-36">
                <p className="break-words font-semibold">{title}</p>
                {detail && <p className="mt-0.5 break-words text-sm text-muted-foreground">{detail}</p>}
              </div>
              <span className={cn("ml-auto rounded-full px-2.5 py-0.5 text-sm", badge[entry.kind][1])}>{badge[entry.kind][0]}</span>
              <Button size="sm" variant="secondary" className="shrink-0 rounded-full" aria-label={`${action}: ${title}`} onClick={() => {
                if (entry.kind === "today") setEditing(entry.briefing);
                else if (entry.kind === "deadlines") setReviewOpen(true);
                else setDebriefKey(key);
              }}>{action}</Button>
            </li>
          ))}
        </ol>}
      </CardContent>
      {editing && <CompactBriefingEditor open onOpenChange={open => { if (!open) setEditing(null); }} appointmentId={editing.id} title={editing.title} />}
      {debrief && ("report" in debrief || "event" in debrief) && (
        <OfficeDebriefActionDialog key={debriefKey} entry={debrief} tenantId={tenantId} userId={userId}
          update={update} close={() => setDebriefKey(current => current === debriefKey ? null : current)} />
      )}
      {reviewOpen && <DeadlineReviewDialog items={review?.items ?? []} open onOpenChange={setReviewOpen} />}
    </Card>
  );
}
