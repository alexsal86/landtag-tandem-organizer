import { SystemSubpointList } from "@/components/meetings/agenda-editor/SystemSubpointList";
import { sortByEarliest } from "./logic";
import { useState, useEffect } from "react";
import { CalendarClock, ChevronDown, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { AppointmentRequestList } from "./AppointmentRequestList";
import { openAppointmentRequestCreate } from "./events";
import { useOpenAppointmentRequests } from "./useAppointmentRequests";
import { JourFixeBriefingList } from "@/features/appointments/briefing/JourFixeBriefingList";
import { useUndecidedBriefings } from "@/features/appointments/briefing/useBriefing";

/** Jour fixe block "Termine": decide requests and clarify briefing needs for the next 14 days. */
export function JourFixeRequestsCard({ className, embedded = false, readOnly = false, onCountChange, agendaRows }: { className?: string; embedded?: boolean; readOnly?: boolean; onCountChange?: (count: number | null) => void; agendaRows?: { agendaNumber?: string; resultText?: string | null; onUpdateResult?: (value: string) => void } }) {
  const [open, setOpen] = useState(true);
  const { data = [], isLoading: requestsLoading, error: requestsError } = useOpenAppointmentRequests();
  const { data: briefings = [], isLoading: briefingsLoading, error: briefingsError } = useUndecidedBriefings();
  useEffect(() => { onCountChange?.(requestsLoading || briefingsLoading || requestsError || briefingsError ? null : data.length + briefings.length); }, [requestsLoading, briefingsLoading, requestsError, briefingsError, data.length, briefings.length, onCountChange]);

  if (agendaRows) {
    if (requestsError || briefingsError) return <p role="status" className="px-4 py-2 text-xs text-muted-foreground">Terminanfragen oder Briefing-Bedarf konnten nicht geladen werden.</p>;
    if (requestsLoading || briefingsLoading) return <p role="status" className="px-4 py-2 text-xs text-muted-foreground">Terminanfragen werden geladen …</p>;
    const entries = [
      ...sortByEarliest(data).map(request => ({ id: `request-${request.id}`, sourceId: request.id, title: request.title, kind: "request" as const })),
      ...briefings.map(appointment => ({ id: `briefing-${appointment.id}`, sourceId: appointment.id, title: appointment.title, kind: "briefing" as const })),
    ];
    return <SystemSubpointList
      {...agendaRows}
      onUpdateResult={readOnly ? undefined : agendaRows.onUpdateResult}
      entries={entries}
      titleOf={(entry) => entry.title}
      label="Terminanfragen & Briefing-Bedarf"
      checkable
      metadata={(entry) => <span className="text-muted-foreground">{entry.kind === "request" ? "Terminanfrage" : "Briefing-Bedarf"}</span>}
      details={(entry) => entry.kind === "request"
        ? <AppointmentRequestList mode="all" readOnly={readOnly} requestId={entry.sourceId} />
        : <JourFixeBriefingList readOnly={readOnly} appointmentId={entry.sourceId} />}
    />;
  }

  if (embedded) return <div className="min-w-0 space-y-3">
    <div className="flex items-center justify-between gap-2">
      <span className="text-caption text-muted-foreground">{data.length} Anfragen · {briefings.length} Briefing-Bedarfe</span>
      <Button disabled={readOnly} size="sm" variant="ghost" onClick={() => openAppointmentRequestCreate()}><Plus className="h-4 w-4 mr-1" /> Vormerken</Button>
    </div>
    <Tabs defaultValue="requests">
      <TabsList className="h-auto flex flex-wrap justify-start gap-1">
        <TabsTrigger value="requests">Anfragen ({data.length})</TabsTrigger>
        <TabsTrigger value="briefings">Briefing-Bedarf ({briefings.length})</TabsTrigger>
      </TabsList>
      <TabsContent value="requests"><AppointmentRequestList mode="all" readOnly={readOnly} /></TabsContent>
      <TabsContent value="briefings"><JourFixeBriefingList readOnly={readOnly} /></TabsContent>
    </Tabs>
  </div>;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className={className}>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between gap-2">
            <CollapsibleTrigger asChild>
              <button type="button" className="flex items-center gap-2 text-left">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-body font-semibold">Termine im Jour Fixe ({data.length + briefings.length})</CardTitle>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", !open && "-rotate-90")} />
              </button>
            </CollapsibleTrigger>
            <Button disabled={readOnly} size="sm" variant="ghost" onClick={() => openAppointmentRequestCreate()}>
              <Plus className="mr-1 h-4 w-4" /> Vormerken
            </Button>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <Tabs defaultValue="requests">
              <TabsList className="mb-2">
                <TabsTrigger value="requests">Anfragen entscheiden ({data.length})</TabsTrigger>
                <TabsTrigger value="briefings">Briefing-Bedarf 14 Tage ({briefings.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="requests"><AppointmentRequestList mode="all" readOnly={readOnly} /></TabsContent>
              <TabsContent value="briefings"><JourFixeBriefingList readOnly={readOnly} /></TabsContent>
            </Tabs>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
