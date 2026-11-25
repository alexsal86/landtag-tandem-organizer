import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search, ShieldCheck } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useResolvedUserRole } from "@/hooks/useResolvedUserRole";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { catalogAreas, catalogFeatures } from "./inventory";
import { EMPTY_FILTERS, computeMetrics, filterFeatures, type FeatureFilters } from "./metrics";
import { catalogPages, entityMapMarkdown, type CatalogPage } from "./catalogContent";
import { MarkdownView } from "./MarkdownView";
import { groupSecurityByTable, useTableSecurity } from "./useTableSecurity";
import {
  FEATURE_CATEGORIES,
  IMPLEMENTATION_STATUSES,
  INTEGRATION_STATUSES,
  TEST_COVERAGE_STATUSES,
  type ResolvedFeature,
} from "./types";

const entityPage: CatalogPage = { id: "entity-map", title: "Entitätskarte", markdown: entityMapMarkdown };

const docLabels: Record<string, string> = {
  README: "Übersicht",
  matrix: "Abdeckungsmatrix",
  roles: "Rollen & Rechte",
  dependencies: "Abhängigkeiten",
  review: "Prüfbericht",
};

const labelForPage = (page: CatalogPage) => docLabels[page.id] ?? page.title;

type View =
  | { type: "overview" }
  | { type: "area"; id: string }
  | { type: "feature"; id: string }
  | { type: "doc"; id: string };

const coverageLabel: Record<string, string> = {
  selftest: "Selbsttest",
  unit: "Unit-Test",
  integration: "Integrationstest",
  browser: "Browser-Test",
  security: "Security-Test",
  teilweise: "teilweise",
  keine: "kein Test",
  ungeprueft: "ungeprüft",
};

const integrationLabel: Record<string, string> = {
  ui: "UI",
  system: "systemseitig",
  rollenabhaengig: "rollenabhängig",
  "feature-flag": "Feature Flag",
  "ohne-einbindung": "ohne Einbindung",
  ungeprueft: "ungeprüft",
  "nicht-anwendbar": "nicht anwendbar",
};

const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "implementiert") return "default";
  if (status === "teilweise") return "secondary";
  if (status === "verwaist" || status === "deaktiviert" || status === "unklar") return "destructive";
  return "outline";
};

function Metric({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-xs font-medium">{label}</div>
      {hint ? <div className="text-[0.7rem] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function RefList({ title, values, empty = "—" }: { title: string; values: string[]; empty?: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      {values.length ? (
        <ul className="mt-1 flex flex-wrap gap-1">
          {values.map((value) => (
            <li key={value}>
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.75rem]">{value}</code>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

const rlsSeverityVariant = (severity: string): "default" | "secondary" | "destructive" | "outline" => {
  if (severity === "critical") return "destructive";
  if (severity === "warning") return "default";
  if (severity === "ok") return "secondary";
  return "outline";
};

/**
 * Sicherheitsbefunde und Policies je Tabelle – getrennt von den funktionalen
 * Testergebnissen und ohne daraus eine Gesamtbewertung der Funktion abzuleiten.
 */
function SecuritySection({ feature }: { feature: ResolvedFeature }) {
  const { gapsQuery, policiesQuery } = useTableSecurity(feature.tables);
  const securityByTable = groupSecurityByTable(feature.tables, gapsQuery.data ?? [], policiesQuery.data ?? []);

  if (feature.tables.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck aria-hidden="true" className="h-4 w-4" /> Sicherheitsbezug (RLS)
          </CardTitle>
          <CardDescription>
            Dieser Funktion sind keine Datenbanktabellen zugeordnet. Damit gibt es keinen RLS-Bezug; das ist keine
            Aussage über die Sicherheit der Funktion.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck aria-hidden="true" className="h-4 w-4" /> Sicherheitsbezug (RLS)
        </CardTitle>
        <CardDescription>
          Live-Befunde des Security-Cockpits für die zugeordneten Tabellen. Sie bewerten nicht die Funktion und sind
          kein funktionales Testergebnis; die Testangaben oben bleiben davon getrennt.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {gapsQuery.isLoading || policiesQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Sicherheitsdaten werden geladen …</p>
        ) : null}
        {gapsQuery.isError ? (
          <p role="alert" className="text-sm text-destructive">
            RLS-Befunde konnten nicht geladen werden. Es wird keine Bewertung ersatzweise angenommen.
          </p>
        ) : null}
        {policiesQuery.isError ? (
          <p role="status" className="rounded border border-dashed p-2 text-xs text-muted-foreground">
            Policy-Details sind nicht verfügbar. Vermutlich ist die Migration
            {" "}
            <code className="font-mono">20261125160000_feature_security_policy_links.sql</code> noch nicht angewendet.
            Die RLS-Befunde bleiben sichtbar; eine Bewertung wird nicht ersatzweise angenommen.
          </p>
        ) : null}

        {securityByTable.map(({ table, gap, policies }) => {
          return (
            <div key={table} className="rounded-md border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <code className="font-mono text-xs">{table}</code>
                {gap ? (
                  <Badge variant={rlsSeverityVariant(gap.severity)}>{gap.severity}</Badge>
                ) : (
                  <Badge variant="outline">kein Befund</Badge>
                )}
                {gap ? <span className="text-xs text-muted-foreground">{gap.reason}</span> : null}
                {gap ? <span className="text-xs text-muted-foreground">{gap.policy_count} Policies</span> : null}
                {gap ? <span className="text-xs text-muted-foreground">tenant_id: {gap.has_tenant_id ? "ja" : "nein"}</span> : null}
              </div>

              {policies.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {policies.map((policy) => (
                    <li key={`${policy.table_name}:${policy.policy_name}`} className="flex flex-wrap items-center gap-2 text-xs">
                      <code className="rounded bg-muted px-1 py-0.5 font-mono">{policy.policy_name}</code>
                      <Badge variant="outline">{policy.command}</Badge>
                      <span className="text-muted-foreground">{policy.roles.join(", ") || "—"}</span>
                      {policy.has_using ? <span className="text-muted-foreground">USING</span> : null}
                      {policy.has_check ? <span className="text-muted-foreground">WITH CHECK</span> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  {policiesQuery.isError
                    ? "Für diese Tabelle liegen keine Policy-Details vor; der RLS-Befund oben gilt unabhängig davon."
                    : policiesQuery.isSuccess
                      ? "Keine Policy für diese Tabelle gefunden."
                      : "Policies werden geladen …"}
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function FeatureDetail({ feature }: { feature: ResolvedFeature }) {
  const area = catalogAreas.find((candidate) => candidate.id === feature.area);
  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{feature.name}</h2>
          <Badge variant={statusVariant(feature.implementationStatus)}>{feature.implementationStatus}</Badge>
          <Badge variant="outline">{feature.category}</Badge>
        </div>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{feature.id}</p>
        <p className="mt-2 text-sm">{feature.description}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Einbindung" value={integrationLabel[feature.integrationStatus]} />
        <Metric label="Testabdeckung" value={coverageLabel[feature.coverage]} />
        <Metric label="Letztes Ergebnis" value={feature.testResult} hint="kein Nachweis eines Laufs" />
        <Metric label="Bereich" value={area?.title ?? feature.area} hint={feature.subarea} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <RefList title="Rollen" values={feature.roles} empty="Keine besondere Rolle deklariert" />
        <RefList title="Routen" values={feature.routes} />
        <RefList title="Frontend-Komponenten" values={feature.components} />
        <RefList title="Services" values={feature.services} />
        <RefList title="Hooks" values={feature.hooks} />
        <RefList title="Edge Functions" values={feature.edgeFunctions} />
        <RefList title="Datenbankfunktionen (RPC)" values={feature.rpcs} />
        <RefList title="Datenbanktabellen" values={feature.tables} />
        <RefList title="Abhängigkeiten" values={feature.dependsOn} />
        <RefList title="Selbsttest-Szenarien" values={feature.scenarios} empty="Kein Selbsttest zugeordnet" />
        <RefList title="Unit-Tests" values={feature.unitTests} />
        <RefList title="Integrationstests" values={feature.integrationTests} />
        <RefList title="Browser-Tests" values={feature.e2eTests} />
        <RefList title="Dokumentation" values={feature.docs} empty="Kein Dokumentationsverweis" />
        <RefList title="Nachweise im Quellcode" values={feature.evidence} />
      </div>

      <SecuritySection feature={feature} />

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold">Bekannte Einschränkungen</h3>
          {feature.limitations.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {feature.limitations.map((item) => <li key={item}>{item}</li>)}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Keine deklariert.</p>
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold">Offene Prüfpunkte</h3>
          {feature.reviewPoints.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {feature.reviewPoints.map((item) => <li key={item}>{item}</li>)}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Keine offen.</p>
          )}
        </div>
      </div>
    </div>
  );
}

const optionLabel = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

function FilterSelect({
  label,
  value,
  options,
  onChange,
  allLabel,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  allLabel: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium">
      {label}
      <Select value={value || "all"} onValueChange={(next) => onChange(next === "all" ? "" : next)}>
        <SelectTrigger aria-label={label} className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>{optionLabel(option)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

export function FeatureCatalogView() {
  const { hasAdminAccess, loading } = useResolvedUserRole();
  const [view, setView] = useState<View>({ type: "overview" });
  const [filters, setFilters] = useState<FeatureFilters>(EMPTY_FILTERS);
  const [searchParams] = useSearchParams();
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());
  const pages = useMemo(() => [...catalogPages, entityPage], []);

  useEffect(() => {
    const featureId = searchParams.get("feature");
    if (featureId && catalogFeatures.some((feature) => feature.id === featureId)) {
      setView({ type: "feature", id: featureId });
    }
  }, [searchParams]);

  const filtered = useMemo(() => filterFeatures(catalogFeatures, filters), [filters]);
  const metrics = useMemo(() => computeMetrics(filtered), [filtered]);
  const allMetrics = useMemo(() => computeMetrics(catalogFeatures), []);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Zugriff wird geprüft …</div>;
  }

  if (!hasAdminAccess) {
    return (
      <div className="p-4 md:p-6">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="text-base">Kein Zugriff</CardTitle>
            <CardDescription>
              Der Funktionskatalog zeigt Tabellen- und Beziehungswissen und ist nur für Administration und Büroleitung
              sichtbar. Bitte wenden Sie sich an die Büroleitung.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const setFilter = <K extends keyof FeatureFilters>(key: K, value: FeatureFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  const toggleArea = (id: string) => {
    setExpandedAreas((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const showFeature = (id: string) => setView({ type: "feature", id });
  const selectedFeature = view.type === "feature" ? catalogFeatures.find((feature) => feature.id === view.id) : undefined;
  const selectedArea = view.type === "area" ? catalogAreas.find((area) => area.id === view.id) : undefined;
  const selectedDoc = view.type === "doc" ? pages.find((page) => page.id === view.id) : undefined;

  const handleNavigatePage = (id: string) => {
    if (pages.some((page) => page.id === id)) setView({ type: "doc", id });
  };

  const renderOverview = () => (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Funktionen" value={allMetrics.features} />
        <Metric label="Bereiche" value={allMetrics.areas} hint={`${allMetrics.subareas} Unterbereiche`} />
        <Metric label="implementiert" value={allMetrics.implemented} />
        <Metric label="teilweise" value={allMetrics.partial} />
        <Metric label="deaktiviert" value={allMetrics.disabled} />
        <Metric label="verwaist" value={allMetrics.orphaned} />
        <Metric label="mit Selbsttest" value={allMetrics.withSelftest} />
        <Metric label="mit Browser-Test" value={allMetrics.withBrowserTest} />
        <Metric label="ohne Test" value={allMetrics.withoutAnyTest} />
        <Metric label="ohne Doku" value={allMetrics.missingDocumentation} />
        <Metric label="Prüfkandidaten" value={allMetrics.reviewCandidates} />
        <Metric label="technische Zuordnungen" value={allMetrics.technicalAssignments} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Bestand</CardTitle>
          <CardDescription>
            Alle Kennzahlen stammen aus dem versionierten Funktionskatalog. Ein vorhandener Test ist kein bestandener
            Test; Testergebnisse stehen separat.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {catalogAreas.map((area) => {
            const areaMetrics = computeMetrics(area.features);
            return (
              <button
                key={area.id}
                type="button"
                onClick={() => setView({ type: "area", id: area.id })}
                className="rounded-md border p-3 text-left transition-colors hover:bg-muted/60"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{area.title}</span>
                  <Badge variant="outline">{areaMetrics.features}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{area.purpose}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {area.subareas.length} Unterbereiche · {areaMetrics.withoutAnyTest} ohne Test · {areaMetrics.missingDocumentation} ohne Doku
                </p>
              </button>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );

  const renderArea = (areaId: string) => {
    const area = catalogAreas.find((candidate) => candidate.id === areaId);
    if (!area) return null;
    const features = filtered.filter((feature) => feature.area === areaId);
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">{area.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{area.purpose}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{features.length} Funktionen (gefiltert)</Badge>
          <Badge variant="outline">{area.subareas.length} Unterbereiche</Badge>
        </div>
        {area.subareas.map((subarea) => {
          const subFeatures = features.filter((feature) => feature.subarea === subarea);
          if (subFeatures.length === 0) return null;
          return (
            <section key={subarea} className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{subarea}</h3>
              <div className="space-y-2">
                {subFeatures.map((feature) => (
                  <button
                    key={feature.id}
                    type="button"
                    onClick={() => showFeature(feature.id)}
                    className="flex w-full flex-col gap-1 rounded-md border p-3 text-left transition-colors hover:bg-muted/60"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{feature.name}</span>
                      <Badge variant={statusVariant(feature.implementationStatus)}>{feature.implementationStatus}</Badge>
                      <Badge variant="outline">{coverageLabel[feature.coverage]}</Badge>
                    </span>
                    <span className="text-xs text-muted-foreground">{feature.description}</span>
                    <span className="font-mono text-[0.7rem] text-muted-foreground">{feature.id}</span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold">Funktionskatalog</h1>
        <p className="text-sm text-muted-foreground">
          Schreibgeschützt. Quelle ist der versionierte Funktionsbestand; Dokumentation wird daraus erzeugt.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Katalog</CardTitle>
            <CardDescription className="text-xs">
              {filtered.length} von {catalogFeatures.length} Funktionen
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-2">
            <div className="space-y-2 px-1">
              <div className="relative">
                <Search aria-hidden="true" className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
                <Input
                  aria-label="Funktionen durchsuchen"
                  placeholder="Volltextsuche …"
                  value={filters.query}
                  onChange={(event) => setFilter("query", event.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <FilterSelect label="Funktionsbereich" value={filters.area} allLabel="Alle Bereiche" options={catalogAreas.map((area) => area.id)} onChange={(value) => setFilter("area", value)} />
              <FilterSelect label="Kategorie" value={filters.category} allLabel="Alle Kategorien" options={FEATURE_CATEGORIES} onChange={(value) => setFilter("category", value as FeatureFilters["category"])} />
              <FilterSelect label="Implementierungsstatus" value={filters.implementationStatus} allLabel="Alle Status" options={IMPLEMENTATION_STATUSES} onChange={(value) => setFilter("implementationStatus", value as FeatureFilters["implementationStatus"])} />
              <FilterSelect label="Einbindungsstatus" value={filters.integrationStatus} allLabel="Alle Einbindungen" options={INTEGRATION_STATUSES} onChange={(value) => setFilter("integrationStatus", value as FeatureFilters["integrationStatus"])} />
              <FilterSelect label="Testabdeckung" value={filters.coverage} allLabel="Alle Abdeckungen" options={TEST_COVERAGE_STATUSES} onChange={(value) => setFilter("coverage", value as FeatureFilters["coverage"])} />
              <FilterSelect label="Dokumentation" value={filters.documentation} allLabel="Alle" options={["dokumentiert", "fehlend"]} onChange={(value) => setFilter("documentation", value as FeatureFilters["documentation"])} />
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={filters.onlyWithoutTests} onChange={(event) => setFilter("onlyWithoutTests", event.target.checked)} />
                nur ohne Test
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={filters.onlyReviewCandidates} onChange={(event) => setFilter("onlyReviewCandidates", event.target.checked)} />
                nur offene Prüfpunkte
              </label>
              <button type="button" className="text-xs text-primary underline underline-offset-2" onClick={() => setFilters(EMPTY_FILTERS)}>
                Filter zurücksetzen
              </button>
            </div>

            <nav className="flex max-h-[42vh] flex-col gap-0.5 overflow-y-auto" aria-label="Katalogbereiche">
              <button
                type="button"
                onClick={() => setView({ type: "overview" })}
                aria-current={view.type === "overview" ? "page" : undefined}
                className={cn("rounded-md px-3 py-2 text-left text-sm transition-colors", view.type === "overview" ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted")}
              >
                Übersicht
              </button>
              {catalogAreas.map((area) => {
                const areaFeatures = filtered.filter((feature) => feature.area === area.id);
                const expanded = expandedAreas.has(area.id) || Boolean(filters.query) || Boolean(filters.area);
                const showAll = expanded || areaFeatures.length === 0;
                return (
                  <div key={area.id}>
                    <button
                      type="button"
                      onClick={() => {
                        toggleArea(area.id);
                        setView({ type: "area", id: area.id });
                      }}
                      aria-expanded={showAll}
                      className={cn(
                        "flex w-full items-center gap-1 rounded-md px-2 py-2 text-left text-sm transition-colors",
                        view.type === "area" && view.id === area.id ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted",
                      )}
                    >
                      {showAll ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                      <span className="flex-1">{area.title}</span>
                      <span className="text-xs text-muted-foreground">{areaFeatures.length}</span>
                    </button>
                    {showAll
                      ? (filters.area && filters.area !== area.id ? [] : area.subareas).map((subarea) => {
                          const subFeatures = areaFeatures.filter((feature) => feature.subarea === subarea);
                          if (subFeatures.length === 0) return null;
                          return (
                            <div key={subarea} className="ml-4 border-l pl-2">
                              <div className="px-2 py-1 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">{subarea}</div>
                              {subFeatures.map((feature) => (
                                <button
                                  key={feature.id}
                                  type="button"
                                  onClick={() => showFeature(feature.id)}
                                  aria-current={view.type === "feature" && view.id === feature.id ? "page" : undefined}
                                  className={cn(
                                    "block w-full rounded px-2 py-1 text-left text-xs transition-colors",
                                    view.type === "feature" && view.id === feature.id ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted",
                                  )}
                                >
                                  {feature.name}
                                </button>
                              ))}
                            </div>
                          );
                        })
                      : null}
                  </div>
                );
              })}
              <div className="mt-2 border-t pt-2">
                <div className="px-2 py-1 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">Dokumentation</div>
                {pages.filter((page) => page.id !== "README").map((page) => (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() => setView({ type: "doc", id: page.id })}
                    aria-current={view.type === "doc" && view.id === page.id ? "page" : undefined}
                    className={cn(
                      "block w-full rounded px-2 py-1 text-left text-xs transition-colors",
                      view.type === "doc" && view.id === page.id ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted",
                    )}
                  >
                    {labelForPage(page)}
                  </button>
                ))}
              </div>
            </nav>
          </CardContent>
        </Card>

        <Card>
          <ScrollArea className="max-h-[calc(100vh-12rem)]">
            <CardContent className="px-5 py-4">
              {view.type === "overview" ? renderOverview() : null}
              {view.type === "area" ? renderArea(view.id) : null}
              {view.type === "feature" && selectedFeature ? <FeatureDetail feature={selectedFeature} /> : null}
              {view.type === "feature" && !selectedFeature ? (
                <p className="text-sm text-muted-foreground">Die gewählte Funktion ist nicht im Katalog enthalten.</p>
              ) : null}
              {view.type === "doc" && selectedDoc ? (
                <MarkdownView markdown={selectedDoc.markdown} onNavigatePage={handleNavigatePage} />
              ) : null}
              {view.type === "doc" && !selectedDoc ? (
                <p className="text-sm text-muted-foreground">
                  Diese Dokumentationsseite wurde beim Build nicht eingebunden. <code>npm run update:feature-catalog</code> ausführen und neu bauen.
                </p>
              ) : null}
              {view.type === "area" && !selectedArea ? (
                <p className="text-sm text-muted-foreground">Der gewählte Funktionsbereich ist nicht enthalten.</p>
              ) : null}
              {metrics.features === 0 && view.type !== "doc" ? (
                <p className="mt-4 text-xs text-muted-foreground">Kein Eintrag entspricht den aktiven Filtern.</p>
              ) : null}
            </CardContent>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}
