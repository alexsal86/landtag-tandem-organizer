import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { deputyProfileUrl } from "@/features/election-analysis/navigation";
import { getPartyColor } from "@/features/election-districts/partyColors";
import { supabase } from "@/integrations/supabase/client";
import { number } from "./documents";

type DeputyRanking = [key: string, name: string, count: number];
type Ranking = [name: string, count: number];
type Snapshot = {
  total: number;
  kinds: Record<string, number>;
  deputiesMost: DeputyRanking[];
  deputiesLeast: DeputyRanking[];
  factions: Ranking[];
  ministries: Ranking[];
  withoutFaction: number;
  withoutMinistry: number;
};

const percent = new Intl.NumberFormat("de-DE", { style: "percent", maximumFractionDigits: 1 });

function DeputyRankingList({ title, rows }: { title: string; rows: DeputyRanking[] }) {
  return <section className="min-w-0 space-y-2">
    <h3 className="font-semibold">{title}</h3>
    <ol className="divide-y rounded-md border px-3">
      {rows.map(([key, name, count], index) => <li key={key} className="grid grid-cols-[3ch_minmax(0,1fr)_auto] gap-2 py-2 text-sm">
        <span className="text-muted-foreground">{index + 1}.</span>
        <Link className="min-w-0 break-words text-primary underline underline-offset-2" to={deputyProfileUrl(key)}>{name}</Link>
        <span className="tabular-nums">{number.format(count)}</span>
      </li>)}
    </ol>
  </section>;
}

export function InitiativeRankings({ legislature }: { legislature: number }) {
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ["parlis-initiative-rankings", legislature],
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc("get_parlis_initiative_rankings", { period: legislature }).abortSignal(signal);
      if (error) throw error;
      return data as unknown as Snapshot | null;
    },
    enabled: open,
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
  const data = query.data;

  return <details className="parlis-analysis" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Initiativenbilanz der {legislature}. Wahlperiode <ChevronDown size={16} aria-hidden="true" /></summary>
    {open && <div className="space-y-5 pb-3">
      {query.isPending ? <p role="status" className="text-sm">Initiativenbilanz wird geladen …</p>
        : query.isError ? <div role="alert" className="text-sm">
          <p>Die Initiativenbilanz konnte nicht geladen werden.</p>
          <Button variant="link" className="h-auto p-0" onClick={() => void query.refetch()}>Erneut laden</Button>
        </div>
        : !data ? <p className="text-sm text-muted-foreground">Für diese Wahlperiode ist keine Bilanz verfügbar.</p>
        : <>
          <div className="space-y-1">
            <p className="font-semibold">{number.format(data.total)} Initiativen</p>
            <p className="text-sm text-muted-foreground">
              {number.format(data.kinds["Kleine Anfrage"] ?? 0)} Kleine Anfragen ·{" "}
              {number.format(data.kinds["Große Anfrage"] ?? 0)} Große Anfragen ·{" "}
              {number.format(data.kinds.Antrag ?? 0)} Anträge
            </p>
            <p className="text-xs text-muted-foreground">Berechnungsgrundlage sind alle importierten Vorgänge dieser drei Typen in der Wahlperiode.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <DeputyRankingList title="Die 10 mit den meisten Initiativen" rows={data.deputiesMost} />
            <DeputyRankingList title="Die 10 mit den wenigsten Initiativen" rows={data.deputiesLeast} />
          </div>
          <p className="text-xs text-muted-foreground">
            Die Personenranglisten zählen namentlich zugeordnete Initiativen und enthalten auch Mandate ohne zugeordneten Vorgang.
            Bei gleicher Anzahl entscheidet der Name, eine unterschiedliche Mandatsdauer wird nicht gewichtet.
          </p>
          <section className="space-y-2">
            <h3 className="font-semibold">Fraktionen nach Beteiligung</h3>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground">
                <th scope="col" className="py-2 font-medium">Fraktion</th>
                <th scope="col" className="py-2 text-right font-medium">Initiativen</th>
                <th scope="col" className="py-2 text-right font-medium">Anteil</th>
              </tr></thead>
              <tbody className="divide-y">
                {data.factions.map(([name, count]) => <tr key={name}>
                  <th scope="row" className="py-2 text-left font-medium">
                    <span aria-hidden="true" className="mr-2 inline-block size-2 rounded-full" style={{ backgroundColor: getPartyColor(name) }} />
                    {name}
                  </th>
                  <td className="text-right tabular-nums">{number.format(count)}</td>
                  <td className="text-right tabular-nums">{percent.format(count / data.total)}</td>
                </tr>)}
              </tbody>
            </table>
            <p className="text-xs text-muted-foreground">
              Gezählt werden Initiativen der Fraktion und ihrer in PARLIS mit Fraktion genannten Abgeordneten. Eine gemeinsame Initiative zählt je beteiligter Fraktion einmal.
              Die Anteile können sich deshalb überschneiden. {number.format(data.withoutFaction)} Initiativen haben keine Fraktionszuordnung.
            </p>
          </section>
          <section className="space-y-2">
            <h3 className="font-semibold">Ministerien nach erhaltenen Initiativen</h3>
            <ol className="divide-y rounded-md border px-3">
              {data.ministries.map(([name, count], index) => <li key={name} className="grid grid-cols-[3ch_minmax(0,1fr)_auto] gap-2 py-2 text-sm">
                <span className="text-muted-foreground">{index + 1}.</span>
                <span className="break-words">{name}</span>
                <span className="tabular-nums">{number.format(count)}</span>
              </li>)}
            </ol>
            <p className="text-xs text-muted-foreground">{number.format(data.withoutMinistry)} Initiativen haben in PARLIS kein Ministerium als Ressort.</p>
          </section>
        </>}
    </div>}
  </details>;
}
