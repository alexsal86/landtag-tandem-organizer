import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { notify } from "@/lib/notify";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
const ALL_ROLES: AppRole[] = ["abgeordneter", "bueroleitung", "mitarbeiter", "praktikant"];

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
  { key: "knowledge.write", label: "Wissensfragen stellen und Antworten bearbeiten" },
  { key: "knowledge.verify", label: "Wissensantworten prüfen" },
  { key: "letter.send", label: "Brief versenden" },
  { key: "letter.delete", label: "Brief löschen" },
  { key: "decision.archive", label: "Entscheidung archivieren" },
  { key: "case.close", label: "Fallakte schließen" },
  { key: "workflow.execute_manual", label: "Workflow manuell auslösen" },
  { key: "contact.delete", label: "Kontakt löschen" },
  { key: "tenant.invite_user", label: "Mitarbeiter einladen" },
];

// Vorgeschlagene sensible Felder. Admin kann pro Rolle read/write togglen.
const FIELD_TARGETS: Array<{ table: string; column: string; label: string }> = [
  { table: "contacts", column: "phone", label: "Kontakt · Telefon" },
  { table: "contacts", column: "email", label: "Kontakt · E-Mail" },
  { table: "contacts", column: "notes", label: "Kontakt · Notizen" },
  { table: "contacts", column: "email_2", label: "Kontakt · weitere E-Mail" },
  { table: "contacts", column: "email_3", label: "Kontakt · dritte E-Mail" },
  { table: "contacts", column: "mobile_phone", label: "Kontakt · Mobiltelefon" },
  { table: "contacts", column: "business_phone", label: "Kontakt · Geschäftstelefon" },
  { table: "letters", column: "content", label: "Brief · Inhalt" },
  { table: "letters", column: "content_html", label: "Brief · formatierter Inhalt" },
];

interface FieldPerm { can_read: boolean; can_write: boolean; read_mode?: "mask" | "record" }


export function PermissionsManager() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  const [flags, setFlags] = useState<Map<string, boolean>>(new Map());
  const [actions, setActions] = useState<Map<string, AppRole[]>>(new Map());
  // key = `${table}.${column}.${role}`
  const [fields, setFields] = useState<Map<string, FieldPerm>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadedTenant, setLoadedTenant] = useState<string>();
  const [saving, setSaving] = useState(false);
  const currentTenantRef = useRef(tenantId);
  currentTenantRef.current = tenantId;
  const pending = useRef<object | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(false);
      setSaving(false);
      pending.current = null;
      try {
        const [flagsRes, actionsRes, fieldsRes] = await Promise.all([
          supabase.from("tenant_feature_flags").select("feature_key, enabled").eq("tenant_id", tenantId),
          supabase.from("action_permissions").select("action_key, allowed_roles").eq("tenant_id", tenantId),
          supabase.from("field_permissions")
            .select("table_name, column_name, role, can_read, can_write, read_mode")
            .eq("tenant_id", tenantId),
        ]);
        if (flagsRes.error) throw flagsRes.error;
        if (actionsRes.error) throw actionsRes.error;
        if (fieldsRes.error) throw fieldsRes.error;
        if (cancelled) return;
        const fmap = new Map<string, boolean>();
        for (const r of flagsRes.data ?? []) fmap.set(r.feature_key, r.enabled);
        const amap = new Map<string, AppRole[]>();
        for (const r of actionsRes.data ?? []) amap.set(r.action_key, (r.allowed_roles ?? []) as AppRole[]);
        const fdmap = new Map<string, FieldPerm>();
        for (const r of fieldsRes.data ?? []) {
          fdmap.set(`${r.table_name}.${r.column_name}.${r.role}`, {
            can_read: r.can_read, can_write: r.can_write, read_mode: r.read_mode === "record" ? "record" : "mask",
          });
        }
        setFlags(fmap);
        setActions(amap);
        setFields(fdmap);
        setLoadedTenant(tenantId);
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tenantId]);


  // Commit only confirmed writes. A failed write leaves the displayed value unchanged.
  const save = async (
    write: () => PromiseLike<{ error: { message: string } | null }>,
    commit: () => void,
  ) => {
    if (pending.current || loading || loadError || loadedTenant !== tenantId) return;
    const operation = {};
    pending.current = operation;
    setSaving(true);
    try {
      const { error } = await write();
      if (error) throw error;
      if (currentTenantRef.current === tenantId && pending.current === operation) commit();
    } catch {
      notify.error("Nicht gespeichert", { description: "Die Berechtigungen konnten nicht gespeichert werden. Bitte versuchen Sie es erneut." });
    } finally {
      if (pending.current === operation) {
        pending.current = null;
        setSaving(false);
      }
    }
  };

  const toggleFlag = (key: string, enabled: boolean) => save(
    () => supabase.from("tenant_feature_flags")
      .upsert({ tenant_id: tenantId!, feature_key: key, enabled }, { onConflict: "tenant_id,feature_key" }),
    () => setFlags(previous => new Map(previous).set(key, enabled)),
  );

  const toggleActionRole = (actionKey: string, role: AppRole) => {
    const current = actions.get(actionKey) ?? ALL_ROLES;
    const nextRoles = current.includes(role) ? current.filter(r => r !== role) : [...current, role];
    return save(
      () => supabase.from("action_permissions").upsert(
        { tenant_id: tenantId!, action_key: actionKey, allowed_roles: nextRoles },
        { onConflict: "tenant_id,action_key" },
      ),
      () => setActions(previous => new Map(previous).set(actionKey, nextRoles)),
    );
  };

  const toggleField = (table: string, column: string, role: AppRole, key: "can_read" | "can_write") => {
    const mapKey = `${table}.${column}.${role}`;
    const current = fields.get(mapKey) ?? { can_read: true, can_write: true };
    const nextPerm = { ...current, [key]: !current[key] };
    if (!nextPerm.can_read) nextPerm.can_write = false;
    return save(
      () => supabase.from("field_permissions").upsert(
        { tenant_id: tenantId!, table_name: table, column_name: column, role, ...nextPerm },
        { onConflict: "tenant_id,table_name,column_name,role" },
      ),
      () => setFields(previous => new Map(previous).set(mapKey, nextPerm)),
    );
  };

  const setReadMode = (table: string, column: string, role: AppRole, mode: "mask" | "record") => {
    const mapKey = `${table}.${column}.${role}`;
    const current = fields.get(mapKey) ?? { can_read: true, can_write: true };
    const next = { ...current, read_mode: mode };
    return save(() => supabase.from("field_permissions").upsert({ tenant_id: tenantId!, table_name: table, column_name: column, role, ...next }, { onConflict: "tenant_id,table_name,column_name,role" }), () => setFields(previous => new Map(previous).set(mapKey, next)));
  };

  if (!tenantId) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Module und Berechtigungen</CardTitle>
        <CardDescription>
          Module werden im Arbeitsbereich ein- oder ausgeblendet. Aktions- und Feldregeln gelten zusätzlich zu den bestehenden Büro- und Rollenrechten; Plattformadministratoren bleiben handlungsfähig.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loadError ? (
          <p role="alert">Berechtigungen konnten nicht geladen werden. Bitte laden Sie die Seite erneut.</p>
        ) : loading || loadedTenant !== tenantId ? (
          <p role="status">Berechtigungen werden geladen…</p>
        ) : (
          <fieldset disabled={saving} aria-busy={saving} className="min-w-0">
            {saving && <p role="status">Wird gespeichert…</p>}
            <Tabs defaultValue="features">
              <TabsList>
                <TabsTrigger value="features">Module</TabsTrigger>
                <TabsTrigger value="actions">Aktionen</TabsTrigger>
                <TabsTrigger value="fields">Felder</TabsTrigger>
              </TabsList>

              <TabsContent value="features" className="space-y-3 pt-4">
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
                            <button
                              type="button"
                              aria-pressed={active}
                              key={role}
                              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold disabled:opacity-50 ${active ? "bg-primary text-primary-foreground" : "bg-background"}`}
                              onClick={() => toggleActionRole(a.key, role)}
                            >
                              {role}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </TabsContent>

              <TabsContent value="fields" className="space-y-3 pt-4">
                <p className="text-caption text-muted-foreground">
                  Pro Rolle festlegen, ob ein sensibles Feld gelesen oder geschrieben werden darf.
                  Bei einem Leseverbot können Sie nur das Feld ausblenden oder den gesamten Datensatz sperren. Ausgeblendete Werte werden serverseitig entfernt. Ein Leseverbot sperrt auch das Schreiben.
                </p>
                {FIELD_TARGETS.map((t) => (
                  <div key={`${t.table}.${t.column}`} className="border rounded-md p-3">
                    <div className="flex items-baseline justify-between mb-2">
                      <Label className="font-medium">{t.label}</Label>
                      <code className="text-caption text-muted-foreground">{t.table}.{t.column}</code>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {ALL_ROLES.map((role) => {
                        const perm = fields.get(`${t.table}.${t.column}.${role}`) ?? { can_read: true, can_write: true };
                        return (
                          <div key={role} className="flex items-center justify-between border rounded-md px-2 py-1.5">
                            <span className="text-caption">{role}</span>
                            <div className="flex gap-3">
                              <label className="flex items-center gap-1 text-caption">
                                <Switch
                                  checked={perm.can_read}
                                  onCheckedChange={() => toggleField(t.table, t.column, role, "can_read")}
                                />
                                Lesen
                              </label>
                              <select aria-label={`${t.label} · ${role} · Leseverbot`} className="max-w-40 rounded border bg-background text-xs" value={perm.read_mode ?? "mask"} onChange={event => void setReadMode(t.table, t.column, role, event.target.value as "mask" | "record")}>
                                <option value="mask">Nur Feld ausblenden</option>
                                <option value="record">Datensatz sperren</option>
                              </select>
                              <label className="flex items-center gap-1 text-caption">
                                <Switch
                                  checked={perm.can_write}
                                  disabled={!perm.can_read}
                                  onCheckedChange={() => toggleField(t.table, t.column, role, "can_write")}
                                />
                                Schreiben
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </fieldset>
        )}
      </CardContent>
    </Card>
  );
}
