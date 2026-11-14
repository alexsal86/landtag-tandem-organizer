import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useDistrictVersions } from "./hooks";
import type {
  ElectionPeriod,
  HistoricalDistrict,
} from "@/features/election-history/types";
/** Explicit confirmation of the SAME election's district, never a cross-year geometry identity. */
export function HistoryLinkReview({
  period,
  districts,
  disabled,
}: {
  period: ElectionPeriod;
  districts: HistoricalDistrict[];
  disabled: boolean;
}) {
  const versions = useDistrictVersions(period.election_year || 0);
  const cache = useQueryClient();
  const [number, setNumber] = useState(1);
  const version = versions.data?.find((v) => v.district_number === number);
  const matches = districts.filter(
    (d) => d.period_id === period.id && d.district_number === number,
  );
  const historical = matches.length === 1 ? matches[0] : undefined;
  const confirm = useMutation({
    mutationFn: async () => {
      if (!version || !historical)
        throw new Error("Keine eindeutige Zuordnung");
      const { data, error } = await supabase
        .from("election_analysis_versions")
        .update({
          historical_district_id: historical.id,
          history_link_verified: true,
        })
        .eq("year", version.year)
        .eq("district_number", number)
        .eq("history_link_verified", false)
        .select("district_number");
      if (error) throw error;
      if (!data?.length)
        throw new Error(
          "Zuordnung wurde zwischenzeitlich geändert. Bitte neu laden.",
        );
    },
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["election-research"] });
    },
  });
  if (!versions.data?.length) return null;
  return (
    <details className="rounded-lg border p-3 text-sm">
      <summary className="cursor-pointer font-medium">
        Verbindung zur Wahlanalyse prüfen
      </summary>
      <p className="my-2 text-muted-foreground">
        Bestätigt nur die Zuordnung innerhalb derselben Wahlperiode. Eine
        Identität der Grenzen mit anderen Jahren entsteht dadurch nicht.
      </p>
      <label htmlFor="history-analysis-link">Wahlkreis</label>
      <select
        id="history-analysis-link"
        className="mx-2 rounded border bg-white text-slate-900 p-2"
        value={number}
        disabled={confirm.isPending}
        onChange={(event) => {
          setNumber(Number(event.target.value));
          confirm.reset();
        }}
      >
        {versions.data.map((v) => (
          <option key={v.district_number} value={v.district_number}>
            {v.district_number}: {v.district_name}
          </option>
        ))}
      </select>
      <p className="my-2">
        Wahlanalyse: {version?.year} · {version?.district_name}
        <br />
        Mandatshistorie: {period.name} ·{" "}
        {historical?.name || "Keine eindeutige, gesicherte Nummer vorhanden"}
      </p>
      <Button
        size="sm"
        variant="outline"
        disabled={
          disabled ||
          !historical ||
          version?.history_link_verified ||
          confirm.isPending
        }
        onClick={() => confirm.mutate()}
      >
        {version?.history_link_verified
          ? "Verbindung bereits bestätigt"
          : "Diesen Wahlkreis ausdrücklich zuordnen"}
      </Button>
      {confirm.isError && (
        <p role="alert" className="mt-2">
          {confirm.error.message}
        </p>
      )}
      {confirm.isSuccess && (
        <p role="status" className="mt-2">
          Zuordnung gespeichert. Freigegebene Mandate sind im Steckbrief
          abrufbar.
        </p>
      )}
    </details>
  );
}
