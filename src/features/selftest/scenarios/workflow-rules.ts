import { formatDashboardGreeting, parseDashboardGreetings, selectDashboardGreeting } from "@/utils/dashboard/greetings";
import { pollPartyBasis, POLL_FEATURED_PARTIES } from "@/features/election-analysis/research/simulator/polls";
import { getAdministrationAccess } from "@/components/administration/access";
import { automationTabFromParams, normalizeAutomationParams, rssTabFromParams } from "@/components/administration/automationNavigation";
import { canTransitionStatus } from "@/components/letters/types";
import { canDecide } from "@/features/appointment-requests/logic";
import { isOnResubmission, MINISTRY_RESPONSE_DAYS, withAutoDeadline, type TriageItem } from "@/features/cases/items/ball";
import { computeCropRect, isCrowdedDay, parseTopicDrop, rescheduleToDay } from "@/features/redaktion/utils/plannerRules";
import { validateVariant } from "@/features/redaktion/components/PlannerBoard/utils";
import { approvalOptions, canDecideApproval, changeRequestDueDate } from "@/features/redaktion/approval";
import { defaultStepSetting, previewRoutine, readStepSettings, resolveRoutineDates, validateStepGraph, validateRoutineWorkflow } from "@/features/automation/routineWorkflow";
import { routineEntityLink, routineStepLabel } from "@/features/automation/routinePackages";
import { routineStepKinds, validateOfficeRoutine } from "@/features/automation/officeRoutineTemplates";
import { evaluateAutomationTree } from "@/features/automation/conditions";
import { validateRuleEditor } from "@/components/administration/automationRule/ruleValidation";
import { editorFormSnapshot, editorPlanYear, editorStepErrors, evaluateEditorSample, parseEditorSample } from "@/components/administration/automationRule/editorModel";
import { DEFAULT_ACTION, DEFAULT_FORM } from "@/components/administration/automationRule/constants";
import { secondVoteScenario } from "@/features/election-analysis/research/simulator/model";
import { projectDistrictVotes } from "@/features/election-analysis/research/simulator/districtModel";
import { transferDistrict } from "@/features/election-analysis/research/simulator/electionFile";
import type { TestScenario } from "../types";
import { calendarOccurrence, nextCalendarOccurrence, scheduleRunKey } from "@/features/automation/calendarSchedule";
import { ACTION_MODULE } from "@/features/permissions/catalog";
import { buildPermissionDiff, diffSimulation, parsePermissionExplanation } from "@/features/permissions/explain";
import { parseConfigImpact, parseConfigRename, summarizeConfigImpact, summarizeConfigRename } from "@/features/admin/configImpact";
import { calculateWeeklyTarget, isBadenWuerttembergHoliday, isDefaultWorkdays } from "@/features/timetracking/weeklyTarget";
import { checkArbzgDay, elapsedWorkedMinutes, requiredBreakMinutes, requiredPauseForSpan, summarizeArbzgDay } from "@/features/timetracking/arbzg";

export const workflowRulesScenario: TestScenario = {
  id: "workflow-rules", title: "Geschäftsregeln (Freigabe, Rollen, Fristen)",
  description: "Prüft die von der Anwendung verwendeten Regeln ohne Datenbankzugriff oder Testdatensätze.",
  features: ["letters", "appointment-requests", "case-items"], touches: [],
  checks: ["Erlaubte und verbotene Brief-Statuswechsel", "Entscheiderrollen", "Ministeriumsfrist und Wiedervorlage"],
  limitations: ["Berechtigungen der Datenbank werden separat in den Zugriffstests geprüft."],
  steps: [
    {
      id: "dashboard-greetings", label: "My Work: Begrüßungen nach Tageszeit, Wochentag und Monat", kind: "logic",
      run: async () => {
        const rules = parseDashboardGreetings(JSON.stringify([
          { id: "a", text: "Willkommen, {name}!", timeSlot: "morning", month: 11 },
          { id: "b", text: "Schön, dass du da bist, {name}!", timeSlot: "morning", month: 11 },
          { id: "c", text: "Montag", dayOfWeek: 1, month: 12 },
        ]));
        const defaults = parseDashboardGreetings(null);
        const evening = selectDashboardGreeting(defaults, new Date(2026, 10, 5, 18));
        const first = selectDashboardGreeting(rules, new Date(2026, 10, 5, 9));
        const second = selectDashboardGreeting(rules, new Date(2026, 10, 6, 9));
        return {
          ok: rules.slice(0, 2).some(rule => rule.text === first)
            && rules.slice(0, 2).some(rule => rule.text === second)
            && first !== second
            && selectDashboardGreeting(rules, new Date(2026, 11, 7, 9)) === "Montag"
            && selectDashboardGreeting(rules, new Date(2026, 11, 8, 9)) === undefined
            && defaults.length === 5
            && evening !== undefined && formatDashboardGreeting(evening, "Alex") === "Guten Abend, Alex!"
            && selectDashboardGreeting(parseDashboardGreetings("[]"), new Date(2026, 10, 5, 18)) === undefined,
          message: "Die fünf Vorlagen gelten bis zur ersten Speicherung. Gelöschte Begrüßungen erscheinen nicht wieder.",
        };
      },
    },
    {
      id: "team-weekly-target", label: "Team: Wochen-Soll aus individuellem Arbeitsplan, Abwesenheiten und BW-Feiertagen", kind: "logic",
      run: async () => {
        const fullWeek = calculateWeeklyTarget({ hoursPerWeek: 40, daysPerWeek: 5, weekStart: "2026-11-16", today: "2026-11-20" });
        const partTime = calculateWeeklyTarget({ hoursPerWeek: 32, daysPerWeek: 4, weekStart: "2026-11-16", today: "2026-11-20" });
        const midWeek = calculateWeeklyTarget({ hoursPerWeek: 40, daysPerWeek: 5, weekStart: "2026-11-16", today: "2026-11-18" });
        const withVacation = calculateWeeklyTarget({
          hoursPerWeek: 40, daysPerWeek: 5, weekStart: "2026-11-16", today: "2026-11-20",
          absences: [{ start_date: "2026-11-16", end_date: "2026-11-17" }],
        });
        const withHoliday = calculateWeeklyTarget({
          hoursPerWeek: 40, daysPerWeek: 5, weekStart: "2026-01-05", today: "2026-01-09",
          holidays: [{ holiday_date: "2026-01-06", state: "BW", is_nationwide: false }],
        });
        const foreignHoliday = calculateWeeklyTarget({
          hoursPerWeek: 40, daysPerWeek: 5, weekStart: "2026-01-05", today: "2026-01-09",
          holidays: [{ holiday_date: "2026-01-06", state: "BY", is_nationwide: false }],
        });

        // 24 h an Mo, Mi, Fr: Dienstag darf das Soll nicht erhöhen.
        const monWedFri = [true, false, true, false, true, false, false];
        const planAt = (today: string) => calculateWeeklyTarget({ hoursPerWeek: 24, workdays: monWedFri, weekStart: "2026-11-16", today });
        const planMonday = planAt("2026-11-16");
        const planTuesday = planAt("2026-11-17");
        const planWednesday = planAt("2026-11-18");
        const planThursday = planAt("2026-11-19");
        const planFriday = planAt("2026-11-20");
        const holidayOnFreeDay = calculateWeeklyTarget({
          hoursPerWeek: 24, workdays: monWedFri, weekStart: "2026-11-16", today: "2026-11-20",
          holidays: [{ holiday_date: "2026-11-17", state: "BW", is_nationwide: false }],
        });
        const sevenDayWeek = calculateWeeklyTarget({
          hoursPerWeek: 35, workdays: [true, true, true, true, true, true, true], weekStart: "2026-11-16", today: "2026-11-22",
        });
        const sixDayFallback = calculateWeeklyTarget({ hoursPerWeek: 42, daysPerWeek: 6, weekStart: "2026-11-16", today: "2026-11-21" });

        const ok = fullWeek.targetMinutes === 2400
          && partTime.targetMinutes === 1920
          && midWeek.targetMinutes === 1440
          && withVacation.targetMinutes === 1440 && withVacation.absenceDays === 2
          && withHoliday.targetMinutes === 1920 && withHoliday.holidayDays === 1
          && foreignHoliday.targetMinutes === 2400
          && planMonday.targetMinutes === 480
          && planTuesday.targetMinutes === 480
          && planWednesday.targetMinutes === 960
          && planThursday.targetMinutes === 960
          && planFriday.targetMinutes === 1440 && planFriday.workDaysPerWeek === 3
          && holidayOnFreeDay.targetMinutes === 1440 && holidayOnFreeDay.holidayDays === 0
          && sevenDayWeek.targetMinutes === 2100 && sevenDayWeek.workDaysPerWeek === 7
          && sixDayFallback.targetMinutes === 2520
          && isDefaultWorkdays([true, true, true, true, true, false, false])
          && isDefaultWorkdays(null)
          && !isDefaultWorkdays(monWedFri)
          && isBadenWuerttembergHoliday({ holiday_date: "2026-01-01", state: null, is_nationwide: true })
          && isBadenWuerttembergHoliday({ holiday_date: "2026-01-06", state: "BW", is_nationwide: false })
          && !isBadenWuerttembergHoliday({ holiday_date: "2026-01-06", state: "BY", is_nationwide: false });

        return {
          ok,
          message: ok
            ? "Wochen-Soll: Arbeitsplan Mo/Mi/Fr, sieben Tage, Teilzeit, Abwesenheit, Feiertag und Bundesland korrekt."
            : "Wochen-Soll weicht ab.",
        };
      },
    },
    {
      id: "arbzg-breaks", label: "Zeiterfassung: Pausenpflicht und Tagesgrenze nach ArbZG", kind: "logic",
      run: async () => {
        const midday = new Date(2026, 10, 24, 14, 30);
        // 08:00–16:00 ohne Pause: 8 h Arbeit bleiben 8 h, die fehlende Pause wird nur ausgewiesen.
        const unbrokenDay = summarizeArbzgDay([
          { started_at: "2026-11-24T08:00:00", ended_at: "2026-11-24T16:00:00", pause_minutes: 0 },
        ]);
        // Geteilter Dienst: Die Pflicht gilt für den gesamten Tag, nicht je Eintrag.
        const splitDay = summarizeArbzgDay([
          { started_at: "2026-11-24T08:00:00", ended_at: "2026-11-24T12:00:00", pause_minutes: 0 },
          { started_at: "2026-11-24T13:00:00", ended_at: "2026-11-24T17:00:00", pause_minutes: 0 },
        ]);
        const splitWithBreak = summarizeArbzgDay([
          { started_at: "2026-11-24T08:00:00", ended_at: "2026-11-24T12:00:00", pause_minutes: 0 },
          { started_at: "2026-11-24T13:00:00", ended_at: "2026-11-24T17:00:00", pause_minutes: 30 },
        ]);
        // 10-Stunden-Grenze zählt Arbeitszeit, nicht Bruttoanwesenheit.
        const longDay = summarizeArbzgDay([
          { started_at: "2026-11-24T07:00:00", ended_at: "2026-11-24T18:00:00", pause_minutes: 60 },
        ]);
        const ok = requiredBreakMinutes(0) === 0
          && requiredBreakMinutes(6 * 60) === 0
          && requiredBreakMinutes(6 * 60 + 1) === 30
          && requiredBreakMinutes(9 * 60) === 30
          && requiredBreakMinutes(9 * 60 + 1) === 45
          && checkArbzgDay({ workedMinutes: 7 * 60, pauseMinutes: 30 }).compliant
          && !checkArbzgDay({ workedMinutes: 7 * 60, pauseMinutes: 15 }).compliant
          && checkArbzgDay({ workedMinutes: 7 * 60, pauseMinutes: 15 }).missingPauseMinutes === 15
          && checkArbzgDay({ workedMinutes: 9 * 60 + 30, pauseMinutes: 30 }).missingPauseMinutes === 15
          && checkArbzgDay({ workedMinutes: 10 * 60 + 1, pauseMinutes: 45 }).exceedsMaxDailyWork
          && requiredPauseForSpan(6 * 60) === 0
          && requiredPauseForSpan(6 * 60 + 15) === 30
          && requiredPauseForSpan(9 * 60 + 6) === 30
          && requiredPauseForSpan(9 * 60 + 36) === 45
          && elapsedWorkedMinutes("08:00", null, 0, midday) === 390
          && elapsedWorkedMinutes("08:00", null, 60, midday) === 330
          && elapsedWorkedMinutes("08:00", "13:00", 30, midday) === 270
          && elapsedWorkedMinutes("", null, 0, midday) === 0
          && unbrokenDay.workedMinutes === 8 * 60 && unbrokenDay.grossMinutes === 8 * 60
          && unbrokenDay.missingPauseMinutes === 30 && !unbrokenDay.compliant
          && splitDay.workedMinutes === 8 * 60 && splitDay.missingPauseMinutes === 30
          && splitWithBreak.missingPauseMinutes === 0 && splitWithBreak.workedMinutes === 7 * 60 + 30
          && longDay.grossMinutes === 11 * 60 && longDay.workedMinutes === 10 * 60 && !longDay.exceedsMaxDailyWork;
        return {
          ok,
          message: ok
            ? "Pausenpflicht 30/45 Min am Tag, 10-Stunden-Grenze ohne Pausen und laufende Stempeluhr korrekt."
            : "ArbZG-Regel weicht ab.",
        };
      },
    },
    {
      id: "seat-poll-basis", label: "Mandatssimulator: Umfragewerte als Ausgangsbasis", kind: "logic",
      run: async () => {
        const ids = [...POLL_FEATURED_PARTIES, "BSW", "ÖDP", "Volt"];
        const parties = ids.map((id, index) => ({
          id, name: id, votes: [300, 260, 140, 90, 60, 50, 60, 30, 10][index], hasList: true, direct: 0,
        }));
        const projected = pollPartyBasis(parties, 1000, {
          id: "synthetic", institute: "Testinstitut", commissioner: "", published_on: "2026-10-15",
          field_start: "2026-10-08", field_end: "2026-10-13", respondents: 1000, method: "Online",
          question_type: "Sonntagsfrage", source_url: "https://example.org", is_published: false,
          shares: { "GRÜNE": 30, CDU: 23, AfD: 23, SPD: 7, "Die Linke": 6, FDP: 4, BSW: 3 }, others: 4,
        });
        return { ok: projected.map((party) => party.votes).join() === "300,230,230,70,60,40,30,30,10", message: "Einzeln ausgewiesene Werte und Reststimmen ergeben zusammen 100 Prozent." };
      },
    },
    {
      id: "seat-district-model", label: "Mandatssimulator: Zweitstimmen auf Wahlkreise übertragen", kind: "logic",
      run: async () => {
        const data = {
          version: "bw-lwg-2026-v1" as const, year: 2026 as const, source_url: "https://example.org",
          data_release: "synthetic", validSecond: 100, lists: {}, listsComplete: false,
          parties: [{ id: "a", name: "A", votes: 60, hasList: true, direct: 1 }, { id: "b", name: "B", votes: 40, hasList: true, direct: 0 }],
          districts: [{ number: 1, validFirst: 100, candidates: [
            { id: "a", name: "A", partyId: "a", votes: 50 },
            { id: "b", name: "B", partyId: "b", votes: 40 },
            { id: "ind", name: "Einzelbewerbung", partyId: null, votes: 10 },
          ] }],
        };
        const unchanged = projectDistrictVotes(data, data.parties, {}, "logratio");
        const shifted = projectDistrictVotes(data, data.parties, { a: 5, b: -5 }, "swing")[0].candidates;
        return { ok: unchanged === data.districts && shifted[2].votes === 10 && shifted[0].votes > 50 && shifted.reduce((sum, c) => sum + c.votes, 0) === 100, message: "Referenz, Einzelbewerbung und Wahlkreissumme bleiben erhalten." };
      },
    },
    {
      id: "seat-other-vote-offset", label: "Mandatssimulator: Gegenbuchung bei den Sonstigen", kind: "logic",
      run: async () => {
        const parties = [["A", 600], ["B", 300], ["C", 100]].map(([id, votes]) => ({
          id: String(id), name: String(id), votes: Number(votes), direct: 0, hasList: true,
        }));
        const result = secondVoteScenario(parties, 1000, { A: 4 }, ["B", "C"]);
        return { ok: result.parties.map((party) => party.votes).join() === "640,270,90", message: "Die Gegenbuchung wahrt die Gesamtstimmenzahl und verteilt sich proportional." };
      },
    },
    {
      id: "seat-district-transfer", label: "Mandatssimulator: knappen Wahlkreis durch Erststimmenübertragung kippen", kind: "logic",
      run: async () => {
        const district = {
          number: 1, validFirst: 29,
          candidates: [
            { id: "a", name: "A", partyId: "A", votes: 12 },
            { id: "b", name: "B", partyId: "B", votes: 8 },
            { id: "c", name: "C", partyId: "C", votes: 9 },
          ],
        };
        const result = transferDistrict(district, "b");
        const repeated = transferDistrict(result, "b");
        const ok = result.candidates.map((c) => c.votes).join() === "9,11,9"
          && result.candidates.reduce((sum, c) => sum + c.votes, 0) === district.validFirst
          && district.candidates[0].votes === 12 && repeated === result;
        return { ok, message: "Die Übertragung erzeugt einen eindeutigen Sieger und erhält die gültigen Erststimmen." };
      },
    },
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
      id: "permission-explorer", label: "Rechte-Explorer: Rolle, Modul und Feldrecht erklären und Widersprüche finden", kind: "logic",
      run: async () => {
        const question = {
          actions: ["letter.send"],
          features: ["module.letters"],
          fields: [{ table: "contacts", column: "email" }],
        };
        const base = {
          member: true, role: "mitarbeiter", simulated_role: null, is_superadmin: false,
          actions: [{ key: "letter.send", allowed: true, reason: "Rolle Mitarbeiter ist für diese Aktion freigegeben.", source: "rule", role: "mitarbeiter", allowed_roles: ["mitarbeiter"] }],
          features: [{ key: "module.letters", enabled: false, reason: "Modul ist ausgeschaltet.", source: "tenant", role: "mitarbeiter" }],
          fields: [{ table: "contacts", column: "email", can_read: true, can_write: true, read_mode: "mask", reason: "Feld ist lesbar und schreibbar.", source: "field_rule" }],
        };
        const parsed = parsePermissionExplanation(base, question);
        const conflicts = buildPermissionDiff(parsed, ACTION_MODULE);
        const writeWithoutRead = buildPermissionDiff(
          parsePermissionExplanation({ ...base, fields: [{ ...base.fields[0], can_read: false, can_write: true }] }, question),
          ACTION_MODULE,
        );
        const simulated = parsePermissionExplanation({
          ...base,
          actions: [{ ...base.actions[0], allowed: false, role: "praktikant" }],
          features: [{ ...base.features[0], enabled: true }],
        }, question);
        const changes = diffSimulation(parsed, simulated);
        const missing = parsePermissionExplanation({ member: true }, question);
        const consistent = buildPermissionDiff(
          parsePermissionExplanation({ ...base, features: [{ ...base.features[0], enabled: true }] }, question),
          ACTION_MODULE,
        );
        const checks = {
          reasonPreserved: parsed.actions[0].reason.includes("freigegeben") && parsed.features[0].source === "tenant" && parsed.actions[0].allowedRoles?.[0] === "mitarbeiter",
          roleVersusFlag: conflicts.some(conflict => conflict.id === "action-open-module-off:letter.send" && conflict.severity === "warning"),
          writeWithoutReadCritical: writeWithoutRead.some(conflict => conflict.severity === "critical"),
          simulationDiff: changes.length === 2 && changes.some(change => change.area === "Modul" && change.actual === "aus" && change.simulated === "aktiv"),
          missingAnswerDenied: !missing.actions[0].allowed && !missing.features[0].enabled && !missing.fields[0].canRead,
          consistentSilent: consistent.length === 0,
        };
        return { ok: Object.values(checks).every(Boolean), message: "Begründungen, Ebenenvergleich und Simulation verwenden dieselben Regeln; fehlende Auskünfte gelten nie als Freigabe.", details: checks };
      },
    },
    {
      id: "config-delete-impact", label: "Konfiguration: Verwendung vor dem Löschen ausweisen", kind: "logic",
      run: async () => {
        const used = parseConfigImpact({
          table: "document_categories", label: "Rechnung", total: 17,
          references: [
            { key: "documents", label: "Dokument", count: 14 },
            { key: "case_files", label: "Fallakte", count: 3 },
          ],
        });
        const single = parseConfigImpact({ total: 1, references: [{ key: "appointments", label: "Termin", count: 1 }] });
        const unused = parseConfigImpact({ total: 0, references: [] });
        const unreadable = parseConfigImpact({ total: "viele", references: [] });
        const checks = {
          countsPreserved: used.known && used.total === 17 && used.references.length === 2,
          pluralWording: summarizeConfigImpact(used) === "Wird in 14 Dokumenten und 3 Fallakten verwendet.",
          singularWording: summarizeConfigImpact(single) === "Wird in einem Termin verwendet.",
          unusedClear: summarizeConfigImpact(unused) === "Keine Verwendung gefunden.",
          unknownBlocks: !unreadable.known && summarizeConfigImpact(unreadable) === "Auswirkung konnte nicht geprüft werden.",
        };
        return { ok: Object.values(checks).every(Boolean), message: "Der Löschdialog nennt Verwendungen in Klartext und sperrt das Löschen ohne belastbare Auskunft.", details: checks };
      },
    },
    {
      id: "config-rename-cascade", label: "Konfiguration: Umbenennen zieht Verweise mit und lehnt Mehrdeutigkeit ab", kind: "logic",
      run: async () => {
        const renamed = parseConfigRename({
          total: 3,
          updated: [
            { key: "documents", label: "Dokument", count: 1 },
            { key: "appointments", label: "Termin", count: 2 },
          ],
        });
        const untouched = parseConfigRename({ total: 0, updated: [] });
        const unreadable = parseConfigRename({ total: 1 });
        const checks = {
          summaryNamesUpdatedRows: summarizeConfigRename(renamed) === "Verweise aktualisiert: 1 Dokument, 2 Termine.",
          untouchedClear: summarizeConfigRename(untouched) === "Keine Verweise mussten angepasst werden.",
          unreadableTolerated: !unreadable.known,
        };
        return { ok: Object.values(checks).every(Boolean), message: "Umbenennen meldet mitgezogene Verweise; die Datenbank lehnt mehrdeutige Altnamen und Kollisionen ab.", details: checks };
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
    {
      id: "redaktion-freigabe", label: "Redaktion: Freigabe nur durch Leitung, Änderungswunsch mit Frist", kind: "logic",
      run: async () => {
        const checks = {
          teamCannotDecide: !canDecideApproval(false),
          leadershipCanDecide: canDecideApproval(true),
          teamSubmitsAndReopens: approvalOptions(false, "draft").join(",") === "draft,pending_approval",
          approvedStaysVisible: approvalOptions(false, "approved").includes("approved"),
          leadershipDecides: approvalOptions(true, "draft").includes("approved") && approvalOptions(true, "draft").includes("rejected"),
          dueAfterDays: changeRequestDueDate(3, new Date(2026, 10, 6, 15, 0)).getDate() === 9,
          dueAtLeastOneDay: changeRequestDueDate(0, new Date(2026, 10, 6, 9, 0)).getDate() === 7,
        };
        const ok = Object.values(checks).every(Boolean);
        return { ok, message: ok ? "Freigabe-Regeln korrekt." : "Freigabe-Regel weicht ab.", details: checks };
      },
    },
  ],
};
