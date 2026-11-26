import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { number } from "./documents";
import { parlisDeputyUrl } from "./navigation";

export function DeputyActivity({ profileKey }: { profileKey: string }) {
  const query = useQuery({
    queryKey: ["parlis-wp17-deputy-activity", profileKey],
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc("get_parlis_wp17_deputy_activity", {
        deputy_key: profileKey,
      }).abortSignal(signal);
      if (error) throw error;
      return data;
    },
    staleTime: 60 * 60 * 1000,
  });

  return <section className="mt-6 min-w-0 space-y-3" aria-label="Parlamentarische Bilanz">
    <h4 className="text-sm font-semibold uppercase tracking-wide">Parlamentarische Bilanz · 17. Wahlperiode</h4>
    <p className="text-xs text-muted-foreground">Persönlich zugeordnete Vorgänge aus PARLIS</p>
    {query.isPending ? <p role="status" className="text-sm">Bilanz wird geladen …</p>
      : query.isError ? <div role="alert" className="text-sm">
        <p>Die Bilanz konnte nicht geladen werden.</p>
        <Button variant="link" className="h-auto p-0" onClick={() => void query.refetch()}>Erneut laden</Button>
      </div>
      : query.data.length === 0 ? <p className="text-sm text-muted-foreground">Keine persönlich zugeordneten Vorgänge gefunden.</p>
      : <ul className="flex flex-wrap gap-2">
        {query.data.map(({ document_kind, document_count }) => {
          const label = <><span className="font-semibold tabular-nums">{number.format(document_count)}</span>{" "}
            {document_kind || "Ohne Dokumententyp"}</>;
          const className = "inline-block rounded-md border bg-muted/30 px-3 py-2 text-sm";
          return <li key={document_kind}>{document_kind
            ? <Link className={`${className} hover:bg-muted hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2`}
              to={parlisDeputyUrl(profileKey, 17, document_kind)}>{label}</Link>
            : <span className={className}>{label}</span>}</li>;
        })}
      </ul>}
  </section>;
}
