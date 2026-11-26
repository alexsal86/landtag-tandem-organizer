import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { parlisDateFormat } from "./documents";
import { parlisDeputyUrl } from "./navigation";

export function DeputyMotions({ profileKey, period }: { profileKey: string; period: number }) {
  const query = useQuery({
    queryKey: ["parlis-deputy-motions", period, profileKey],
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc("get_parlis_deputy_motions", {
        period, deputy_key: profileKey,
      }).abortSignal(signal);
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  return <section className="mt-6 min-w-0 space-y-3" aria-label="Anträge">
    <h4 className="text-sm font-semibold uppercase tracking-wide">Anträge · {period}. Wahlperiode</h4>
    {query.isPending ? <p role="status" className="text-sm">Anträge werden geladen …</p>
      : query.isError ? <div role="alert" className="text-sm">
        <p>Die Anträge konnten nicht geladen werden.</p>
        <Button variant="link" className="h-auto p-0" onClick={() => void query.refetch()}>Erneut laden</Button>
      </div>
      : query.data.length === 0 ? <p className="text-sm text-muted-foreground">Keine persönlich zugeordneten Anträge gefunden.</p>
      : <ul className="divide-y rounded-md border px-3">
        {query.data.map(row => <li key={row.vorgangs_id} className="space-y-1 py-3 text-sm [overflow-wrap:anywhere]">
          <p className="font-medium">{row.titel || row.vorgangs_id}</p>
          <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            {row.datum && <time dateTime={row.datum}>{parlisDateFormat.format(new Date(row.datum))}</time>}
            {row.drucksache && <span>{row.drucksache}</span>}
          </p>
          {row.pdf_url && <a className="inline-flex items-center gap-1.5 text-xs text-primary underline underline-offset-2"
            href={row.pdf_url} target="_blank" rel="noreferrer"
            aria-label={`PDF öffnen: ${row.titel || row.vorgangs_id} (neuer Tab)`}>
            <FileText size={14} aria-hidden="true" /> PDF öffnen
          </a>}
        </li>)}
      </ul>}
    <Button variant="link" className="h-auto p-0" asChild>
      <Link to={parlisDeputyUrl(profileKey, period, "Antrag")}>Alle Anträge anzeigen</Link>
    </Button>
  </section>;
}
