import {
  suggestResponsible,
  responsibilityCoverage,
  matchesResponsibilityArea,
  findCoverageGaps,
} from "@/features/responsibilities/suggest";
import { formatInTimeZone } from "@/features/responsibilities/berlinDay";
import { supabase } from "@/integrations/supabase/client";
import type { TestScenario } from "../types";
export const responsibilitiesScenario: TestScenario = {
  id: "responsibilities",
  title: "Zuständigkeiten & Matrix",
  description: "Vorschläge, Lücken und Tenant-Grenzen der Matrix.",
  touches: ["tasks"],
  features: ["employees", "permissions"],
  limitations: [
    "Der Fremdtenant-Lesetest verwendet für das angemeldete Konto nicht zugängliche IDs. Zwei echte Sitzungen und RPC-Schreibtests werden zusätzlich im isolierten Datenbanktest geprüft.",
  ],
  steps: [
    {id:'topic-conversion-boundary',label:'Themenumwandlung verlangt Tenant und Leitungsrolle',kind:'workflow',run:async()=>{const r=await supabase.rpc('convert_topic_to_catalog',{p_topic:crypto.randomUUID(),p_kind:'committee'});return {ok:r.error?.code==='42501',message:'Unbekannte bzw. fremde Themen können nicht umgewandelt werden.'};}},

    {
      id: "matrix-multiple-primary",
      label: "Mehrere Primärpersonen und unterschiedliche Abdeckungslücken",
      kind: "logic",
      run: async () => {
        const area = { id: "topic", kind: "topic" as const, name: "Presse" };
        const rows = [
          {
            user_id: "a",
            kind: "topic" as const,
            topic_id: "topic",
            level: "primary" as const,
          },
          {
            user_id: "b",
            kind: "topic" as const,
            topic_id: "topic",
            level: "primary" as const,
          },
        ];
        return {
          ok:
            responsibilityCoverage(area, rows).primary === 2 &&
            responsibilityCoverage(area, rows).state === "covered" &&
            responsibilityCoverage(area, [{ ...rows[0], level: "secondary" }])
              .state === "no_primary" &&
            responsibilityCoverage(area, []).state === "unassigned" &&
            matchesResponsibilityArea(area, "Anna", rows, [
              { id: "a", name: "Anna" },
            ]),
          message:
            "Mehrere Primärpersonen sind erlaubt; sekundäre und vollständig fehlende Besetzung bleiben unterscheidbar. Suche findet zugeordnete Personen.",
        };
      },
    },

    {
      id: "priority",
      label: "Thema und Region, Primärstufe und deterministische Gleichstände",
      kind: "logic",
      run: async () => {
        const result = suggestResponsible(
          { topicIds: ["t"], regionIds: ["r"] },
          [
            {
              user_id: "combo",
              kind: "topic",
              topic_id: "t",
              level: "secondary",
            },
            {
              user_id: "combo",
              kind: "region",
              region_id: "r",
              level: "secondary",
            },
            { user_id: "b", kind: "topic", topic_id: "t", level: "primary" },
            { user_id: "a", kind: "topic", topic_id: "t", level: "primary" },
            {
              user_id: "region",
              kind: "region",
              region_id: "r",
              level: "primary",
            },
          ],
          [],
        );
        return {
          ok:
            result.map((c) => c.userId).join(",") === "combo,a,b,region" &&
            suggestResponsible({}, [], []).length === 0,
          message:
            "Kombination vor Thema vor Region; Gleichstand stabil nach User-ID, ohne Treffer kein Vorschlag.",
        };
      },
    },

    {
      id: "confirmed-handover",
      label: "Bestätigte Übergabe erhält Ball-Kategorie und ist wiederholbar",
      kind: "workflow",
      run: async (ctx) => {
        const created = await supabase
          .from("tasks")
          .insert({
            tenant_id: ctx.tenantId,
            user_id: ctx.userId,
            title: `[SELFTEST] Matrix ${ctx.runId}`,
            ball_owner: "deputy",
            status: "todo",
          })
          .select("id")
          .single();
        if (created.error || !created.data)
          return {
            ok: false,
            message: created.error?.message ?? "Keine Testaufgabe angelegt.",
          };
        ctx.trackRecord({ table: "tasks", id: created.data.id });
        for (let i = 0; i < 2; i++) {
          const result = await supabase.rpc(
            "assign_from_responsibility_matrix",
            {
              p_tenant: ctx.tenantId,
              p_kind: "task",
              p_id: created.data.id,
              p_user: ctx.userId,
            },
          );
          if (result.error) return { ok: false, message: result.error.message };
        }
        const result = await supabase
          .from("tasks")
          .select("ball_owner,ball_assignee_id,timeline")
          .eq("id", created.data.id)
          .single();
        return {
          ok:
            !result.error &&
            result.data?.ball_owner === "deputy" &&
            result.data.ball_assignee_id === ctx.userId &&
            Array.isArray(result.data.timeline) &&
            result.data.timeline.length === 1,
          message:
            "Bestehende Aufgabe über RPC übergeben; Freigabekategorie unverändert, Timeline nicht doppelt.",
        };
      },
    },
    {
      id: "catalog-write-boundary",
      label: "Katalogänderungen und Zusammenführen erzwingen Tenant und Rolle",
      kind: "workflow",
      run: async (ctx) => {
        const foreign = await supabase.rpc("save_responsibility_catalog", {
          p_tenant: crypto.randomUUID(),
          p_kind: "committee",
          p_name: "[SELFTEST] Verweigert",
        });
        const id = crypto.randomUUID();
        const merge = await supabase.rpc("merge_responsibility_catalog", {
          p_tenant: ctx.tenantId,
          p_kind: "committee",
          p_source: id,
          p_target: id,
        });
        const admin = ["bueroleitung", "abgeordneter"].includes(ctx.role ?? "");
        return {
          ok:
            foreign.error?.code === "42501" &&
            merge.error?.code === (admin ? "22023" : "42501"),
          message:
            "Fremdtenant-Schreiben und unzulässige Zusammenführung werden serverseitig abgewiesen.",
        };
      },
    },

    {
      id: "suggest",
      label: "Sekundärzuständigkeit bei Abwesenheit vorschlagen",
      kind: "logic",
      run: async () => {
        const result = suggestResponsible(
          { topicIds: ["t"] },
          [
            { user_id: "a", kind: "topic", topic_id: "t", level: "primary" },
            { user_id: "b", kind: "topic", topic_id: "t", level: "secondary" },
          ],
          ["a"],
        );
        return {
          ok: result[0]?.userId === "b" && result[0].absentUserIds[0] === "a",
          message:
            "Abwesenheit stuft Primär herab; Übergabe bleibt eine bewusste Aktion.",
        };
      },
    },
    {
      id: "gaps",
      label: "Lücken erkennen",
      kind: "logic",
      run: async () => ({
        ok:
          findCoverageGaps(
            { topics: [{ id: "t" }], committees: [], regions: [] },
            [],
          )[0]?.id === "t",
        message: "Unbesetztes Thema erkannt.",
      }),
    },
    {
      id: "berlin-day",
      label: "Abwesenheit nach Berliner Kalendertag abfragen",
      kind: "logic",
      run: async () => ({
        ok: formatInTimeZone(new Date("2026-06-01T22:30:00Z")) === "2026-06-02",
        message: "Berliner Tagesgrenze statt UTC verwendet.",
      }),
    },
    {
      id: "foreign-tenant",
      label: "Fremdtenant darf keine Matrixdaten liefern",
      kind: "db",
      run: async (ctx) => {
        const memberships = await supabase
          .from("user_tenant_memberships")
          .select("tenant_id")
          .eq("user_id", ctx.userId)
          .eq("is_active", true);
        if (memberships.error)
          return { ok: false, message: memberships.error.message };
        const allowed = (memberships.data ?? []).map((m) => m.tenant_id);
        const checks = await Promise.all(
          ["employee_responsibilities", "committees", "regions"].map(
            async (table) => {
              const r = await supabase
                .from(table as "committees")
                .select("tenant_id");
              return (
                !r.error &&
                (r.data ?? []).every((row) => allowed.includes(row.tenant_id))
              );
            },
          ),
        );
        return {
          ok: checks.every(Boolean),
          message:
            "Nur Daten aktiver eigener Tenant-Mitgliedschaften sichtbar; bevölkerter Fremdtenant wird im DB-Test nachgewiesen.",
        };
      },
    },
  ],
};
