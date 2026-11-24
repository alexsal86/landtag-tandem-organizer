import { supabase } from "@/integrations/supabase/client";
import type { TestScenario, TestContext } from "../types";
import { SELFTEST_MARKER, SELFTEST_PREFIX } from "../runner";
import { describeError } from "../verify";

const title = (run: string, label: string) => `${SELFTEST_PREFIX} ${label} (${run})`;

const slotTime = (daysAhead: number, hour: number) => {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

const sameInstant = (left: string | null, right: string | null) =>
  left !== null && right !== null && Date.parse(left) === Date.parse(right);

/**
 * Legt eine Abstimmung über die bestehende RPC an, damit der Gewinner-Slot
 * anschließend wie im UI übernommen werden kann.
 */
async function createPoll(ctx: TestContext) {
  const slots = [
    { start_time: slotTime(3, 10), end_time: slotTime(3, 11), order_index: 0 },
    { start_time: slotTime(4, 14), end_time: slotTime(4, 15), order_index: 1 },
  ];
  const participants = [
    { email: `selbsttest-intern-${ctx.runId}@example.invalid`, name: "Teilnehmerin Selbsttest", is_external: false },
    { email: `selbsttest-gast-${ctx.runId}@example.invalid`, name: "Gast Selbsttest", is_external: true },
  ];

  const { data: pollId, error } = await supabase.rpc("create_appointment_poll_with_details", {
    p_title: title(ctx.runId, "Abstimmung Gewinner-Slot"),
    p_description: `${SELFTEST_MARKER} Übernahme des Gewinner-Slots`,
    p_deadline: slotTime(2, 18),
    p_time_slots: slots,
    p_participants: participants,
  });

  return { pollId: pollId as string | null, slots, participants, error };
}

export const pollLifecycleScenario: TestScenario = {
  id: "poll-lifecycle",
  title: "Terminabstimmung (Gewinner-Slot übernehmen + Nachfassen)",
  description:
    "Legt eine Abstimmung mit Slots und Teilnehmern an und übernimmt den Gewinner-Slot über confirm_poll_winner. Prüft, dass nur die erstellende Person mit aktiver Büromitgliedschaft übernehmen darf, fremde Slots abgelehnt werden und ein zweiter Aufruf denselben Termin samt tatsächlich gespeichertem Slot liefert.",
  touches: ["appointment_polls", "poll_time_slots", "poll_participants", "appointments", "appointment_guests"],
  features: ["appointments"],
  writes: [
    {
      table: "appointment_polls",
      columns: ["title", "description", "deadline", "status", "user_id", "tenant_id", "confirmed_slot_id", "confirmed_appointment_id"],
    },
    { table: "poll_time_slots", columns: ["poll_id", "start_time", "end_time", "order_index"] },
    { table: "poll_participants", columns: ["poll_id", "email", "name", "is_external", "token"] },
    { table: "appointment_guests", columns: ["appointment_id", "tenant_id", "name", "email", "status"] },
    {
      table: "appointments",
      columns: ["title", "description", "start_time", "end_time", "category", "status", "priority", "user_id", "tenant_id", "poll_id"],
    },
  ],
  checks: [
    "confirm_poll_winner legt genau einen Termin an und verknüpft ihn mit der Abstimmung",
    "Zweiter Aufruf (gleicher und anderer Slot) liefert denselben Termin und den tatsächlich gespeicherten Slot",
    "Externe Teilnehmer werden als Gäste am Termin angelegt, interne nicht",
    "Fremde Slots und unbekannte Abstimmungen werden abgelehnt",
    "Fremde Abstimmungen im Mandanten können nicht übernommen werden",
    "get_poll_availability verweigert fremde Mandanten",
  ],
  limitations: [
    "Die Erstellerprüfung läuft gegen eine vorhandene fremde Abstimmung im Mandanten; in einem Büro ohne fremde Abstimmung meldet der Schritt diese Teilprüfung als nicht ausführbar.",
    "Eine ausgeschiedene Büromitgliedschaft lässt sich im Selbsttest nicht gefahrlos simulieren; die Prüfung auf aktive Mitgliedschaft und der Versand der Erinnerungswarteschlange sind in der Migration und in den Logikschritten abgesichert.",
  ],
  steps: [
    {
      id: "create-poll",
      label: "Abstimmung mit Slots und Teilnehmern anlegen",
      critical: true,
      run: async (ctx) => {
        const { pollId, slots, participants, error } = await createPoll(ctx);
        if (error || !pollId) return { ok: false, message: describeError(error) };
        ctx.trackRecord({ table: "appointment_polls", id: pollId });
        ctx.data.pollId = pollId;

        const { data: slotRows, error: slotError } = await supabase
          .from("poll_time_slots")
          .select("id, start_time, end_time, order_index")
          .eq("poll_id", pollId)
          .order("order_index");
        if (slotError) return { ok: false, message: `Zeitslots: ${describeError(slotError)}` };
        if (!slotRows || slotRows.length !== slots.length) {
          return { ok: false, message: `Zeitslots: ${slotRows?.length ?? 0} von ${slots.length} angelegt.` };
        }
        if (!sameInstant(slotRows[0].start_time, slots[0].start_time) || !sameInstant(slotRows[1].end_time, slots[1].end_time)) {
          return { ok: false, message: "Zeitslots: Zeiten weichen von der Eingabe ab." };
        }

        const { data: people, error: peopleError } = await supabase
          .from("poll_participants")
          .select("id, email, is_external, token")
          .eq("poll_id", pollId);
        if (peopleError) return { ok: false, message: `Teilnehmer: ${describeError(peopleError)}` };
        if (!people || people.length !== participants.length) {
          return { ok: false, message: `Teilnehmer: ${people?.length ?? 0} von ${participants.length} angelegt.` };
        }
        if (!people.some((person) => person.is_external && person.token)) {
          return { ok: false, message: "Teilnehmer: externer Teilnehmer ohne Antwort-Token." };
        }

        ctx.data.slotIds = slotRows.map((slot) => slot.id);
        ctx.data.slotStarts = slotRows.map((slot) => slot.start_time);
        ctx.data.slotEnds = slotRows.map((slot) => slot.end_time);
        return { ok: true, message: `${slotRows.length} Zeitslots und ${people.length} Teilnehmer angelegt.` };
      },
    },
    {
      id: "confirm-winner",
      label: "Gewinner-Slot übernehmen (idempotent, genau ein Termin)",
      critical: true,
      run: async (ctx) => {
        const pollId = ctx.data.pollId as string;
        const [firstSlotId, secondSlotId] = ctx.data.slotIds as string[];
        const [firstStart, secondStart] = ctx.data.slotStarts as string[];
        const [firstEnd] = ctx.data.slotEnds as string[];

        const first = await supabase.rpc("confirm_poll_winner", { _poll_id: pollId, _slot_id: firstSlotId });
        if (first.error || !first.data) return { ok: false, message: `Übernahme: ${describeError(first.error)}` };
        const firstResult = first.data[0];
        const appointmentId = firstResult?.appointment_id;
        if (!appointmentId) return { ok: false, message: "Übernahme: Die RPC lieferte keinen Termin." };
        if (firstResult.slot_id !== firstSlotId) {
          return { ok: false, message: "Übernahme: Die RPC muss den tatsächlich gespeicherten Slot zurückgeben." };
        }
        ctx.trackRecord({ table: "appointments", id: appointmentId });
        ctx.data.appointmentId = appointmentId;

        const again = await supabase.rpc("confirm_poll_winner", { _poll_id: pollId, _slot_id: firstSlotId });
        if (again.error) return { ok: false, message: `Zweiter Aufruf: ${describeError(again.error)}` };
        if (again.data?.[0]?.appointment_id !== appointmentId || again.data?.[0]?.slot_id !== firstSlotId) {
          return { ok: false, message: "Zweiter Aufruf muss denselben Termin und Slot zurückgeben.", details: { first: appointmentId, second: again.data?.[0] } };
        }

        const otherSlot = await supabase.rpc("confirm_poll_winner", { _poll_id: pollId, _slot_id: secondSlotId });
        if (otherSlot.error) return { ok: false, message: `Anderer Slot: ${describeError(otherSlot.error)}` };
        if (otherSlot.data?.[0]?.appointment_id !== appointmentId) {
          return { ok: false, message: "Nach der Übernahme bleibt der Gewinner-Slot fixiert.", details: { first: appointmentId, second: otherSlot.data?.[0] } };
        }
        if (otherSlot.data?.[0]?.slot_id !== firstSlotId) {
          return { ok: false, message: "Ein anderer Slot darf die gespeicherte Auswahl nicht ersetzen.", details: { expected: firstSlotId, stored: otherSlot.data?.[0]?.slot_id } };
        }

        const { data: appointmentRows, error: appointmentError } = await supabase
          .from("appointments")
          .select("id, poll_id, user_id, tenant_id, start_time, end_time, title, status")
          .eq("poll_id", pollId);
        if (appointmentError) return { ok: false, message: `Termin: ${describeError(appointmentError)}` };
        if (!appointmentRows || appointmentRows.length !== 1) {
          return { ok: false, message: `Es darf genau ein Termin entstehen (gefunden: ${appointmentRows?.length ?? 0}).` };
        }

        const appointment = appointmentRows[0];
        if (appointment.id !== appointmentId) return { ok: false, message: "Der Termin der Abstimmung ist ein anderer als der zurückgegebene." };
        if (appointment.user_id !== ctx.userId) return { ok: false, message: "Der Termin muss der erstellenden Person gehören." };
        if (!sameInstant(appointment.start_time, firstStart) || !sameInstant(appointment.end_time, firstEnd)) {
          return { ok: false, message: "Der Termin muss die Zeiten des Gewinner-Slots tragen." };
        }
        if (sameInstant(appointment.start_time, secondStart)) {
          return { ok: false, message: "Der Termin darf nicht am Zweitplatzierten-Slot liegen." };
        }

        const { data: poll, error: pollError } = await supabase
          .from("appointment_polls")
          .select("status, tenant_id, confirmed_slot_id, confirmed_appointment_id, followup_count")
          .eq("id", pollId)
          .single();
        if (pollError || !poll) return { ok: false, message: `Abstimmung: ${describeError(pollError)}` };
        if (poll.status !== "completed") return { ok: false, message: `Abstimmung muss abgeschlossen sein (Status: ${poll.status}).` };
        if (poll.confirmed_slot_id !== firstSlotId) return { ok: false, message: "Abstimmung muss den Gewinner-Slot speichern." };
        if (poll.confirmed_appointment_id !== appointmentId) return { ok: false, message: "Abstimmung muss den erzeugten Termin speichern." };
        if (appointment.tenant_id !== poll.tenant_id) return { ok: false, message: "Termin und Abstimmung müssen im selben Mandanten liegen." };

        const { data: guestRows, error: guestError } = await supabase
          .from("appointment_guests")
          .select("id, email, status")
          .eq("appointment_id", appointmentId);
        if (guestError) return { ok: false, message: `Gäste: ${describeError(guestError)}` };
        (guestRows ?? []).forEach((guest) => ctx.trackRecord({ table: "appointment_guests", id: guest.id }));
        const externalGuest = guestRows?.find((guest) => guest.email.includes(`selbsttest-gast-${ctx.runId}`));
        if (!externalGuest) return { ok: false, message: "Externe Teilnehmer müssen als Gäste am Termin hängen." };
        if (externalGuest.status !== "pending") return { ok: false, message: `Gast muss auf 'pending' stehen (ist: ${externalGuest.status}).` };
        if (guestRows?.some((guest) => guest.email.includes(`selbsttest-intern-${ctx.runId}`))) {
          return { ok: false, message: "Interne Teilnehmer dürfen nicht als externe Gäste angelegt werden." };
        }

        return {
          ok: true,
          message: "Gewinner-Slot übernommen; wiederholte Aufrufe liefern denselben Termin und es bleibt genau einer.",
          details: { appointmentId, slotId: firstSlotId, tenantId: poll.tenant_id },
        };
      },
    },
    {
      id: "confirm-winner-guards",
      label: "Ersteller-, Slot- und Mandantenprüfung",
      run: async (ctx) => {
        const pollId = ctx.data.pollId as string;
        const slotId = (ctx.data.slotIds as string[])[0];
        const notes: string[] = [];

        // Unbekannter Slot: darf nicht in die Abstimmung rutschen.
        const foreignSlot = await supabase.rpc("confirm_poll_winner", { _poll_id: pollId, _slot_id: crypto.randomUUID() });
        if (!foreignSlot.error) return { ok: false, message: "Ein fremder Slot darf nicht übernommen werden." };
        if (!/Zeitslot/i.test(foreignSlot.error.message)) {
          return { ok: false, message: `Unerwarteter Fehler für fremden Slot: ${foreignSlot.error.message}` };
        }
        notes.push("fremder Slot abgelehnt");

        // Unbekannte Abstimmung: keine stille Neuanlage.
        const unknownPoll = await supabase.rpc("confirm_poll_winner", { _poll_id: crypto.randomUUID(), _slot_id: slotId });
        if (!unknownPoll.error) return { ok: false, message: "Eine unbekannte Abstimmung darf keinen Termin erzeugen." };
        if (!/nicht gefunden/i.test(unknownPoll.error.message)) {
          return { ok: false, message: `Unerwarteter Fehler für unbekannte Abstimmung: ${unknownPoll.error.message}` };
        }
        notes.push("unbekannte Abstimmung abgelehnt");

        // Mandantenprüfung der Frei/Gebucht-Abfrage.
        const foreignTenant = await supabase.rpc("get_poll_availability", {
          _tenant_id: crypto.randomUUID(),
          _emails: [`selbsttest-intern-${ctx.runId}@example.invalid`],
        });
        if (!foreignTenant.error) return { ok: false, message: "Frei/Gebucht darf fremde Mandanten nicht auswerten." };
        if (!/Kein Zugriff/i.test(foreignTenant.error.message)) {
          return { ok: false, message: `Unerwarteter Fehler für fremden Mandanten: ${foreignTenant.error.message}` };
        }
        notes.push("fremder Mandant abgelehnt");

        // Erstellerprüfung: fremde Abstimmung im eigenen Mandanten.
        const { data: foreignPolls, error: foreignPollError } = await supabase
          .from("appointment_polls")
          .select("id")
          .eq("tenant_id", ctx.tenantId)
          .neq("user_id", ctx.userId)
          .eq("status", "active")
          .is("confirmed_appointment_id", null)
          .limit(1);

        if (foreignPollError) return { ok: false, message: `Fremde Abstimmung: ${describeError(foreignPollError)}` };

        const foreignPollId = foreignPolls?.[0]?.id;
        if (!foreignPollId) {
          return {
            ok: true,
            message: `Fremde Slots, unbekannte Abstimmungen und fremde Mandanten abgelehnt. Erstellerprüfung nicht ausführbar: keine offene fremde Abstimmung im Büro.`,
            details: { checks: notes, ownerCheck: "skipped" },
          };
        }

        const { data: foreignSlots } = await supabase
          .from("poll_time_slots")
          .select("id")
          .eq("poll_id", foreignPollId)
          .limit(1);
        const foreignPollSlotId = foreignSlots?.[0]?.id;
        if (!foreignPollSlotId) {
          return {
            ok: true,
            message: `Fremde Slots, unbekannte Abstimmungen und fremde Mandanten abgelehnt. Erstellerprüfung nicht ausführbar: fremde Abstimmung ohne lesbaren Slot.`,
            details: { checks: notes, ownerCheck: "skipped" },
          };
        }

        const { count: before } = await supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("poll_id", foreignPollId);

        const foreignAttempt = await supabase.rpc("confirm_poll_winner", { _poll_id: foreignPollId, _slot_id: foreignPollSlotId });
        if (!foreignAttempt.error) {
          // Falls die Sperre fehlt: keine fremden Daten zurücklassen.
          const leakedAppointmentId = foreignAttempt.data?.[0]?.appointment_id;
          if (leakedAppointmentId) await supabase.from("appointments").delete().eq("id", leakedAppointmentId);
          return { ok: false, message: "Eine fremde Abstimmung darf nicht übernommen werden." };
        }
        if (!/erstellende Person/i.test(foreignAttempt.error.message)) {
          return { ok: false, message: `Unerwarteter Fehler bei fremder Abstimmung: ${foreignAttempt.error.message}` };
        }

        const { count: after } = await supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("poll_id", foreignPollId);
        if ((before ?? 0) !== (after ?? 0)) {
          return { ok: false, message: "Abgelehnter Übernahmeversuch darf keine Termine verändern.", details: { before, after } };
        }
        notes.push("fremde Abstimmung abgelehnt");

        return { ok: true, message: `Geprüft: ${notes.join(", ")}.`, details: { checks: notes, ownerCheck: "verified" } };
      },
    },
  ],
};
