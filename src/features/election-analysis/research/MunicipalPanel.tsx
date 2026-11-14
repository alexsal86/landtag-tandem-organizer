import { useState, useMemo, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useAdministrationAccess } from "@/components/administration/useAdministrationAccess";
import { supabase } from "@/integrations/supabase/client";
import { DataState, DataTable, Selection, StatusNote } from "../shared";
import { exportAnalysisCsv, parties, percent, number } from "../model";
import type { Ballot } from "../types";
import type { LocalResult } from "./workspaceTypes";
import { useLocalPage } from "./workspaceHooks";
import { useDistrictVersions } from "./hooks";
import { localMetrics, parseLocalCsv } from "./localModel";
import { jsonSnapshot } from "./SaveScenarioAction";
import { useLabParams, attempt } from "./lab/shared";
export default function MunicipalPanel({
  year,
  ballot,
  party,
}: {
  year: number;
  ballot: Ballot;
  party: string;
}) {
  const { params, set } = useLabParams(),
    { user, loading } = useAuth(),
    access = useAdministrationAccess(user?.id, undefined, loading),
    cache = useQueryClient();
  const requested = Number(params.get("analysisDistrict")),
    district =
      requested >= 1 && requested <= 70 && Number.isInteger(requested)
        ? requested
        : 1,
    areaType = params.get("localType") === "ward" ? "ward" : "municipality",
    search = params.get("localSearch") || "",
    page = Math.max(0, Number(params.get("localPage")) || 0);
  const selectedParty = params.get("localParty") || party;
  const query = useLocalPage(
      year,
      ballot,
      district,
      areaType,
      selectedParty,
      search,
      page,
    ),
    versions = useDistrictVersions(year);
  const [release, setRelease] = useState(""),
    [source, setSource] = useState(""),
    [boundary, setBoundary] = useState(""),
    [preliminary, setPreliminary] = useState(false),
    [verified, setVerified] = useState(false),
    [text, setText] = useState(""),
    [fileError, setFileError] = useState("");
  const fileRequest = useRef(0);
  const preview = useMemo(
    () =>
      text
        ? attempt(() =>
            parseLocalCsv(text, {
              year,
              ballot,
              district,
              type: areaType,
              release,
              source,
              boundary,
              preliminary,
              verified: true,
            }),
          )
        : { value: null, error: null },
    [
      text,
      year,
      ballot,
      district,
      areaType,
      release,
      source,
      boundary,
      preliminary,
    ],
  );
  const importRows = useMutation({
    mutationFn: async () => {
      const rows = parseLocalCsv(text, {
        year,
        ballot,
        district,
        type: areaType,
        release,
        source,
        boundary,
        preliminary,
        verified,
      });
      const { data, error } = await supabase.rpc("import_analysis_local_rows", {
        rows_to_import: jsonSnapshot(rows),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["election-research"] });
    },
  });
  useEffect(() => {
    setVerified(false);
    importRows.reset();
  }, [year, ballot, district, areaType]);
  const onSelect = (key: string, value: string) => {
    setVerified(false);
    importRows.reset();
    set(key, value);
    if (page) set("localPage", "0");
  };
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">
        Gemeinden und Wahlbezirke innerhalb des Wahlkreises
      </h3>
      <StatusNote>
        Nur tatsächlich hinterlegte, geprüfte Gebietsergebnisse.
        Gemeindeschlüssel und Zuschnitt sind explizit; gleiche Namen verbinden
        keine Gebiete. Gemeinden, Gemeindeanteile und Wahlbezirke können sich
        unterscheiden. Gemeinde- und Wahlbezirksebene werden nicht gemeinsam
        summiert. Fehlende feinräumige Daten werden nicht aus
        Wahlkreisergebnissen verteilt.
      </StatusNote>
      <div className="flex flex-wrap items-end gap-3">
        <Selection
          id="local-district"
          label="Wahlkreis"
          value={String(district)}
          onChange={(v) => onSelect("analysisDistrict", v)}
        >
          {Array.from({ length: 70 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}:{" "}
              {versions.data?.find((v) => v.district_number === n)
                ?.district_name || "Wahlkreis"}
            </option>
          ))}
        </Selection>
        <Selection
          id="local-type"
          label="Gebietsebene"
          value={areaType}
          onChange={(v) => onSelect("localType", v)}
        >
          <option value="municipality">Gemeinden / Gemeindeanteile</option>
          <option value="ward">Wahlbezirke</option>
        </Selection>
        <Selection
          id="local-party"
          label="Partei"
          value={selectedParty}
          onChange={(v) => onSelect("localParty", v)}
        >
          {[...new Set([...parties, ...(query.data?.parties || [])])].map(
            (p) => (
              <option key={p}>{p}</option>
            ),
          )}
        </Selection>
        <label className="text-sm">
          Gebiet suchen
          <Input
            maxLength={100}
            value={search}
            onChange={(e) => onSelect("localSearch", e.target.value)}
          />
        </label>
      </div>
      <DataState
        loading={query.isLoading}
        error={query.error}
        empty={!query.data?.rows.length}
        retry={() => void query.refetch()}
      >
        <DataTable
          headers={[
            "Schlüssel",
            "Gebiet",
            "Berechtigte",
            "Wählende",
            "Beteiligung",
            "Gültige Stimmen",
            "Parteistimmen",
            "Anteil",
            "Datenstand / Quelle",
          ]}
          sortableColumns={[0, 1, 2, 3, 4, 5, 6, 7]}
          sortValues={(query.data?.rows || []).map((r) => [
            r.unit_key,
            r.name,
            r.eligible,
            r.voters,
            localMetrics(r).turnout,
            r.valid_votes,
            r.votes,
            localMetrics(r).share,
          ])}
          rows={(query.data?.rows || []).map((r) => [
            r.unit_key,
            r.name,
            number(r.eligible),
            number(r.voters),
            percent(localMetrics(r).turnout),
            number(r.valid_votes),
            number(r.votes),
            percent(localMetrics(r).share),
            <span>
              {!r.is_verified ? "Entwurf / ungeprüft · " : ""}
              {r.preliminary ? "Vorläufig · " : ""}
              {r.data_release}
              <br />
              {r.boundary_key}
              <br />
              <a
                className="underline"
                href={r.source_url}
                target="_blank"
                rel="noreferrer"
              >
                Quelle
              </a>
            </span>,
          ])}
        />
        <Button
          variant="outline"
          onClick={() =>
            exportAnalysisCsv(
              (query.data?.rows || []).map((r) => ({
                ...r,
                ...localMetrics(r),
              })),
              `Gemeindedaten-${year}-WK${district}-Seite${page + 1}.csv`,
            )
          }
        >
          Diese Seite exportieren
        </Button>
      </DataState>
      <p className="text-xs text-muted-foreground">
        Sortierung bezieht sich auf die aktuell geladene Seite. Je Anfrage
        höchstens 25 Gebiete; kein vollständiger Gemeindedownload im Browser.
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={page <= 0}
          onClick={() => set("localPage", String(page - 1))}
        >
          Zurück
        </Button>
        <span className="py-2 text-sm">
          Seite {page + 1} · {query.data?.total || 0} Gebiete
        </span>
        <Button
          variant="outline"
          disabled={(page + 1) * 25 >= (query.data?.total || 0)}
          onClick={() => set("localPage", String(page + 1))}
        >
          Weiter
        </Button>
      </div>
      {access.isSuperAdmin && (
        <details className="rounded border p-3" data-report-exclude>
          <summary className="cursor-pointer font-medium">
            Amtliche Gebietsdaten zentral übernehmen
          </summary>
          <p className="my-2 text-sm">
            Die oben ausgewählte Wahl, Stimmenart, Nummer und Ebene gelten für
            die Datei. CSV:
            unit_key;name;party;eligible;voters;valid_votes;votes. Gemeinde-AGS
            achtstellig, Wahlbezirk als AGS:Bezirk. Unbekannte
            Berechtigte/Wählende leer, tatsächliche Null als 0. Bis 5.000 Zeilen
            / 2 MB. Bestehende abweichende Einträge werden geschützt und als
            Konflikte gemeldet.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <label>
              Datenstand
              <Input
                maxLength={160}
                value={release}
                onChange={(e) => {
                  setRelease(e.target.value);
                  setVerified(false);
                }}
              />
            </label>
            <label>
              HTTPS-Quelle
              <Input
                type="url"
                value={source}
                onChange={(e) => {
                  setSource(e.target.value);
                  setVerified(false);
                }}
              />
            </label>
            <label>
              Amtliche Gebietsversion / Zuschnitt
              <Input
                maxLength={160}
                value={boundary}
                onChange={(e) => {
                  setBoundary(e.target.value);
                  setVerified(false);
                }}
              />
            </label>
          </div>
          <label className="my-2 flex gap-2">
            <input
              type="checkbox"
              checked={preliminary}
              onChange={(e) => {
                setPreliminary(e.target.checked);
                setVerified(false);
              }}
            />
            Vorläufige Werte
          </label>
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={async (e) => {
              const request = ++fileRequest.current;
              const file = e.target.files?.[0];
              setText("");
              setVerified(false);
              importRows.reset();
              if (!file) return;
              try {
                if (file.size > 2_000_000)
                  throw new Error("Datei größer als 2 MB.");
                const content = await file.text();
                if (request !== fileRequest.current) return;
                setText(content);
                setFileError("");
              } catch (err) {
                if (request !== fileRequest.current) return;
                setFileError(
                  err instanceof Error
                    ? err.message
                    : "Datei konnte nicht geladen werden.",
                );
              }
            }}
          />
          <label className="my-2 flex gap-2">
            <input
              type="checkbox"
              checked={verified}
              onChange={(e) => setVerified(e.target.checked)}
            />
            Amtliche Quelle, Gebietszuschnitt, Datenstand und Zuordnung zur
            obigen Auswahl geprüft
          </label>
          <Button
            variant="outline"
            disabled={
              !text || !verified || importRows.isPending || !preview.value
            }
            onClick={() => importRows.mutate()}
          >
            Geprüfte Zeilen übernehmen
          </Button>
          {preview.error && <p role="status">Vorschau: {preview.error}</p>}
          {preview.value && (
            <>
              <p className="my-2 text-xs">
                Vorschau, noch nicht übernommen: {preview.value.length} Zeilen;
                erste 25 unten.
              </p>
              <DataTable
                headers={[
                  "Schlüssel",
                  "Name",
                  "Partei",
                  "Gültige Stimmen",
                  "Parteistimmen",
                ]}
                rows={preview.value
                  .slice(0, 25)
                  .map((r) => [
                    r.unit_key,
                    r.name,
                    r.party,
                    r.valid_votes,
                    r.votes,
                  ])}
              />
            </>
          )}
          {fileError && <p role="alert">{fileError}</p>}
          {importRows.error && <p role="alert">{importRows.error.message}</p>}
          {importRows.data && (
            <pre className="mt-2 whitespace-pre-wrap text-xs">
              {JSON.stringify(importRows.data, null, 2)}
            </pre>
          )}
        </details>
      )}
    </div>
  );
}
