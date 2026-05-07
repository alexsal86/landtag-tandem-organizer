import type { JSX } from "react";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import * as RechartsPrimitive from "recharts";
import { Activity, AlertTriangle, Database, RefreshCw, TrendingUp } from "lucide-react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";

type TableSize = { table_name: string; total_bytes: number; row_count: number };
type Growth = TableSize & { delta_bytes: number; delta_pct: number | null };
type EgressMetric = {
  id: string;
  metric_date: string;
  collected_at: string;
  db_size_bytes: number | null;
  table_sizes: TableSize[];
  top_tables_by_growth: Growth[];
};
type Anomaly = {
  id: string;
  detected_at: string;
  metric_date: string;
  severity: "info" | "warning" | "critical";
  anomaly_type: string;
  table_name: string | null;
  baseline_value: number | null;
  current_value: number | null;
  delta_pct: number | null;
  message: string;
  acknowledged_at: string | null;
};

const formatBytes = (bytes: number | null | undefined): string => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 100 ? 0 : 1)} ${units[i]}`;
};

const severityVariant = (s: Anomaly["severity"]): "default" | "secondary" | "destructive" => {
  if (s === "critical") return "destructive";
  if (s === "warning") return "default";
  return "secondary";
};

export function PerformanceDashboard(): JSX.Element {
  const { toast } = useToast();

  const metricsQuery = useQuery({
    queryKey: ["egress_metrics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("egress_metrics")
        .select("id, metric_date, collected_at, db_size_bytes, table_sizes, top_tables_by_growth")
        .order("metric_date", { ascending: false })
        .limit(14);
      if (error) throw error;
      return (data ?? []) as unknown as EgressMetric[];
    },
    staleTime: 60_000,
  });

  const anomaliesQuery = useQuery({
    queryKey: ["egress_anomalies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("egress_anomalies")
        .select(
          "id, detected_at, metric_date, severity, anomaly_type, table_name, baseline_value, current_value, delta_pct, message, acknowledged_at",
        )
        .order("detected_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as Anomaly[];
    },
    staleTime: 60_000,
  });

  const series = useMemo(() => {
    if (!metricsQuery.data) return [];
    return [...metricsQuery.data]
      .reverse()
      .map((m) => ({
        date: format(parseISO(m.metric_date), "dd.MM", { locale: de }),
        size: m.db_size_bytes ?? 0,
      }));
  }, [metricsQuery.data]);

  const latest = metricsQuery.data?.[0];
  const previous = metricsQuery.data?.[1];
  const dbDelta =
    latest && previous && previous.db_size_bytes
      ? ((Number(latest.db_size_bytes ?? 0) - Number(previous.db_size_bytes)) /
          Number(previous.db_size_bytes)) *
        100
      : null;

  const triggerCollection = async (): Promise<void> => {
    try {
      const { error } = await supabase.functions.invoke("collect-egress-metrics", { body: {} });
      if (error) throw error;
      toast({ title: "Sammlung gestartet", description: "Aktuelle Metriken werden erfasst." });
      void metricsQuery.refetch();
    } catch (e) {
      toast({
        title: "Fehler",
        description: e instanceof Error ? e.message : "Unbekannt",
        variant: "destructive",
      });
    }
  };

  const acknowledge = async (id: string): Promise<void> => {
    const { error } = await supabase
      .from("egress_anomalies")
      .update({ acknowledged_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    void anomaliesQuery.refetch();
  };

  const openAnomalies = anomaliesQuery.data?.filter((a) => !a.acknowledged_at) ?? [];

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-h2 font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5" /> Performance & Egress
          </h2>
          <p className="text-body text-muted-foreground">
            Tägliche Metriken zur Datenbankgröße und Anomalien (Cron 02:00 UTC).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={triggerCollection}>
          <RefreshCw className="mr-2 h-4 w-4" /> Jetzt sammeln
        </Button>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><Database className="h-4 w-4" /> DB-Größe</CardDescription>
            <CardTitle className="text-h2 tabular-nums">{formatBytes(latest?.db_size_bytes ?? 0)}</CardTitle>
          </CardHeader>
          <CardContent className="text-caption text-muted-foreground">
            {dbDelta !== null ? `${dbDelta >= 0 ? "+" : ""}${dbDelta.toFixed(2)} % vs. Vortag` : "Keine Vergleichsdaten"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><TrendingUp className="h-4 w-4" /> Tabellen erfasst</CardDescription>
            <CardTitle className="text-h2 tabular-nums">{latest?.table_sizes?.length ?? 0}</CardTitle>
          </CardHeader>
          <CardContent className="text-caption text-muted-foreground">
            Letzte Erfassung: {latest ? format(parseISO(latest.collected_at), "dd.MM.yyyy HH:mm", { locale: de }) : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Offene Anomalien</CardDescription>
            <CardTitle className="text-h2 tabular-nums">{openAnomalies.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-caption text-muted-foreground">
            {openAnomalies.filter((a) => a.severity === "critical").length} kritisch
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datenbankgröße – letzte 14 Tage</CardTitle>
        </CardHeader>
        <CardContent>
          {series.length === 0 ? (
            <p className="text-body text-muted-foreground">
              Noch keine Daten. Klicke „Jetzt sammeln", um eine erste Erfassung zu starten.
            </p>
          ) : (
            <ChartContainer
              config={{ size: { label: "DB-Größe", color: "hsl(var(--primary))" } }}
              className="h-[280px] w-full"
            >
              <RechartsPrimitive.AreaChart data={series}>
                <RechartsPrimitive.CartesianGrid strokeDasharray="3 3" />
                <RechartsPrimitive.XAxis dataKey="date" tickLine={false} axisLine={false} />
                <RechartsPrimitive.YAxis
                  tickFormatter={(v) => formatBytes(Number(v))}
                  tickLine={false}
                  axisLine={false}
                  width={70}
                />
                <ChartTooltip
                  content={<ChartTooltipContent formatter={(v) => formatBytes(Number(v))} />}
                />
                <RechartsPrimitive.Area
                  type="monotone"
                  dataKey="size"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary) / 0.15)"
                />
              </RechartsPrimitive.AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top 10 wachsende Tabellen (vs. Vortag)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tabelle</TableHead>
                <TableHead className="text-right">Aktuell</TableHead>
                <TableHead className="text-right">Δ Bytes</TableHead>
                <TableHead className="text-right">Δ %</TableHead>
                <TableHead className="text-right">Zeilen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(latest?.top_tables_by_growth ?? []).slice(0, 10).map((row) => (
                <TableRow key={row.table_name}>
                  <TableCell className="font-mono text-caption">{row.table_name}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBytes(row.total_bytes)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBytes(row.delta_bytes)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.delta_pct !== null ? `${row.delta_pct.toFixed(1)} %` : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.row_count.toLocaleString("de-DE")}</TableCell>
                </TableRow>
              ))}
              {(latest?.top_tables_by_growth ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    Keine Daten verfügbar.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Anomalien</CardTitle>
          <CardDescription>Tabellen-Wachstum &gt; 50 % gegenüber 7-Tage-Mittel</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Schwere</TableHead>
                <TableHead>Erkannt</TableHead>
                <TableHead>Tabelle</TableHead>
                <TableHead className="text-right">Δ %</TableHead>
                <TableHead>Meldung</TableHead>
                <TableHead className="text-right">Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(anomaliesQuery.data ?? []).map((a) => (
                <TableRow key={a.id} className={a.acknowledged_at ? "opacity-50" : ""}>
                  <TableCell>
                    <Badge variant={severityVariant(a.severity)}>{a.severity}</Badge>
                  </TableCell>
                  <TableCell className="text-caption">
                    {format(parseISO(a.detected_at), "dd.MM.yyyy HH:mm", { locale: de })}
                  </TableCell>
                  <TableCell className="font-mono text-caption">{a.table_name ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {a.delta_pct !== null ? `${a.delta_pct.toFixed(1)} %` : "—"}
                  </TableCell>
                  <TableCell className="text-caption">{a.message}</TableCell>
                  <TableCell className="text-right">
                    {!a.acknowledged_at && (
                      <Button size="sm" variant="ghost" onClick={() => acknowledge(a.id)}>
                        Bestätigen
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(anomaliesQuery.data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    Keine Anomalien — alles im grünen Bereich.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
