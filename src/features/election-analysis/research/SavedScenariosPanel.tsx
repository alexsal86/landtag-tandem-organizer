import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DataState, DataTable, StatusNote } from "../shared";
import {
  useSavedScenario,
  useSavedScenarios,
  useScenarioResult,
} from "./workspaceHooks";
import { comparisonRows, savedScenarioUrl } from "./scenarioStorage";
import { attempt, format, useLabParams } from "./lab/shared";
import { ballotLabels, exportAnalysisCsv } from "../model";
export default function SavedScenariosPanel() {
  const { params, set } = useLabParams(),
    navigate = useNavigate(),
    { user } = useAuth(),
    cache = useQueryClient();
  const page = Math.max(0, Number(params.get("scenarioPage")) || 0);
  const index = useSavedScenarios(page),
    [open, setOpen] = useState<string | null>(null),
    openQuery = useSavedScenario(open),
    a = useScenarioResult(params.get("compareA")),
    b = useScenarioResult(params.get("compareB"));
  useEffect(() => {
    if (open && openQuery.data?.id === open)
      navigate(savedScenarioUrl(openQuery.data));
  }, [open, openQuery.data, navigate]);
  const remove = useMutation({
    mutationFn: async (row: { id: string; revision: number }) => {
      const { data, error } = await supabase
        .from("election_analysis_scenarios")
        .delete()
        .eq("id", row.id)
        .eq("revision", row.revision)
        .select("id");
      if (error) throw error;
      if (!data?.length)
        throw new Error("Szenario geändert oder nicht mehr zugänglich.");
    },
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["analysis-scenarios"] });
    },
  });
  const compared = attempt(() => {
    if (!a.data || !b.data) return null;
    if (
      a.data.model_version !== b.data.model_version ||
      a.data.year !== b.data.year ||
      a.data.ballot !== b.data.ballot
    )
      throw new Error(
        "Nur dasselbe Modell, Wahljahr und dieselbe Stimmenart direkt vergleichen.",
      );
    const av = comparisonRows(a.data),
      bv = comparisonRows(b.data);
    return [...new Set([...Object.keys(av), ...Object.keys(bv)])]
      .sort()
      .map((p) => ({
        Partei: p,
        A: av[p] ?? null,
        B: bv[p] ?? null,
        Differenz: av[p] == null || bv[p] == null ? null : bv[p] - av[p],
      }));
  });
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">
        Gespeicherte Szenarien und Vergleich
      </h3>
      <StatusNote>
        Nur Szenarien des aktiven Büros, die du lesen darfst. Die Liste lädt 20
        Metadatensätze je Seite; vollständige Grundlagen werden erst beim Öffnen
        oder für die zwei ausdrücklich gewählten Vergleichsszenarien geladen.
      </StatusNote>
      <DataState
        loading={index.isLoading}
        error={index.error}
        empty={!index.data?.rows.length}
        retry={() => void index.refetch()}
      >
        <DataTable
          headers={[
            "Name",
            "Wahl",
            "Modell",
            "Sichtbarkeit",
            "Datenstand",
            "Aktionen",
          ]}
          rows={(index.data?.rows || []).map((r) => [
            r.name,
            `${r.year} · ${r.ballot}`,
            r.model_version,
            r.visibility === "tenant" ? "Büro" : "Privat",
            `${r.data_release} · Version ${r.revision}`,
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setOpen(r.id)}>
                Öffnen
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => set("compareA", r.id)}
              >
                Als A
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => set("compareB", r.id)}
              >
                Als B
              </Button>
              {r.owner_id === user?.id && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (window.confirm(`Szenario „${r.name}“ löschen?`))
                      remove.mutate(r);
                  }}
                >
                  Löschen
                </Button>
              )}
            </div>,
          ])}
        />
      </DataState>
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={page <= 0}
          onClick={() => set("scenarioPage", String(page - 1))}
        >
          Zurück
        </Button>
        <span className="py-2 text-sm">
          Seite {page + 1} · {index.data?.total || 0} Szenarien
        </span>
        <Button
          variant="outline"
          disabled={(page + 1) * 20 >= (index.data?.total || 0)}
          onClick={() => set("scenarioPage", String(page + 1))}
        >
          Weiter
        </Button>
      </div>
      {(openQuery.error || remove.error) && (
        <p role="alert">
          {remove.error?.message || "Szenario konnte nicht geöffnet werden."}
        </p>
      )}
      <h4 className="font-medium">
        A: {a.data?.name || "noch auswählen"} · B:{" "}
        {b.data?.name || "noch auswählen"}
      </h4>
      {(a.isLoading || b.isLoading) && (
        <p role="status">Vergleichsschnappschüsse laden …</p>
      )}
      {(a.error || b.error || compared.error) && (
        <p role="alert">
          {compared.error ||
            "Vergleich nicht verfügbar; Szenario möglicherweise gelöscht oder privat."}
        </p>
      )}
      {a.data && b.data && compared.value && (
        <>
          <StatusNote>
            {a.data.year} · {ballotLabels[a.data.ballot]} · {a.data.model_version}.{" "}
            {a.data.data_release === b.data.data_release
              ? "Gleicher gespeicherter Ausgangsstand."
              : "Unterschiedliche Datenstände: Differenzen umfassen Änderungen der Grundlage und der Annahmen."}{" "}
            A: {a.data.data_release} · B: {b.data.data_release}.{" "}
            {a.data.model_version === "shares-v1"
              ? "Differenzen in Prozentpunkten."
              : "Differenzen in Sitzen."}
          </StatusNote>
          <Button
            variant="outline"
            onClick={() =>
              exportAnalysisCsv(
                compared.value!,
                `Szenariovergleich-${a.data!.year}.csv`,
              )
            }
          >
            Vergleich exportieren
          </Button>
          <DataTable
            headers={["Partei", "A", "B", "B − A"]}
            sortableColumns={[0, 1, 2, 3]}
            sortValues={compared.value.map((r) => [
              r.Partei,
              r.A,
              r.B,
              r.Differenz,
            ])}
            rows={compared.value.map((r) => [
              r.Partei,
              format(r.A),
              format(r.B),
              format(r.Differenz),
            ])}
          />
        </>
      )}
    </div>
  );
}
