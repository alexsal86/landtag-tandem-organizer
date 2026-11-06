import { canTransitionStatus } from "@/components/letters/types";
import { canDecide } from "@/features/appointment-requests/logic";
import { isOnResubmission, MINISTRY_RESPONSE_DAYS, withAutoDeadline, type TriageItem } from "@/features/cases/items/ball";
import type { TestScenario } from "../types";

export const workflowRulesScenario: TestScenario = {
  id: "workflow-rules", title: "Geschäftsregeln (Freigabe, Rollen, Fristen)",
  description: "Prüft die von der Anwendung verwendeten Regeln ohne Datenbankzugriff oder Testdatensätze.",
  features: ["letters", "appointment-requests", "case-items"], touches: [],
  checks: ["Erlaubte und verbotene Brief-Statuswechsel", "Entscheiderrollen", "Ministeriumsfrist und Wiedervorlage"],
  limitations: ["Berechtigungen der Datenbank werden separat in den Zugriffstests geprüft."],
  steps: [
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
  ],
};
