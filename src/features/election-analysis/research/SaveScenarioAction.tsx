import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { isRecord } from "@/utils/typeSafety";
import { scenarioParams } from "./scenarioStorage";
import { useSavedScenario } from "./workspaceHooks";
function jsonValue(v: unknown): v is Json {
  return (
    v === null ||
    typeof v === "string" ||
    typeof v === "boolean" ||
    (typeof v === "number" && Number.isFinite(v)) ||
    (Array.isArray(v) && v.every(jsonValue)) ||
    (isRecord(v) && Object.values(v).every(jsonValue))
  );
}
export function jsonSnapshot(v: unknown): Json {
  const encoded = JSON.stringify(v);
  if (!encoded) throw new Error("Szenario ist leer.");
  const decoded: unknown = JSON.parse(encoded);
  if (!jsonValue(decoded)) throw new Error("Ungültiger Schnappschuss.");
  return decoded;
}
export function SaveScenarioAction({
  year,
  ballot,
  model,
  release,
  input,
  result,
}: {
  year: number;
  ballot: "single" | "first" | "second";
  model: "shares-v1" | "bw-lwg-2026-v1";
  release: string;
  input: unknown;
  result: unknown;
}) {
  const { user } = useAuth(),
    { currentTenant } = useTenant(),
    [params] = useSearchParams(),
    cache = useQueryClient();
  const existing = useSavedScenario(params.get("savedScenario"));
  const [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [visibility, setVisibility] = useState<"private" | "tenant">("private"),
    [update, setUpdate] = useState(false);
  const canUpdate =
    !!existing.data &&
    existing.data.owner_id === user?.id &&
    existing.data.model_version === model &&
    existing.data.year === year &&
    existing.data.ballot === ballot;
  const save = useMutation({
    mutationFn: async () => {
      if (!user || !currentTenant || !name.trim())
        throw new Error("Name und aktives Büro erforderlich.");
      const fields = {
        name: name.trim(),
        description,
        visibility,
        year,
        ballot,
        model_version: model,
        data_release: release,
        params: jsonSnapshot(scenarioParams(params)),
        input_snapshot: jsonSnapshot(input),
        result_snapshot: jsonSnapshot(result),
      };
      if (JSON.stringify(fields.input_snapshot).length > 1_500_000)
        throw new Error("Szenariogrundlage ist zu groß.");
      if (update) {
        if (!canUpdate || !existing.data)
          throw new Error("Nur eigene passende Szenarien aktualisieren.");
        const { data, error } = await supabase
          .from("election_analysis_scenarios")
          .update(fields)
          .eq("id", existing.data.id)
          .eq("tenant_id", currentTenant.id)
          .eq("revision", existing.data.revision)
          .select("id");
        if (error) throw error;
        if (!data?.length)
          throw new Error(
            "Szenario wurde zwischenzeitlich geändert. Neu laden oder als Kopie speichern.",
          );
      } else {
        const now = new Date().toISOString();
        const { error } = await supabase
          .from("election_analysis_scenarios")
          .insert({
            ...fields,
            id: crypto.randomUUID(),
            tenant_id: currentTenant.id,
            owner_id: user.id,
            revision: 1,
            created_at: now,
            updated_at: now,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["analysis-scenarios"] });
    },
  });
  return (
    <details className="rounded-lg border p-3 text-sm" data-report-exclude>
      <summary className="cursor-pointer font-medium">
        Szenario mit Datenstand speichern
      </summary>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label>
          Name
          <Input
            maxLength={120}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              save.reset();
            }}
          />
        </label>
        <label>
          Beschreibung
          <Input
            maxLength={2000}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              save.reset();
            }}
          />
        </label>
        <label>
          Sichtbarkeit
          <select
            className="ml-2 rounded border bg-white p-2"
            value={visibility}
            onChange={(e) =>
              setVisibility(e.target.value === "tenant" ? "tenant" : "private")
            }
          >
            <option value="private">Nur ich</option>
            <option value="tenant">Mitglieder dieses Büros</option>
          </select>
        </label>
        {canUpdate && (
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={update}
              onChange={(e) => setUpdate(e.target.checked)}
            />
            Aktuelles eigenes Szenario aktualisieren; sonst neue Kopie
          </label>
        )}
      </div>
      <p className="my-2 text-xs text-muted-foreground">
        Grundlage und Ergebnis werden eingefroren. Geteilte Szenarien können
        andere Büromitglieder lesen; Änderungen bleiben beim Eigentümer. Keine
        echten Wahlergebnisse werden verändert.
      </p>
      <Button
        variant="outline"
        disabled={save.isPending || !currentTenant || !name.trim()}
        onClick={() => save.mutate()}
      >
        Speichern
      </Button>
      {save.isError && (
        <p role="alert" className="mt-2">
          {save.error.message}
        </p>
      )}
      {save.isSuccess && (
        <p role="status" className="mt-2">
          Szenario gespeichert. Unter „Gespeicherte Szenarien“ öffnen oder
          vergleichen.
        </p>
      )}
    </details>
  );
}
