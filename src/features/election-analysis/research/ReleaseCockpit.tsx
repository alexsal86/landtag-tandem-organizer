import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DataTable, StatusNote } from "../shared";
import { useQualityData } from "./hooks";
import { validateElectionData } from "./calculations";
import { exportAnalysisCsv } from "../model";
import { Button } from "@/components/ui/button";
export function ReleaseCockpit({ year }: { year: number }) {
  const { user } = useAuth(),
    query = useQualityData(year);
  const releases = [
    ...new Set(
      [...(query.data?.results || []), ...(query.data?.state || [])]
        .map((r) => r.data_release)
        .filter((s): s is string => !!s),
    ),
  ].sort();
  const geoIds = [
    ...new Set(
      (query.data?.versions || [])
        .map((v) => v.geography_id)
        .filter((s): s is string => !!s),
    ),
  ].sort();
  const meta = useQuery({
    queryKey: [
      "election-research",
      user?.id,
      "release-cockpit",
      year,
      releases,
      geoIds,
    ],
    enabled: !!user && !!query.data,
    queryFn: async ({ signal }) => {
      const y = await supabase
        .from("election_analysis_years")
        .select("*")
        .eq("year", year)
        .abortSignal(signal)
        .maybeSingle();
      if (y.error) throw y.error;
      const id = y.data?.period_id;
      const replies = await Promise.all([
        releases.length
          ? supabase
              .from("election_analysis_source_reviews")
              .select("*")
              .in("id", releases)
              .limit(10)
              .abortSignal(signal)
          : Promise.resolve({ data: [], error: null }),
        geoIds.length
          ? supabase
              .from("election_analysis_geographies")
              .select("*")
              .in("id", geoIds)
              .limit(5)
              .abortSignal(signal)
          : Promise.resolve({ data: [], error: null }),
        id
          ? supabase
              .from("election_history_periods")
              .select("*")
              .eq("id", id)
              .abortSignal(signal)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        id
          ? supabase
              .from("election_analysis_candidate_coverage")
              .select("*")
              .eq("period_id", id)
              .abortSignal(signal)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        id
          ? supabase
              .from("election_history_mandates")
              .select("id", { head: true, count: "exact" })
              .eq("period_id", id)
              .abortSignal(signal)
          : Promise.resolve({ data: null, error: null, count: 0 }),
        id
          ? supabase
              .from("election_history_candidacies")
              .select("id", { head: true, count: "exact" })
              .eq("period_id", id)
              .abortSignal(signal)
          : Promise.resolve({ data: null, error: null, count: 0 }),
        supabase.from("election_analysis_period_proposals").select("*")
          .eq("election_year", year).eq("verified", true)
          .abortSignal(signal).maybeSingle(),
      ]);
      for (const r of replies) if (r.error) throw r.error;
      return {
        proposal: replies[6].data,
        year: y.data,
        reviews: replies[0].data || [],
        geographies: replies[1].data || [],
        period: replies[2].data,
        coverage: replies[3].data,
        mandates: replies[4].count || 0,
        candidacies: replies[5].count || 0,
      };
    },
    staleTime: 60_000,
    gcTime: 120_000,
    retry: false,
  });
  const rows = useMemo(() => {
    if (!query.data || !meta.data) return [];
    const d = query.data,
      m = meta.data,
      issues = validateElectionData(d.results, d.turnout, d.state),
      fullSourceIds = new Set(
        m.reviews
          .filter(
            (r) => r.status === "verified" && r.kind === "official-results",
          )
          .map((r) => r.id),
      );
    const districtFinal =
      d.results.length > 0 &&
      d.results.every(
        (r) =>
          !r.preliminary &&
          !!r.data_release &&
          fullSourceIds.has(r.data_release),
      );
    const second = d.state.filter((r) => r.ballot === "second"),
      fullState =
        year === 2026 &&
        second.length === 21 &&
        second.every(
          (r) => r.data_release === "official-final-2026-state-20260327",
        ) &&
        m.reviews.some(
          (r) =>
            r.id === "official-final-2026-state-20260327" &&
            r.status === "verified" &&
            r.kind === "official-state-results",
        );
    const geometry =
      d.versions.length === 70 &&
      d.versions.every(
        (v) =>
          v.geography_id &&
          m.geographies.some((g) => g.id === v.geography_id && g.verified),
      );
    const period = m.period;
    return [
      {
        Bereich: "Datensatzfreigabe",
        Status: m.year?.is_published ? "Veröffentlicht" : "Entwurf",
        Hinweis:
          "Freigabe für angemeldete Nutzer ist vom fachlichen Endgültigkeits-/Vollständigkeitsstatus getrennt.",
      },
      {
        Bereich: "Zahlenprüfung",
        Status: issues.some((i) => i.severity === "error")
          ? "Prüfen"
          : "Plausibel",
        Hinweis: `${issues.filter((i) => i.severity === "error").length} Fehler; ${issues.filter((i) => i.severity === "warning").length} Statushinweise. Keine externe Quellenbestätigung.`,
      },
      {
        Bereich: "Endgültige Wahlkreiswerte",
        Status: districtFinal ? "Belegt" : "Prüfen",
        Hinweis: `${d.results.filter((r) => r.preliminary).length} vorläufige Parteizeilen; vollständiger amtlicher Quellenabgleich ${districtFinal ? "vorhanden" : "fehlt"}.`,
      },
      {
        Bereich: "Vollständige Landesparteien",
        Status: fullState ? "Belegt" : "Prüfen",
        Hinweis: fullState
          ? "21 Landeslisten der amtlichen Endfeststellung 2026. Nur Landes-Zweitstimmen, keine Wahlkreisbestätigung."
          : `${second.length} Zweitstimmenzeilen; Vollständigkeit nicht bestätigt.`,
      },
      {
        Bereich: "Periodenspezifische Geometrie",
        Status: geometry ? "Belegt" : "Fehlt",
        Hinweis: `${d.versions.filter((v) => v.geography_id).length}/70 Versionen mit Geometrie; ${d.versions.filter((v) => v.identity_key).length}/70 mit geprüfter Zuschnittidentität.`,
      },
      {
        Bereich: "Historische Verknüpfungen",
        Status:
          d.versions.length === 70 &&
          d.versions.every((v) => v.history_link_verified)
            ? "Bestätigt"
            : "Prüfen",
        Hinweis: `${d.versions.filter((v) => v.history_link_verified).length}/70 ausdrücklich bestätigte Verbindungen.`,
      },
      {
        Bereich: "Wahlperiode und Termine",
        Status: period && m.proposal?.starts_on &&
          period.election_date === m.proposal.election_date &&
          period.starts_on === m.proposal.starts_on &&
          (m.proposal.ends_on || m.proposal.expected_ends_on) &&
          period.ends_on === (m.proposal.ends_on || m.proposal.expected_ends_on) &&
          !!period.ends_on_is_expected === !m.proposal.ends_on
          ? "Belegt" : period ? "Prüfen" : "Fehlt",
        Hinweis: period
          ? `${period.name}; Wahltag ${period.election_date || "fehlt"}, Beginn ${period.starts_on || "fehlt"}, Ende ${period.ends_on || "offen"}${period.ends_on_is_expected ? " (voraussichtlich)" : ""}. Abgleich mit den belegten Terminen aus dem Tabellenblatt Wahlperioden.`
          : "Analysejahr hat keine zugängliche Periodenverknüpfung.",
      },
      {
        Bereich: "Mandate",
        Status: m.mandates ? "Erfasst" : "Fehlt",
        Hinweis: `${m.mandates} zugängliche Einträge, keine Behauptung einer vollständigen Mandatshistorie.`,
      },
      {
        Bereich: "Vollständige Kandidaturen",
        Status: m.coverage?.is_complete ? "Bestätigt" : "Gesperrt",
        Hinweis: `${m.candidacies} erfasst; Sollzahl ${m.coverage?.expected_district_candidacies ?? "unbekannt"}. Erfolglos Kandidierende müssen enthalten sein.`,
      },
      {
        Bereich: "Wahlrechtsmodell 2026",
        Status:
          year === 2026
            ? "Implementiert, nicht freigeprüft"
            : "Nicht implementiert",
        Hinweis:
          "Rechenkern und Referenzabgleich verfügbar. Automatisierte Tests wurden auf Wunsch nicht ausgeführt. Andere Wahlperioden nicht substituieren.",
      },
    ];
  }, [query.data, meta.data, year]);
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h3 className="text-lg font-semibold">
        Daten- und Freigabecockpit {year}
      </h3>
      <StatusNote>
        Ein veröffentlichter Datensatz ist nicht automatisch vollständig oder
        endgültig. Dieses Cockpit trennt Zahlenplausibilität, Quellenprüfung,
        Geometrien, Personen und Wahlrecht. Es ändert keine Daten.
      </StatusNote>
      {query.isLoading || meta.isLoading ? (
        <p role="status">Prüfstände laden …</p>
      ) : query.error || meta.error ? (
        <p role="alert">
          Prüfmetadaten nicht verfügbar; Migrationen und Zugriffsrechte prüfen.
        </p>
      ) : (
        <>
          <DataTable
            headers={["Bereich", "Stand", "Nachweis / Lücke"]}
            rows={rows.map((r) => [r.Bereich, r.Status, r.Hinweis])}
          />
          <Button
            variant="outline"
            onClick={() =>
              exportAnalysisCsv(rows, `Freigabecockpit-${year}.csv`)
            }
          >
            Prüfstand exportieren
          </Button>
          {meta.data?.reviews.map((r) => (
            <p className="text-xs" key={r.id}>
              <a
                className="underline"
                href={r.source_url}
                target="_blank"
                rel="noreferrer"
              >
                {r.kind}: {r.id}
              </a>{" "}
              · {r.status} ·{" "}
              {r.sha256
                ? "Original-Prüfsumme hinterlegt"
                : "Kein Originaldatei-Hash verfügbar"}
            </p>
          ))}
          <Link
            className="block text-sm underline"
            to="/administration?adminSection=superadmin&adminSubSection=election-history"
          >
            Termine, Mandate und Kandidaturen zentral prüfen (Super-Admin)
          </Link>
        </>
      )}
    </section>
  );
}
