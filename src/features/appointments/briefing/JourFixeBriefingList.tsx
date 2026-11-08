import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notify";
import { useBriefingMutations, useUndecidedBriefings } from "./useBriefing";
import { BriefingRequestPopover } from "./BriefingRequestPopover";

/** Accepted appointments in the next 14 days without a briefing decision. */
export function JourFixeBriefingList({ readOnly = false }: { readOnly?: boolean }) {
  const { data = [], isLoading } = useUndecidedBriefings();
  const { setBriefing } = useBriefingMutations();
  if (isLoading) return <p className="text-caption text-muted-foreground">Lädt…</p>;
  if (!data.length) return <p className="text-caption text-muted-foreground">Für alle Termine der nächsten 14 Tage ist der Briefing-Bedarf geklärt.</p>;
  return (
    <ul className="divide-y">
      {data.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <div className="min-w-0">
            <p className="truncate text-body font-medium">{a.title}</p>
            <p className="text-caption text-muted-foreground tabular-nums">
              {format(new Date(a.start_time), "EEE d.M. HH:mm", { locale: de })}{a.location && ` · ${a.location}`}
            </p>
          </div>
          {!readOnly && <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={async () => {
              try { await setBriefing.mutateAsync({ appointmentId: a.id, decision: "none" }); } catch (e) { notify.error(e instanceof Error ? e.message : "Fehlgeschlagen."); }
            }}>Kein Briefing</Button>
            <BriefingRequestPopover appointmentId={a.id} startTime={a.start_time} trigger={<Button size="sm">Briefing vergeben</Button>} />
          </div>}
        </li>
      ))}
    </ul>
  );
}
