import { BIRTHDAY_ACTION_OPTIONS, birthdayActionLabel } from "@/utils/birthdayActions";
import {
  appointmentInviteUid,
  buildAppointmentIcs,
  invitationUpdateRequired,
  nextCalendarSequence,
  nextGuestStatusAfterSend,
  normalizeSequence,
  selectInvitationRecipients,
  selectNewGuestEmails,
} from "@/features/appointments/invitations/invitationRules";
import {
  APPOINTMENT_REMINDER_MAX_MINUTES,
  appointmentReminderDueAt,
  appointmentReminderKey,
  isAppointmentReminderDue,
  normalizeAppointmentReminderMinutes,
} from "@/features/appointments/reminderRules";
import { isDashboardBirthday, birthdayAge, nextAppointmentLabel, occursOnDay } from "@/utils/dashboard/occasions";
import {
  POLL_FOLLOWUP_MAX_SEND_ATTEMPTS,
  decidePollFollowup,
  isPollFollowupSendExhausted,
  nextPollFollowupSendAttemptAt,
  pollFollowupSendKey,
  selectFollowupRecipients,
  suggestPollSlots,
} from "@/features/polls/pollRules";
import { supabase } from "@/integrations/supabase/client";
import type { TestScenario } from "../types";
import { SELFTEST_MARKER, SELFTEST_PREFIX } from "../runner";
import { describeError, expectFields } from "../verify";

const title = (run: string, label: string) => `${SELFTEST_PREFIX} ${label} (${run})`;

export const appointmentLifecycleScenario: TestScenario = {
  id: "appointment-lifecycle",
  title: "Termin-Lifecycle (Kalender + Briefing + Feedback)",
  description:
    "Erzeugt einen vollständigen Kalender-Termin inkl. Vorbereitung/Briefing (visit_reason, conversation_partners, companions, program, sections) und Feedback. Verifiziert jedes geschriebene Feld.",
  touches: ["appointments", "appointment_preparations", "appointment_feedback"],
  features: ["appointments", "briefings"],
  writes: [
    {
      table: "appointments",
      columns: [
        "title", "description", "start_time", "end_time", "location", "category",
        "priority", "status", "is_all_day", "user_id", "tenant_id", "reminder_minutes",
      ],
    },
    {
      table: "appointment_preparations",
      columns: ["appointment_id", "tenant_id", "created_by", "title", "status", "preparation_data", "checklist_items", "notes"],
    },
    {
      table: "appointment_feedback",
      columns: ["appointment_id", "user_id", "tenant_id", "feedback_status", "notes", "event_type", "completed_at"],
    },
  ],
  links: (ctx) => {
    const links: Array<{ label: string; href: string }> = [
      { label: "Kalender öffnen", href: "/calendar" },
    ];
    if (ctx.data.appointmentId) {
      links.push({
        label: "Termin im Kalender hervorheben",
        href: `/calendar?highlight=${ctx.data.appointmentId as string}`,
      });
    }
    return links;
  },
  steps: [
    {
      id: "birthday-congratulations-options", label: "Dashboard und Jour fixe teilen die Glückwunsch-Optionen", kind: "logic",
      run: async () => ({
        ok: BIRTHDAY_ACTION_OPTIONS.map(option => option.key).join(',') === 'card,mail,call,gift'
          && birthdayActionLabel('gift') === 'Geschenk' && birthdayActionLabel('invalid') === undefined,
        message: 'Karte, Mail, Anruf und Geschenk sind einheitlich verfügbar.',
      }),
    },
    {
      id: "dashboard-occasions", label: "Geburtstage und ganztägige Termine getrennt darstellen", kind: "logic",
      run: async () => {
        if (birthdayAge('1980-11-23', '2026-11-23') !== 46 || birthdayAge('1980-11-24', '2026-11-23') !== undefined) throw new Error('Geburtstagsberechnung falsch');
        if (!isDashboardBirthday({ category: 'birthday' }) || isDashboardBirthday({ category: null }) || isDashboardBirthday({ category: 'meeting' })) throw new Error('Geburtstage müssen vom normalen Tagesablauf getrennt bleiben');
        const event = { id: 'all-day', title: 'Klausur', is_all_day: true, start_time: '2026-11-22T23:00:00Z', end_time: '2026-11-24T23:00:00Z', location: 'Stuttgart' };
        if (!occursOnDay(event, '2026-11-24') || occursOnDay(event, '2026-11-25')) throw new Error('Ganztägige Dauer falsch');
        if (!nextAppointmentLabel(event).includes('ganztägig · Klausur · Stuttgart.')) throw new Error('Terminausblick falsch');
        return { ok: true, message: 'Geburtstage, mehrtägige Termine und kompakter Ausblick geprüft.' };
      },
    },
    {
      id: "invitation-uid-sequence",
      label: "Einladungen: stabile UID und fortlaufende SEQUENCE",
      kind: "logic",
      run: async () => {
        const appointmentId = "8a3f0f8e-1c5b-4a44-9d5e-2b0d5f0f9a11";
        const uid = appointmentInviteUid(appointmentId);
        if (uid !== appointmentInviteUid(appointmentId)) throw new Error("UID muss über die Lebensdauer stabil bleiben");
        if (uid === appointmentInviteUid("11111111-1111-4111-8111-111111111111")) throw new Error("UIDs verschiedener Termine müssen sich unterscheiden");
        if (normalizeSequence(null) !== 0 || nextCalendarSequence(0) !== 1 || nextCalendarSequence(4) !== 5) throw new Error("SEQUENCE zählt nicht korrekt hoch");

        const invite = { uid, title: "Jour fixe", startTime: "2026-11-24T09:00:00Z", endTime: "2026-11-24T10:00:00Z", organizer: { name: "Büro", email: "buero@example.com" } };
        const moved = buildAppointmentIcs({ ...invite, sequence: 1, startTime: "2026-11-24T11:00:00Z", endTime: "2026-11-24T12:00:00Z" });
        const cancelled = buildAppointmentIcs({ ...invite, sequence: 2, method: "CANCEL" });
        const lines = (ics: string) => ics.split("\r\n");

        if (!lines(buildAppointmentIcs({ ...invite, sequence: 0 })).includes(`UID:${uid}`)) throw new Error("Einladung braucht die stabile UID");
        if (!lines(moved).includes(`UID:${uid}`) || !lines(cancelled).includes(`UID:${uid}`)) throw new Error("Update und Absage müssen dieselbe UID tragen");
        if (!lines(moved).includes("METHOD:REQUEST") || !lines(moved).includes("SEQUENCE:1")) throw new Error("Verschiebung muss ein REQUEST mit höherer SEQUENCE sein");
        if (!lines(cancelled).includes("METHOD:CANCEL") || !lines(cancelled).includes("STATUS:CANCELLED") || !lines(cancelled).includes("SEQUENCE:2")) throw new Error("Absage muss als CANCEL mit höherer SEQUENCE versendet werden");
        if (!invitationUpdateRequired(1, 0) || invitationUpdateRequired(0, 0) || invitationUpdateRequired(2, 2)) throw new Error("Ein Update darf nur bei gestiegener SEQUENCE rausgehen (echte Zeit-/Ortsänderung)");
        return { ok: true, message: "UID bleibt stabil, nur echte Zeit-/Ortsänderungen erhöhen die SEQUENCE (Datenbank-Trigger), Absagen gehen als CANCEL an dieselbe UID." };
      },
    },
    {
      id: "invitation-guest-identity",
      label: "Einladungen: Gäste per E-Mail angleichen, RSVP und Antwortlink erhalten",
      kind: "logic",
      run: async () => {
        const guests = [
          { id: "g1", email: "a@example.com", status: "confirmed", invited_at: "2026-11-01T09:00:00Z" },
          { id: "g2", email: "b@example.com", status: "pending", invited_at: null },
        ];
        if (selectInvitationRecipients(guests).length !== 2) throw new Error("Manueller Versand muss alle Gäste erreichen");
        const updatable = selectInvitationRecipients(guests, { reason: "update" });
        if (updatable.length !== 1 || updatable[0].id !== "g1") throw new Error("Änderungen dürfen nur bereits eingeladene Gäste erreichen");
        if (selectInvitationRecipients(guests, { reason: "update", guestIds: ["g2"] }).length !== 2) throw new Error("Neu hinzugefügte Gäste müssen die Einladung erhalten");
        if (nextGuestStatusAfterSend("confirmed") !== "confirmed" || nextGuestStatusAfterSend("declined") !== "declined" || nextGuestStatusAfterSend(null) !== "invited") throw new Error("RSVP-Status darf nicht überschrieben werden");
        const added = selectNewGuestEmails(["A@example.com"], [{ email: " a@example.COM " }, { email: "neu@example.com" }]);
        if (added.length !== 1 || added[0] !== "neu@example.com") throw new Error("Neue Gäste müssen unabhängig von der Schreibweise erkannt werden");
        return { ok: true, message: "Gäste werden über die E-Mail-Adresse abgeglichen; bestätigte oder abgelehnte Rückmeldungen und Antwortlinks bleiben erhalten." };
      },
    },
    {
      id: "poll-slot-suggestions",
      label: "Terminabstimmung: Slots aus Frei/Gebucht samt Puffer",
      kind: "logic",
      run: async () => {
        const suggestions = suggestPollSlots({
          participants: ["a@example.com", "A@example.com", "b@example.com"],
          busy: [{ email: "b@example.com", start: "2026-11-25T08:00:00.000Z", end: "2026-11-25T09:00:00.000Z" }],
          windowStart: "2026-11-25T00:00:00.000Z",
          windowEnd: "2026-11-27T00:00:00.000Z",
          durationMinutes: 60,
          bufferMinutes: 15,
          existingSlots: [{ start: "2026-11-25T10:00:00.000Z", end: "2026-11-25T11:00:00.000Z" }],
          limit: 5,
        });

        if (suggestions.length === 0) throw new Error("Es müssen Vorschläge entstehen");
        if (!suggestions.every((suggestion) => suggestion.fullyFree)) throw new Error("Vorgeschlagen werden zuerst vollständig freie Slots");
        if (suggestions.some((suggestion) => suggestion.start === "2026-11-25T08:00:00.000Z")) throw new Error("Belegte Zeit inkl. Puffer darf nicht vorgeschlagen werden");
        if (suggestions.some((suggestion) => suggestion.start === "2026-11-25T10:00:00.000Z")) throw new Error("Bereits vorhandene Slots dürfen nicht erneut vorgeschlagen werden");
        if (Date.parse(suggestions[0].start) < Date.parse("2026-11-25T10:30:00.000Z")) throw new Error("Der Puffer muss den Slot vor dem belegten Termin sperren");

        const withUnknown = suggestPollSlots({
          participants: ["a@example.com", "extern@example.org"],
          knownParticipants: ["a@example.com"],
          busy: [],
          windowStart: "2026-11-25T00:00:00.000Z",
          windowEnd: "2026-11-26T00:00:00.000Z",
          durationMinutes: 60,
          bufferMinutes: 15,
          limit: 1,
        });
        if (withUnknown[0].fullyFree) throw new Error("Teilnehmer ohne Frei/Gebucht-Daten dürfen nicht als frei gelten");
        if (withUnknown[0].unknownEmails.join(",") !== "extern@example.org") throw new Error("Unbekannte Kalender müssen je Teilnehmer gekennzeichnet werden");
        if (withUnknown[0].freeEmails.join(",") !== "a@example.com") throw new Error("Nur nachweislich freie Teilnehmer zählen als frei");

        return { ok: true, message: "Vorschläge beachten Arbeitszeit, Puffer, belegte Zeiten und vorhandene Slots; Teilnehmer ohne Kalenderdaten werden gekennzeichnet statt als frei gezählt." };
      },
    },
    {
      id: "poll-answer-followup",
      label: "Terminabstimmung: automatisches Nachfassen ohne Antwort",
      kind: "logic",
      run: async () => {
        const poll = {
          status: "active",
          createdAt: "2026-11-20T09:00:00.000Z",
          deadline: "2026-11-30T09:00:00.000Z",
          followupCount: 0,
          lastFollowupAt: null,
          participantCount: 3,
          respondingCount: 1,
        };

        if (decidePollFollowup(poll, new Date("2026-11-21T08:00:00.000Z")).due) throw new Error("Vor 24 Stunden darf nicht erinnert werden");
        const first = decidePollFollowup(poll, new Date("2026-11-21T09:00:00.000Z"));
        if (!first.due || first.attempt !== 1) throw new Error("Nach 24 Stunden muss die erste Erinnerung rausgehen");
        const second = decidePollFollowup(
          { ...poll, followupCount: 1, lastFollowupAt: "2026-11-21T09:00:00.000Z" },
          new Date("2026-11-23T09:00:00.000Z"),
        );
        if (!second.due || second.attempt !== 2) throw new Error("Nach 48 Stunden muss erneut erinnert werden");
        if (decidePollFollowup({ ...poll, followupCount: 2 }, new Date("2026-11-29T09:00:00.000Z")).due) throw new Error("Mehr als zwei Erinnerungen sind nicht erlaubt");
        if (decidePollFollowup({ ...poll, respondingCount: 3 }, new Date("2026-11-25T09:00:00.000Z")).due) throw new Error("Ohne offene Antworten darf nicht erinnert werden");
        if (decidePollFollowup({ ...poll, deadline: "2026-11-22T09:00:00.000Z" }, new Date("2026-11-25T09:00:00.000Z")).due) throw new Error("Nach Fristablauf darf nicht erinnert werden");
        if (decidePollFollowup({ ...poll, lastSlotEnd: "2026-11-22T09:00:00.000Z" }, new Date("2026-11-25T09:00:00.000Z")).due) throw new Error("Nach dem letzten Zeitslot darf nicht mehr erinnert werden");

        const deadlineSoon = decidePollFollowup(
          { ...poll, createdAt: "2026-11-25T06:00:00.000Z", deadline: "2026-11-25T20:00:00.000Z" },
          new Date("2026-11-25T09:00:00.000Z"),
        );
        if (!deadlineSoon.due) throw new Error("Bei Frist in unter 24 Stunden muss einmalig erinnert werden");
        const deadlineSoonAfterReminder = decidePollFollowup(
          { ...poll, createdAt: "2026-11-25T06:00:00.000Z", deadline: "2026-11-25T20:00:00.000Z", followupCount: 1, lastFollowupAt: "2026-11-25T08:00:00.000Z" },
          new Date("2026-11-25T09:00:00.000Z"),
        );
        if (deadlineSoonAfterReminder.due) throw new Error("Kurz vor der Frist darf nicht doppelt erinnert werden");

        const recipients = selectFollowupRecipients([
          { id: "1", email: "offen@example.com", hasResponded: false },
          { id: "2", email: "antwort@example.com", hasResponded: true },
        ]);
        if (recipients.length !== 1 || recipients[0].id !== "1") throw new Error("Nur offene Teilnehmende werden erinnert");

        return { ok: true, message: "Erinnerungen laufen 24 Stunden nach Erstellung, danach alle 48 Stunden, maximal zweimal und nie nach Fristablauf." };
      },
    },
    {
      id: "poll-followup-queue",
      label: "Terminabstimmung: Versandwarteschlange mit Wiederholungen",
      kind: "logic",
      run: async () => {
        const key = pollFollowupSendKey("poll-1", "teilnehmer-1", 2);
        if (key !== "poll-1:teilnehmer-1:answer_followup:2") throw new Error("Versandschlüssel muss Abstimmung, Teilnehmer und Versuch abbilden");
        if (pollFollowupSendKey("poll-1", "teilnehmer-1", 2) !== key) throw new Error("Versandschlüssel muss stabil bleiben");
        if (pollFollowupSendKey("poll-1", "teilnehmer-2", 2) === key) throw new Error("Teilnehmer brauchen unterschiedliche Versandschlüssel");
        if (pollFollowupSendKey("poll-1", "teilnehmer-1", 1) === key) throw new Error("Jeder Versuch braucht einen eigenen Versandschlüssel");

        const base = new Date("2026-11-24T09:00:00.000Z");
        const gaps = [1, 2, 3].map(
          (failed) => (nextPollFollowupSendAttemptAt(failed, base).getTime() - base.getTime()) / 60_000,
        );
        if (gaps.join(",") !== "15,30,60") throw new Error(`Wiederholungen müssen wachsen (sind: ${gaps.join(",")})`);
        if (nextPollFollowupSendAttemptAt(9, base).getTime() - base.getTime() !== 120 * 60_000) {
          throw new Error("Der Wiederholungsabstand muss bei 120 Minuten gedeckelt sein");
        }

        if (isPollFollowupSendExhausted(POLL_FOLLOWUP_MAX_SEND_ATTEMPTS - 1)) {
          throw new Error("Ein Auftrag darf vor dem letzten Versuch nicht als gescheitert gelten");
        }
        if (!isPollFollowupSendExhausted(POLL_FOLLOWUP_MAX_SEND_ATTEMPTS)) {
          throw new Error("Nach allen Versuchen muss der Auftrag als gescheitert gelten");
        }
        if (POLL_FOLLOWUP_MAX_SEND_ATTEMPTS < 2) {
          throw new Error("Ein einzelner Fehlversuch darf keinen Erinnerungsversuch verbrauchen");
        }

        return { ok: true, message: "Jeder Versuch hat eindeutige Versandschlüssel; Fehlversuche werden nach 15, 30 und 60 Minuten (max. 120) wiederholt, erst danach gilt der Auftrag als gescheitert." };
      },
    },
    {
      id: "appointment-reminder-due",
      label: "Termin-Erinnerung: Vorlauf, Fälligkeit und ein Versand je Termin",
      kind: "logic",
      run: async () => {
        if (normalizeAppointmentReminderMinutes(0) !== null) throw new Error("0 Minuten bedeutet keine Erinnerung");
        if (normalizeAppointmentReminderMinutes(null) !== null) throw new Error("Ohne Vorlauf keine Erinnerung");
        if (normalizeAppointmentReminderMinutes(-5) !== null) throw new Error("Negative Vorläufe sind ungültig");
        if (normalizeAppointmentReminderMinutes(APPOINTMENT_REMINDER_MAX_MINUTES + 1) !== null) {
          throw new Error("Vorläufe über einer Woche sind ungültig");
        }
        if (normalizeAppointmentReminderMinutes(15.9) !== 15) throw new Error("Vorlauf wird auf ganze Minuten gekürzt");
        if (normalizeAppointmentReminderMinutes(APPOINTMENT_REMINDER_MAX_MINUTES) !== APPOINTMENT_REMINDER_MAX_MINUTES) {
          throw new Error("Der maximale Vorlauf muss gültig bleiben");
        }

        const start = "2026-11-25T14:00:00.000Z";
        if (appointmentReminderDueAt(start, 15)?.toISOString() !== "2026-11-25T13:45:00.000Z") {
          throw new Error("Die Erinnerung ist Vorlauf vor dem Beginn fällig");
        }

        const beforeDue = new Date("2026-11-25T13:44:59.000Z");
        const dueNow = new Date("2026-11-25T13:45:00.000Z");
        const afterStart = new Date("2026-11-25T14:00:00.000Z");
        if (isAppointmentReminderDue({ id: "a", startTime: start, reminderMinutes: 15 }, beforeDue)) {
          throw new Error("Vor dem Vorlauf darf nicht erinnert werden");
        }
        if (!isAppointmentReminderDue({ id: "a", startTime: start, reminderMinutes: 15 }, dueNow)) {
          throw new Error("Zum Vorlauf muss erinnert werden");
        }
        if (isAppointmentReminderDue({ id: "a", startTime: start, reminderMinutes: null }, dueNow)) {
          throw new Error("Ohne Vorlauf darf nicht erinnert werden");
        }
        if (isAppointmentReminderDue({ id: "a", startTime: start, reminderMinutes: 15 }, afterStart)) {
          throw new Error("Nach Terminbeginn darf nicht erinnert werden");
        }

        if (appointmentReminderKey("a", 15) === appointmentReminderKey("b", 15)) {
          throw new Error("Termine brauchen getrennte Versandschlüssel");
        }
        if (appointmentReminderKey("a", 15) === appointmentReminderKey("a", 30)) {
          throw new Error("Verschiedene Vorläufe brauchen getrennte Versandschlüssel");
        }

        return {
          ok: true,
          message: "Erinnert wird genau einmal je Vorlauf, frühestens Vorlauf vor dem Beginn und nie nach Terminbeginn; 0/unbekannt bedeutet keine Erinnerung.",
        };
      },
    },
    {
      id: "create-appointment",
      label: "Termin anlegen (heute, 2h Block)",
      run: async (ctx) => {
        const start = new Date();
        start.setHours(start.getHours() + 2, 0, 0, 0);
        const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
        const payload = {
          title: title(ctx.runId, "Demo-Termin"),
          description: `${SELFTEST_MARKER} Bürgersprechstunde mit Ortsbesichtigung`,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          location: "Bürgerhaus Karlsruhe-Mitte",
          category: "buergersprechstunde",
          priority: "high",
          status: "planned",
          is_all_day: false,
          reminder_minutes: 30,
          user_id: ctx.userId,
          tenant_id: ctx.tenantId,
        };
        const { data, error } = await supabase.from("appointments").insert(payload).select("id").single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.trackRecord({ table: "appointments", id: data.id });
        ctx.data.appointmentId = data.id;
        return expectFields("appointments", data.id, payload, "Termin");
      },
    },
    {
      id: "create-preparation",
      label: "Briefing/Vorbereitung mit allen Strukturfeldern",
      run: async (ctx) => {
        const preparation_data = {
          visit_reason: "einladung" as const,
          conversation_partners: [
            { id: crypto.randomUUID(), name: "Dr. Beispiel", role: "Ortsvorsteherin", organization: "Stadt Karlsruhe", note: "Ansprechpartnerin vor Ort" },
          ],
          companions: [
            { id: crypto.randomUUID(), name: "Mitarbeiter Müller", type: "mitarbeiter" as const, note: "Protokoll" },
          ],
          has_parking: true,
          social_media_planned: true,
          press_planned: false,
          program: [
            { id: crypto.randomUUID(), time: "14:00", item: "Begrüßung", notes: "Kurze Vorstellung" },
            { id: crypto.randomUUID(), time: "14:15", item: "Rundgang", notes: "Mit Fotograf" },
          ],
          sections: [
            { type: "appointment_preparation_section" as const, status: "in_progress" as const, id: crypto.randomUUID(), title: "Hintergrund", content: `${SELFTEST_MARKER} Hintergrundinfos` },
          ],
        };
        const checklist_items = [
          { id: crypto.randomUUID(), label: "Anfahrt prüfen", completed: true },
          { id: crypto.randomUUID(), label: "Sprechzettel mitnehmen", completed: false },
        ];
        const payload = {
          appointment_id: ctx.data.appointmentId as string,
          tenant_id: ctx.tenantId,
          created_by: ctx.userId,
          title: title(ctx.runId, "Vorbereitung"),
          status: "in_progress",
          preparation_data,
          checklist_items,
          notes: `${SELFTEST_MARKER} Briefing-Notiz`,
        };
        const { data, error } = await supabase.from("appointment_preparations").insert(payload).select("id").single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.trackRecord({ table: "appointment_preparations", id: data.id });
        ctx.data.preparationId = data.id;
        return expectFields("appointment_preparations", data.id, payload, "Vorbereitung");
      },
    },
    {
      id: "create-feedback",
      label: "Feedback (abgeschlossen, mit Notizen)",
      critical: false,
      run: async (ctx) => {
        const payload = {
          appointment_id: ctx.data.appointmentId as string,
          user_id: ctx.userId,
          tenant_id: ctx.tenantId,
          feedback_status: "completed",
          notes: `${SELFTEST_MARKER} Sehr produktives Gespräch.`,
          event_type: "appointment",
          completed_at: new Date().toISOString(),
        };
        const { data, error } = await supabase.from("appointment_feedback").insert(payload).select("id").single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.trackRecord({ table: "appointment_feedback", id: data.id });
        return expectFields("appointment_feedback", data.id, payload, "Feedback");
      },
    },
  ],
};
