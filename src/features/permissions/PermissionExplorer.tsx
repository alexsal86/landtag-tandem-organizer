import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, Info, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import {
  ACTION_KEYS,
  ACTION_MODULE,
  FEATURE_KEYS,
  FIELD_TARGETS,
  PERMISSION_ROLES,
  roleLabel,
} from "./catalog";
import {
  buildPermissionDiff,
  diffSimulation,
  parsePermissionExplanation,
  type PermissionExplanation,
  type PermissionQuestion,
  type PermissionConflict,
} from "./explain";

const QUESTION: PermissionQuestion = {
  actions: ACTION_KEYS.map((action) => action.key),
  features: FEATURE_KEYS.map((feature) => feature.key),
  fields: FIELD_TARGETS.map((field) => ({ table: field.table, column: field.column })),
};

const SOURCE_LABELS: Record<string, string> = {
  platform: "Plattform",
  membership: "Mitgliedschaft",
  rule: "Aktionsregel",
  default: "Standard",
  tenant: "Büro-Regel",
  field_rule: "Feldregel",
};

const FEATURE_LABELS = new Map(FEATURE_KEYS.map((feature) => [feature.key, feature.label]));
const ACTION_LABELS = new Map(ACTION_KEYS.map((action) => [action.key, action.label]));
const FIELD_LABELS = new Map(
  FIELD_TARGETS.map((field) => [`${field.table}.${field.column}`, field.label]),
);

function DecisionBadge({ allowed, on, off }: { allowed: boolean; on: string; off: string }): JSX.Element {
  return allowed ? (
    <Badge className="gap-1">
      <CheckCircle2 className="h-3 w-3" aria-hidden />
      {on}
    </Badge>
  ) : (
    <Badge variant="destructive" className="gap-1">
      <XCircle className="h-3 w-3" aria-hidden />
      {off}
    </Badge>
  );
}

function SourceBadge({ source }: { source: string }): JSX.Element {
  return <Badge variant="outline">{SOURCE_LABELS[source] ?? source}</Badge>;
}

function Conflicts({ conflicts }: { conflicts: PermissionConflict[] }): JSX.Element {
  if (!conflicts.length) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        Kein Widerspruch zwischen Rolle, Moduleinstellung und Feldrecht erkannt.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {conflicts.map((conflict) => (
        <li key={conflict.id} className="rounded-md border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                conflict.severity === "critical"
                  ? "destructive"
                  : conflict.severity === "warning"
                    ? "default"
                    : "secondary"
              }
            >
              {conflict.severity === "critical"
                ? "Kritisch"
                : conflict.severity === "warning"
                  ? "Warnung"
                  : "Hinweis"}
            </Badge>
            <span className="text-sm font-medium">{conflict.title}</span>
            <span className="text-xs text-muted-foreground">{conflict.area}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{conflict.detail}</p>
        </li>
      ))}
    </ul>
  );
}

async function loadExplanation(
  userId: string,
  tenantId: string,
  simulateRole: string | null,
): Promise<PermissionExplanation> {
  const { data, error } = await supabase.rpc("explain_permissions", {
    _user_id: userId,
    _tenant_id: tenantId,
    _actions: QUESTION.actions,
    _features: QUESTION.features,
    _fields: QUESTION.fields as unknown as Json,
    _simulate_role: simulateRole,
  });
  if (error) throw error;
  return parsePermissionExplanation(data, QUESTION);
}

export function PermissionExplorer(): JSX.Element | null {
  const { user } = useAuth();
  const { currentTenant, loading: tenantLoading } = useTenant();
  const tenantId = currentTenant?.id;

  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [simulation, setSimulation] = useState<string>("actual");

  const membersQuery = useQuery({
    queryKey: ["permission-explorer-members", tenantId],
    enabled: Boolean(tenantId),
    staleTime: 30_000,
    queryFn: async () => {
      const { data: memberships, error } = await supabase
        .from("user_tenant_memberships")
        .select("user_id, role")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true);
      if (error) throw error;

      const userIds = (memberships ?? []).map((membership) => membership.user_id);
      if (!userIds.length) return [];

      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);
      if (profileError) throw profileError;

      const names = new Map((profiles ?? []).map((profile) => [profile.user_id, profile.display_name ?? ""]));
      return (memberships ?? [])
        .map((membership) => ({
          userId: membership.user_id,
          role: membership.role,
          name: names.get(membership.user_id) || membership.user_id.slice(0, 8),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "de"));
    },
  });

  useEffect(() => {
    const members = membersQuery.data ?? [];
    if (!members.length) {
      setSelectedUserId("");
      return;
    }
    if (!selectedUserId || !members.some((member) => member.userId === selectedUserId)) {
      setSelectedUserId(
        members.find((member) => member.userId === user?.id)?.userId ?? members[0].userId,
      );
    }
  }, [membersQuery.data, selectedUserId, user?.id]);

  const actualQuery = useQuery({
    queryKey: ["permission-explanation", tenantId, selectedUserId, "actual"],
    enabled: Boolean(tenantId && selectedUserId),
    staleTime: 0,
    queryFn: () => loadExplanation(selectedUserId, tenantId!, null),
  });

  const simulatedQuery = useQuery({
    queryKey: ["permission-explanation", tenantId, selectedUserId, simulation],
    enabled: Boolean(tenantId && selectedUserId) && simulation !== "actual",
    staleTime: 0,
    queryFn: () => loadExplanation(selectedUserId, tenantId!, simulation),
  });

  const explanation = actualQuery.data;
  const simulated = simulation === "actual" ? undefined : simulatedQuery.data;
  // Bei aktiver Simulation zeigen die Reiter die simulierte Rolle; der Diff vergleicht
  // sie mit der tatsächlichen Rolle. Gespeichert wird in beiden Fällen nichts.
  const view = simulated ?? explanation;

  const conflicts = useMemo(
    () => (view ? buildPermissionDiff(view, ACTION_MODULE) : []),
    [view],
  );
  const changes = useMemo(
    () => (explanation && simulated ? diffSimulation(explanation, simulated) : []),
    [explanation, simulated],
  );

  const person = membersQuery.data?.find((member) => member.userId === selectedUserId);
  const queryError = membersQuery.isError || actualQuery.isError || simulatedQuery.isError;

  if (!tenantLoading && !tenantId) {
    return <p role="status">Bitte wählen Sie ein Büro aus.</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" aria-hidden />
          Rechte-Explorer
        </CardTitle>
        <CardDescription>
          Zeigt für eine Person, ein Büro und eine Rolle, welche Module, Aktionen und Felder erlaubt
          sind – jeweils mit Quelle und Begründung. Die Rollensimulation rechnet nur, sie ändert keine
          Rechte. Büro: {currentTenant?.name ?? "kein Büro ausgewählt"}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-56 space-y-1">
            <Label htmlFor="permission-explorer-person">Person</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId} disabled={!membersQuery.data?.length}>
              <SelectTrigger id="permission-explorer-person">
                <SelectValue placeholder="Person wählen" />
              </SelectTrigger>
              <SelectContent>
                {(membersQuery.data ?? []).map((member) => (
                  <SelectItem key={member.userId} value={member.userId}>
                    {member.name} · {roleLabel(member.role)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-56 space-y-1">
            <Label htmlFor="permission-explorer-simulation">Rolle</Label>
            <Select value={simulation} onValueChange={setSimulation}>
              <SelectTrigger id="permission-explorer-simulation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="actual">Tatsächliche Rolle</SelectItem>
                {PERMISSION_ROLES.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    Simulation: {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            onClick={() => {
              void membersQuery.refetch();
              void actualQuery.refetch();
              if (simulation !== "actual") void simulatedQuery.refetch();
            }}
            disabled={actualQuery.isFetching || simulatedQuery.isFetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${actualQuery.isFetching ? "animate-spin" : ""}`} aria-hidden />
            Aktualisieren
          </Button>
        </div>

        {queryError && (
          <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm">
            Die Rechteauskunft konnte nicht geladen werden. Bitte erneut versuchen.
          </p>
        )}

        {!membersQuery.isLoading && !membersQuery.isError && !membersQuery.data?.length && (
          <p role="status" className="text-sm text-muted-foreground">
            Dieses Büro hat keine aktiven Mitglieder.
          </p>
        )}

        {simulation === "actual" && explanation && !explanation.member && !explanation.isSuperadmin && (
          <p className="flex items-start gap-2 rounded-md border p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4" aria-hidden />
            {person?.name ?? "Die Person"} ist kein aktives Mitglied dieses Büros. Wählen Sie eine
            Simulationsrolle, um zu sehen, welche Rechte eine Rolle hier hätte.
          </p>
        )}

        {view && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>
              Rolle: <strong>{roleLabel(view.role)}</strong>
            </span>
            {view.simulatedRole && (
              <span>
                · simuliert als <strong>{roleLabel(view.simulatedRole)}</strong>
              </span>
            )}
            {view.isSuperadmin && !view.simulatedRole && (
              <Badge variant="secondary">Plattform-Administrator</Badge>
            )}
            {view.simulatedRole && <Badge variant="outline">Simulation – keine Speicherung</Badge>}
          </p>
        )}

        {actualQuery.isLoading || (simulation !== "actual" && simulatedQuery.isLoading) ? (
          <p role="status">Rechte werden geladen…</p>
        ) : (
          view && (
            <Tabs defaultValue="features">
              <TabsList>
                <TabsTrigger value="features">Module</TabsTrigger>
                <TabsTrigger value="actions">Aktionen</TabsTrigger>
                <TabsTrigger value="fields">Felder</TabsTrigger>
                <TabsTrigger value="diff">Diff &amp; Simulation</TabsTrigger>
              </TabsList>

              <TabsContent value="features" className="space-y-3 pt-4">
                {view.features.map((feature) => (
                  <div key={feature.key} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          {FEATURE_LABELS.get(feature.key) ?? feature.key}
                        </p>
                        <code className="text-xs text-muted-foreground">{feature.key}</code>
                      </div>
                      <div className="flex items-center gap-2">
                        <DecisionBadge allowed={feature.enabled} on="Aktiv" off="Aus" />
                        <SourceBadge source={feature.source} />
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{feature.reason}</p>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="actions" className="space-y-3 pt-4">
                {view.actions.map((action) => (
                  <div key={action.key} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          {ACTION_LABELS.get(action.key) ?? action.key}
                        </p>
                        <code className="text-xs text-muted-foreground">{action.key}</code>
                      </div>
                      <div className="flex items-center gap-2">
                        <DecisionBadge allowed={action.allowed} on="Erlaubt" off="Gesperrt" />
                        <SourceBadge source={action.source} />
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{action.reason}</p>
                    {action.allowedRoles && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Freigegebene Rollen: {action.allowedRoles.map(roleLabel).join(", ")}
                      </p>
                    )}
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="fields" className="space-y-3 pt-4">
                {view.fields.map((field) => {
                  const id = `${field.table}.${field.column}`;
                  return (
                    <div key={id} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{FIELD_LABELS.get(id) ?? id}</p>
                          <code className="text-xs text-muted-foreground">{id}</code>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <DecisionBadge allowed={field.canRead} on="Lesbar" off="Lesen gesperrt" />
                          <DecisionBadge allowed={field.canWrite} on="Schreibbar" off="Schreiben gesperrt" />
                          <SourceBadge source={field.source} />
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{field.reason}</p>
                      {field.readMode === "record" && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Lesemodus: gesamter Datensatz gesperrt.
                        </p>
                      )}
                    </div>
                  );
                })}
              </TabsContent>

              <TabsContent value="diff" className="space-y-5 pt-4">
                <section aria-label="Widersprüche zwischen den Ebenen" className="space-y-2">
                  <h3 className="text-sm font-semibold">Rolle, Modulschalter und Feldrecht</h3>
                  <Conflicts conflicts={conflicts} />
                </section>

                <section aria-label="Rollensimulation" className="space-y-2">
                  <h3 className="text-sm font-semibold">Rollensimulation</h3>
                  {simulation === "actual" ? (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Info className="h-4 w-4" aria-hidden />
                      Wählen Sie oben eine Rolle, um die Abweichungen zur tatsächlichen Rolle zu sehen.
                    </p>
                  ) : simulatedQuery.isLoading ? (
                    <p role="status">Simulation wird berechnet…</p>
                  ) : changes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Keine Abweichung: {roleLabel(simulation)} sieht dieselben Module, Aktionen und
                      Felder wie die tatsächliche Rolle.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left">
                            <th className="py-2 pr-3 font-medium">Ebene</th>
                            <th className="py-2 pr-3 font-medium">Eintrag</th>
                            <th className="py-2 pr-3 font-medium">Tatsächlich</th>
                            <th className="py-2 font-medium">Simuliert</th>
                          </tr>
                        </thead>
                        <tbody>
                          {changes.map((change) => {
                            const label =
                              FEATURE_LABELS.get(change.id.split(":")[1]) ??
                              ACTION_LABELS.get(change.id.split(":")[1]) ??
                              FIELD_LABELS.get(change.id.split(":")[1]) ??
                              change.id.split(":")[1];
                            return (
                              <tr key={change.id} className="border-b last:border-0">
                                <td className="py-2 pr-3 text-muted-foreground">{change.area}</td>
                                <td className="py-2 pr-3">{label}</td>
                                <td className="py-2 pr-3">{change.actual}</td>
                                <td className="py-2">{change.simulated}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </TabsContent>
            </Tabs>
          )
        )}
      </CardContent>
    </Card>
  );
}
