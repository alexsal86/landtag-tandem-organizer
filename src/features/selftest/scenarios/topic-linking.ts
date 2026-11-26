import { supabase } from "@/integrations/supabase/client";
import { SELFTEST_MARKER, SELFTEST_PREFIX } from "../runner";
import type { TestScenario } from "../types";
import { describeError, expectFields } from "../verify";

const tag = (run: string, label: string) => `${SELFTEST_PREFIX} ${label} (${run})`;
/** Themenlabels sind auf 40 Zeichen begrenzt; die Laufkennung wird deshalb gekürzt. */
const topicLabel = (run: string, label: string) => `ST ${run.slice(0, 8)} ${label}`;
const CONFIG_ADMIN_ROLES = ["abgeordneter", "bueroleitung"];
const MODULES = [
  "tasks", "case_items", "case_files", "documents", "appointments",
  "decisions", "contacts", "knowledge_questions", "knowledge_documents", "map_flags",
];

/**
 * Zentrale Themen: Eindeutigkeit und Weiterleitung im Katalog, mandantensichere
 * Verknüpfung von Vorgängen und Wissensfragen, Büro-Steuerung je Modul und Zählwerte.
 * Die Werte der Modul-Steuerung werden nach der Prüfung wiederhergestellt.
 */
export const topicLinkingScenario: TestScenario = {
  id: "topic-linking",
  title: "Themenverknüpfung und Modul-Steuerung",
  description:
    "Legt Themen über ensure_topic an, prüft Bereinigung, Groß-/Kleinschreibung und Längengrenzen sowie die Anlageregel je Modul, verknüpft einen Vorgang über intake_payload (Trigger) und direkt, prüft Duplikatsperre und Mandantenzuordnung, führt Themen zusammen und belegt Weiterleitung samt mitgezogenen Verknüpfungen. Dazu kommen die Modul-Steuerung mit ihren Wertebereichen und die Zählwerte aus topic_usage.",
  touches: [
    "topics",
    "case_item_topics",
    "case_items",
    "knowledge_question_topics",
    "topic_module_settings",
  ],
  features: ["topics", "knowledge"],
  checks: [
    "ensure_topic bereinigt Leerzeichen, bildet den Schlüssel aus dem Label und liefert für dieselbe Bezeichnung dasselbe Thema",
    "Themenlabels außerhalb von 2–40 Zeichen werden abgewiesen (22023)",
    "Die Modul-Steuerung führt alle zehn Module; Wertebereiche für Modul und max_topics sind gesperrt (23514)",
    "Nur die Büroleitung ändert die Modul-Steuerung; die Prüfung stellt die Ausgangswerte wieder her",
    "ensure_topic mit Modul folgt creation_policy: bei 'admins' nur für die Büroleitung, bei 'members' auch für Mitglieder",
    "Ein Vorgang verknüpft Themen über intake_payload; der Trigger setzt tenant_id und created_by, Entfernen im Payload löscht die Verknüpfung",
    "Doppelte Verknüpfungen sind gesperrt (23505); auch ein direkter Insert ohne tenant_id wird dem Büro zugeordnet",
    "merge_topics zieht Verknüpfungen auf das Zielthema, deaktiviert die Quelle als Weiterleitung und ensure_topic folgt der Weiterleitung",
    "topic_usage zählt die Verknüpfungen je Modul und liefert die Summe",
  ],
  limitations: [
    "knowledge_question_topics hat derzeit keinen Client-Schreibpfad (nur eine Lesepolicy); geprüft werden Lesbarkeit und die Abweisung eines direkten Inserts, nicht eine UI-Verknüpfung.",
    "Für merge_topics und Änderungen an der Modul-Steuerung braucht das Szenario eine Büroleitung; als Mitglied werden die Abweisungen geprüft statt der Wirkung.",
    "Die Modul-Steuerung kennt keine id-Spalte; geprüft wird auf der vorhandenen Standardzeile, die anschließend wiederhergestellt wird.",
  ],
  writes: [
    { table: "topics", columns: ["name", "label", "icon", "color", "order_index", "is_active", "tenant_id", "created_by", "merged_into", "merged_at", "updated_by"] },
    { table: "case_items", columns: ["subject", "summary", "user_id", "tenant_id", "intake_payload"] },
    { table: "case_item_topics", columns: ["tenant_id", "case_item_id", "topic_id", "created_by"] },
    { table: "topic_module_settings", columns: ["requirement", "max_topics", "creation_policy", "show_filter", "is_enabled", "updated_by"] },
  ],
  steps: [
    {
      id: "catalog", label: "Thema anlegen, bereinigen und wiederfinden", critical: true,
      run: async ctx => {
        const label = `  ${topicLabel(ctx.runId, "Bildung")}  `;
        const created = await supabase.rpc("ensure_topic", { p_tenant: ctx.tenantId, p_label: label });
        if (created.error || !created.data) {
          return { ok: false, message: `Thema anlegen: ${describeError(created.error)}` };
        }
        const id = created.data;
        ctx.trackRecord({ table: "topics", id });
        const stored = await expectFields("topics", id, {
          label: label.trim(), tenant_id: ctx.tenantId, is_active: true, created_by: ctx.userId,
          name: label.trim().toLowerCase().replace(/\s+/g, "-"),
        }, "Thema");
        if (!stored.ok) return stored;
        const again = await supabase.rpc("ensure_topic", { p_tenant: ctx.tenantId, p_label: label.trim().toLowerCase() });
        const tooShort = await supabase.rpc("ensure_topic", { p_tenant: ctx.tenantId, p_label: "A" });
        const checks = {
          sameTopic: !again.error && again.data === id,
          trimmed: await (async () => {
            const row = await supabase.from("topics").select("label").eq("id", id).single();
            return row.data?.label === label.trim();
          })(),
          labelGuard: tooShort.error?.code === "22023",
        };
        ctx.data.topicId = id;
        ctx.data.topicLabel = label.trim();
        return {
          ok: Object.values(checks).every(Boolean),
          message: "Thema ist bereinigt angelegt; dieselbe Bezeichnung liefert dasselbe Thema.",
          details: checks,
        };
      },
    },
    {
      id: "module-settings", label: "Modul-Steuerung lesen und Wertebereiche prüfen",
      run: async ctx => {
        const settings = await supabase.from("topic_module_settings")
          .select("module,is_enabled,requirement,max_topics,creation_policy,show_filter")
          .eq("tenant_id", ctx.tenantId);
        if (settings.error || !settings.data) {
          return { ok: false, message: `Modul-Steuerung lesen: ${describeError(settings.error)}` };
        }
        const modules = new Set(settings.data.map(row => row.module));
        const caseItems = settings.data.find(row => row.module === "case_items");
        const isAdmin = CONFIG_ADMIN_ROLES.includes(ctx.role ?? "");
        if (!caseItems) {
          return { ok: false, message: "Für dieses Büro fehlt die Modul-Zeile case_items.", details: { modules: [...modules] } };
        }
        ctx.data.moduleBaseline = caseItems;
        ctx.data.moduleIsAdmin = isAdmin;

        const guards: Record<string, boolean> = {};
        if (isAdmin) {
          const invalidModule = await supabase.from("topic_module_settings")
            .update({ module: "unbekannt" }).eq("tenant_id", ctx.tenantId).eq("module", "case_items");
          const invalidLimit = await supabase.from("topic_module_settings")
            .update({ max_topics: 0 }).eq("tenant_id", ctx.tenantId).eq("module", "case_items");
          guards.invalidModule = invalidModule.error?.code === "23514";
          guards.invalidLimit = invalidLimit.error?.code === "23514";
        } else {
          // RLS filtert fremde Zeilen ohne Fehler weg; entscheidend ist, dass nichts geändert wurde.
          const forbidden = await supabase.from("topic_module_settings")
            .update({ requirement: "required" }).eq("tenant_id", ctx.tenantId).eq("module", "case_items");
          const after = await supabase.from("topic_module_settings")
            .select("requirement").eq("tenant_id", ctx.tenantId).eq("module", "case_items").single();
          guards.memberRefused = (forbidden.error?.code === "42501" || !forbidden.error)
            && after.data?.requirement === caseItems.requirement;
        }
        const checks = {
          allModules: MODULES.every(module => modules.has(module)),
          validValues: ["optional", "required"].includes(caseItems.requirement)
            && ["admins", "members"].includes(caseItems.creation_policy)
            && caseItems.max_topics >= 1 && caseItems.max_topics <= 20,
          ...guards,
        };
        return {
          ok: Object.values(checks).every(Boolean),
          message: isAdmin
            ? "Alle zehn Module sind gesteuert; ungültige Werte werden abgewiesen."
            : "Alle zehn Module sind gesteuert; Mitglieder können die Steuerung nicht ändern.",
          details: { ...checks, modules: [...modules] },
        };
      },
    },
    {
      id: "module-write", label: "Modul-Steuerung ändern und wiederherstellen",
      run: async ctx => {
        const baseline = ctx.data.moduleBaseline as { requirement: string; max_topics: number; show_filter: boolean } | undefined;
        if (!baseline) return { ok: false, message: "Ausgangswerte der Modul-Steuerung fehlen." };
        if (!ctx.data.moduleIsAdmin) {
          const { data, error } = await supabase.from("topic_module_settings")
            .select("requirement").eq("tenant_id", ctx.tenantId).eq("module", "case_items").single();
          return {
            ok: !error && data?.requirement === baseline.requirement,
            message: "Als Mitglied bleibt die Modul-Steuerung unverändert.",
          };
        }
        const next = { requirement: baseline.requirement === "required" ? "optional" : "required", max_topics: baseline.max_topics === 7 ? 8 : 7, show_filter: !baseline.show_filter };
        const changed = await supabase.from("topic_module_settings")
          .update({ ...next, updated_by: ctx.userId }).eq("tenant_id", ctx.tenantId).eq("module", "case_items");
        const readBack = await supabase.from("topic_module_settings")
          .select("requirement,max_topics,show_filter").eq("tenant_id", ctx.tenantId).eq("module", "case_items").single();
        const restored = await supabase.from("topic_module_settings")
          .update({ requirement: baseline.requirement, max_topics: baseline.max_topics, show_filter: baseline.show_filter, updated_by: ctx.userId })
          .eq("tenant_id", ctx.tenantId).eq("module", "case_items");
        const afterRestore = await supabase.from("topic_module_settings")
          .select("requirement,max_topics,show_filter").eq("tenant_id", ctx.tenantId).eq("module", "case_items").single();
        const checks = {
          changed: !changed.error && readBack.data?.requirement === next.requirement
            && readBack.data?.max_topics === next.max_topics && readBack.data?.show_filter === next.show_filter,
          restored: !restored.error && afterRestore.data?.requirement === baseline.requirement
            && afterRestore.data?.max_topics === baseline.max_topics
            && afterRestore.data?.show_filter === baseline.show_filter,
        };
        return {
          ok: Object.values(checks).every(Boolean),
          message: "Die Büro-Steuerung ist änderbar und steht nach der Prüfung wieder auf den Ausgangswerten.",
          details: checks,
        };
      },
    },
    {
      id: "module-policy", label: "Anlageregel je Modul beachten",
      run: async ctx => {
        const settings = await supabase.from("topic_module_settings")
          .select("creation_policy").eq("tenant_id", ctx.tenantId).eq("module", "case_items").maybeSingle();
        if (settings.error || !settings.data) {
          return { ok: false, message: `Anlageregel lesen: ${describeError(settings.error)}` };
        }
        const policy = settings.data.creation_policy;
        const allowed = policy === "members" || Boolean(ctx.data.moduleIsAdmin);
        const label = topicLabel(ctx.runId, "Modulthema");
        const result = await supabase.rpc("ensure_topic", { p_tenant: ctx.tenantId, p_label: label, p_module: "case_items" });
        if (allowed) {
          if (result.error || !result.data) {
            return { ok: false, message: `Thema mit Modul anlegen: ${describeError(result.error)}` };
          }
          ctx.trackRecord({ table: "topics", id: result.data });
          return {
            ok: true,
            message: `Anlageregel '${policy}' erlaubt das Thema für diese Rolle.`,
            details: { policy, created: result.data },
          };
        }
        const refused = result.error?.code === "42501";
        const absent = await supabase.from("topics")
          .select("id").eq("tenant_id", ctx.tenantId).eq("label", label).maybeSingle();
        return {
          ok: refused && !absent.data,
          message: `Anlageregel '${policy}' weist diese Rolle ab; kein Thema wurde angelegt.`,
          details: { policy, code: result.error?.code ?? null, topic: absent.data?.id ?? null },
        };
      },
    },
    {
      id: "case-item-link", label: "Vorgang mit Thema verknüpfen und Duplikate sperren", critical: true,
      run: async ctx => {
        const topicId = ctx.data.topicId as string;
        // Seit 20261126120000 ist der JSON-Spiegel stillgelegt: intake_payload legt
        // keine Themen mehr an, damit spätere Payload-Updates sie nicht löschen.
        const item = await supabase.from("case_items").insert({
          subject: tag(ctx.runId, "Themenvorgang"), summary: SELFTEST_MARKER,
          user_id: ctx.userId, tenant_id: ctx.tenantId,
          intake_payload: { topic_ids: [topicId] },
        }).select("id").single();
        if (item.error || !item.data) {
          return { ok: false, message: `Vorgang anlegen: ${describeError(item.error)}` };
        }
        ctx.trackRecord({ table: "case_items", id: item.data.id });
        ctx.data.caseItemId = item.data.id;

        const fromPayload = await supabase.from("case_item_topics")
          .select("topic_id").eq("case_item_id", item.data.id);
        const direct = await supabase.from("case_item_topics")
          .insert({ case_item_id: item.data.id, topic_id: topicId, tenant_id: ctx.tenantId, created_by: ctx.userId })
          .select("tenant_id,created_by,topic_id").single();
        const duplicate = await supabase.from("case_item_topics")
          .insert({ case_item_id: item.data.id, topic_id: topicId, tenant_id: ctx.tenantId });
        const foreignTenant = await supabase.from("case_item_topics")
          .insert({ case_item_id: item.data.id, topic_id: topicId, tenant_id: crypto.randomUUID(), created_by: ctx.userId });
        const cleared = await supabase.from("case_items")
          .update({ intake_payload: { topic_ids: [] } }).eq("id", item.data.id);
        const afterClear = await supabase.from("case_item_topics")
          .select("topic_id").eq("case_item_id", item.data.id);
        const removed = await supabase.from("case_item_topics").delete()
          .eq("case_item_id", item.data.id).eq("topic_id", topicId);
        const afterDelete = await supabase.from("case_item_topics")
          .select("topic_id").eq("case_item_id", item.data.id);

        const checks = {
          payloadLegtNichtsAn: !fromPayload.error && fromPayload.data?.length === 0,
          linked: !direct.error && direct.data?.tenant_id === ctx.tenantId
            && direct.data?.topic_id === topicId && direct.data?.created_by === ctx.userId,
          duplicateBlocked: duplicate.error?.code === "23505",
          fremderMandantGesperrt: Boolean(foreignTenant.error),
          payloadUpdateLaesstThemenStehen: !cleared.error && !afterClear.error && afterClear.data?.length === 1,
          removed: !removed.error && !afterDelete.error && afterDelete.data?.length === 0,
        };
        const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
        return {
          ok: failed.length === 0,
          message: failed.length === 0
            ? "Die Verknüpfung folgt dem direkten Schreibpfad; Payload-Updates lassen Themen stehen, Duplikate und fremde Mandanten sind gesperrt."
            : `Fehlgeschlagen: ${failed.join(", ")}`,
          details: checks,
        };
      },
    },
    {
      id: "merge-redirect", label: "Themen zusammenführen und Weiterleitung prüfen",
      run: async ctx => {
        const source = ctx.data.topicId as string;
        const label = ctx.data.topicLabel as string;
        const target = await supabase.rpc("ensure_topic", { p_tenant: ctx.tenantId, p_label: topicLabel(ctx.runId, "Zielthema") });
        if (target.error || !target.data) {
          return { ok: false, message: `Zielthema anlegen: ${describeError(target.error)}` };
        }
        const targetId = target.data;
        ctx.trackRecord({ table: "topics", id: targetId });
        ctx.data.targetTopicId = targetId;

        if (!ctx.data.moduleIsAdmin) {
          const refused = await supabase.rpc("merge_topics", { p_source: source, p_target: targetId });
          const sourceRow = await supabase.from("topics").select("is_active,merged_into").eq("id", source).single();
          return {
            ok: refused.error?.code === "42501" && sourceRow.data?.is_active === true && sourceRow.data?.merged_into === null,
            message: "Als Mitglied wird das Zusammenführen abgewiesen; die Quelle bleibt aktiv.",
            details: { code: refused.error?.code ?? null },
          };
        }

        const merged = await supabase.rpc("merge_topics", { p_source: source, p_target: targetId });
        const sourceRow = await supabase.from("topics").select("is_active,merged_into,merged_at").eq("id", source).single();
        const links = await supabase.from("case_item_topics")
          .select("case_item_id,topic_id").eq("case_item_id", ctx.data.caseItemId as string);
        const redirect = await supabase.rpc("ensure_topic", { p_tenant: ctx.tenantId, p_label: label });
        const again = await supabase.rpc("merge_topics", { p_source: source, p_target: targetId });
        const checks = {
          sourceInactive: !sourceRow.error && sourceRow.data?.is_active === false
            && sourceRow.data?.merged_into === targetId && Boolean(sourceRow.data?.merged_at),
          linksMoved: !links.error && links.data?.length === 1 && links.data?.[0].topic_id === targetId,
          redirect: !redirect.error && redirect.data === targetId,
          mergeTwiceBlocked: again.error?.code === "22023",
        };
        return {
          ok: Object.values(checks).every(Boolean) && !merged.error,
          message: "Die Quelle leitet auf das Ziel weiter; Verknüpfungen sind mitgezogen.",
          details: checks,
        };
      },
    },
    {
      id: "usage", label: "Verwendung je Modul zählen",
      run: async ctx => {
        const topicId = (ctx.data.targetTopicId as string | undefined) ?? (ctx.data.topicId as string);
        const usage = await supabase.rpc("topic_usage", { p_tenant: ctx.tenantId });
        if (usage.error || !usage.data) {
          return { ok: false, message: `Verwendung lesen: ${describeError(usage.error)}` };
        }
        const row = usage.data.find(entry => entry.topic_id === topicId);
        if (!row) {
          return { ok: false, message: "Das geprüfte Thema fehlt in den Zählwerten.", details: { topicId } };
        }
        const sum = row.tasks + row.case_items + row.case_files + row.documents + row.appointments
          + row.decisions + row.contacts + row.knowledge_questions + row.knowledge_documents + row.map_flags;
        const checks = {
          counted: row.case_items >= 1,
          sumMatches: Number(row.total) === sum,
          knowledgeColumn: row.knowledge_questions >= 0,
        };
        return {
          ok: Object.values(checks).every(Boolean),
          message: "topic_usage zählt die Verknüpfungen je Modul und bildet die Summe korrekt.",
          details: { ...checks, case_items: Number(row.case_items), total: Number(row.total) },
        };
      },
    },
    {
      id: "knowledge-topics", label: "Wissensfragen-Verknüpfung lesen und Schreibversuch abweisen",
      run: async ctx => {
        const readable = await supabase.from("knowledge_question_topics").select("topic_id").limit(1);
        const attempt = await supabase.from("knowledge_question_topics").insert({
          tenant_id: ctx.tenantId,
          question_id: "00000000-0000-4000-8000-000000000000",
          topic_id: ctx.data.topicId as string,
        });
        const checks = {
          readable: !readable.error,
          clientWriteRefused: attempt.error?.code === "42501",
        };
        return {
          ok: Object.values(checks).every(Boolean),
          message: "Die Wissensfragen-Verknüpfung ist lesbar; ein direkter Client-Insert wird abgewiesen.",
          details: { ...checks, code: attempt.error?.code ?? null },
        };
      },
    },
  ],
};
