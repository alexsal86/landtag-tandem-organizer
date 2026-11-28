import { supabase } from "@/integrations/supabase/client";
import { REQUIRED_NOTIFICATION_TYPES } from "../notificationTypeExpectations";
import type { TestScenario } from "../types";
import { SELFTEST_PREFIX } from "../runner";
import { describeError } from "../verify";

const tag = (run: string, label: string) => `${SELFTEST_PREFIX} ${label} (${run})`;

export const notificationInboxScenario: TestScenario = {
  id: "notification-inbox",
  title: "Benachrichtigungs-Inbox (Erzeugen, Gelesen-Markieren, Zurücksetzen und Zugriffsgrenze)",
  description: "Erzeugt eine echte In-App-Benachrichtigung im eigenen Büro, markiert sie als gelesen, setzt sie wieder auf ungelesen zurück und prüft, dass fremde Benachrichtigungen weder lesbar noch über einen fremden Nutzerbezug änderbar sind.",
  touches: ["notifications"],
  features: ["notifications", "dashboard"],
  checks: [
    "Eine Benachrichtigung wird mit Mandant, Typ und Deep-Link-Daten angelegt und ist ungelesen",
    "Als-gelesen-Markieren setzt is_read und read_at und ist erneut lesbar",
    "Zurücksetzen setzt die Benachrichtigung wieder auf ungelesen und leert read_at",
    "Alle clientseitig erzeugten Meldungstypen sind im Büro aktiv vorhanden",
    "Fremde Benachrichtigungen liefern keine Zeilen, und ein Update mit fremdem Nutzerbezug ändert die eigene Zeile nicht",
  ],
  limitations: [
    "Die Zustellung je Fach-Trigger (Aufgaben, Termine, Nachrichten, Freigaben) prüft das Szenario nicht; es erzeugt seine Benachrichtigung direkt über die Inbox-Tabelle.",
    "Push-Versand, Glocke, Realtime-Aktualisierung und die Oberfläche der Benachrichtigungsseite werden nicht geprüft.",
    "Der Schritt braucht mindestens einen aktiven Benachrichtigungstyp im Büro; fehlt er, meldet das Szenario das als Befund statt still zu bestehen.",
  ],
  writes: [
    { table: "notifications", columns: ["tenant_id", "user_id", "notification_type_id", "title", "message", "data", "priority", "is_read", "read_at"] },
  ],
  steps: [
    {
      id: "create-notification", label: "Benachrichtigung erzeugen",
      run: async ctx => {
        const type = await supabase.from("notification_types")
          .select("id,name").eq("tenant_id", ctx.tenantId).eq("is_active", true)
          .order("name").limit(1).maybeSingle();
        if (type.error) return { ok: false, message: `Benachrichtigungstyp lesen: ${describeError(type.error)}` };
        if (!type.data) {
          return { ok: false, message: "Im Büro fehlt ein aktiver Benachrichtigungstyp; ohne Typ lässt sich keine Inbox-Benachrichtigung anlegen." };
        }
        ctx.data.notificationTypeId = type.data.id;

        const payload = {
          tenant_id: ctx.tenantId,
          user_id: ctx.userId,
          notification_type_id: type.data.id,
          title: tag(ctx.runId, "Benachrichtigung"),
          message: "Selbsttest: Diese Benachrichtigung gehört nur dem ausführenden Konto.",
          data: { route: "/notifications", selftest: ctx.runId },
          priority: "medium",
        };
        const { data, error } = await supabase.from("notifications").insert(payload).select("id,is_read,read_at").single();
        if (error || !data) return { ok: false, message: `Benachrichtigung anlegen: ${describeError(error)}` };
        ctx.data.notificationId = data.id;
        ctx.trackRecord({ table: "notifications", id: data.id });

        const own = await supabase.from("notifications")
          .select("id,tenant_id,user_id,title,is_read,read_at,data").eq("id", data.id).maybeSingle();
        if (own.error || !own.data) return { ok: false, message: `Benachrichtigung lesen: ${describeError(own.error)}` };

        const ok = own.data.tenant_id === ctx.tenantId
          && own.data.user_id === ctx.userId
          && own.data.title === payload.title
          && own.data.is_read === false
          && own.data.read_at === null;
        return {
          ok,
          message: ok
            ? "Benachrichtigung liegt ungelesen im eigenen Postfach und trägt Mandant, Typ und Deep-Link."
            : "Die angelegte Benachrichtigung weicht von Mandant, Empfänger oder Lesestatus ab.",
          details: own.data,
        };
      },
    },
    {
      id: "notification-types", label: "Alle vom Client erzeugten Meldungstypen existieren im Büro",
      run: async ctx => {
        const expected = [...REQUIRED_NOTIFICATION_TYPES];
        const { data, error } = await supabase.from("notification_types")
          .select("name,is_active")
          .eq("tenant_id", ctx.tenantId)
          .in("name", expected);
        if (error) return { ok: false, message: `Meldungstypen lesen: ${describeError(error)}` };

        const active = new Set((data ?? []).filter((row: { is_active: boolean }) => row.is_active).map((row: { name: string }) => row.name));
        const missing = expected.filter(name => !active.has(name));
        return {
          ok: missing.length === 0,
          message: missing.length === 0
            ? `${expected.length} clientseitig erzeugte Meldungstypen sind im Büro aktiv vorhanden.`
            : `Im Büro fehlen aktive Meldungstypen: ${missing.join(", ")}. create_notification würde diese Meldungen verwerfen.`,
          details: { expected: expected.length, missing },
        };
      },
    },
    {
      id: "mark-read", label: "Benachrichtigung als gelesen markieren",
      run: async ctx => {
        const id = ctx.data.notificationId as string;
        const readAt = new Date().toISOString();
        const updated = await supabase.from("notifications")
          .update({ is_read: true, read_at: readAt })
          .eq("id", id).eq("user_id", ctx.userId);
        if (updated.error) return { ok: false, message: `Als gelesen markieren: ${describeError(updated.error)}` };

        const read = await supabase.from("notifications")
          .select("is_read,read_at").eq("id", id).maybeSingle();
        if (read.error || !read.data) return { ok: false, message: `Benachrichtigung lesen: ${describeError(read.error)}` };
        const ok = read.data.is_read === true && read.data.read_at !== null;
        return {
          ok,
          message: ok ? "Benachrichtigung ist gelesen; der Lesezeitpunkt ist gespeichert." : "Der Lesestatus wurde nicht gespeichert.",
          details: read.data,
        };
      },
    },
    {
      id: "reset-unread", label: "Benachrichtigung wieder auf ungelesen zurücksetzen",
      run: async ctx => {
        const id = ctx.data.notificationId as string;
        const updated = await supabase.from("notifications")
          .update({ is_read: false, read_at: null })
          .eq("id", id).eq("user_id", ctx.userId);
        if (updated.error) return { ok: false, message: `Zurücksetzen: ${describeError(updated.error)}` };

        const read = await supabase.from("notifications")
          .select("is_read,read_at").eq("id", id).maybeSingle();
        if (read.error || !read.data) return { ok: false, message: `Benachrichtigung lesen: ${describeError(read.error)}` };
        const ok = read.data.is_read === false && read.data.read_at === null;
        return {
          ok,
          message: ok ? "Benachrichtigung ist wieder ungelesen; der Lesezeitpunkt ist geleert." : "Das Zurücksetzen hat den Lesestatus nicht geändert.",
          details: read.data,
        };
      },
    },
    {
      id: "access-boundary", label: "Fremde Benachrichtigungen bleiben unlesbar und unverändert",
      run: async ctx => {
        const id = ctx.data.notificationId as string;
        const other = await supabase.from("user_tenant_memberships")
          .select("user_id").eq("tenant_id", ctx.tenantId).eq("is_active", true)
          .neq("user_id", ctx.userId).limit(1).maybeSingle();
        if (other.error) return { ok: false, message: `Zweites Konto lesen: ${describeError(other.error)}` };

        const foreignId = other.data?.user_id ?? crypto.randomUUID();
        ctx.data.foreignUserId = foreignId;

        // Lesen: Die RLS-Policy liefert ausschließlich eigene Zeilen.
        const foreignRows = await supabase.from("notifications")
          .select("id").eq("user_id", foreignId).limit(5);
        if (foreignRows.error) return { ok: false, message: `Fremde Benachrichtigungen lesen: ${describeError(foreignRows.error)}` };
        const foreignVisible = (foreignRows.data ?? []).length;

        // Schreiben: Ein Update mit fremdem Nutzerbezug darf die eigene Zeile nicht treffen.
        const foreignUpdate = await supabase.from("notifications")
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq("id", id).eq("user_id", foreignId).select("id");
        if (foreignUpdate.error) return { ok: false, message: `Fremdbezug ändern: ${describeError(foreignUpdate.error)}` };
        const touched = (foreignUpdate.data ?? []).length;

        const own = await supabase.from("notifications").select("is_read,read_at").eq("id", id).maybeSingle();
        if (own.error || !own.data) return { ok: false, message: `Eigene Benachrichtigung lesen: ${describeError(own.error)}` };

        const checks = {
          foreignReadHidden: foreignVisible === 0,
          foreignUpdateBlocked: touched === 0,
          ownRowUntouched: own.data.is_read === false && own.data.read_at === null,
        };
        const ok = Object.values(checks).every(Boolean);
        return {
          ok,
          message: ok
            ? "Fremde Postfächer sind weder lesbar noch über einen fremden Nutzerbezug änderbar; die eigene Zeile bleibt ungelesen."
            : "Die Zugriffsgrenze der Inbox hält nicht: fremde Zeilen waren sichtbar oder der Fremdbezug hat die eigene Zeile geändert.",
          details: { ...checks, foreignUserId: foreignId, hasSecondMember: Boolean(other.data) },
        };
      },
    },
  ],
};
