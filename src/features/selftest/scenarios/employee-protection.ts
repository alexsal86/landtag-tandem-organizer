import type {
  ActionItem, EmployeeMeeting, EmployeeMeetingStatus, ProtocolData,
} from "@/components/employees/types";
import { canEditProtocol, isProtocolLocked } from "@/features/employees/protocolWorkflow";
import { getWellbeingTrend } from "@/features/employees/wellbeing";
import { isPreparationAvailable, suggestPreparationFields } from "@/features/employees/preparation";
import { getPreviousMeetingContext } from "@/features/employees/previousMeeting";
import { resolveActionTaskResponsibility } from "@/features/employees/actionTasks";
import type { TestScenario } from "../types";

const meeting = (
  id: string, employeeId: string, meetingDate: string, status: EmployeeMeetingStatus,
): EmployeeMeeting => ({
  id, employee_id: employeeId, conducted_by: "supervisor", meeting_date: meetingDate,
  meeting_type: "regular", status, version: 1,
});

const action = (id: string, meetingId: string): ActionItem => ({
  id, description: `Maßnahme ${id}`, owner: "employee", status: "open", meeting_id: meetingId,
});

export const employeeProtectionScenario: TestScenario = {
  id: "employee-protection",
  title: "Mitarbeiterschutz: Protokollsperre, Belastungsgrenzen und Vorbereitung",
  description: "Prüft Protokollrechte, Wohlbefindens-Schwellen, Vorbereitungsfenster, Vorbefunde und Maßnahmenverantwortung ohne Datenbankzugriff.",
  features: ["employees"],
  touches: [],
  checks: [
    "Protokoll ist nur während des Gesprächs bearbeitbar und nach Freigabe gesperrt",
    "Wohlbefindens-Trend zählt nur abgeschlossene Gespräche und respektiert Schwellen",
    "Vorbereitung öffnet sieben Berliner Kalendertage vor dem Gespräch",
    "Vorschläge füllen nur leere Protokollfelder und verändern die Vorlage nicht",
    "Vorbefund stammt nur aus einem früheren, abgeschlossenen Gespräch derselben Person",
    "Bei gemeinsamer Maßnahme hält die Führungskraft die Aufgabe, die Person den Ball",
  ],
  limitations: [
    "Die Durchsetzung in der Datenbank (RLS, Freigabe-/Widerspruch-RPCs, Sichtbarkeit nur für Mitarbeitende und direkte Führungskraft) erfordert einen angemeldeten Lauf.",
    "Es werden keine echten Wohlbefindens-, Protokoll- oder Vorbereitungsdaten angelegt oder gelesen.",
  ],
  steps: [
    {
      id: "protocol-lock", label: "Protokoll: bearbeitbar nur im Gespräch, gesperrt nach Freigabe", kind: "logic",
      run: async () => {
        const checks = {
          editableDuringMeeting: (["scheduled", "in_progress"] as EmployeeMeetingStatus[]).every(canEditProtocol),
          lockedAfterRelease: (["pending_acknowledgement", "acknowledged"] as EmployeeMeetingStatus[]).every(isProtocolLocked),
          neverBoth: !(["scheduled", "in_progress"] as EmployeeMeetingStatus[]).some(isProtocolLocked)
            && !(["pending_acknowledgement", "acknowledged"] as EmployeeMeetingStatus[]).some(canEditProtocol),
          finishedNotEditable: (["completed", "cancelled", "cancelled_by_employee", "rescheduled"] as EmployeeMeetingStatus[]).every(status => !canEditProtocol(status)),
        };
        return {
          ok: Object.values(checks).every(Boolean),
          message: "Eingefrorene Protokolle bleiben unveränderlich; abgeschlossene und abgesagte Gespräche sind nicht mehr bearbeitbar.",
          details: checks,
        };
      },
    },
    {
      id: "wellbeing-thresholds", label: "Wohlbefinden: nur abgeschlossene Gespräche, gehaltene Belastung und fallende Werte", kind: "logic",
      run: async () => {
        const points = [
          { id: "new", meeting_date: "2026-02-10", status: "acknowledged", mood: 2, workload: 5, balance: 2 },
          { id: "old", meeting_date: "2026-01-10", status: "completed", mood: 3, workload: 5, balance: 3 },
          { id: "open", meeting_date: "2026-03-10", status: "scheduled", mood: 1, workload: 5, balance: 1 },
        ];
        const trend = getWellbeingTrend(points);
        const checks = {
          finishedOnly: trend.points.map(point => point.id).join(",") === "old,new",
          sustainedWorkload: trend.sustainedWorkload,
          fallingValues: trend.falling,
          needsConversation: trend.needsConversation,
          customThresholdRaised: !getWellbeingTrend(points, { workload: 6 }).sustainedWorkload,
          thresholdReached: getWellbeingTrend(points, { workload: 5 }).sustainedWorkload,
          runTooShort: !getWellbeingTrend(points, { consecutiveMeetings: 3 }).sustainedWorkload,
          singleMeetingQuiet: (() => {
            const single = getWellbeingTrend([points[1]]);
            return !single.sustainedWorkload && !single.falling && !single.needsConversation;
          })(),
          fallingCanBeDisabled: !getWellbeingTrend(points, { fallingMoodOrBalance: false }).falling,
        };
        return {
          ok: Object.values(checks).every(Boolean),
          message: "Der Trend ignoriert geplante Gespräche, sortiert nach Datum und verlangt die konfigurierte Anzahl aufeinanderfolgender Gespräche.",
          details: checks,
        };
      },
    },
    {
      id: "preparation-window", label: "Vorbereitung: sieben Berliner Kalendertage vor dem Gespräch", kind: "logic",
      run: async () => {
        const checks = {
          exactlySevenDaysBefore: isPreparationAvailable("2026-11-20", new Date("2026-11-13T10:00:00Z")),
          berlinMidnightBoundary: isPreparationAvailable("2026-11-20", new Date("2026-11-12T23:30:00Z")),
          eightDaysBefore: !isPreparationAvailable("2026-11-20", new Date("2026-11-12T12:00:00Z")),
          afterMeeting: isPreparationAvailable("2026-11-20", new Date("2026-12-01T12:00:00Z")),
          winterBoundary: isPreparationAvailable("2026-01-15", new Date("2026-01-08T09:00:00Z"))
            && !isPreparationAvailable("2026-01-15", new Date("2026-01-07T09:00:00Z")),
          summerBoundary: isPreparationAvailable("2026-07-15", new Date("2026-07-08T09:00:00Z"))
            && !isPreparationAvailable("2026-07-15", new Date("2026-07-07T21:00:00Z")),
        };
        return {
          ok: Object.values(checks).every(Boolean),
          message: "Das Fenster richtet sich nach dem Berliner Kalendertag und öffnet unabhängig von der Zeitumstellung exakt sieben Tage vorher.",
          details: checks,
        };
      },
    },
    {
      id: "preparation-suggestions", label: "Vorbereitung: Vorschläge füllen nur leere Protokollfelder", kind: "logic",
      run: async () => {
        const protocol: ProtocolData = {
          review_successes: "", projects_support: "  ", development_skills: "Bestehend", goals: "Bleibt",
        };
        const suggested = suggestPreparationFields(protocol, {
          proud_of: "Stolz", need_support: "Unterstützung", skills_to_deepen: "Neu",
        });
        const untouched = suggestPreparationFields(protocol, {});
        const checks = {
          fillsEmpty: suggested.review_successes === "Stolz" && suggested.projects_support === "Unterstützung",
          keepsFilled: suggested.development_skills === "Bestehend",
          keepsUnrelated: suggested.goals === "Bleibt",
          emptySuggestionChangesNothing: untouched.review_successes === "" && untouched.projects_support === "  ",
          noMutation: protocol.review_successes === "",
        };
        return {
          ok: Object.values(checks).every(Boolean),
          message: "Nur leere Felder werden übernommen; bereits getippte Inhalte und die Vorlage bleiben unverändert.",
          details: checks,
        };
      },
    },
    {
      id: "previous-meeting", label: "Vorbefund: nur ein früheres, abgeschlossenes Gespräch derselben Person", kind: "logic",
      run: async () => {
        const current = meeting("current", "e1", "2026-03-01", "scheduled");
        const meetings = [
          meeting("latest", "e1", "2026-02-01", "completed"),
          meeting("older", "e1", "2025-12-01", "acknowledged"),
          meeting("scheduled", "e1", "2026-02-15", "scheduled"),
          meeting("foreign", "e2", "2026-02-20", "completed"),
          meeting("future", "e1", "2026-04-01", "completed"),
          current,
        ];
        const actions = [action("a-latest", "latest"), action("a-older", "older")];
        const context = getPreviousMeetingContext("e1", current, meetings, actions);
        const checks = {
          latestFinished: context?.meeting.id === "latest",
          employeeScoped: context?.meeting.employee_id === "e1",
          onlyItsActions: context?.actions.map(entry => entry.id).join(",") === "a-latest",
          unknownEmployeeHasNoBaseline: getPreviousMeetingContext("e3", current, meetings, actions) === null,
          noEarlierFinished: getPreviousMeetingContext("e1", meeting("first", "e1", "2025-01-01", "scheduled"), meetings, actions) === null,
        };
        return {
          ok: Object.values(checks).every(Boolean),
          message: "Geplante, spätere und fremde Gespräche liefern keinen Vorbefund; Maßnahmen bleiben am gewählten Gespräch.",
          details: checks,
        };
      },
    },
    {
      id: "action-task", label: "Maßnahme: eine Aufgabe, Ball bei der Person, Begleitung durch die Führungskraft", kind: "logic",
      run: async () => {
        const employee = "user-employee";
        const supervisor = "user-supervisor";
        const own = resolveActionTaskResponsibility("employee", employee, supervisor);
        const lead = resolveActionTaskResponsibility("supervisor", employee, supervisor);
        const both = resolveActionTaskResponsibility("both", employee, supervisor);
        const same = resolveActionTaskResponsibility("both", employee, employee);
        const checks = {
          employeeOwns: own.ballAssigneeId === employee && own.collaboratorIds.length === 0,
          supervisorOwns: lead.ballAssigneeId === supervisor && lead.collaboratorIds.length === 0,
          sharedKeepsEmployeeBall: both.ballAssigneeId === employee && both.collaboratorIds.join(",") === supervisor,
          noSelfCollaboration: same.collaboratorIds.length === 0,
        };
        return {
          ok: Object.values(checks).every(Boolean),
          message: "Jede Maßnahme erzeugt genau eine Zuständigkeit; gemeinsame Maßnahmen begleitet die Führungskraft ohne Doppelrolle.",
          details: checks,
        };
      },
    },
  ],
};
