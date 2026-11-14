import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { ElectionPeriod } from "@/features/election-history/types";

/** Rendered inside the existing super-admin workspace, never an automatic import. */
export function PeriodSourceReview({
  period,
  disabled,
}: {
  period: ElectionPeriod;
  disabled: boolean;
}) {
  const cache = useQueryClient();
  const proposal = useQuery({
    queryKey: ["election-period-proposal", period.number],
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from("election_analysis_period_proposals")
        .select("*")
        .eq("period_number", period.number)
        .eq("verified", true)
        .abortSignal(signal)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    retry: false,
  });
  const apply = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc(
        "apply_verified_election_period",
        { period_number_to_apply: period.number },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["election-history"] });
    },
  });
  if (!proposal.data) return null;
  const p = proposal.data;
  return (
    <details className="rounded-lg border p-3 text-sm">
      <summary className="cursor-pointer font-medium">
        Amtliche Terminvorschläge für {period.name}
      </summary>
      <p className="my-2 text-muted-foreground">
        Bestehende Angaben bleiben erhalten. Ergänzte Periodentermine verwenden
        die vorhandenen Regeln zur Vererbung auf Mandate.
      </p>
      <p>
        Wahltag: {period.election_date || "fehlt"} · amtlicher Vorschlag:{" "}
        {p.election_date || "nicht belegt"}
      </p>
      <p>
        Beginn: {p.starts_on || "noch nicht amtlich belegt"} · tatsächliches
        Ende: {p.ends_on || "noch nicht amtlich belegt"}
      </p>
      <a
        className="my-2 block underline"
        href={p.election_source_url}
        target="_blank"
        rel="noreferrer"
      >
        Amtliche Quelle zum Wahltag
      </a>
      {p.notes && <p className="mb-2 text-muted-foreground">{p.notes}</p>}
      <Button
        size="sm"
        variant="outline"
        disabled={disabled || apply.isPending}
        onClick={() => apply.mutate()}
      >
        Fehlende belegte Termine ergänzen
      </Button>
      {apply.isSuccess && (
        <p role="status" className="mt-2">
          Ergänzung gespeichert; vorhandene Angaben wurden beibehalten.
        </p>
      )}
      {apply.isError && (
        <p role="alert" className="mt-2">
          Ergänzung konnte nicht gespeichert werden.
        </p>
      )}
    </details>
  );
}
