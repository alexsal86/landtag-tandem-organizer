import { format } from "date-fns";
import { de } from "date-fns/locale";
import { CalendarCheck, CalendarClock, CalendarX, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingState } from "@/components/ui-patterns";
import { useResolvedUserRole } from "@/hooks/useResolvedUserRole";
import { notify } from "@/lib/notify";
import { RECOMMENDATION_LABELS, canDecide, isUrgent, requestStart, sortByEarliest } from "./logic";
import { openAppointmentRequestCreate, openAppointmentRequestDetail } from "./events";
import { useAppointmentRequestMutations, useNextJourFixeDate, useOpenAppointmentRequests } from "./useAppointmentRequests";

interface Props {
  /** "urgent" shows only requests that cannot wait for the next Jour fixe. */
  mode: "all" | "urgent";
  /** Hide the whole block when there is nothing to show. */
  hideWhenEmpty?: boolean;
}

export function AppointmentRequestList({ mode, hideWhenEmpty }: Props) {
  const { data = [], isLoading } = useOpenAppointmentRequests();
  const { data: nextJf = null } = useNextJourFixeDate();
  const { role } = useResolvedUserRole();
  const { decide } = useAppointmentRequestMutations();
  const mayDecide = canDecide(role);

  const list = sortByEarliest(mode === "urgent" ? data.filter((r) => isUrgent(r, nextJf)) : data);

  if (isLoading) return hideWhenEmpty ? null : <LoadingState variant="inline" />;
  if (list.length === 0) {
    if (hideWhenEmpty) return null;
    return (
      <EmptyState
        icon={CalendarClock}
        title="Keine offenen Terminanfragen"
        description="Neue Anfragen aus E-Mail oder Post hier vormerken."
        size="sm"
        action={{ label: "Anfrage vormerken", icon: Plus, onClick: () => openAppointmentRequestCreate() }}
      />
    );
  }

  const quick = async (id: string, decision: "accepted" | "declined") => {
    try {
      await decide.mutateAsync({ id, decision });
      notify.success(decision === "accepted" ? "Zugesagt – Termin steht im Kalender" : "Abgesagt");
    } catch (e) {
      notify.error("Entscheidung fehlgeschlagen", { description: e instanceof Error ? e.message : undefined });
    }
  };

  return (
    <ul className="divide-y divide-border">
      {list.map((r) => (
        <li key={r.id} className="flex items-center gap-3 py-2">
          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openAppointmentRequestDetail(r.id)}>
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{r.title}</span>
              {mode === "all" && isUrgent(r, nextJf) && <Badge variant="destructive" className="shrink-0">Eilig</Badge>}
            </div>
            <div className="truncate text-xs text-muted-foreground tabular-nums">
              {format(requestStart(r), r.requested_time ? "EEE d.MM., HH:mm" : "EEE d.MM.", { locale: de })}
              {r.requester ? ` · ${r.requester}` : ""}
              {r.recommendation ? ` · ${RECOMMENDATION_LABELS[r.recommendation]}` : ""}
            </div>
          </button>
          {mayDecide && (
            <div className="flex shrink-0 gap-1">
              <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Zusagen" title="Zusagen" disabled={decide.isPending} onClick={() => quick(r.id, "accepted")}>
                <CalendarCheck className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Absagen" title="Absagen" disabled={decide.isPending} onClick={() => quick(r.id, "declined")}>
                <CalendarX className="h-4 w-4" />
              </Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
