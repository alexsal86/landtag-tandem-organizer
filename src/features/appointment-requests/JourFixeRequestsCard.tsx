import { useState } from "react";
import { CalendarClock, ChevronDown, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { AppointmentRequestList } from "./AppointmentRequestList";
import { openAppointmentRequestCreate } from "./events";
import { useOpenAppointmentRequests } from "./useAppointmentRequests";

/** All open appointment requests, to go through together in the Jour fixe. */
export function JourFixeRequestsCard({ className }: { className?: string }) {
  const [open, setOpen] = useState(true);
  const { data = [] } = useOpenAppointmentRequests();

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className={className}>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between gap-2">
            <CollapsibleTrigger asChild>
              <button type="button" className="flex items-center gap-2 text-left">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-body font-semibold">Terminanfragen zur Entscheidung ({data.length})</CardTitle>
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
            <AppointmentRequestList mode="all" />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
