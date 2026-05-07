import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

type AppRole = "abgeordneter" | "bueroleitung" | "mitarbeiter" | "praktikant" | "gast";
const ALL_ROLES: AppRole[] = ["abgeordneter", "bueroleitung", "mitarbeiter", "praktikant", "gast"];

const FEATURE_KEYS: Array<{ key: string; label: string; description: string }> = [
  { key: "module.events", label: "Veranstaltungen", description: "Eventplanung, RSVP, Checklisten" },
  { key: "module.letters", label: "Briefe", description: "Letter-Designer und Versand" },
  { key: "module.knowledge", label: "Wissen", description: "Dossiers, Wissensbereich" },
  { key: "module.editorial", label: "Redaktion", description: "Themenbacklog, Social-Planner" },
  { key: "module.timetracking", label: "Zeitwirtschaft", description: "Zeiterfassung, Urlaube, Tageszettel" },
  { key: "module.casefiles", label: "Fallakten", description: "Fallakten und Vorgänge" },
  { key: "module.maps", label: "Karten/Wahlkreise", description: "Wahlkreiskarte mit Layern" },
];

const ACTION_KEYS: Array<{ key: string; label: string }> = [
  { key: "letter.send", label: "Brief versenden" },
  { key: "letter.delete", label: "Brief löschen" },
  { key: "decision.archive", label: "Entscheidung archivieren" },
  { key: "case.close", label: "Fallakte schließen" },
  { key: "workflow.execute_manual", label: "Workflow manuell auslösen" },
  { key: "contact.delete", label: "Kontakt löschen" },
  { key: "tenant.invite_user", label: "Mitarbeiter einladen" },
];

export function PermissionsManager() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const tenantId = currentTenant?.id;

  const [flags, setFlags] = useState<Map<string, boolean>>(new Map());
  const [actions, setActions] = useState<Map<string, AppRole[]>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [flagsRes, actionsRes] = await Promise.all([
        supabase.from("tenant_feature_flags").select("feature_key, enabled").eq("tenant_id", tenantId),
        supabase.from("action_permissions").select("action_key, allowed_roles").eq("tenant_id", tenantId),
      ]);
      if (cancelled) return;
      const fmap = new Map<string, boolean>();
      for (const r of flagsRes.data ?? []) fmap.set(r.feature_key, r.enabled);
      const amap = new Map<string, AppRole[]>();
      for (const r of actionsRes.data ?? []) amap.set(r.action_key, (r.allowed_roles ?? []) as AppRole[]);
      setFlags(fmap);
      setActions(amap);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [tenantId]);

  const toggleFlag = async (key: string, enabled: boolean) => {
    if (!tenantId) return;
    const next = new Map(flags);
    next.set(key, enabled);
    setFlags(next);
    const { error } = await supabase
      .from("tenant_feature_flags")
      .upsert({ tenant_id: tenantId, feature_key: key, enabled }, { onConflict: "tenant_id,feature_key" });
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      next.set(key, !enabled);
      setFlags(new Map(next));
    }
  };

  const toggleActionRole = async (actionKey: string, role: AppRole) => {
    if (!tenantId) return;
    const current = actions.get(actionKey) ?? ALL_ROLES;
    const has = current.includes(role);
    const nextRoles = has ? current.filter((r) => r !== role) : [...current, role];
    const next = new Map(actions);
    next.set(actionKey, nextRoles);
    setActions(next);
    const { error } = await supabase
      .from("action_permissions")
      .upsert(
        { tenant_id: tenantId, action_key: actionKey, allowed_roles: nextRoles },
        { onConflict: "tenant_id,action_key" },
      );
    if (error) toast({ title: "Fehler", description: error.message, variant: "destructive" });
  };

  if (!tenantId) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Berechtigungen & Module</CardTitle>
        <CardDescription>
          Aktiviere oder deaktiviere Module pro Tenant und steuere, welche Rollen sensible Aktionen ausführen dürfen.
          Server-seitige Prüfung erfolgt zusätzlich über RPCs (`is_feature_enabled`, `is_action_allowed`).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="features">
          <TabsList>
            <TabsTrigger value="features">Module</TabsTrigger>
            <TabsTrigger value="actions">Aktionen</TabsTrigger>
            <TabsTrigger value="fields" disabled>Felder (folgt)</TabsTrigger>
          </TabsList>

          <TabsContent value="features" className="space-y-3 pt-4">
            {loading && <p className="text-caption text-muted-foreground">Lade…</p>}
            {FEATURE_KEYS.map((f) => {
              const enabled = flags.has(f.key) ? flags.get(f.key)! : true;
              return (
                <div key={f.key} className="flex items-start justify-between gap-4 border rounded-md p-3">
                  <div>
                    <Label className="font-medium">{f.label}</Label>
                    <p className="text-caption text-muted-foreground">{f.description}</p>
                    <code className="text-caption text-muted-foreground">{f.key}</code>
                  </div>
                  <Switch checked={enabled} onCheckedChange={(v) => toggleFlag(f.key, v)} />
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="actions" className="space-y-3 pt-4">
            {loading && <p className="text-caption text-muted-foreground">Lade…</p>}
            {ACTION_KEYS.map((a) => {
              const allowed = actions.get(a.key) ?? ALL_ROLES;
              return (
                <div key={a.key} className="border rounded-md p-3">
                  <div className="flex items-baseline justify-between mb-2">
                    <Label className="font-medium">{a.label}</Label>
                    <code className="text-caption text-muted-foreground">{a.key}</code>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ALL_ROLES.map((role) => {
                      const active = allowed.includes(role);
                      return (
                        <Badge
                          key={role}
                          variant={active ? "default" : "outline"}
                          className="cursor-pointer select-none"
                          onClick={() => toggleActionRole(a.key, role)}
                        >
                          {role}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
