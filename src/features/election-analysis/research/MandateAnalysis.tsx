import { AnalysisControls, AnalysisToolbarLayout } from "../AnalysisToolbar";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PersonElectionSummary } from "@/features/election-history/PersonElectionSummary";
import {
  useElectionHistory,
  useElectionPeriods,
} from "@/features/election-history/useElectionHistory";
import { DataState, DataTable, Selection, StatusNote } from "../shared";
import { exportAnalysisCsv, parties, percent } from "../model";
import { useDistrictVersions, useVerifiedCandidates } from "./hooks";
import {
  useCandidateCoverage,
  useCandidatePartyReference,
} from "./mandateHooks";
import {
  candidateComparison,
  candidateCoverageReady,
  directPartyChanges,
  mandateCounts,
  mandateDays,
  mandateKind,
  personTransitions,
} from "./mandateModel";
const kinds = {
  direct: "Direkt",
  second: "Historisches Zweitmandat",
  list: "Liste",
  unclassified: "Art nicht weiter belegt",
};
export default function MandateAnalysis() {
  const [params, setParams] = useSearchParams();
  const periods = useElectionPeriods();
  const published = periods.data?.filter((p) => p.is_published) || [];
  const period =
    published.find((p) => p.id === params.get("analysisPeriod")) ||
    published.find((p) => p.is_current) ||
    published[0];
  const previous = published.find(
    (p) =>
      p.id === params.get("mandateBefore") &&
      p.id !== period?.id &&
      p.number < (period?.number || 0),
  );
  const current = useElectionHistory(period?.id),
    before = useElectionHistory(previous?.id);
  const coverage = useCandidateCoverage(period?.id || "");
  const [candidatesOpen, setCandidatesOpen] = useState(false);
  const ready =
    !!current.data &&
    candidateCoverageReady(current.data, coverage.data) &&
    !coverage.isFetching;
  const versions = useDistrictVersions(
      previous || (candidatesOpen && ready) ? period?.election_year || 0 : 0,
    ),
    oldVersions = useDistrictVersions(previous?.election_year || 0);
  const references = useCandidatePartyReference(
    period?.election_year || 0,
    candidatesOpen && ready,
  );
  const verified = useVerifiedCandidates(
    period?.election_year || 0,
    candidatesOpen && ready ? parties : [],
  );
  const counts = useMemo(
    () => (current.data ? mandateCounts(current.data) : undefined),
    [current.data],
  );
  const transitions = useMemo(
    () =>
      before.data && current.data
        ? personTransitions(before.data, current.data)
        : [],
    [before.data, current.data],
  );
  const changes = useMemo(
    () =>
      before.data && current.data
        ? directPartyChanges(before.data, current.data, [
            ...(versions.data || []),
            ...(oldVersions.data || []),
          ])
        : [],
    [before.data, current.data, versions.data, oldVersions.data],
  );
  const candidateRows = useMemo(
    () =>
      ready && current.data
        ? candidateComparison(
            current.data,
            versions.data || [],
            references.data || [],
            verified.data || [],
          )
        : [],
    [ready, current.data, versions.data, references.data, verified.data],
  );
  const set = (key: string, value: string) =>
    setParams((old) => {
      const next = new URLSearchParams(old);
      next.set(key, value);
      return next;
    });
  const search = params.get("mandateSearch") || "";
  const rows = (current.data?.mandates || []).filter((m) =>
    `${current.data?.people.find((p) => p.id === m.person_id)?.name || m.person_name} ${m.party} ${current.data?.districts.find((d) => d.id === m.district_id)?.name || ""}`
      .toLocaleLowerCase("de-DE")
      .includes(search.toLocaleLowerCase("de-DE")),
  );
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Mandats- und Kandidatenanalyse</h2>
      <DataState
        loading={periods.isLoading}
        error={periods.error}
        empty={!period}
        retry={() => void periods.refetch()}
      >
        <AnalysisToolbarLayout filters={<Selection
          id="mandate-period"
          label="Legislaturperiode"
          value={period?.id || ""}
          onChange={(v) => {
            setCandidatesOpen(false);
            setParams((old) => {
              const next = new URLSearchParams(old);
              next.set("analysisPeriod", v);
              next.delete("mandateBefore");
              return next;
            });
          }}
        >
          {published.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.election_year ? ` · ${p.election_year}` : ""}
            </option>
          ))}
        </Selection>}>
        <StatusNote>
          Gezählt werden erfasste, bei der Wahl gewonnene Mandate; dies ist
          keine Bestätigung einer vollständigen Sitzverteilung. Nachrücker
          stehen separat. Namen allein begründen keine Personenidentität.
          Historische Zweitmandate und Listenmandate bleiben getrennt.
          Amtsdauern sind abgeschlossene Kalendertage einschließlich Beginn und
          Ende; erwartete oder zukünftige Endtermine zählen nicht als bereits
          geleistete Amtszeit.
        </StatusNote>
        <DataState
          loading={current.isLoading}
          error={current.error}
          empty={!current.data}
          retry={() => void current.refetch()}
        >
          <Button
            variant="outline"
            disabled={!counts}
            onClick={() =>
              exportAnalysisCsv(
                counts?.rows || [],
                `Mandatszahlen-${period?.number}.csv`,
              )
            }
          >
            Mandatszahlen exportieren
          </Button>
          {counts && (
            <>
              <DataTable
                headers={[
                  "Partei",
                  "Direkt gewählt",
                  "Zweitmandate",
                  "Listenmandate",
                  "Weitere Listenart ungeklärt",
                  "Nachrücker-Einträge",
                  "Ohne bestätigte Personen-ID",
                ]}
                sortableColumns={[0, 1, 2, 3, 4, 5, 6]}
                sortValues={counts.rows.map((r) => [
                  r.party,
                  r.direct,
                  r.second,
                  r.list,
                  r.unclassified,
                  r.successors,
                  r.unlinked,
                ])}
                rows={counts.rows.map((r) => [
                  r.party,
                  r.direct,
                  r.second,
                  r.list,
                  r.unclassified,
                  r.successors,
                  r.unlinked,
                ])}
              />
              <p className="text-xs text-muted-foreground">
                {counts.duplicates} doppelte Einträge derselben bestätigten
                Person zusammengefasst · {counts.conflicts} widersprüchliche
                Wahleinträge ausgeschlossen. Unverknüpfte Namen bleiben separate
                erfasste Einträge.
              </p>
            </>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="mandate-search" className="text-sm font-medium">
                Mandate filtern
              </label>
              <Input
                id="mandate-search"
                value={search}
                onChange={(e) => set("mandateSearch", e.target.value)}
                placeholder="Name, Partei oder Wahlkreis …"
              />
            </div>
            <Button
              variant="outline"
              onClick={() =>
                exportAnalysisCsv(
                  rows.map((m) => ({
                    Name:
                      current.data?.people.find((p) => p.id === m.person_id)
                        ?.name || m.person_name,
                    Partei: m.party,
                    Wahlkreis: current.data?.districts.find(
                      (d) => d.id === m.district_id,
                    )?.name,
                    Person_bestaetigt: !!m.person_id,
                    Mandatsart: kinds[mandateKind(m)],
                    Eintritt: m.entry_type,
                    Beginn: m.starts_on,
                    Ende: m.ends_on,
                    Ende_voraussichtlich:
                      m.end_from_period && period?.ends_on_is_expected,
                    Abgeschlossene_Kalendertage: period
                      ? mandateDays(m, period, today)
                      : null,
                    Periodendaten_uebernommen:
                      m.start_from_period || m.end_from_period,
                  })),
                  `Mandate-${period?.number}.csv`,
                )
              }
            >
              Mandate exportieren
            </Button>
          </div>
          <DataTable
            headers={[
              "Name",
              "Partei",
              "Wahlkreis",
              "Mandat / Eintritt",
              "Amtszeit",
              "Abgeschlossene Tage",
              "Wiederwahlen",
            ]}
            sortableColumns={[0, 1, 2, 5]}
            sortValues={rows.map((m) => [
              current.data?.people.find((p) => p.id === m.person_id)?.name ||
                m.person_name ||
                "",
              m.party,
              current.data?.districts.find((d) => d.id === m.district_id)
                ?.name || null,
              null,
              null,
              period ? mandateDays(m, period, today) : null,
            ])}
            rows={rows.map((m) => [
              current.data?.people.find((p) => p.id === m.person_id)?.name ||
                m.person_name,
              m.party,
              current.data?.districts.find((d) => d.id === m.district_id)
                ?.name || "Ohne Wahlkreis",
              `${kinds[mandateKind(m)]} · ${m.entry_type === "succession" ? "nachgerückt" : "gewählt"}`,
              `${m.starts_on || "Beginn unbekannt"} – ${m.ends_on || "Ende unbekannt"}${m.end_from_period && period?.ends_on_is_expected ? " (voraussichtlich)" : ""}${m.start_from_period || m.end_from_period ? " · Periodendaten übernommen" : ""}`,
              period ? (mandateDays(m, period, today) ?? "—") : "—",
              m.person_id && period ? (
                <PersonElectionSummary
                  personId={m.person_id}
                  periodId={period.id}
                />
              ) : (
                <span className="text-xs text-muted-foreground">
                  Personenidentität nicht bestätigt
                </span>
              ),
            ])}
          />
          <AnalysisControls>
            <Selection
              id="mandate-before"
              label="Eine frühere Periode ausdrücklich zum Vergleich laden"
              value={previous?.id || ""}
              onChange={(v) => set("mandateBefore", v)}
            >
              <option value="">Kein Periodenvergleich</option>
              {published
                .filter((p) => p.number < (period?.number || 0))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </Selection>
          </AnalysisControls>
          {previous && (
            <DataState
              loading={
                before.isLoading || versions.isLoading || oldVersions.isLoading
              }
              error={before.error || versions.error || oldVersions.error}
              empty={!before.data}
              retry={() =>
                void Promise.all([
                  before.refetch(),
                  versions.refetch(),
                  oldVersions.refetch(),
                ])
              }
            >
              <h3 className="text-lg font-medium">
                {previous.name} → {period?.name}
              </h3>
              <StatusNote>
                „Erneut gewählt“ bedeutet: dieselbe bestätigte Person hat in
                beiden ausgewählten Perioden einen Wahleintrag. Dazwischen
                können weitere Perioden liegen. Nachrücken gilt nicht als
                Wahlsieg. Ein Nichtauftauchen beweist bei unvollständigen Daten
                keinen Personen- oder Parteiwechsel. Direktparteiwechsel
                benötigen dieselbe geprüfte Gebietsidentität und eindeutige
                Direktmandate.
              </StatusNote>
              <Button
                variant="outline"
                onClick={() =>
                  exportAnalysisCsv(
                    transitions.map((r) => ({
                      ...r,
                      Ausgangsperiode: previous.number,
                      Zielperiode: period?.number,
                    })),
                    `Personenwechsel-${previous.number}-${period?.number}.csv`,
                  )
                }
              >
                Personenvergleich exportieren
              </Button>
              <DataTable
                headers={[
                  "Person",
                  "Partei vorher",
                  "Partei danach",
                  "Mandat vorher",
                  "Mandat danach",
                  "Erneut gewählt / Mandatswechsel",
                ]}
                rows={transitions.map((r) => [
                  r.name,
                  r.partyBefore,
                  r.partyAfter,
                  kinds[r.kindBefore],
                  kinds[r.kindAfter],
                  r.typeChanged
                    ? "Erneut gewählt · Direkt/Liste gewechselt"
                    : "Erneut gewählt",
                ])}
              />
              {!transitions.length && (
                <p className="text-sm text-muted-foreground">
                  Keine eindeutigen bestätigten Personenpaare erfasst; das
                  bedeutet nicht null tatsächliche Wiederwahlen.
                </p>
              )}
              <Button
                variant="outline"
                onClick={() =>
                  exportAnalysisCsv(
                    changes,
                    `Direktparteien-${previous.number}-${period?.number}.csv`,
                  )
                }
              >
                Direktparteien exportieren
              </Button>
              <DataTable
                headers={[
                  "Nr.",
                  "Wahlkreis",
                  "Direktpartei vorher",
                  "Direktpartei danach",
                  "Wechsel / Hinweis",
                ]}
                sortableColumns={[0, 1]}
                sortValues={changes.map((r) => [
                  r.districtNumber || null,
                  r.districtName,
                ])}
                rows={changes.map((r) => [
                  r.districtNumber || "—",
                  r.districtName,
                  r.partyBefore || "—",
                  r.partyAfter || "—",
                  r.changed == null
                    ? r.reason
                    : r.changed
                      ? "Direktpartei gewechselt"
                      : "Direktpartei gleich",
                ])}
              />
            </DataState>
          )}
          <details
            className="rounded-lg border p-4"
            onToggle={(e) => setCandidatesOpen(e.currentTarget.open)}
          >
            <summary className="cursor-pointer font-medium">
              Kandidaturergebnisse und Parteireferenz
            </summary>
            {coverage.isLoading || coverage.isFetching ? (
              <p role="status">Vollständigkeit wird geprüft …</p>
            ) : coverage.error ? (
              <p role="alert">Vollständigkeitsprüfung nicht verfügbar.</p>
            ) : !ready ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Gesperrt: Die vollständigen Wahlkreiskandidaturen einschließlich
                erfolgloser Personen sind noch nicht zentral bestätigt. Unter
                Administration → Wahldaten & Mandatshistorie → Kandidaturen &
                Ergebnisse prüfen. Mandate werden nicht als Ersatz für fehlende
                Kandidaturen verwendet.
              </p>
            ) : (
              <>
                <StatusNote>
                  Die Datenvollständigkeit wurde zentral bestätigt.
                  Kandidaten-Erstanteil minus Parteizweitanteil ist eine
                  deskriptive Differenz, kein kausaler Amtsinhaber- oder
                  persönlicher Effekt. Vor 2026 gibt es keinen unabhängigen
                  Zweitstimmenvergleich. Ein konkreter Vergleich benötigt
                  zusätzlich die bestätigte amtliche Kandidatur, Personen-ID,
                  Wahlkreisverbindung und denselben endgültigen Datenstand.
                </StatusNote>
                <DataState
                  loading={
                    references.isLoading ||
                    verified.isLoading ||
                    versions.isLoading
                  }
                  error={references.error || verified.error || versions.error}
                  empty={!candidateRows.length}
                  retry={() =>
                    void Promise.all([references.refetch(), verified.refetch()])
                  }
                >
                  <Button
                    className="my-3"
                    variant="outline"
                    onClick={() =>
                      exportAnalysisCsv(
                        candidateRows.map((r) => ({
                          Name: current.data?.people.find(
                            (p) => p.id === r.candidacy.person_id,
                          )?.name,
                          Partei: r.candidacy.party,
                          Wahlkreis: current.data?.districts.find(
                            (d) => d.id === r.candidacy.district_id,
                          )?.name,
                          Persoenliche_Stimmen: r.candidacy.votes,
                          Persoenlicher_Anteil: r.candidacy.vote_share,
                          Parteizweitstimmen: r.partyResult?.votes,
                          Parteizweitanteil: r.partyResult?.share,
                          Parteireferenz_vorlaeufig: r.partyResult?.preliminary,
                          Parteireferenz_Datenstand:
                            r.partyResult?.data_release,
                          Differenz_PP: r.difference,
                          Hinweis: r.reason,
                        })),
                        `Kandidaturen-${period?.number}.csv`,
                      )
                    }
                  >
                    Kandidaturen exportieren
                  </Button>
                  <DataTable
                    headers={[
                      "Name",
                      "Partei",
                      "Wahlkreis",
                      "Persönliche Stimmen",
                      "Persönlicher Anteil",
                      "Parteizweitanteil",
                      "Differenz PP / Hinweis",
                    ]}
                    rows={candidateRows.map((r) => [
                      current.data?.people.find(
                        (p) => p.id === r.candidacy.person_id,
                      )?.name,
                      r.candidacy.party,
                      current.data?.districts.find(
                        (d) => d.id === r.candidacy.district_id,
                      )?.name,
                      r.candidacy.votes,
                      percent(r.candidacy.vote_share),
                      `${percent(r.partyResult?.share)}${r.partyResult?.preliminary ? " · vorläufig" : ""}`,
                      r.difference == null
                        ? r.reason
                        : `${r.difference > 0 ? "+" : ""}${r.difference.toLocaleString("de-DE", { maximumFractionDigits: 2 })} PP`,
                    ])}
                  />
                </DataState>
              </>
            )}
          </details>
        </DataState>
        </AnalysisToolbarLayout>
      </DataState>
    </div>
  );
}
