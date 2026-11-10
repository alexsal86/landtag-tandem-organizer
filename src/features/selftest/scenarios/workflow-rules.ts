import { getAdministrationAccess } from "@/components/administration/access";
import { automationTabFromParams, normalizeAutomationParams, rssTabFromParams } from "@/components/administration/automationNavigation";
import { canTransitionStatus } from "@/components/letters/types";
import { canDecide } from "@/features/appointment-requests/logic";
import { isOnResubmission, MINISTRY_RESPONSE_DAYS, withAutoDeadline, type TriageItem } from "@/features/cases/items/ball";
import { computeCropRect, isCrowdedDay, parseTopicDrop, rescheduleToDay } from "@/features/redaktion/utils/plannerRules";
import { validateVariant } from "@/features/redaktion/components/PlannerBoard/utils";
import { defaultStepSetting, previewRoutine, readStepSettings, resolveRoutineDates, validateStepGraph, validateRoutineWorkflow } from "@/features/automation/routineWorkflow";
import { routineEntityLink, routineStepLabel } from "@/features/automation/routinePackages";
import { routineStepKinds, validateOfficeRoutine } from "@/features/automation/officeRoutineTemplates";
import { evaluateAutomationTree } from "@/features/automation/conditions";
import { validateRuleEditor } from "@/components/administration/automationRule/ruleValidation";
import { editorFormSnapshot, editorPlanYear, editorStepErrors, evaluateEditorSample, parseEditorSample } from "@/components/administration/automationRule/editorModel";
import { DEFAULT_ACTION, DEFAULT_FORM } from "@/components/administration/automationRule/constants";
import type { TestScenario } from "../types";
import { calendarOccurrence, nextCalendarOccurrence, scheduleRunKey } from "@/features/automation/calendarSchedule";

export const workflowRulesScenario: TestScenario = {
  id: "workflow-rules", title: "Geschäftsregeln (Freigabe, Rollen, Fristen)",
  description: "Prüft die von der Anwendung verwendeten Regeln ohne Datenbankzugriff oder Testdatensätze.",
  features: ["letters", "appointment-requests", "case-items"], touches: [],
  checks: ["Erlaubte und verbotene Brief-Statuswechsel", "Entscheiderrollen", "Ministeriumsfrist und Wiedervorlage"],
  limitations: ["Berechtigungen der Datenbank werden separat in den Zugriffstests geprüft."],
  steps: [
    {
      id: "routine-relative-deadlines-deputies", label: "Routinen: relative Fristen und Abwesenheitsvertretung konfigurieren", kind: "logic",
      run: async () => {
        const base = defaultStepSetting();
        const planned = [base, { ...base, deadline_basis: "previous_planned" as const, deadline_offset: 3 }];
        const actual = [base, { ...base, deadline_basis: "previous_completed" as const, deadline_offset: 2 }];
        const dates = resolveRoutineDates("2026-11-01", "2026-12-01", [10, 0], planned);
        const nextPlan = [ { ...base, deadline_basis: "next_planned" as const, deadline_offset: -3 }, { ...base, release: "after_previous" as const } ];
        const checks = {
          previousPlanned: dates[1].due === "2026-11-24",
          nextPlanned: resolveRoutineDates("2026-11-01", "2026-12-01", [0, 0], nextPlan)[0].due === "2026-11-28",
          realCompletionUnknown: resolveRoutineDates("2026-11-01", "2026-12-01", [10, 0], actual)[1].due === null,
          realCompletionKnown: resolveRoutineDates("2026-11-01", "2026-12-01", [10, 0], actual, ["2026-11-25"])[1].due === "2026-11-27",
          nextCompletionCycle: validateStepGraph([{ ...base, deadline_basis: "next_completed" }, { ...base, release: "after_previous" }]) !== null,
          plannedCycle: validateStepGraph([{ ...base, deadline_basis: "next_planned" }, { ...base, deadline_basis: "previous_planned" }]) !== null,
          missingNeighbor: validateStepGraph([{ ...base, deadline_basis: "previous_planned" }]) !== null,
          legacyDeputyEnabled: readStepSettings('[{"release":"package_start","assignee":"","approver":""}]', 1)[0].use_deputy,
          explicitDeputyDisabled: !readStepSettings(JSON.stringify([{ ...base, use_deputy: false }]), 1)[0].use_deputy,
          deferredLabel: routineStepLabel({ status: "waiting", release: "package_start", due_day: null }) === "Wartet auf Bezugsschritt",
        };
        return { ok: Object.values(checks).every(Boolean), message: "Relative Terminplanung, Kreisprüfung und Vertretungseinstellung verwenden die Editor-Regeln. Die tatsächliche Vertretungsauflösung erfolgt mandantengeprüft in der Datenbank.", details: checks };
      },
    },
    {
      id: "shared-condition-dates", label: "Regeln: identische Datumsauswertung für Vorschau und Server", kind: "logic",
      run: async () => {
        const evaluate = (actual: unknown, operator: string, value: string) => evaluateAutomationTree({ due_date: actual }, { all: [{ field: "due_date", operator, value }] }, "tasks").matched;
        const badDate = { ...DEFAULT_FORM, name: "Datumsregel", triggerType: "manual", conditionGroup: { logic: "all" as const, conditions: [], groups: [{ logic: "all" as const, conditions: [{ field: "due_date", operator: "gt", value: "2026-02-30" }], groups: [] }] }, actions: [{ ...DEFAULT_ACTION, type: "create_task", title: "Folgeschritt" }] };
        const checks = {
          dateOrder: evaluate("2026-12-10", "gt", "2026-11-10"),
          berlinDay: evaluate("2026-11-10T23:30:00Z", "gt", "2026-11-10"),
          sameBerlinDay: evaluate("2026-11-10T22:30:00Z", "equals", "2026-11-10"),
          equivalentInstant: evaluate("2026-07-01T08:00:00Z", "equals", "2026-07-01T10:00:00+02:00"),
          springMidnight: evaluate("2026-03-29", "equals", "2026-03-28T23:00:00Z"),
          autumnMidnight: evaluate("2026-10-25", "equals", "2026-10-24T22:00:00Z"),
          rejectInvalid: !evaluate("2026-02-30", "gt", "2026-02-01"),
          rejectMissing: !evaluate(undefined, "not_equals", "2026-11-10"),
          rejectNaiveTime: !evaluate("2026-11-10T12:00:00", "gt", "2026-11-01"),
          nestedFieldError: validateRuleEditor(badDate).some(issue => issue.field === "conditionGroup.groups.0.conditions.0.value" && issue.level === "error"),
          nameFieldError: validateRuleEditor({ ...badDate, name: "" }).some(issue => issue.field === "name"),
          sampleDoesNotBlockSaving: editorStepErrors({ ...DEFAULT_FORM, name: "JSON-Beispiel", triggerType: "manual", conditionGroup: { logic: "all", conditions: [], groups: [] }, actions: [{ ...DEFAULT_ACTION, type: "create_task", title: "Aufgabe" }], samplePayload: "{" }).slice(0,3).every(step => step.length === 0),
        };
        return { ok: Object.values(checks).every(Boolean), message: "Datums-, Zeitzonen- und Feldfehlerregeln verwenden dieselbe Grundlage.", details: checks };
      },
    },
    {
      id: "rule-editor-preview", label: "Regel-Editor: JSON, verschachtelte Vorschau und unbedingte Regeln", kind: "logic",
      run: async () => {
        const condition = (value: string) => ({ field: "status", operator: "equals", value });
        const base = { ...DEFAULT_FORM, name: "Editor-Beispiel", triggerType: "manual", conditionGroup: { logic: "all" as const, conditions: [], groups: [] }, actions: [{ ...DEFAULT_ACTION, type: "create_task", title: "Aufgabe" }] };
        const nested = { ...base, conditionGroup: { logic: "all" as const, conditions: [condition("open")], groups: [{ logic: "any" as const, conditions: [{ field: "priority", operator: "equals", value: "high" }, { field: "priority", operator: "equals", value: "urgent" }], groups: [] }] } };
        const now = new Date("2026-11-10T12:00:00Z");
        const checks = {
          emptyRuns: evaluateEditorSample(base, {})?.runs === true,
          emptyValid: editorStepErrors(base).every(step => step.length === 0),
          nestedMatch: evaluateEditorSample(nested, { status: "open", priority: "urgent" })?.runs === true,
          nestedReject: evaluateEditorSample(nested, { status: "closed", priority: "urgent" })?.runs === false,
          fullCount: evaluateEditorSample(nested, { status: "open", priority: "urgent" })?.total === 3,
          objectOnly: Boolean(parseEditorSample("[]").error && parseEditorSample("null").error && parseEditorSample("7").error),
          invalidJson: Boolean(parseEditorSample("{").error),
          sampleNotPersisted: editorFormSnapshot(base) === editorFormSnapshot({ ...base, samplePayload: '{"status":"open"}' }),
          manualYear: editorPlanYear(base, now) === 2026,
          automaticYear: editorPlanYear({ triggerType: "schedule", schedule: { ...DEFAULT_FORM.schedule!, schedule_kind: "annual", month: "9", day: "15", hour: "9", month_end: "false", timezone: "Europe/Berlin" } }, now) === 2027,
        };
        return { ok: Object.values(checks).every(Boolean), message: "Editor-Vorschau und Speichervoraussetzungen geprüft.", details: checks };
      },
    },
    {
      id: "routine-dependencies-preview", label: "Routinen: Freigaben, Abhängigkeiten und Jahreswechsel bleiben nachvollziehbar", kind: "logic",
      run: async () => {
        const fields = { routineDeadlineMonth: "1", routineDeadlineDay: "10", routineSteps: "0 | Versand\n70 | Liste bereinigen", routineStepKinds: '["task","case"]' };
        const plan = previewRoutine(fields, { month: "11", day: "1", month_end: "false" }, 2026);
        const sequential = { ...fields, routineSteps: "70 | Liste bereinigen\n0 | Versand", routineStepSettings: JSON.stringify([defaultStepSetting(), { ...defaultStepSetting(), release: "after_previous" }]) };
        const checks = {
          yearBoundary: plan.finish === "2027-01-10",
          pairedSort: plan.steps[0].title === "Liste bereinigen" && plan.steps[0].kind === "case",
          inheritedDefaults: readStepSettings(undefined, 2).every(step => step.release === "package_start" && !step.assignee),
          validDependency: validateRoutineWorkflow(sequential) === null,
          firstCannotWait: validateRoutineWorkflow({ ...sequential, routineStepSettings: JSON.stringify([{ ...defaultStepSetting(), release: "after_previous" }, defaultStepSetting()]) }) !== null,
          explicitApproval: validateRoutineWorkflow({ ...sequential, routineStepSettings: JSON.stringify([defaultStepSetting(), { ...defaultStepSetting(), release: "after_approval" }]) }) !== null,
          blockedLabel: routineStepLabel({ status: "blocked", release: "after_approval" }) === "Angehalten",
          caseLink: routineEntityLink("jour_fixe", "case-id", "parent") === "/vorgaenge/case-id",
          subtaskLink: routineEntityLink("subtask", "child", "parent").endsWith("highlight=parent"),
        };
        return { ok: Object.values(checks).every(Boolean), message: "Abhängigkeiten und Vorschau verwenden dieselben Paketdaten.", details: checks };
      },
    },
    {
      id: "routine-step-types", label: "Routinen: Schritttypen bleiben vollständig und abwärtskompatibel", kind: "logic",
      run: async () => {
        const kinds = ["subtask", "task", "case", "decision", "jour_fixe"];
        const fields = { routineDeadlineMonth: "12", routineDeadlineDay: "10", routineSteps: kinds.map((_, index) => `${index * 7} | Schritt ${index + 1}`).join("\n") };
        const checks = {
          legacy: routineStepKinds(undefined, 2).every(kind => kind === "subtask"),
          allKinds: routineStepKinds(JSON.stringify(kinds), 5).join() === kinds.join(),
          valid: validateOfficeRoutine({ ...fields, routineStepKinds: JSON.stringify(kinds) }) === null,
          mismatch: validateOfficeRoutine({ ...fields, routineStepKinds: '["task"]' }) !== null,
          unknown: validateOfficeRoutine({ ...fields, routineStepKinds: JSON.stringify([...kinds.slice(0, 4), "unknown"]) }) !== null,
        };
        return { ok: Object.values(checks).every(Boolean), message: "Schritttypen und Zuordnung zum Aufgabenpaket geprüft.", details: checks };
      },
    },
    {
      id: "calendar-automation", label: "Stichtage: Jahresdatum, Monatsende, Quartal und doppelte Ausführung", kind: "logic",
      run: async () => {
        const config = { schedule_kind: "annual", month: "4", day: "1", hour: "9", month_end: "false", timezone: "Europe/Berlin" };
        const checks = {
          before: calendarOccurrence(config, new Date("2026-04-01T06:00:00Z")) === null,
          due: calendarOccurrence(config, new Date("2026-04-01T07:00:00Z")) === "2026-04-01",
          next: nextCalendarOccurrence(config, new Date("2026-03-01T00:00:00Z"))?.toISOString() === "2026-04-01T07:00:00.000Z",
          monthEnd: calendarOccurrence({ ...config, schedule_kind: "monthly", month_end: "true" }, new Date("2028-02-29T08:00:00Z")) === "2028-02-29",
          quarter: calendarOccurrence({ ...config, schedule_kind: "quarterly", month_end: "true" }, new Date("2026-06-30T07:00:00Z")) === "2026-06-30",
          sameSlot: scheduleRunKey("a", "2026-04-01") === "a-calendar-2026-04-01",
        };
        return { ok: Object.values(checks).every(Boolean), message: "Stichtagsregeln geprüft.", details: checks };
      },
    },
    {
      id: "automation-hub-links", label: "Automatisierung: alte Workflow- und RSS-Links bleiben erreichbar", kind: "logic",
      run: async () => {
        const engine = normalizeAutomationParams(new URLSearchParams("adminSection=automation&adminSubSection=engine"));
        const sources = normalizeAutomationParams(new URLSearchParams("adminSection=automation&adminSubSection=rss-sources"));
        const settings = normalizeAutomationParams(new URLSearchParams("adminSection=automation&adminSubSection=rss-settings"));
        const ok = engine.get("adminSubSection") === "rules" && automationTabFromParams(engine) === "dispatcher"
          && sources.get("adminSubSection") === "rss" && rssTabFromParams(sources) === "sources"
          && settings.get("adminSubSection") === "rss" && rssTabFromParams(settings) === "settings";
        return { ok, message: ok ? "Alle drei alten Automatisierungslinks bleiben erreichbar." : "Ein alter Automatisierungslink führt zum falschen Bereich." };
      },
    },
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
