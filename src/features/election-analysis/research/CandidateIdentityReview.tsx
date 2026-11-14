import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useDistrictVersions, useVerifiedCandidates } from "./hooks";
import { parties } from "../model";
import type { ElectionHistoryData } from "@/features/election-history/types";
export function CandidateIdentityReview({
  data,
  disabled,
}: {
  data: ElectionHistoryData;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="rounded-lg border p-3 text-sm"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="cursor-pointer font-medium">
        Amtliche Kandidatur einer bestätigten Person zuordnen
      </summary>
      {open && <IdentityForm data={data} disabled={disabled} />}
    </details>
  );
}
function IdentityForm({
  data,
  disabled,
}: {
  data: ElectionHistoryData;
  disabled: boolean;
}) {
  const period = data.periods[0];
  const year = period?.election_year || 0;
  const versions = useDistrictVersions(year),
    official = useVerifiedCandidates(year, year >= 2026 ? parties : []);
  const [selected, setSelected] = useState("");
  const c = data.candidacies.find((c) => c.id === selected);
  const version = c
    ? versions.data?.find(
        (v) =>
          v.history_link_verified && v.historical_district_id === c.district_id,
      )
    : undefined;
  const match = version
    ? official.data?.find(
        (o) =>
          o.district_number === version.district_number && o.party === c?.party,
      )
    : undefined;
  const cache = useQueryClient();
  const confirm = useMutation({
    mutationFn: async () => {
      if (!c) throw new Error("Kandidatur auswählen.");
      const { error } = await supabase.rpc(
        "confirm_analysis_candidate_identity",
        { candidacy: c.id },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["election-research"] });
    },
  });
  return (
    <div className="mt-2 space-y-3">
      <p className="text-muted-foreground">
        Beide Namen und die amtliche Quelle prüfen. Gleiche Namen werden nicht
        automatisch zusammengeführt. Vorhandene andere Personenverknüpfungen
        bleiben geschützt.
      </p>
      <label className="block">
        Persönliche Erststimmenkandidatur
        <select
          className="mt-1 w-full rounded border bg-background p-2"
          value={selected}
          disabled={disabled || confirm.isPending}
          onChange={(e) => {
            setSelected(e.target.value);
            confirm.reset();
          }}
        >
          <option value="">Kandidatur auswählen</option>
          {data.candidacies
            .filter((c) => c.ballot_type === "first_vote")
            .map((c) => (
              <option key={c.id} value={c.id}>
                {data.people.find((p) => p.id === c.person_id)?.name} ·{" "}
                {c.party} ·{" "}
                {data.districts.find((d) => d.id === c.district_id)?.name}
              </option>
            ))}
        </select>
      </label>
      {versions.isLoading || official.isLoading ? (
        <p role="status">Amtliche Verknüpfungen laden …</p>
      ) : versions.error || official.error ? (
        <p role="alert">Amtliche Verknüpfungen konnten nicht geladen werden.</p>
      ) : (
        c && (
          <p>
            Zentrale Person:{" "}
            {data.people.find((p) => p.id === c.person_id)?.name}
            <br />
            Amtlicher Name:{" "}
            {match?.candidate_name ||
              "Keine bestätigte amtliche Kandidatur verfügbar"}
            <br />
            Persönliche Stimmen: {c.votes ?? "unbekannt"} · amtlich:{" "}
            {match?.votes ?? "unbekannt"}
          </p>
        )
      )}
      {match && (
        <a
          className="block underline"
          href={match.source_url}
          target="_blank"
          rel="noreferrer"
        >
          Amtliche Kandidaturquelle öffnen
        </a>
      )}
      <Button
        size="sm"
        variant="outline"
        disabled={
          disabled ||
          confirm.isPending ||
          !c ||
          !match ||
          !!versions.error ||
          !!official.error
        }
        onClick={() => confirm.mutate()}
      >
        Personenzuordnung ausdrücklich bestätigen
      </Button>
      {confirm.isError && <p role="alert">{confirm.error.message}</p>}
      {confirm.isSuccess && (
        <p role="status">
          Personenzuordnung und geprüfter Datenstand gespeichert.
        </p>
      )}
    </div>
  );
}
