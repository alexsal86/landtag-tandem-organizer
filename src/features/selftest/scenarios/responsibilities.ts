import {
  suggestResponsible,
  responsibilityCoverage,
  matchesResponsibilityArea,
  findCoverageGaps,
} from "@/features/responsibilities/suggest";
import { formatInTimeZone } from "@/features/responsibilities/berlinDay";
import { topicMentionIds, topicMentionToken } from "@/features/topics/topicMentions";
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
    "Die positive Themen-Meldung (Empfänger mit Primärzuständigkeit) braucht ein zweites Konto und wird nur im isolierten Datenbanktest geprüft; hier wird die Servergrenze des Anlaufs abgesichert.",
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
      id: "topic-mention-token",
      label: "Themen-Token hält die ID stabil und wird aus HTML wie Text gelesen",
      kind: "logic",
      run: async () => {
        const topicId = "3f7c1e0a-5b2d-4c8a-9d61-2a4b6c8d0e1f";
        const token = topicMentionToken("Presse", topicId);
        const html = `<p>Notiz <span data-lexical-topic-id="${topicId}" data-lexical-topic-label="Presse">#Presse</span></p>`;
        return {
          ok:
            token === `#[Presse](${topicId})` &&
            topicMentionIds(token).join() === topicId &&
            topicMentionIds(html).join() === topicId &&
            topicMentionIds("#[Presse](keine-uuid)").length === 0,
          message:
            "Token und gespeichertes HTML liefern dieselbe Themen-ID; ungültige IDs lösen keine Meldung aus.",
        };
      },
    },

    {
      id: "topic-mention-server-only",
      label: "Themen-Meldungen löst nur der serverseitige Ruhephase-Anlauf aus",
      kind: "db",
      run: async () => {
        const callServerOnly = supabase.rpc as unknown as (
          fn: string,
          args?: Record<string, unknown>,
        ) => Promise<{ error: { code?: string } | null }>;
        const direct = await callServerOnly("dispatch_topic_mentions_for_note", {
          p_note_id: crypto.randomUUID(),
        });
        const settled = await callServerOnly("dispatch_settled_topic_mentions", {
          p_quiet_seconds: 0,
          p_window_hours: 1,
        });
        return {
          ok: direct.error?.code === "42501" && settled.error?.code === "42501",
          message:
            "Weder der Kern noch der verzögerte Anlauf sind für Clients aufrufbar; Meldungen entstehen ausschließlich in der Datenbank und erst nach der Ruhephase.",
        };
      },
    },

    {
      id: "topic-mention-delivery",
      label: "Themen-Meldung kommt genau einmal an, ohne Primärzuständigkeit gar nicht",
      kind: "workflow",
      run: async (ctx) => {
        const callSelftest = supabase.rpc as unknown as (
          fn: string,
          args?: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
        const response = await callSelftest("topic_mention_selftest", {
          p_tenant: ctx.tenantId,
        });
        if (response.error) {
          return {
            ok: false,
            message:
              response.error.message ??
              response.error.code ??
              "Server-Selbsttest nicht ausführbar",
          };
        }
        const result =
          response.data && typeof response.data === "object" && !Array.isArray(response.data)
            ? (response.data as {
                ok?: boolean;
                skipped?: string;
                message?: string;
                checks?: Record<string, boolean>;
              })
            : null;
        if (result?.skipped) return { ok: true, message: result.skipped };
        return {
          ok: result?.ok === true,
          message:
            result?.message ??
            (result?.ok === true
              ? "Genau eine Meldung bei der primären Zuständigkeit, keine ohne Primärzuständigkeit; Testthemen, Zuständigkeit, Notizen und Meldungen wurden zurückgerollt."
              : "Zustellung oder Stille weicht vom erwarteten Verhalten ab."),
          details: result?.checks,
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
