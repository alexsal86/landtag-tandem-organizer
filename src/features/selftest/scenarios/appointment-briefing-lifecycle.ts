import { mergeDetectedPromise, officeDebriefPromiseEdit, suggestOfficeFeedbackPromises } from "@/features/appointments/briefing/officeFeedbackPromises";
import {
  countPromiseHint, countPromiseHintShown, emptyPromiseHintStats, normalizePromiseHintStats,
  promiseHintOutcome, promiseHintsWithoutFeedback,
} from "@/features/appointments/briefing/officeFeedbackPromiseHintStats";
import { appendDictatedText } from "@/lib/speechCommandUtils";
import { buildTodayPriorities } from "@/components/my-work/todayPriorities";
import { appointmentFocusMode, departureTime, focusCountdown, pickFocusAppointment } from "@/features/appointments/dashboardFocus";
import { visibleSentChanges } from "@/features/appointments/change-alerts/sentChangeVisibility";
import { debriefDuration, debriefReceivedAt, debriefSourceLabel, sortDebriefReports } from "@/features/appointments/briefing/officeDebriefInbox";
import { isOfficeReminderDue, isOlderOfficeFeedback, needsOfficeFeedback, officeReminderLabel, officeReminderTime, readOfficeSnooze, showsOfficeTaskHint } from "@/features/appointments/briefing/officeFeedback";
import { appointmentProgress, showTimelineNowMarker, appointmentCountdown, dashboardTimelineState, appointmentSummary, hasAppointmentEnded, nextAppointmentId, pendingSummary, timelineNowIndex } from "@/utils/dashboard/daySummary";
import { canCompleteBriefing, canGoLive, followUpTaskFromLive, mergeLegacy, saveCompact } from "@/features/appointments/briefing/briefingModel";
import { supabase } from "@/integrations/supabase/client";
import { addMinutesToStart, applyReportedStart, changeSummary, changeTitle, formatChangeClock, nextStartFromChange, pickAppointmentChanges, shiftEndWithStart, summarizeReportedChanges, withBerlinClockTime } from "@/features/appointments/change-alerts/changeModel";
import { dashboardBriefingState, needsBriefingReminder, showsInDailyBriefing, canAdvanceBriefing, needsBriefingDecision, suggestBriefingDue } from "@/features/appointments/briefing";
import type { TestScenario } from "../types";
import { SELFTEST_PREFIX } from "../runner";
import { describeError } from "../verify";

const read = async (id: string) => {
  const { data, error } = await supabase.from("appointments").select("briefing_status, briefing_task_id").eq("id", id).single();
  if (error) throw error;
  return data;
};

export const appointmentBriefingLifecycleScenario: TestScenario = {
  id: "appointment-briefing-lifecycle",
  title: "Briefing-Lifecycle (vergeben → Aufgabe → vorlegen → freigeben)",
  description: "Legt einen Termin an, vergibt ein Briefing (es entsteht eine Aufgabe), legt es vor, gibt es frei (Aufgabe erledigt) und prüft „Kein Briefing“.",
  touches: ["appointments", "tasks", "appointment_change_alerts"],
  features: ["appointments", "tasks"],
  requiredRoles: ["abgeordneter", "bueroleitung"],
  checks: ["Regeln für Freigabe und Fristvorschlag", "Aufgabe entsteht beim Vergeben", "Ball wechselt bei Vorlage", "Freigabe erledigt Aufgabe", "Kein Briefing schließt Aufgabe"],
  limitations: ["Bedienung von Kalender- und Jour-Fixe-Oberfläche wird nicht geprüft."],
  writes: [
    { table: "appointments", columns: ["title", "tenant_id", "user_id", "start_time", "end_time"] },
    { table: "appointment_change_alerts", columns: ["tenant_id", "appointment_id", "title", "message", "kind", "new_start_time", "new_location"] },
  ],
  links: () => [{ label: "Kalender", href: "/calendar" }],
  steps: [
    {
      id: 'personal-sent-changes', label: 'Gemeldete Änderungen nur heute und persönlich ausblendbar', kind: 'logic',
      run: async () => {
        const now = new Date('2026-11-24T12:00:00Z');
        const alerts = [
          { id: 'yesterday', created_at: '2026-11-23T21:00:00Z' },
          { id: 'today', created_at: '2026-11-23T23:30:00Z' },
          { id: 'second', created_at: '2026-11-24T10:00:00Z' },
        ];
        return {
          ok: visibleSentChanges(alerts, [], now).map(alert => alert.id).join(',') === 'today,second'
            && visibleSentChanges(alerts, ['today'], now).map(alert => alert.id).join(',') === 'second'
            && visibleSentChanges(alerts, [], now).length === 2
            && alerts.length === 3,
          message: 'Berliner Kalendertag und persönliche Ausblendung ohne Änderung an der gemeinsamen Meldung.',
        };
      },
    },
    {
      id: "day-appointment-progress", label: "Dein Tag: vergangen, laufend und als nächstes", kind: "logic",
      run: async () => {
        const now = new Date("2026-11-22T12:00:00+01:00");
        const past = { id: "past", start_time: "2026-11-22T09:00:00+01:00", end_time: "2026-11-22T10:00:00+01:00", is_all_day: false };
        const active = { ...past, id: "active", end_time: "2026-11-22T13:00:00+01:00" };
        const upcoming = { ...past, id: "next", start_time: "2026-11-22T14:00:00+01:00", end_time: "2026-11-22T15:00:00+01:00" };
        const checks = [
          appointmentProgress(active, now)?.fraction === 0.75,
          appointmentProgress(active, now)?.remainingMinutes === 60,
          appointmentProgress({ ...active, start_time: '2026-11-22T11:57:00+01:00', end_time: '2026-11-22T12:03:00+01:00' }, now)?.remainingMinutes === 3,
          appointmentProgress(past, now)?.fraction === 1,
          appointmentProgress(past, now)?.remainingMinutes === 0,
          appointmentProgress({ ...active, is_all_day: true }, now) === null,
          !showTimelineNowMarker([past, active, upcoming], now),
          showTimelineNowMarker([past, upcoming], now),
          showTimelineNowMarker([past], now),
          dashboardTimelineState([past, active, upcoming], now).runningIds.has('active'),
          dashboardTimelineState([past, active, upcoming], now).nextId === 'next',
          !dashboardTimelineState([past, active, upcoming], now).highlightNext,
          dashboardTimelineState([past, upcoming], now).highlightNext,
          appointmentCountdown(upcoming.start_time, now) === 'in 2 Std.',
          appointmentCountdown('2026-11-22T12:30:00+01:00', now) === 'in 30 Min.',
          appointmentCountdown('2026-11-22T13:30:00+01:00', now) === 'in 1 Std. 30 Min.',
          hasAppointmentEnded(past, now),
          !hasAppointmentEnded(active, now),
          !hasAppointmentEnded(upcoming, now),
          nextAppointmentId([upcoming, active, past], now) === "next",
          nextAppointmentId([past, active], now) === undefined,
          timelineNowIndex([past, active, upcoming], now) === 2,
          timelineNowIndex([past, upcoming], now) === 1,
          timelineNowIndex([past], now) === 1,
          timelineNowIndex([], now) === 0,
          !hasAppointmentEnded({ ...past, end_time: undefined, is_all_day: true }, now),
        ];
        return { ok: checks.every(Boolean), message: `${checks.filter(Boolean).length}/${checks.length} Tagesstatus bestanden.` };
      },
    },
    {
      id: "appointment-change-rules", label: "Terminänderung: Schnellwahl, eigene Zeit, Ort und Hinweis-Chip", kind: "logic",
      run: async () => {
        const start = "2026-11-22T18:00:00+01:00";
        const alerts = [
          { id: "t", appointment_id: "a", title: "Zeit geändert: Termin", message: "Zugang über Hof", kind: "time", new_start_time: "2026-11-22T18:30:00+01:00", new_location: null, created_at: "2026-11-20T10:00:00Z", acknowledged_at: null, created_by_name: "Büro" },
          { id: "o", appointment_id: "a", title: "Ort geändert: Termin", message: "", kind: "location", new_start_time: null, new_location: "Raum 2", created_at: "2026-11-20T11:00:00Z", acknowledged_at: null, created_by_name: "Büro" },
          { id: "n", appointment_id: "a", title: "Hinweis: Termin", message: "Unterlagen liegen bereit", kind: "note", new_start_time: null, new_location: null, created_at: "2026-11-20T12:00:00Z", acknowledged_at: null, created_by_name: "Büro" },
        ];
        const picked = pickAppointmentChanges(alerts, "a");
        const checks = [
          addMinutesToStart(start, 30) === "2026-11-22T17:30:00.000Z",
          addMinutesToStart(start, 60) === "2026-11-22T18:00:00.000Z",
          withBerlinClockTime(start, "19:15") === "2026-11-22T18:15:00.000Z",
          withBerlinClockTime(start, "24:00") === null,
          nextStartFromChange(start, 15, "") === "2026-11-22T17:15:00.000Z",
          nextStartFromChange(start, 15, "20:00") === "2026-11-22T19:00:00.000Z",
          formatChangeClock("2026-11-22T17:30:00.000Z") === "18:30",
          changeTitle("time", "Bürgerdialog") === "Zeit geändert: Bürgerdialog",
          changeTitle("location", "Bürgerdialog") === "Ort geändert: Bürgerdialog",
          changeSummary(alerts[0]) === "Neue Zeit 18:30 · Zugang über Hof",
          changeSummary(alerts[1]) === "Neuer Ort: Raum 2",
          picked.time?.id === "t" && picked.location?.id === "o",
          picked.notes.map(note => note.id).join(",") === "n,t",
          pickAppointmentChanges(alerts, "b").notes.length === 0,
          shiftEndWithStart(start, "2026-11-22T19:00:00+01:00", "2026-11-22T19:00:00+01:00") === "2026-11-22T19:00:00.000Z",
          shiftEndWithStart("2026-11-22T23:30:00+01:00", "2026-11-23T00:30:00+01:00", "2026-11-22T23:30:00.000Z") === "2026-11-23T00:30:00.000Z",
          shiftEndWithStart(start, null, "2026-11-22T19:00:00+01:00") === null,
          shiftEndWithStart(start, "2026-11-22T19:00:00+01:00", null) === null,
          summarizeReportedChanges(alerts, "a").newStartTime === "2026-11-22T18:30:00+01:00",
          summarizeReportedChanges(alerts, "a").newLocation === "Raum 2",
          summarizeReportedChanges(alerts, "a").notes.join("|") === "Unterlagen liegen bereit|Zugang über Hof",
          summarizeReportedChanges(alerts, "b").notes.length === 0,
          applyReportedStart({ start_time: start, end_time: "2026-11-22T19:00:00+01:00" }, "2026-11-22T19:00:00+01:00").end_time === "2026-11-22T19:00:00.000Z",
          applyReportedStart<{ start_time: string; end_time?: string }>({ start_time: start }, "2026-11-22T19:00:00+01:00").end_time === undefined,
          applyReportedStart({ start_time: start, end_time: "2026-11-22T19:00:00+01:00" }, null).start_time === start,
        ];
        return { ok: checks.every(Boolean), message: `${checks.filter(Boolean).length}/${checks.length} Änderungsregeln bestanden.` };
      },
    },
    {
      id: "dashboard-briefing-status", label: "Dashboard-Briefing: Auftrag, Entscheidung und Freigabe", kind: "logic",
      run: async () => {
        const checks = [
          dashboardBriefingState(undefined, false) === null,
          dashboardBriefingState("undecided", false)?.label === "Briefing nötig?",
          dashboardBriefingState("none", false)?.label === "Kein Briefing angefordert",
          dashboardBriefingState("assigned", false)?.label === "Briefing fehlt",
          !dashboardBriefingState("assigned", true)?.canOpen,
          !dashboardBriefingState("in_review", true)?.canOpen,
          dashboardBriefingState("approved", true)?.canOpen,
          !dashboardBriefingState("approved", false)?.canOpen,
        ];
        return { ok: checks.every(Boolean), message: `${checks.filter(Boolean).length}/${checks.length} Statusfälle bestanden.` };
      },
    },
    {
      id: "appointment-dashboard-focus", label: "Termin-Fokus: Größe, Abfahrt und laufender Termin", kind: "logic",
      run: async () => {
        const now = new Date("2026-11-25T13:00:00+01:00");
        const base = { id: "intern", category: "intern", is_all_day: false,
          start_time: "2026-11-25T12:50:00+01:00", end_time: "2026-11-25T13:15:00+01:00" };
        const planned = { ...base, id: "blocked", category: "blocked", start_time: "2026-11-25T13:20:00+01:00" };
        const next = { ...base, id: "next", category: "appointment", start_time: "2026-11-25T14:30:00+01:00" };
        const focus = pickFocusAppointment([planned, next, base], now);
        const departure = departureTime(next.start_time, 12);
        const ok = focus.running && focus.appointment?.id === base.id && focus.after?.id === next.id
          && appointmentFocusMode(base, false) === "hint" && appointmentFocusMode(next, false) === "compact"
          && appointmentFocusMode(next, true) === "detailed" && appointmentFocusMode(base, true, "compact") === "compact"
          && departure?.at.toISOString() === "2026-11-25T13:13:00.000Z" && focusCountdown(departure.at, now) === 73;
        return { ok, message: ok ? "Termin, Darstellung und Abfahrtszeit stimmen." : "Termin-Fokus weicht ab." };
      },
    },
    {
      id: "office-debrief-inbox", label: "Nachbereitung: Zusagen priorisieren und Quelle anzeigen", kind: "logic",
      run: async () => {
        const oldest = { promise: null, due_on: null, received_at: "2026-11-20T16:00:00Z" };
        const promised = { promise: "Rückruf", due_on: null, received_at: "2026-11-23T16:10:00Z" };
        const planned = { promise: "Unterlagen", due_on: "2026-11-26", received_at: "2026-11-21T16:00:00Z" };
        const sorted = sortDebriefReports([oldest, promised, planned]);
        const now = new Date("2026-11-24T00:15:00+01:00");
        const ok = sorted[0] === promised && sorted[1] === oldest && sorted[2] === planned
          && debriefReceivedAt(promised.received_at, now) === "gestern 17:10"
          && debriefDuration(41) === "0:41" && debriefSourceLabel("phone", "Alexander Salomon") === "Telefonat mit Alexander";
        return { ok, message: ok ? "Sortierung, Berliner Eingangsuhrzeit, Diktatdauer und Quelle stimmen." : "Die Darstellung der Nachbereitung weicht ab." };
      },
    },
    {
      id: "today-priorities", label: "Heute zuerst: Rangfolge und Berliner Tagesgrenzen", kind: "logic",
      run: async () => {
        const now = new Date("2026-11-26T00:15:00+01:00");
        const today = { id: "today", title: "Bürgerdialog", start_time: "2026-11-26T18:00:00+01:00",
          briefing_due_at: "2026-11-26T00:05:00+01:00" };
        const tomorrow = { ...today, id: "tomorrow", start_time: "2026-11-27T18:00:00+01:00", briefing_due_at: null };
        const past = { ...today, id: "past", start_time: "2026-11-25T22:00:00+01:00" };
        const event = { id: "missing", title: "Fraktionssitzung", starts_at: "2026-11-24T12:00:00+01:00",
          deputy_name: null, is_external: false };
        const report = { id: "report", title: "Besuch", starts_at: event.starts_at, deputy_name: null,
          appointment_id: null, received_at: "2026-11-24T16:00:00Z", notes: "Bericht", entered_by: null, source: null,
          confirmed_at: null, promise: "Rückruf", due_on: "2026-11-28", spoken_seconds: null, question: null };
        const deadline = { id: "old", title: "Altfrist", dueDate: "2026-10-26", type: "task" as const, canSnooze: true };
        const priorities = buildTodayPriorities(
          [tomorrow, past, today], [report, { ...report, id: "promise", due_on: null }], [event],
          [deadline, { ...deadline, id: "recent", dueDate: "2026-10-27" }], now,
        );
        const cleanup = priorities.find(entry => entry.kind === "deadlines");
        const ok = priorities.map(entry => entry.kind).join(",") === "today,promise,report,followUp,deadlines"
          && cleanup?.items.length === 1 && cleanup.items[0].id === deadline.id;
        return { ok, message: ok ? "Rangfolge und Fristenauswahl stimmen." : "Rangfolge oder Fristenauswahl weicht ab." };
      },
    },
    {
      id: "office-feedback", label: "Bürorückmeldung: Abschluss, Erinnerung und ältere Termine", kind: "logic",
      run: async () => {
        const now = new Date("2026-11-21T12:00:00+01:00");
        const checks = [
          readOfficeSnooze("2026-11-21T17:00:00.000Z")?.count === 1,
          readOfficeSnooze({ until: "2026-11-21T17:00:00.000Z", count: 2 })?.count === 2,
          readOfficeSnooze({ until: "", count: 2 })?.until === "",
          readOfficeSnooze(undefined) === null,
          showsOfficeTaskHint({ until: "2026-11-21T12:00:00.000Z", count: 2 }, now),
          !showsOfficeTaskHint({ until: "2026-11-21T12:00:00.000Z", count: 1 }, now),
          !showsOfficeTaskHint({ until: "", count: 2 }, now),
          !showsOfficeTaskHint({ until: "2026-11-21T10:00:00.000Z", count: 2 }, now),
          !showsOfficeTaskHint(undefined, now),
          isOfficeReminderDue("2026-11-21T11:00:00.000Z", now),
          isOfficeReminderDue({ until: "2026-11-21T10:00:00.000Z", count: 2 }, now),
          !isOfficeReminderDue("2026-11-21T12:00:00.000Z", now),
          !isOfficeReminderDue({ until: "", count: 2 }, now),
          !isOfficeReminderDue(undefined, now),
          officeReminderLabel("2026-11-21T17:00:00.000Z", now) === "Erinnerung um 18 Uhr (in 6 Stunden)",
          officeReminderLabel("2026-11-22T07:00:00.000Z", now) === "Erinnerung morgen um 8 Uhr (in 20 Stunden)",
          needsOfficeFeedback(null),
          needsOfficeFeedback({ feedback_status: "pending", notes: null }),
          !needsOfficeFeedback({ feedback_status: "skipped", notes: null }),
          !needsOfficeFeedback({ feedback_status: "completed", notes: "Bericht" }),
          !needsOfficeFeedback({ feedback_status: "pending", notes: "Stichpunkte" }),
          officeReminderTime("hour", now) === "2026-11-21T12:00:00.000Z",
          officeReminderTime("evening", now) === "2026-11-21T17:00:00.000Z",
          officeReminderTime("morning", now) === "2026-11-22T07:00:00.000Z",
          officeReminderTime("morning", new Date("2026-03-28T18:00:00+01:00")) === "2026-03-29T06:00:00.000Z",
          isOlderOfficeFeedback("2026-11-20T18:00:00+01:00", now),
          !isOlderOfficeFeedback("2026-11-21T08:00:00+01:00", now),
        ];
        return { ok: checks.every(Boolean), message: `${checks.filter(Boolean).length}/${checks.length} Rückmelderegeln bestanden.` };
      },
    },
    {
      id: "office-feedback-promise-suggestions", label: "Bürorückmeldung: Vorschläge für Zusagen", kind: "logic",
      run: async () => {
        const text = "Das Treffen lief gut. Ich habe zugesagt, die Unterlagen bis zum 12.12. zu schicken. "
          + "Wir werden beim Ministerium nachfragen. Ich habe nichts versprochen. Werden wir die Planung ändern? "
          + "Zusage: Rückruf am Freitag.";
        const expected = "Ich habe zugesagt, die Unterlagen bis zum 12.12. zu schicken.\n"
          + "Wir werden beim Ministerium nachfragen.\nRückruf am Freitag.";
        const checks = [
          suggestOfficeFeedbackPromises(text) === expected,
          suggestOfficeFeedbackPromises("Die Unterlagen wurden besprochen.") === "",
          // Diktat ohne Satzzeichen: „nicht“ im Folgesatz verwirft die Zusage nicht.
          suggestOfficeFeedbackPromises("das treffen war gut ich habe zugesagt die unterlagen zu schicken "
            + "ich habe nicht vor das zu vergessen") === "ich habe zugesagt die unterlagen zu schicken",
          // Passiv ist nicht pauschal eine Zusage: „ich werde gefragt“ nicht, unpersönliches Passiv schon.
          suggestOfficeFeedbackPromises("ich werde gefragt ob die unterlagen schon da sind") === "",
          suggestOfficeFeedbackPromises("ich werde gefragt ob ich die unterlagen schicken kann") === "",
          suggestOfficeFeedbackPromises("wir werden morgen informiert") === "",
          suggestOfficeFeedbackPromises("Die Unterlagen werden bis Freitag geschickt.")
            === "Die Unterlagen werden bis Freitag geschickt.",
          suggestOfficeFeedbackPromises("Die Unterlagen werden nicht geschickt.") === "",
          // Typische Formulierungen ohne „zugesagt“.
          suggestOfficeFeedbackPromises("ich kümmere mich um die Anfrage") === "ich kümmere mich um die Anfrage",
          suggestOfficeFeedbackPromises("wir schicken die Unterlagen bis Montag") === "wir schicken die Unterlagen bis Montag",
          suggestOfficeFeedbackPromises("ich rufe die Bürgerin morgen zurück") === "ich rufe die Bürgerin morgen zurück",
          suggestOfficeFeedbackPromises("Ich melde mich nächste Woche.") === "Ich melde mich nächste Woche.",
          // Abkürzung schneidet den Satz nicht ab.
          suggestOfficeFeedbackPromises("Ich habe zugesagt, Dr. Müller zu informieren.")
            === "Ich habe zugesagt, Dr. Müller zu informieren.",
          // „nicht nur“ ist keine Verneinung.
          suggestOfficeFeedbackPromises("Ich habe zugesagt, nicht nur die Unterlagen zu schicken, sondern auch den Termin zu nennen.")
            === "Ich habe zugesagt, nicht nur die Unterlagen zu schicken, sondern auch den Termin zu nennen.",
          // Verneinte Zusagen bleiben verneint.
          suggestOfficeFeedbackPromises("Ich habe nichts zugesagt.") === "",
          suggestOfficeFeedbackPromises("Ich melde mich nicht.") === "",
          // Randfälle: eine Verneinung im Relativsatz hebt die Zusage nicht auf.
          suggestOfficeFeedbackPromises("Ich kümmere mich um die Anfrage der Bürgerin, die sich nicht gemeldet hat.")
            === "Ich kümmere mich um die Anfrage der Bürgerin, die sich nicht gemeldet hat.",
          // „dass/weil“ bindet den Nebensatz an die Zusage, statt den Teilsatz abzuschneiden.
          suggestOfficeFeedbackPromises("Ich habe zugesagt, dass ich die Unterlagen schicke.")
            === "Ich habe zugesagt, dass ich die Unterlagen schicke.",
          suggestOfficeFeedbackPromises("Ich habe zugesagt, weil ich die Unterlagen schicke.")
            === "Ich habe zugesagt, weil ich die Unterlagen schicke.",
          // „Kontakt … auf“ und „kein Problem“ sind eine Zusage bzw. keine Verneinung.
          suggestOfficeFeedbackPromises("Ich nehme morgen Kontakt mit dem Ministerium auf.")
            === "Ich nehme morgen Kontakt mit dem Ministerium auf.",
          suggestOfficeFeedbackPromises("Ich schicke die Unterlagen, kein Problem.")
            === "Ich schicke die Unterlagen, kein Problem.",
          // „aber“ trennt den Zusage-Teilsatz; der Folgesatz gehört nicht in den Vorschlag.
          suggestOfficeFeedbackPromises("Ich habe zugesagt die Unterlagen zu schicken aber ich habe es nicht geschafft")
            === "Ich habe zugesagt die Unterlagen zu schicken",
          // Diktat wird wie im Brief-/Protokoll-Editor aufbereitet; gesprochene Satzzeichen helfen der Erkennung.
          suggestOfficeFeedbackPromises(appendDictatedText("", "ich habe zugesagt die unterlagen bis zum 12.12. zu schicken "
            + "punkt ich habe nicht vor das zu vergessen")) === "Ich habe zugesagt die unterlagen bis zum 12.12. zu schicken.",
          // Der Diktat-Vorschlag füllt das Feld, überschreibt aber keine eigene Formulierung.
          mergeDetectedPromise(undefined, undefined, "Rückruf am Freitag").text === "Rückruf am Freitag",
          mergeDetectedPromise({ hasPromise: true, text: "Rückruf am Freitag" }, "Rückruf am Freitag", "Unterlagen schicken").text
            === "Unterlagen schicken",
          mergeDetectedPromise({ hasPromise: true, text: "Eigene Formulierung" }, "Rückruf am Freitag", "Unterlagen schicken").text
            === "Eigene Formulierung",
          // Messung: nur Anzahlen, kein Text – unverändert, geändert, verworfen, ohne Vorschlag gar nichts.
          promiseHintOutcome("Rückruf am Freitag", "Rückruf am Freitag") === "unchanged",
          promiseHintOutcome("Rückruf am Freitag", "Rückruf am Montag") === "edited",
          promiseHintOutcome("Rückruf am Freitag", "") === "discarded",
          promiseHintOutcome(undefined, "Rückruf am Freitag") === null,
          countPromiseHint(countPromiseHint(emptyPromiseHintStats, "unchanged"), "discarded").unchanged === 1,
          // Kaputte, alte oder fehlende Zähler zählen ab 0 weiter und werfen nie.
          normalizePromiseHintStats(undefined).edited === 0,
          normalizePromiseHintStats({ shown: 3 }).discarded === 0,
          normalizePromiseHintStats("kaputt").unchanged === 0,
          countPromiseHint({ unchanged: Number.NaN }, "edited").edited === 1,
          // Erschienene Vorschläge zählen mit, damit wirkungslose Hinweise sichtbar bleiben.
          countPromiseHintShown(emptyPromiseHintStats).shown === 1,
          promiseHintsWithoutFeedback(countPromiseHintShown(emptyPromiseHintStats)) === 1,
          promiseHintsWithoutFeedback(countPromiseHint(countPromiseHintShown(emptyPromiseHintStats), "edited")) === 0,
          normalizePromiseHintStats({ unchanged: 2, edited: 1 }).shown === 3,
        ];
        return { ok: checks.every(Boolean), message: `${checks.filter(Boolean).length}/${checks.length} Zusagenregeln bestanden.` };
      },
    },
    {
      id: "office-debrief-edit-promise", label: "Nachbereitung: Zusage und Frist im Büro bearbeiten", kind: "logic",
      run: async () => {
        const saved = officeDebriefPromiseEdit(true, " Rückruf ", "2026-12-01");
        const cleared = officeDebriefPromiseEdit(false, "Rückruf", "2026-12-01");
        const ok = saved._promise === "Rückruf" && saved._due === "2026-12-01"
          && cleared._promise === undefined && cleared._due === undefined;
        return { ok, message: ok ? "Zusage und Frist werden gemeinsam übergeben oder entfernt." : "Die Zusagedaten weichen ab." };
      },
    },
    {
      id: "day-summary", label: "Tagesüberblick: leere Tage, laufende Termine, Briefings und offene Rückmeldungen", kind: "logic",
      run: async () => {
        const now = new Date("2026-11-21T12:00:00+01:00");
        const event = { id: "summary", title: "Bürgerdialog", start_time: "2026-11-21T18:00:00+01:00", end_time: "2026-11-21T19:00:00+01:00", is_all_day: false };
        const checks = [
          appointmentSummary([], now).includes("Heute und morgen stehen keine weiteren Termine an"),
          appointmentSummary([event], now).includes("ein Termin um 18:00"),
          !appointmentSummary([event], now).includes("Briefing"),
          appointmentSummary([{ ...event, briefing_status: "approved" }], now).includes("Das Briefing liegt bereit"),
          appointmentSummary([event], new Date("2026-11-21T18:30:00+01:00")).includes("Gerade läuft"),
          appointmentSummary([event], new Date("2026-11-21T20:00:00+01:00")).includes("alle Termine erledigt"),
          appointmentSummary([{ ...event, is_all_day: true }], now).includes("ganztägiger Termin"),
          pendingSummary(0, 0).includes("sind erledigt"),
          pendingSummary(1, 2) === "Eine Entscheidung und 2 Rückmeldungen warten.",
          pendingSummary(0, 1) === "Eine Rückmeldung wartet.",
          pendingSummary(1, 0) === "Eine Entscheidung wartet.",
          pendingSummary(9, 2) === "9 Entscheidungen und 2 Rückmeldungen warten.",
        ];
        return { ok: checks.every(Boolean), message: `${checks.filter(Boolean).length}/${checks.length} Textfälle bestanden.` };
      },
    },
    {
      id: "reminder", label: "Briefing-Hinweis: Zuständigkeit, Vorlauf und Montag", kind: "logic",
      run: async () => {
        const appointment = { start_time: "2026-11-23T17:00:00+01:00", briefing_status: "assigned", briefing_assignee_id: "employee", briefing_due_at: null };
        const friday = new Date("2026-11-20T08:00:00+01:00");
        const checks = [
          needsBriefingReminder(appointment, "employee", friday),
          !needsBriefingReminder(appointment, "employee", new Date("2026-11-20T07:59:00+01:00")),
          !needsBriefingReminder(appointment, "other", friday),
          needsBriefingReminder({ ...appointment, briefing_assignee_id: null }, "other", friday),
          !needsBriefingReminder({ ...appointment, briefing_status: "approved" }, "employee", friday),
          needsBriefingReminder({ ...appointment, start_time: "2026-11-25T18:00:00+01:00", briefing_due_at: "2026-11-24T12:00:00+01:00" }, "employee", new Date("2026-11-23T12:00:00+01:00")),
          !needsBriefingReminder({ ...appointment, start_time: "2026-11-25T18:00:00+01:00" }, "employee", new Date("2026-11-24T17:59:00+01:00")),
        ];
        return { ok: checks.every(Boolean), message: `${checks.filter(Boolean).length}/${checks.length} Hinweisregeln bestanden.` };
      },
    },
    {
      id: "rules", label: "Regeln: nur Entscheider geben frei; Frist am Vortag 12:00", kind: "logic",
      run: async () => {
        const due = suggestBriefingDue(new Date(2026, 10, 12, 18), new Date(2026, 10, 1));
        const checks = [
          canAdvanceBriefing("assigned", "submit", { isDecider: false, isAssignee: true }),
          !canAdvanceBriefing("in_review", "approve", { isDecider: false, isAssignee: true }),
          due.getDate() === 11 && due.getHours() === 12,
          showsInDailyBriefing({ briefing_status: "approved", start_time: new Date().toISOString() }),
          !showsInDailyBriefing({ briefing_status: "in_review", start_time: new Date().toISOString() }),
          needsBriefingDecision({ briefing_status: "undecided", start_time: new Date(Date.now() + 86400_000).toISOString() }),
        ];
        return { ok: checks.every(Boolean), message: `${checks.filter(Boolean).length}/${checks.length} Regeln bestanden.` };
      },
    },
    {
      id: "model", label: "Regeln: Kurz/Dossier-Umrechnung, Live nur am Termintag, Folgeaufgabe, Abschluss", kind: "logic",
      run: async () => {
        const saved = saveCompact({}, { ...mergeLegacy({}), compact_positions: "Radweg" });
        const today = new Date(); today.setHours(23, 0, 0, 0);
        const checks = [
          Array.isArray(saved.talking_point_items) && (saved.talking_point_items as unknown[]).length === 1,
          mergeLegacy({ objectives: "Ziel" }).compact_goal === "Ziel",
          canGoLive({ briefing_status: "approved", start_time: today.toISOString() }),
          !canGoLive({ briefing_status: "assigned", start_time: today.toISOString() }),
          followUpTaskFromLive("a", { title: " " }) === null,
          canCompleteBriefing("approved", "Ergebnis") && !canCompleteBriefing("approved", ""),
        ];
        return { ok: checks.every(Boolean), message: `${checks.filter(Boolean).length}/${checks.length} Regeln bestanden.` };
      },
    },
    {
      id: "create", label: "Termin anlegen (Briefing offen)", critical: true,
      run: async (ctx) => {
        const start = new Date(Date.now() + 5 * 86400_000);
        const id = crypto.randomUUID();
        const { error } = await supabase.from("appointments").insert({ id, title: `${SELFTEST_PREFIX} Briefing-Termin (${ctx.runId})`, tenant_id: ctx.tenantId, user_id: ctx.userId,
          start_time: start.toISOString(), end_time: new Date(start.getTime() + 3600_000).toISOString() });
        if (error) return { ok: false, message: describeError(error) };
        ctx.trackRecord({ table: "appointments", id });
        ctx.data.appointmentId = id;
        const a = await read(id);
        return { ok: a.briefing_status === "undecided", message: `Status: ${a.briefing_status}` };
      },
    },
    {
      id: "change-alert", label: "Eil-Änderung mit neuer Zeit und Hinweis speichern", kind: "workflow",
      run: async (ctx) => {
        const appointmentId = ctx.data.appointmentId as string;
        const alertId = crypto.randomUUID();
        const newStart = addMinutesToStart(new Date(Date.now() + 5 * 86400_000).toISOString(), 30) as string;
        const { error } = await supabase.from("appointment_change_alerts").insert({
          id: alertId, tenant_id: ctx.tenantId, appointment_id: appointmentId,
          title: changeTitle("time", `${SELFTEST_PREFIX} Briefing-Termin (${ctx.runId})`),
          message: "Zugang über den Hof", kind: "time", new_start_time: newStart,
          created_by: ctx.userId, created_by_name: "Selbsttest",
        });
        if (error) return { ok: false, message: describeError(error) };
        ctx.trackRecord({ table: "appointment_change_alerts", id: alertId });
        const { data, error: readError } = await supabase.from("appointment_change_alerts")
          .select("kind, new_start_time, new_location, message").eq("id", alertId).single();
        if (readError) return { ok: false, message: describeError(readError) };
        const ok = data.kind === "time" && Date.parse(data.new_start_time ?? "") === Date.parse(newStart)
          && data.message === "Zugang über den Hof" && data.new_location === null;
        return { ok, message: ok ? "Zeitänderung samt Zusatzhinweis gespeichert." : "Änderung unerwartet gespeichert.", details: data };
      },
    },
    {
      id: "assign", label: "Briefing vergeben → Aufgabe entsteht", kind: "workflow", critical: true,
      run: async (ctx) => {
        const id = ctx.data.appointmentId as string;
        const { data: taskId, error } = await supabase.rpc("set_appointment_briefing", { _appointment_id: id, _decision: "assigned", _assignee: ctx.userId, _due: new Date(Date.now() + 86400_000).toISOString(), _instructions: "Selbsttest" });
        if (taskId) ctx.trackRecord({ table: "tasks", id: taskId });
        if (error) return { ok: false, message: describeError(error) };
        ctx.data.taskId = taskId;
        const t = await supabase.from("tasks").select("status, ball_assignee_id, source_type").eq("id", taskId as string).single();
        const a = await read(id);
        const ok = a.briefing_status === "assigned" && t.data?.ball_assignee_id === ctx.userId && t.data?.source_type === "appointment_briefing";
        return { ok, message: ok ? "Aufgabe bei Zuarbeit angelegt." : "Aufgabe/Status unerwartet.", details: { a, t: t.data } };
      },
    },
    {
      id: "submit", label: "Vorlegen → Ball bei Abgeordnete/r", kind: "workflow",
      run: async (ctx) => {
        const { error } = await supabase.rpc("advance_appointment_briefing", { _appointment_id: ctx.data.appointmentId as string, _action: "submit" });
        if (error) return { ok: false, message: describeError(error) };
        const t = await supabase.from("tasks").select("ball_owner").eq("id", ctx.data.taskId as string).single();
        return { ok: t.data?.ball_owner === "deputy", message: `Ball: ${t.data?.ball_owner}` };
      },
    },
    {
      id: "approve", label: "Freigeben → Aufgabe erledigt", kind: "workflow",
      run: async (ctx) => {
        const { error } = await supabase.rpc("advance_appointment_briefing", { _appointment_id: ctx.data.appointmentId as string, _action: "approve" });
        if (error) return { ok: false, message: describeError(error) };
        const t = await supabase.from("tasks").select("status").eq("id", ctx.data.taskId as string).single();
        const a = await read(ctx.data.appointmentId as string);
        return { ok: t.data?.status === "completed" && a.briefing_status === "approved", message: `Aufgabe ${t.data?.status}, Briefing ${a.briefing_status}` };
      },
    },
    {
      id: "none", label: "„Kein Briefing“ setzt Status und löst Aufgabe", kind: "workflow",
      run: async (ctx) => {
        const { error } = await supabase.rpc("set_appointment_briefing", { _appointment_id: ctx.data.appointmentId as string, _decision: "none" });
        if (error) return { ok: false, message: describeError(error) };
        const a = await read(ctx.data.appointmentId as string);
        return { ok: a.briefing_status === "none" && !a.briefing_task_id, message: `Status: ${a.briefing_status}` };
      },
    },
    {
      id: "accept-with-briefing", label: "Zusage im Jour Fixe vergibt Briefing in einem Schritt", kind: "workflow",
      run: async (ctx) => {
        const d = new Date(); d.setDate(d.getDate() + 7);
        const reqId = crypto.randomUUID();
        const ins = await supabase.from("appointment_requests").insert({ id: reqId, title: `${SELFTEST_PREFIX} Briefing-Anfrage (${ctx.runId})`, tenant_id: ctx.tenantId, requested_date: d.toISOString().slice(0, 10), requested_time: "10:00:00", duration_minutes: 60, channel: "email" });
        if (ins.error) return { ok: false, message: describeError(ins.error) };
        ctx.trackRecord({ table: "appointment_requests", id: reqId });
        const { data: apptId, error } = await supabase.rpc("decide_appointment_request", { _request_id: reqId, _decision: "accepted", _briefing: "assigned", _briefing_assignee: ctx.userId, _briefing_due: new Date(Date.now() + 86400_000).toISOString() });
        if (apptId) ctx.trackRecord({ table: "appointments", id: apptId });
        if (error || !apptId) return { ok: false, message: describeError(error) };
        const a = await read(apptId);
        if (a.briefing_task_id) ctx.trackRecord({ table: "tasks", id: a.briefing_task_id });
        return { ok: a.briefing_status === "assigned" && !!a.briefing_task_id, message: `Status ${a.briefing_status}, Aufgabe ${a.briefing_task_id ? "angelegt" : "fehlt"}` };
      },
    },
  ],
};
