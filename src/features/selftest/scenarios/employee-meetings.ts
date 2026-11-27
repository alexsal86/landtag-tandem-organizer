import { supabase } from "@/integrations/supabase/client";
import type { EmployeeMeetingStatus } from "@/components/employees/types";
import { isPreparationAvailable } from "@/features/employees/preparation";
import { canEditProtocol, isProtocolLocked } from "@/features/employees/protocolWorkflow";
import { SELFTEST_PREFIX } from "../runner";
import type { TestScenario } from "../types";
import { describeError, expectFields } from "../verify";

const tag = (run: string) => `${SELFTEST_PREFIX} Mitarbeitergespräch (${run})`;
const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

export const employeeMeetingsScenario: TestScenario = {
  id: "employee-meetings",
  title: "Mitarbeitergespräche (Anfrage → Termin → Vorbereitung → Freigabe/Sperre)",
  description: "Legt eine Gesprächsanfrage und zwei echte Termine an, prüft das Sieben-Tage-Fenster der Vorbereitung, private Notizen je Nutzer, eine Maßnahme, die Sperren der Protokollfreigabe und den positiven Freigabepfad in einem zurückgerollten Prüfpfad.",
  touches: [
    "employee_meeting_requests",
    "employee_meetings",
    "employee_meeting_private_notes",
    "employee_meeting_action_items",
    "employee_meeting_audit",
  ],
  features: ["employees"],
  checks: [
    "Anfrage und Termin werden als echte Datensätze angelegt und zurückgelesen",
    "Vorbereitung wird vor dem Sieben-Tage-Fenster mit 55000 abgewiesen und innerhalb des Fensters gespeichert",
    "Private Notizen liegen in employee_meeting_private_notes und nicht in den geteilten Vorbereitungsfeldern",
    "Maßnahme wird über mutate_employee_meeting_action angelegt und zurückgelesen",
    "Direkte Statusänderung ist gesperrt; Freigabe, Bestätigung und Wiedereröffnung werden vor Abschluss mit 22023 abgewiesen",
    "Ein veralteter Autosave-Stand wird mit 40001 abgewiesen",
    "Abschluss, Freigabe, Bestätigung, Wiedereröffnung und Einspruch laufen im positiven Pfad über die echten RPCs und werden vollständig zurückgerollt: Status, Auditzeilen, Maßnahmen-Aufgabe, Benachrichtigungen und der letzte Gesprächstermin bleiben unverändert",
  ],
  limitations: [
    "Freigabe, Bestätigung, Wiedereröffnung und Einspruch werden ausschließlich innerhalb von `selftest_employee_protocol` geprüft: Der Aufruf führt die echten Workflow-RPCs aus und rollt alle Schreibzugriffe zurück, weil `guard_employee_protocol` ein Gespräch mit Auditzeilen absichtlich unlöschbar macht und `employee_meeting_audit` für Clients nur lesbar ist. Ein dauerhaft freigegebenes Gespräch, die Zustellung der Freigabe-Benachrichtigung und Folgewirkungen nach dem Aufräumen bleiben deshalb ungeprüft; die Lücke ist in `docs/selftest-center.md` benannt.",
    "Der Selbsttest führt das Gespräch mit dem angemeldeten Konto (Mitarbeitende Person und Gesprächsleitung in einem), damit Vorbereitungsfenster und Bestätigungssperre prüfbar sind; die Rollentrennung deckt access-boundaries ab.",
    "Die Benachrichtigungen der Freigabe-RPCs entstehen im zurückgerollten Prüfpfad und rollen mit zurück; der 15-Minuten-Versand der Vorbereitungserinnerung wird nicht ausgelöst und nicht geprüft.",
  ],
  writes: [
    { table: "employee_meeting_requests", columns: ["employee_id", "tenant_id", "reason", "urgency", "status"] },
    { table: "employee_meetings", columns: ["employee_id", "conducted_by", "tenant_id", "meeting_date", "meeting_type", "status", "employee_preparation"] },
    { table: "employee_meeting_private_notes", columns: ["meeting_id", "user_id", "notes"] },
    { table: "employee_meeting_action_items", columns: ["meeting_id", "tenant_id", "description", "owner", "assigned_to"] },
    { table: "employee_meeting_audit", columns: ["meeting_id", "actor", "action", "reason", "protocol_hash"] },
  ],
  steps: [
    {
      id: "preparation-and-lock-rule", label: "Reine Regel: Sieben-Tage-Fenster und Protokollsperre", kind: "logic",
      run: async () => {
        const editable = ["scheduled", "in_progress"] as EmployeeMeetingStatus[];
        const locked = ["pending_acknowledgement", "acknowledged"] as EmployeeMeetingStatus[];
        const checks = {
          exactlySevenDaysBefore: isPreparationAvailable("2026-11-20", new Date("2026-11-13T10:00:00Z")),
          berlinMidnightBoundary: isPreparationAvailable("2026-11-20", new Date("2026-11-12T23:30:00Z")),
          eightDaysBefore: !isPreparationAvailable("2026-11-20", new Date("2026-11-12T12:00:00Z")),
          winterBoundary: isPreparationAvailable("2026-01-15", new Date("2026-01-08T09:00:00Z"))
            && !isPreparationAvailable("2026-01-15", new Date("2026-01-07T09:00:00Z")),
          editableInMeeting: editable.every(canEditProtocol),
          lockedAfterRelease: locked.every(isProtocolLocked),
          neverBoth: !editable.some(isProtocolLocked) && !locked.some(canEditProtocol),
          finishedNotEditable: (["completed", "cancelled", "cancelled_by_employee", "rescheduled"] as EmployeeMeetingStatus[]).every(status => !canEditProtocol(status)),
        };
        return {
          ok: Object.values(checks).every(Boolean),
          message: "Das Fenster öffnet exakt sieben Berliner Kalendertage vorher; Freigabe sperrt das Protokoll und abgeschlossene Gespräche sind nicht mehr bearbeitbar.",
          details: checks,
        };
      },
    },
    {
      id: "create-request", label: "Gesprächsanfrage anlegen und zurücklesen",
      run: async ctx => {
        const { data, error } = await supabase.from("employee_meeting_requests").insert({
          employee_id: ctx.userId, tenant_id: ctx.tenantId, reason: tag(ctx.runId), urgency: "medium",
        }).select("id").single();
        if (error || !data) return { ok: false, message: `Anfrage: ${describeError(error)}` };
        ctx.data.requestId = data.id;
        ctx.trackRecord({ table: "employee_meeting_requests", id: data.id });
        return expectFields("employee_meeting_requests", data.id,
          { employee_id: ctx.userId, tenant_id: ctx.tenantId, status: "pending", reason: tag(ctx.runId) }, "Anfrage");
      },
    },
    {
      id: "create-meetings", label: "Zwei Termine anlegen (außerhalb und innerhalb des Vorbereitungsfensters)",
      run: async ctx => {
        const create = async (days: number) => {
          const { data, error } = await supabase.from("employee_meetings").insert({
            employee_id: ctx.userId, conducted_by: ctx.userId, tenant_id: ctx.tenantId,
            meeting_date: daysFromNow(days), meeting_type: "regular", status: "scheduled",
          }).select("id").single();
          if (error || !data) throw new Error(`Termin (${days} Tage): ${describeError(error)}`);
          ctx.trackRecord({ table: "employee_meetings", id: data.id });
          return data.id;
        };
        ctx.data.farMeetingId = await create(10);
        ctx.data.nearMeetingId = await create(3);
        return expectFields("employee_meetings", ctx.data.nearMeetingId as string,
          { employee_id: ctx.userId, conducted_by: ctx.userId, tenant_id: ctx.tenantId, status: "scheduled", meeting_type: "regular" }, "Termin");
      },
    },
    {
      id: "preparation-window", label: "Vorbereitung: außerhalb gesperrt, innerhalb speicherbar",
      run: async ctx => {
        const far = ctx.data.farMeetingId as string;
        const near = ctx.data.nearMeetingId as string;
        const blocked = await supabase.rpc("save_employee_meeting", {
          p_meeting_id: far, p_version: 0, p_patch: { employee_preparation: { proud_of: tag(ctx.runId) } },
        });
        if (!blocked.error) return { ok: false, message: "Vorbereitung wurde vor dem Sieben-Tage-Fenster nicht abgewiesen." };
        if (blocked.error.code !== "55000") return { ok: false, message: `Vorbereitung: ${describeError(blocked.error)}` };
        const saved = await supabase.rpc("save_employee_meeting", {
          p_meeting_id: near, p_version: 0, p_patch: { employee_preparation: { proud_of: tag(ctx.runId) } },
        });
        if (saved.error) return { ok: false, message: `Vorbereitung im Fenster: ${describeError(saved.error)}` };
        ctx.data.nearVersion = saved.data;
        const farCheck = await expectFields("employee_meetings", far, { employee_preparation: {} }, "Gesperrte Vorbereitung");
        if (!farCheck.ok) return farCheck;
        return expectFields("employee_meetings", near, { employee_preparation: { proud_of: tag(ctx.runId) } }, "Vorbereitung im Fenster");
      },
    },
    {
      id: "private-notes", label: "Private Notizen getrennt von den geteilten Vorbereitungsfeldern speichern",
      run: async ctx => {
        const near = ctx.data.nearMeetingId as string;
        const notes = `${tag(ctx.runId)} private Notiz`;
        const saved = await supabase.rpc("save_employee_meeting", {
          p_meeting_id: near, p_version: ctx.data.nearVersion as number, p_patch: {}, p_private_notes: notes,
        });
        if (saved.error) return { ok: false, message: `Private Notiz: ${describeError(saved.error)}` };
        ctx.data.nearVersion = saved.data;
        const stored = await supabase.from("employee_meeting_private_notes")
          .select("notes").eq("meeting_id", near).eq("user_id", ctx.userId).maybeSingle();
        if (stored.error || !stored.data) return { ok: false, message: `Private Notiz nicht lesbar: ${describeError(stored.error)}` };
        const shared = await supabase.from("employee_meetings")
          .select("employee_preparation, supervisor_preparation").eq("id", near).single();
        if (shared.error) return { ok: false, message: `Geteilte Felder: ${describeError(shared.error)}` };
        const serialized = JSON.stringify(shared.data);
        const checks = {
          ownNotesStored: stored.data.notes === notes,
          notInSharedFields: !serialized.includes(notes) && !serialized.includes("private_notes"),
        };
        return { ok: Object.values(checks).every(Boolean), message: "Private Notizen liegen nur in der nutzereigenen Zeile und nicht in den geteilten Vorbereitungsfeldern.", details: checks };
      },
    },
    {
      id: "action-item", label: "Maßnahme über die RPC anlegen und zurücklesen",
      run: async ctx => {
        const near = ctx.data.nearMeetingId as string;
        const { data, error } = await supabase.rpc("mutate_employee_meeting_action", {
          p_meeting_id: near, p_action: "add", p_data: { description: `${tag(ctx.runId)} Maßnahme`, owner: "employee" },
        });
        if (error || !data) return { ok: false, message: `Maßnahme: ${describeError(error)}` };
        return expectFields("employee_meeting_action_items", data,
          { meeting_id: near, tenant_id: ctx.tenantId, owner: "employee", status: "open" }, "Maßnahme");
      },
    },
    {
      id: "release-guard", label: "Freigabe nur über den Workflow: direkte und vorzeitige Wechsel sind gesperrt",
      run: async ctx => {
        const near = ctx.data.nearMeetingId as string;
        const direct = await supabase.from("employee_meetings")
          .update({ status: "pending_acknowledgement" }).eq("id", near).select("id");
        const prematureRequest = await supabase.rpc("request_protocol_acknowledgement", { p_meeting_id: near });
        const prematureAck = await supabase.rpc("acknowledge_meeting_protocol", { p_meeting_id: near });
        const prematureReopen = await supabase.rpc("reopen_meeting_protocol", { p_meeting_id: near, p_reason: tag(ctx.runId) });
        const staleSave = await supabase.rpc("save_employee_meeting", {
          p_meeting_id: near, p_version: (ctx.data.nearVersion as number) - 1, p_patch: { protocol_data: { goals: tag(ctx.runId) } },
        });
        const audit = await supabase.from("employee_meeting_audit").select("id").eq("meeting_id", near);
        const read = await expectFields("employee_meetings", near, { status: "scheduled" }, "Status nach Sperrprüfung");
        const checks = {
          directWriteDenied: direct.error?.code === "42501",
          releaseBeforeCompletion: prematureRequest.error?.code === "22023",
          acknowledgeBeforeRelease: prematureAck.error?.code === "22023",
          reopenBeforeCompletion: prematureReopen.error?.code === "22023",
          staleVersionRejected: staleSave.error?.code === "40001",
          noAuditRows: !audit.error && (audit.data ?? []).length === 0,
        };
        if (!read.ok) return read;
        const ok = Object.values(checks).every(Boolean);
        return {
          ok,
          message: ok
            ? "Alle unzulässigen Änderungen wurden ohne Auditzeile abgewiesen."
            : "Mindestens eine Workflow-Sperre oder die Auditprüfung wich vom erwarteten Ergebnis ab.",
          details: {
            ...checks,
            errors: {
              direct: direct.error?.code, release: prematureRequest.error?.code, acknowledge: prematureAck.error?.code,
              reopen: prematureReopen.error?.code, stale: staleSave.error?.code, audit: audit.error?.code,
            },
          },
        };
      },
    },
    {
      id: "release-workflow", label: "Positiver Pfad: Abschluss, Freigabe, Bestätigung, Wiedereröffnung und Einspruch",
      run: async ctx => {
        const near = ctx.data.nearMeetingId as string;
        const { data, error } = await supabase.rpc("selftest_employee_protocol", { p_meeting_id: near });
        if (error) return { ok: false, message: `Freigabepfad: ${describeError(error)}` };
        const checks = (data ?? {}) as unknown as Record<string, boolean>;
        const failed = Object.entries(checks).filter(([, value]) => value !== true).map(([name]) => name);
        const meeting = await supabase.from("employee_meetings")
          .select("status, protocol_hash, acknowledged_at, completed_at").eq("id", near).single();
        const audit = await supabase.from("employee_meeting_audit").select("id").eq("meeting_id", near);
        const items = await supabase.from("employee_meeting_action_items").select("task_id").eq("meeting_id", near);
        if (meeting.error) return { ok: false, message: `Restprüfung: ${describeError(meeting.error)}` };
        const isolation = {
          meetingUnchanged: meeting.data.status === "scheduled" && meeting.data.protocol_hash === null
            && meeting.data.acknowledged_at === null && meeting.data.completed_at === null,
          noAuditRows: !audit.error && (audit.data ?? []).length === 0,
          noTaskLinks: !items.error && (items.data ?? []).every(item => item.task_id === null),
        };
        return {
          ok: Object.keys(checks).length > 0 && failed.length === 0 && Object.values(isolation).every(Boolean),
          message: "Abschluss, Freigabe, Bestätigung, Wiedereröffnung und Einspruch laufen über die echten RPCs; alle Schreibzugriffe werden zurückgerollt, weil auditierte Gespräche unlöschbar sind.",
          details: { checks, failed, isolation },
        };
      },
    },
  ],
};
