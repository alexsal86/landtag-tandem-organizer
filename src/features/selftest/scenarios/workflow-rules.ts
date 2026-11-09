import { getAdministrationAccess } from "@/components/administration/access";
import { canTransitionStatus } from "@/components/letters/types";
import { canDecide } from "@/features/appointment-requests/logic";
import { isOnResubmission, MINISTRY_RESPONSE_DAYS, withAutoDeadline, type TriageItem } from "@/features/cases/items/ball";
import { computeCropRect, isCrowdedDay, parseTopicDrop, rescheduleToDay } from "@/features/redaktion/utils/plannerRules";
import { validateVariant } from "@/features/redaktion/components/PlannerBoard/utils";
import type { TestScenario } from "../types";

export const workflowRulesScenario: TestScenario = {
  id: "workflow-rules", title: "Geschäftsregeln (Freigabe, Rollen, Fristen)",
  description: "Prüft die von der Anwendung verwendeten Regeln ohne Datenbankzugriff oder Testdatensätze.",
  features: ["letters", "appointment-requests", "case-items"], touches: [],
  checks: ["Erlaubte und verbotene Brief-Statuswechsel", "Entscheiderrollen", "Ministeriumsfrist und Wiedervorlage"],
  limitations: ["Berechtigungen der Datenbank werden separat in den Zugriffstests geprüft."],
  steps: [
    {
      id: "administration-access", label: "Administration: Büro- und Plattformrechte bleiben getrennt", kind: "logic",
      run: async () => {
        const cases = [
          { role: "abgeordneter", platform: false, admin: true, superadmin: false },
          { role: "bueroleitung", platform: false, admin: true, superadmin: false },
          { role: "mitarbeiter", platform: false, admin: false, superadmin: false },
          { role: null, platform: false, admin: false, superadmin: false },
          { role: null, platform: true, admin: true, superadmin: true },
        ];
        const failures = cases.filter(c => {
          const access = getAdministrationAccess(c.role, c.platform);
          return access.isAdmin !== c.admin || access.isSuperAdmin !== c.superadmin;
        });
        return { ok: failures.length === 0, message: `${cases.length - failures.length}/${cases.length} Admin-Rollenregeln bestanden.`, details: failures };
      },
    },
    {
      id: "letter-rules", label: "Brief: Freigabe erforderlich; versendete Briefe bleiben abgeschlossen", kind: "logic",
      run: async () => {
        const cases: Array<[string, string, boolean]> = [
          ["draft", "review", true], ["review", "pending_approval", true], ["pending_approval", "approved", true],
          ["approved", "sent", true], ["draft", "sent", false], ["review", "approved", false],
          ["sent", "draft", false], ["pending_approval", "revision_requested", true], ["revision_requested", "draft", true],
        ];
        const failures = cases.filter(([from, to, allowed]) => canTransitionStatus(from, to) !== allowed);
        return { ok: failures.length === 0, message: `${cases.length - failures.length}/${cases.length} Statusregeln bestanden.`, details: failures };
      },
    },
    {
      id: "decider-roles", label: "Terminanfragen: nur Abgeordnete und Büroleitung entscheiden", kind: "logic",
      run: async () => {
        const cases: Array<[string | null, boolean]> = [["abgeordneter", true], ["bueroleitung", true], ["mitarbeiter", false], ["admin", false], [null, false]];
        const failures = cases.filter(([role, allowed]) => canDecide(role) !== allowed);
        return { ok: failures.length === 0, message: `${cases.length - failures.length}/${cases.length} Rollenregeln bestanden.`, details: failures };
      },
    },
    {
      id: "deadlines", label: "Ministeriumsfrist; fällige Vorgänge verlassen die Wiedervorlage", kind: "logic",
      run: async () => {
        const now = new Date(2026, 10, 6, 12);
        const patch = withAutoDeadline<Partial<TriageItem>>({ ball_owner: "office" }, { ball_owner: "ministry" }, now);
        const due = new Date(patch.next_action_due_at!);
        const days = Math.round((due.getTime() - now.getTime()) / 86400000);
        const future = { ...patch, next_action_label: "Antwort abwarten" };
        const ok = days === MINISTRY_RESPONSE_DAYS && isOnResubmission(future, now) && !isOnResubmission(future, due);
        return { ok, message: ok ? "Frist und Wiedervorlage korrekt." : "Frist oder Wiedervorlage weicht ab.", details: { expectedDays: MINISTRY_RESPONSE_DAYS, actualDays: days } };
      },
    },
    {
      id: "redaktion-planner", label: "Redaktion: Verschieben behält Uhrzeit, volle Tage, Bildzuschnitt", kind: "logic",
      run: async () => {
        const moved = rescheduleToDay(new Date(2026, 10, 3, 14, 30).toISOString(), new Date(2026, 10, 9));
        const fresh = rescheduleToDay(null, new Date(2026, 10, 9));
        const crop = computeCropRect(2000, 1000, 4 / 5);
        const topicDrop = parseTopicDrop(JSON.stringify({ topicId: "idea-one", time: "10:00" }), new Date(2026, 10, 11));
        const customDrop = parseTopicDrop(JSON.stringify({ topicId: "idea-one", time: "14:30" }), new Date(2026, 10, 11));
        const checks = {
          masterTextAccepted: ["instagram", "facebook", "linkedin", "x"].every((slug) => validateVariant(undefined, slug, "Ein gemeinsamer Haupttext.").length === 0),
          channelLimitApplied: validateVariant(undefined, "x", "x".repeat(281)).length > 0,
          emptyTextRejected: validateVariant(undefined, "instagram", "").length > 0,
          topicDrop: topicDrop?.topicId === "idea-one" && topicDrop.scheduledFor.getDate() === 11 && topicDrop.scheduledFor.getHours() === 10,
          customDrop: customDrop?.scheduledFor.getHours() === 14 && customDrop.scheduledFor.getMinutes() === 30,
          invalidDrop: parseTopicDrop('{"topicId":"idea-one","time":"25:00"}', new Date()) === null && parseTopicDrop("invalid", new Date()) === null,
          keepsTime: moved.getDate() === 9 && moved.getHours() === 14 && moved.getMinutes() === 30,
          defaultTen: fresh.getHours() === 10,
          crowded: !isCrowdedDay(2) && isCrowdedDay(3),
          crop45: crop.sw === 800 && crop.sh === 1000 && crop.sx === 600,
        };
        const ok = Object.values(checks).every(Boolean);
        return { ok, message: ok ? "Planer-Regeln korrekt." : "Planer-Regel weicht ab.", details: checks };
      },
    },
  ],
};
