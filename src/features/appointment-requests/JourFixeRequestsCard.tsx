import { useState } from "react";
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
export function JourFixeRequestsCard({ className }: { className?: string }) {
  const [open, setOpen] = useState(true);
  const { data = [] } = useOpenAppointmentRequests();
  const { data: briefings = [] } = useUndecidedBriefings();

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
            <Button size="sm" variant="ghost" onClick={() => openAppointmentRequestCreate()}>
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
              <TabsContent value="requests"><AppointmentRequestList mode="all" /></TabsContent>
              <TabsContent value="briefings"><JourFixeBriefingList /></TabsContent>
            </Tabs>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
