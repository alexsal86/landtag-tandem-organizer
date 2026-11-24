import { describe, expect, it } from "vitest";
import {
  appointmentInviteUid,
  buildAppointmentIcs,
  escapeICSValue,
  formatDateToICS,
  hasBeenInvited,
  invitationUpdateRequired,
  nextCalendarSequence,
  nextGuestStatusAfterSend,
  normalizeSequence,
  selectInvitationRecipients,
  selectNewGuestEmails,
  validateInviteDates,
} from "./appointmentInvite";

const organizer = { name: "Max Mustermann", email: "max@example.com" };
const base = {
  uid: appointmentInviteUid("8a3f0f8e-1c5b-4a44-9d5e-2b0d5f0f9a11"),
  title: "Jour fixe, Büro",
  startTime: "2025-01-01T10:00:00Z",
  endTime: "2025-01-01T11:00:00Z",
  organizer,
  now: new Date("2025-01-01T08:00:00Z"),
};

describe("Termineinladungen: UID und SEQUENCE", () => {
  it("leitet eine stabile UID aus der Termin-ID ab", () => {
    expect(appointmentInviteUid("abc")).toBe("abc@landtagsos.app");
    expect(appointmentInviteUid("abc")).toBe(appointmentInviteUid("abc"));
    expect(appointmentInviteUid("abc")).not.toBe(appointmentInviteUid("def"));
    expect(() => appointmentInviteUid("   ")).toThrow();
  });

  it("normalisiert SEQUENCE-Werte und zählt nur vorwärts", () => {
    expect(normalizeSequence(undefined)).toBe(0);
    expect(normalizeSequence(null)).toBe(0);
    expect(normalizeSequence("3")).toBe(3);
    expect(normalizeSequence(-2)).toBe(0);
    expect(normalizeSequence(Number.NaN)).toBe(0);
    expect(nextCalendarSequence(0)).toBe(1);
    expect(nextCalendarSequence(3)).toBe(4);
  });

  it("verlangt ein Update nur bei gestiegener SEQUENCE", () => {
    expect(invitationUpdateRequired(0, 0)).toBe(false);
    expect(invitationUpdateRequired(2, 2)).toBe(false);
    expect(invitationUpdateRequired(3, 2)).toBe(true);
    expect(invitationUpdateRequired(0, -1)).toBe(false);
  });
});

describe("Termineinladungen: ICS", () => {
  it("escaped problematische Zeichen korrekt für ICS", () => {
    expect(escapeICSValue("a,b;c\\d\nline")).toBe("a\\,b\\;c\\\\d\\nline");
  });

  it("formatiert Datum in UTC ICS Format", () => {
    expect(formatDateToICS("2025-02-01T10:30:45Z")).toBe("20250201T103045Z");
  });

  it("validiert ungültige Datumsformate und Zeitreihenfolge", () => {
    expect(validateInviteDates("kein-datum", "2025-01-01T10:00:00Z")).toContain("Ungültiges Datumsformat");
    expect(validateInviteDates("2025-01-01T10:00:00Z", "2025-01-01T09:00:00Z")).toContain("Endzeit");
    expect(validateInviteDates("2025-01-01T10:00:00Z", "2025-01-01T11:00:00")).toContain("Zeitzonen-Konflikt");
  });

  it("erzeugt eine Einladung mit Organisator und Teilnehmern", () => {
    const ics = buildAppointmentIcs({
      ...base,
      attendees: [{ name: "Erika", email: "erika@example.com" }],
    });
    const lines = ics.split("\r\n");

    expect(lines).toContain("BEGIN:VCALENDAR");
    expect(lines).toContain("METHOD:REQUEST");
    expect(lines).toContain(`UID:${base.uid}`);
    expect(lines).toContain("SEQUENCE:0");
    expect(lines).toContain("STATUS:CONFIRMED");
    expect(lines).toContain("ORGANIZER;CN=Max Mustermann:mailto:max@example.com");
    expect(lines).toContain("ATTENDEE;CN=Erika;RSVP=TRUE:mailto:erika@example.com");
    expect(ics).toContain("SUMMARY:Jour fixe\\, Büro");
  });

  it("behält die UID für Updates und Absagen und erhöht nur die SEQUENCE", () => {
    const update = buildAppointmentIcs({ ...base, sequence: 1, notice: "Termin geändert" });
    const cancel = buildAppointmentIcs({ ...base, sequence: 2, method: "CANCEL", notice: "Termin abgesagt" });

    for (const ics of [update, cancel]) {
      expect(ics.split("\r\n")).toContain(`UID:${base.uid}`);
    }
    expect(update.split("\r\n")).toContain("METHOD:REQUEST");
    expect(update.split("\r\n")).toContain("SEQUENCE:1");
    expect(update).toContain("DESCRIPTION:Termin geändert");
    expect(cancel.split("\r\n")).toContain("METHOD:CANCEL");
    expect(cancel.split("\r\n")).toContain("STATUS:CANCELLED");
    expect(cancel.split("\r\n")).toContain("SEQUENCE:2");
  });
});

describe("Termineinladungen: Gäste und RSVP", () => {
  const guests = [
    { id: "g1", email: "a@example.com", status: "confirmed", invited_at: "2025-01-01T09:00:00Z" },
    { id: "g2", email: "b@example.com", status: "declined", invited_at: "2025-01-01T09:00:00Z" },
    { id: "g3", email: "c@example.com", status: "pending", invited_at: null },
  ];

  it("schreibt manuell alle Gäste an, bei Auswahl nur diese", () => {
    expect(selectInvitationRecipients(guests).map((guest) => guest.id)).toEqual(["g1", "g2", "g3"]);
    expect(selectInvitationRecipients(guests, { guestIds: ["g3"] }).map((guest) => guest.id)).toEqual(["g3"]);
  });

  it("schickt Änderungen und Absagen nur an bereits eingeladene Gäste", () => {
    expect(selectInvitationRecipients(guests, { reason: "update" }).map((guest) => guest.id)).toEqual(["g1", "g2"]);
    expect(selectInvitationRecipients(guests, { reason: "cancel" }).map((guest) => guest.id)).toEqual(["g1", "g2"]);
    expect(selectInvitationRecipients(guests, { reason: "update", guestIds: ["g3"] }).map((guest) => guest.id))
      .toEqual(["g1", "g2", "g3"]);
  });

  it("überschreibt gegebene Rückmeldungen nicht", () => {
    expect(nextGuestStatusAfterSend("confirmed")).toBe("confirmed");
    expect(nextGuestStatusAfterSend("declined")).toBe("declined");
    expect(nextGuestStatusAfterSend("attended")).toBe("attended");
    expect(nextGuestStatusAfterSend("pending")).toBe("invited");
    expect(nextGuestStatusAfterSend(null)).toBe("invited");
  });

  it("erkennt neue Gäste unabhängig von Schreibweise und Leerzeichen", () => {
    expect(selectNewGuestEmails(["A@Example.com"], [{ email: " a@example.COM " }, { email: "neu@example.com" }]))
      .toEqual(["neu@example.com"]);
    expect(hasBeenInvited(guests[0])).toBe(true);
    expect(hasBeenInvited({ id: "x", email: "x@example.com", status: "pending", invited_at: null })).toBe(false);
  });
});
