import type { JSX } from "react";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Shield, AlertTriangle, RefreshCw, Database, Camera } from "lucide-react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { useState } from "react";

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
  payload: Record<string, unknown>;
};

const sevVariant = (s: Gap["severity"]): "default" | "secondary" | "destructive" => {
  if (s === "critical") return "destructive";
  if (s === "warning") return "default";
  return "secondary";
};

export function SecurityCockpit(): JSX.Element {
  const { toast } = useToast();
  const [filter, setFilter] = useState("");
  const [onlyIssues, setOnlyIssues] = useState(true);

  const gapsQuery = useQuery({
    queryKey: ["rls_gaps"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("audit_rls_gaps");
      if (error) throw error;
      return (data ?? []) as Gap[];
    },
    staleTime: 60_000,
  });

  const snapshotsQuery = useQuery({
    queryKey: ["security_snapshots"],
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

  const auditQuery = useQuery({
    queryKey: ["audit_log_recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log_entries")
        .select("id, created_at, user_id, ip_address, payload")
        .order("created_at", { ascending: false })
        .limit(100);
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
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Snapshot erstellt" });
    void snapshotsQuery.refetch();
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-h2 font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5" /> Security-Cockpit
          </h2>
          <p className="text-body text-muted-foreground">
            RLS-Coverage, Audit-Trail und Snapshots zur Datenbanksicherheit.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => gapsQuery.refetch()}>
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
            <CardTitle className="text-h2 tabular-nums">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-destructive flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" /> Kritisch
            </CardDescription>
            <CardTitle className="text-h2 tabular-nums text-destructive">{stats.critical}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Warnung</CardDescription>
            <CardTitle className="text-h2 tabular-nums">{stats.warning}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>OK</CardDescription>
            <CardTitle className="text-h2 tabular-nums text-green-600">{stats.ok}</CardTitle>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Schwere</TableHead>
                    <TableHead>Tabelle</TableHead>
                    <TableHead>Begründung</TableHead>
                    <TableHead className="text-right">Policies</TableHead>
                    <TableHead>tenant_id</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGaps.map((g) => (
                    <TableRow key={g.table_name}>
                      <TableCell>
                        <Badge variant={sevVariant(g.severity)}>{g.severity}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-caption">{g.table_name}</TableCell>
                      <TableCell className="text-caption">{g.reason}</TableCell>
                      <TableCell className="text-right tabular-nums">{g.policy_count}</TableCell>
                      <TableCell>{g.has_tenant_id ? "ja" : "—"}</TableCell>
                    </TableRow>
                  ))}
                  {filteredGaps.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                        Keine Treffer.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
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
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                        Noch keine Snapshots.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Audit-Trail (letzte 100)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zeit</TableHead>
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
                      <TableCell className="font-mono text-caption">{a.user_id?.slice(0, 8) ?? "—"}</TableCell>
                      <TableCell className="font-mono text-caption">{a.ip_address ?? "—"}</TableCell>
                      <TableCell className="text-caption max-w-md truncate">
                        {JSON.stringify(a.payload)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(auditQuery.data ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                        Keine Einträge.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
