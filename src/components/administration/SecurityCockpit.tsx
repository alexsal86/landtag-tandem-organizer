import type { JSX } from "react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { EmptyState } from '@/components/ui-patterns';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Shield, AlertTriangle, RefreshCw, Database, Camera } from "lucide-react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { useState } from "react";
import { notify } from "@/lib/notify";
import { SystemPulse } from "@/features/system-pulse/SystemPulse";
import { featureCatalogHref, featuresForTable } from "@/features/feature-catalog/securityLinks";
import { retestScenariosForTable } from "@/features/selftest/tableRetests";
import { loadScenarioSuite, runAndSaveScenarioSuite } from "@/features/selftest/suite";
import {
  AUDIT_FILTER_OPTIONS,
  auditActionsFor,
  type AuditFilter,
} from "./auditSecurityFilter";

type Gap = {
  table_name: string;
  severity: "critical" | "warning" | "ok";
  reason: string;
  has_tenant_id: boolean;
  policy_count: number;
};

type Snapshot = {
  id: string;
  captured_at: string;
  total_tables: number;
  rls_enabled_count: number;
  critical_count: number;
  warning_count: number;
};

type AuditLog = {
  id: string;
  created_at: string;
  user_id: string | null;
  ip_address: string | null;
  action: string;
  payload: Record<string, unknown>;
};

const sevVariant = (s: Gap["severity"]): "default" | "secondary" | "destructive" => {
  if (s === "critical") return "destructive";
  if (s === "warning") return "default";
  return "secondary";
};

export function SecurityCockpit(): JSX.Element {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("");
  const [onlyIssues, setOnlyIssues] = useState(true);
  const [retesting, setRetesting] = useState<string | null>(null);
  const [auditFilter, setAuditFilter] = useState<AuditFilter>("all");

  const gapsQuery = useQuery({
    queryKey: ["rls_gaps", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("audit_rls_gaps");
      if (error) throw error;
      return (data ?? []) as Gap[];
    },
    staleTime: 60_000,
  });

  const snapshotsQuery = useQuery({
    queryKey: ["security_snapshots", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_audit_snapshots")
        .select("id, captured_at, total_tables, rls_enabled_count, critical_count, warning_count")
        .order("captured_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Snapshot[];
    },
    staleTime: 60_000,
  });

  const auditActions = useMemo(() => auditActionsFor(auditFilter), [auditFilter]);

  const auditQuery = useQuery({
    queryKey: ["audit_log_recent", user?.id, currentTenant?.id, auditFilter],
    queryFn: async () => {
      // Der Filter läuft in der Datenbank und damit vor dem Limit. Nur so findet
      // er auch ältere Sicherheitsereignisse; eine Auswahl im Browser würde bloß
      // die zuletzt geladenen Zeilen durchsuchen und wäre damit irreführend.
      let query = supabase
        .from("audit_log_entries")
        .select("id, created_at, user_id, ip_address, action, payload")
        .order("created_at", { ascending: false });
      if (auditActions) query = query.in("action", auditActions);
      const { data, error } = await query.limit(100);
      if (error) throw error;
      return (data ?? []) as AuditLog[];
    },
    staleTime: 30_000,
  });

  const filteredGaps = useMemo(() => {
    const list = gapsQuery.data ?? [];
    return list.filter((g) => {
      if (onlyIssues && g.severity === "ok") return false;
      if (filter && !g.table_name.toLowerCase().includes(filter.toLowerCase())) return false;
      return true;
    });
  }, [gapsQuery.data, filter, onlyIssues]);

  const stats = useMemo(() => {
    const list = gapsQuery.data ?? [];
    return {
      total: list.length,
      critical: list.filter((g) => g.severity === "critical").length,
      warning: list.filter((g) => g.severity === "warning").length,
      ok: list.filter((g) => g.severity === "ok").length,
    };
  }, [gapsQuery.data]);

  const takeSnapshot = async () => {
    const { error } = await supabase.rpc("snapshot_rls_coverage");
    if (error) {
      notify.error("Fehler", { description: error.message
});
      return;
    }
    notify.success("Snapshot erstellt");
    void snapshotsQuery.refetch();
  };

  // Auffälligen Befund nachtesten: Es laufen die Selbsttests, die die betroffene
  // Tabelle laut Coverage-Übersicht abdecken – nicht bloß die Lückenabfrage neu.
  const retestGap = async (gap: Gap) => {
    if (retesting) return;
    const scenarioIds = retestScenariosForTable(gap.table_name);
    if (scenarioIds.length === 0) return;
    const tenantId = currentTenant?.id;
    const userId = user?.id;
    if (!tenantId || !userId) {
      notify.error("Nachtest nicht möglich", { description: "Büro oder Anmeldung fehlt." });
      return;
    }
    setRetesting(gap.table_name);
    try {
      const scenarios = await loadScenarioSuite(scenarioIds);
      if (scenarios.length === 0) {
        notify.error("Keine Szenarien zugeordnet", { description: gap.table_name });
        return;
      }
      const writes = scenarios.some((scenario) => scenario.steps.some((step) => step.kind !== "logic"));
      if (writes && !window.confirm(
        `${scenarios.length} Selbsttest(s) für die Tabelle „${gap.table_name}“ jetzt starten?\n\nEs entstehen echte Testdatensätze und Dateien, die anschließend aufgeräumt werden.`,
      )) return;

      const results = await runAndSaveScenarioSuite(scenarios, { tenantId, userId, keepData: false });
      // Der eingebettete System-Puls soll den frischen Lauf sofort zeigen.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["selftest_runs_pulse", tenantId] }),
        queryClient.invalidateQueries({ queryKey: ["selftest_run_history", tenantId] }),
      ]);
      const failed = results.filter((result) => result.status !== "ok").length;
      if (failed > 0) {
        notify.error(`${gap.table_name}: ${failed} von ${results.length} Selbsttests nicht bestanden`);
      } else {
        notify.success(`${gap.table_name}: ${results.length} Selbsttest(s) bestanden`);
      }
    } catch (error) {
      notify.error("Nachtest fehlgeschlagen", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setRetesting(null);
    }
  };


  return (
    <div className="space-y-6">
      <SystemPulse
        gaps={gapsQuery.data ?? []}
        gapsState={gapsQuery.isPending ? "loading" : gapsQuery.isError ? "error" : "ready"}
      />
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-h2 font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5" /> Security-Cockpit
          </h2>
          <p className="text-body text-muted-foreground">
            RLS-Coverage, Audit-Trail und Snapshots zur Datenbanksicherheit. Jede Tabelle verweist auf die
            zugeordneten Funktionen; dort stehen auch die Policies und der Befund je Funktion. Sicherheitsbefunde
            bleiben von fachlichen Testergebnissen getrennt und ergeben keine pauschale Funktionsbewertung.{" "}
            <Link to="/funktionskatalog" className="font-medium text-primary underline underline-offset-2">
              Funktionskatalog
            </Link>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { void gapsQuery.refetch(); void snapshotsQuery.refetch(); void auditQuery.refetch(); }}>
            <RefreshCw className="mr-2 h-4 w-4" /> Aktualisieren
          </Button>
          <Button size="sm" onClick={takeSnapshot}>
            <Camera className="mr-2 h-4 w-4" /> Snapshot erstellen
          </Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><Database className="h-4 w-4" /> Tabellen</CardDescription>
            <CardTitle className="text-h2 tabular-nums">{gapsQuery.isSuccess ? stats.total : "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-destructive flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" /> Kritisch
            </CardDescription>
            <CardTitle className="text-h2 tabular-nums text-destructive">{gapsQuery.isSuccess ? stats.critical : "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Warnung</CardDescription>
            <CardTitle className="text-h2 tabular-nums">{gapsQuery.isSuccess ? stats.warning : "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>OK</CardDescription>
            <CardTitle className="text-h2 tabular-nums text-palette-green">{gapsQuery.isSuccess ? stats.ok : "—"}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="coverage">
        <TabsList>
          <TabsTrigger value="coverage">RLS-Coverage</TabsTrigger>
          <TabsTrigger value="snapshots">Snapshots</TabsTrigger>
          <TabsTrigger value="audit">Audit-Trail</TabsTrigger>
        </TabsList>

        <TabsContent value="coverage">
          <Card>
            <CardHeader>
              <CardTitle>Tabellen-Sicherheit</CardTitle>
              <div className="flex items-center gap-2 pt-2">
                <Input
                  placeholder="Tabellenname filtern…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="max-w-xs"
                />
                <Button
                  variant={onlyIssues ? "default" : "outline"}
                  size="sm"
                  onClick={() => setOnlyIssues((v) => !v)}
                >
                  Nur Probleme
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {gapsQuery.isPending ? <p role="status">Wird geladen …</p> : gapsQuery.isError ? (
                <p role="alert" className="text-sm text-destructive">RLS-Befunde konnten nicht geladen werden.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Schwere</TableHead>
                      <TableHead>Tabelle</TableHead>
                      <TableHead>Begründung</TableHead>
                      <TableHead className="text-right">Policies</TableHead>
                      <TableHead>tenant_id</TableHead>
                      <TableHead>Funktionen</TableHead>
                      <TableHead className="text-right">Nachtesten</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGaps.map((g) => {
                      const retestScenarios = retestScenariosForTable(g.table_name);
                      return (
                        <TableRow key={g.table_name}>
                          <TableCell>
                            <Badge variant={sevVariant(g.severity)}>{g.severity}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-caption">{g.table_name}</TableCell>
                          <TableCell className="text-caption">{g.reason}</TableCell>
                          <TableCell className="text-right tabular-nums">{g.policy_count}</TableCell>
                          <TableCell>{g.has_tenant_id ? "ja" : "—"}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {featuresForTable(g.table_name).map((feature) => (
                                <Link
                                  key={feature.id}
                                  to={featureCatalogHref(feature.id)}
                                  className="rounded border px-1 py-0.5 font-mono text-[0.7rem] text-primary underline-offset-2 hover:underline"
                                  title={feature.name}
                                >
                                  {feature.id}
                                </Link>
                              ))}
                              {featuresForTable(g.table_name).length === 0 ? <span className="text-muted-foreground">—</span> : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {g.severity === "ok" ? (
                              <span className="text-muted-foreground">—</span>
                            ) : retestScenarios.length === 0 ? (
                              <span className="text-muted-foreground" title="Kein Selbsttest deckt diese Tabelle ab">—</span>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => void retestGap(g)}
                                disabled={retesting !== null}
                                aria-label={`Selbsttests für ${g.table_name} nachtesten`}
                                title={`${retestScenarios.length} Selbsttest(s) decken diese Tabelle ab`}
                              >
                                <RefreshCw className={retesting === g.table_name ? "mr-1 h-3 w-3 animate-spin" : "mr-1 h-3 w-3"} />
                                {retesting === g.table_name ? "Läuft …" : "Nachtesten"}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredGaps.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                          Keine Treffer.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="snapshots">
          <Card>
            <CardHeader>
              <CardTitle>Snapshots</CardTitle>
              <CardDescription>Historische RLS-Coverage-Berichte.</CardDescription>
            </CardHeader>
            <CardContent>
              {snapshotsQuery.isPending ? <p role="status">Wird geladen …</p> : snapshotsQuery.isError ? (
                <p role="alert" className="text-sm text-destructive">Snapshots konnten nicht geladen werden.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Erfasst</TableHead>
                      <TableHead className="text-right">Tabellen</TableHead>
                      <TableHead className="text-right">RLS aktiv</TableHead>
                      <TableHead className="text-right">Kritisch</TableHead>
                      <TableHead className="text-right">Warnung</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(snapshotsQuery.data ?? []).map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-caption">
                          {format(parseISO(s.captured_at), "dd.MM.yyyy HH:mm", { locale: de })}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{s.total_tables}</TableCell>
                        <TableCell className="text-right tabular-nums">{s.rls_enabled_count}</TableCell>
                        <TableCell className="text-right tabular-nums text-destructive">{s.critical_count}</TableCell>
                        <TableCell className="text-right tabular-nums">{s.warning_count}</TableCell>
                      </TableRow>
                    ))}
                    {(snapshotsQuery.data ?? []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-space-md">
                          <EmptyState size="sm" title="Noch keine Snapshots" />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Audit-Trail (letzte 100 Ereignisse)</CardTitle>
              <CardDescription>
                Sicherheitskritische Ereignisse lassen sich filtern. Der Filter greift in der Datenbank und damit
                auch auf ältere Einträge, nicht nur auf die zuletzt geladenen Zeilen.
              </CardDescription>
              <div className="flex flex-wrap items-center gap-2 pt-2" role="group" aria-label="Audit-Trail filtern">
                {AUDIT_FILTER_OPTIONS.map((option) => (
                  <Button
                    key={option.id}
                    size="sm"
                    variant={auditFilter === option.id ? "default" : "outline"}
                    aria-pressed={auditFilter === option.id}
                    title={option.title}
                    onClick={() => setAuditFilter(option.id)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {auditQuery.isPending ? <p role="status">Wird geladen …</p> : auditQuery.isError ? (
                <p role="alert" className="text-sm text-destructive">Audit-Trail konnten nicht geladen werden.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zeit</TableHead>
                      <TableHead>Ereignis</TableHead>
                      <TableHead>Nutzer</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead>Payload</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(auditQuery.data ?? []).map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="text-caption">
                          {format(parseISO(a.created_at), "dd.MM HH:mm:ss", { locale: de })}
                        </TableCell>
                        <TableCell className="font-mono text-caption">{a.action}</TableCell>
                        <TableCell className="font-mono text-caption">{a.user_id?.slice(0, 8) ?? "—"}</TableCell>
                        <TableCell className="font-mono text-caption">{a.ip_address ?? "—"}</TableCell>
                        <TableCell className="text-caption max-w-md truncate">
                          {JSON.stringify(a.payload)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(auditQuery.data ?? []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                          {auditFilter === "all"
                            ? "Keine Einträge."
                            : `Keine Ereignisse für „${AUDIT_FILTER_OPTIONS.find((option) => option.id === auditFilter)?.title ?? auditFilter}“ — auch nicht in älteren Einträgen.`}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
