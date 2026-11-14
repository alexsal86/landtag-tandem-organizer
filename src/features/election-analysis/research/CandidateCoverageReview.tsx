import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useCandidateCoverage } from "./mandateHooks";
import type { CandidateCoverage } from "./types";
export function CandidateCoverageReview({
  periodId,
  disabled,
}: {
  periodId: string;
  disabled: boolean;
}) {
  const query = useCandidateCoverage(periodId);
  if (query.isLoading)
    return <p className="text-sm">Vollständigkeitsprüfung lädt …</p>;
  if (query.error)
    return (
      <p role="alert" className="text-sm">
        Vollständigkeitsprüfung nicht verfügbar. Bitte Migration einspielen oder
        erneut laden.
      </p>
    );
  return (
    <CoverageForm
      key={periodId}
      periodId={periodId}
      initial={query.data || null}
      disabled={disabled}
    />
  );
}
function CoverageForm({
  periodId,
  initial,
  disabled,
}: {
  periodId: string;
  initial: CandidateCoverage | null;
  disabled: boolean;
}) {
  const [source, setSource] = useState(initial?.source_url || ""),
    [expected, setExpected] = useState(
      initial?.expected_district_candidacies?.toString() || "",
    ),
    [complete, setComplete] = useState(initial?.is_complete || false);
  const cache = useQueryClient();
  const save = useMutation({
    mutationFn: async () => {
      const count = expected ? Number(expected) : null;
      if (count != null && (!Number.isSafeInteger(count) || count <= 0))
        throw new Error("Eine positive ganze Sollzahl eingeben.");
      if (source && !/^https:\/\//.test(source))
        throw new Error("Eine vollständige HTTPS-Quellenadresse eingeben.");
      if (source) {
        let parsed: URL;
        try {
          parsed = new URL(source);
        } catch {
          throw new Error("Eine vollständige HTTPS-Quellenadresse eingeben.");
        }
        if (parsed.protocol !== "https:" || !parsed.hostname)
          throw new Error("Eine vollständige HTTPS-Quellenadresse eingeben.");
      }
      const { error } = await supabase
        .from("election_analysis_candidate_coverage")
        .upsert({
          period_id: periodId,
          is_complete: complete,
          expected_district_candidacies: count,
          source_url: source || null,
          reviewed_at: null,
          notes: initial?.notes || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["election-history"] });
    },
  });
  return (
    <details className="rounded-lg border p-3 text-sm">
      <summary className="cursor-pointer font-medium">
        Vollständigkeit der Wahlkreiskandidaturen prüfen
      </summary>
      <p className="my-2 text-muted-foreground">
        Alle Parteien und auch erfolglose Personen erfassen. Die Sollzahl stammt
        aus der amtlichen vollständigen Kandidatenliste, nicht aus den Mandaten.
        Erst nach eigenständiger Prüfung bestätigen. Änderungen an Kandidaturen
        oder Wahlkreisen heben die Bestätigung auf.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          Amtliche Quelle
          <Input
            type="url"
            value={source}
            disabled={disabled || save.isPending}
            onChange={(e) => {
              setSource(e.target.value);
              save.reset();
            }}
          />
        </label>
        <label>
          Erwartete Wahlkreiskandidaturen
          <Input
            type="number"
            min={1}
            step={1}
            value={expected}
            disabled={disabled || save.isPending}
            onChange={(e) => {
              setExpected(e.target.value);
              save.reset();
            }}
          />
        </label>
      </div>
      <label className="my-3 flex items-center gap-2">
        <input
          type="checkbox"
          checked={complete}
          disabled={disabled || save.isPending}
          onChange={(e) => {
            setComplete(e.target.checked);
            save.reset();
          }}
        />
        Alle Wahlkreiskandidaturen einschließlich Stimmen, Anteilen und
        Wahlausgang vollständig geprüft
      </label>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || save.isPending}
        onClick={() => save.mutate()}
      >
        Prüfvermerk speichern
      </Button>
      {save.isError && (
        <p role="alert" className="mt-2">
          {save.error.message}
        </p>
      )}
      {save.isSuccess && (
        <p role="status" className="mt-2">
          Prüfvermerk gespeichert.
        </p>
      )}
    </details>
  );
}
