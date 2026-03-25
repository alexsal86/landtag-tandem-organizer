import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { debugConsole } from '@/utils/debugConsole';
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { rrulestr } from "rrule";
import type { CalendarEvent } from "../types";
import type { ExternalCalendarSummary } from "@/components/meetings/types";

const APPOINTMENT_SELECT = `
  id, title, description, start_time, end_time, category, priority,
  location, status, is_all_day, meeting_id, contact_id, poll_id,
  reminder_minutes, recurrence_rule, recurrence_end_date
`;

interface AppointmentRow {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  category: string | null;
  priority: string | null;
  location: string | null;
  status: string | null;
  is_all_day: boolean | null;
  meeting_id: string | null;
  contact_id: string | null;
  poll_id: string | null;
  reminder_minutes: number | null;
  recurrence_rule: string | null;
  recurrence_end_date: string | null;
  _isRecurring?: boolean;
  _originalId?: string;
  _isBirthdayInstance?: boolean;
}

interface AppointmentCategoryRow {
  id: string;
  name: string;
  color: string;
}

interface AppointmentContactRow {
  appointment_id: string;
  role: string | null;
  contacts: { id: string; name: string } | { id: string; name: string }[] | null;
}

interface ExternalEventRow {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  location: string | null;
  all_day?: boolean | null;
  recurrence_rule?: string | null;
  category?: string | null;
  external_calendars: ExternalCalendarSummary | ExternalCalendarSummary[] | null;
  _isRecurring?: boolean;
  _originalId?: string;
}

interface EventPlanningRow {
  id: string;
  date_time: string;
  event_plannings: { title: string; user_id: string | null } | { title: string; user_id: string | null }[] | null;
}

interface LeaveRequestRow {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
  profiles: { display_name: string | null } | { display_name: string | null }[] | null;
}

interface ContactBirthdayRow {
  id: string;
  birthday: string | null;
}

interface ExternalCalendarJoinRow {
  id: string;
  name: string;
  color: string | null;
  user_id: string | null;
  tenant_id: string;
}

const extractSingle = <T,>(value: T | T[] | null | undefined): T | null => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
};

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function getDateRange(currentDate: Date, view: string): [Date, Date] {
  if (view === "month") {
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    return [start, end];
  }
  if (view === "week") {
    const start = getWeekStart(currentDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return [start, end];
  }
  const start = new Date(currentDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(currentDate);
  end.setHours(23, 59, 59, 999);
  return [start, end];
}

function isExternalAllDayEvent(start: Date, end: Date): boolean {
  const sm = start.getHours() === 0 && start.getMinutes() === 0 && start.getSeconds() === 0;
  const em = end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0;
  const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  return sm && em && diff === 1;
}

function expandRecurringEvent<T extends AppointmentRow | ExternalEventRow>(event: T, startDate: Date, endDate: Date): T[] {
  if (!event.recurrence_rule) return [event];
  try {
    const rule = rrulestr(event.recurrence_rule, { dtstart: new Date(event.start_time) });
    const expanded = event.recurrence_rule.includes("FREQ=YEARLY") || event.category === "birthday"
      ? (() => {
          const es = new Date(startDate); es.setFullYear(es.getFullYear() - 1);
          const ee = new Date(endDate); ee.setFullYear(ee.getFullYear() + 2);
          return rule.between(es, ee, true).filter((occurrence: Date) => occurrence >= startDate && occurrence <= endDate);
        })()
      : rule.between(startDate, endDate, true);

    return expanded.map((occurrence: Date, index: number) => {
      const origStart = new Date(event.start_time);
      const origEnd = new Date(event.end_time);
      const newStart = new Date(occurrence);

      let newEnd: Date;
      const isAllDayEvent = "is_all_day" in event ? Boolean(event.is_all_day) : Boolean(event.all_day);
      if (isAllDayEvent || event.category === "birthday") {
        newStart.setHours(origStart.getHours(), origStart.getMinutes(), origStart.getSeconds());
        newEnd = new Date(newStart);
        const dur24 = origEnd.getTime() - origStart.getTime() === 24 * 60 * 60 * 1000;
        if (dur24) { newEnd.setDate(newEnd.getDate() + 1); newEnd.setHours(0, 0, 0, 0); }
        else { newEnd = new Date(newStart.getTime() + (origEnd.getTime() - origStart.getTime())); }
      } else {
        newEnd = new Date(newStart.getTime() + (origEnd.getTime() - origStart.getTime()));
      }

      return { ...event, id: `${event.id}-recurrence-${index}`, start_time: newStart.toISOString(), end_time: newEnd.toISOString(), _isRecurring: true, _originalId: event.id };
    });
  } catch { return [event]; }
}

function expandBirthdayEvents(
  event: AppointmentRow,
  startDate: Date,
  endDate: Date,
  birthdayByContactId: Map<string, string>,
): AppointmentRow[] {
  if (event.category !== "birthday" || !event.contact_id) return [event];

  const birthday = birthdayByContactId.get(event.contact_id);
  if (!birthday) return [event];

  const originalDate = new Date(event.start_time);
  const realBirthYear = new Date(birthday).getFullYear();
  const maxYear = realBirthYear + 99;
  const startYear = startDate.getFullYear();
  const endYear = Math.min(endDate.getFullYear(), maxYear);

  const instances: AppointmentRow[] = [];
  for (let year = startYear; year <= endYear; year++) {
    if (year === originalDate.getFullYear()) continue;
    const bd = new Date(originalDate); bd.setFullYear(year);
    const bdStart = new Date(bd); bdStart.setHours(0, 0, 0, 0);
    const bdEnd = new Date(bd); bdEnd.setHours(23, 59, 59, 999);
    const age = year - realBirthYear;
    instances.push({
      ...event, id: `${event.id}-birthday-${year}`,
      title: `${event.title} (${age}. Geburtstag)`,
      start_time: bdStart.toISOString(), end_time: bdEnd.toISOString(),
      is_all_day: true, _isBirthdayInstance: true, _originalId: event.id,
    });
  }

  return [event, ...instances];
}

async function fetchCalendarData(currentDate: Date, view: string, tenantId: string | undefined): Promise<CalendarEvent[]> {
  if (!tenantId) return [];

  const [startDate, endDate] = getDateRange(currentDate, view);

  const [{ data: regular, error: e1 }, { data: recurring, error: e2 }] = await Promise.all([
    supabase
      .from("appointments")
      .select(APPOINTMENT_SELECT)
      .or(`and(start_time.lte.${endDate.toISOString()},end_time.gte.${startDate.toISOString()}),and(start_time.gte.${startDate.toISOString()},start_time.lte.${endDate.toISOString()})`)
      .is("recurrence_rule", null)
      .order("start_time", { ascending: true }),
    supabase
      .from("appointments")
      .select(APPOINTMENT_SELECT)
      .lte("start_time", endDate.toISOString())
      .or(`recurrence_end_date.is.null,recurrence_end_date.gte.${startDate.toISOString().split("T")[0]}`)
      .not("recurrence_rule", "is", null)
      .order("start_time", { ascending: true }),
  ]);

  if (e1 || e2) { debugConsole.error("Error fetching appointments:", e1 || e2); return []; }

  const regularAppointments: AppointmentRow[] = (regular as AppointmentRow[] | null) ?? [];
  const recurringAppointments: AppointmentRow[] = (recurring as AppointmentRow[] | null) ?? [];
  const appointmentsData: AppointmentRow[] = [...regularAppointments, ...recurringAppointments];

  // Process appointments
  const [
    { data: categoriesData },
    { data: userData },
    { data: leaveRequests },
  ] = await Promise.all([
    supabase.from("appointment_categories").select("id, name, color"),
    supabase.auth.getUser(),
    supabase
      .from("leave_requests")
      .select("*, profiles!leave_requests_user_id_fkey(display_name)")
      .or(`and(start_date.lte.${endDate.toISOString().split("T")[0]},end_date.gte.${startDate.toISOString().split("T")[0]})`)
      .in("status", ["approved", "pending"]),
  ]);

  const categoryMetadata = new Map<string, { id: string; color: string }>();
  (categoriesData as AppointmentCategoryRow[] | null)?.forEach((cat) => categoryMetadata.set(cat.name, { id: cat.id, color: cat.color }));

  const formattedEvents: CalendarEvent[] = [];

  const birthdayContactIds = Array.from(
    new Set(
      appointmentsData
        .filter((appointment) => appointment.category === "birthday" && appointment.contact_id)
        .map((appointment) => appointment.contact_id as string),
    ),
  );

  const { data: birthdayContacts } = birthdayContactIds.length > 0
    ? await supabase.from("contacts").select("id, birthday").in("id", birthdayContactIds)
    : { data: [] as ContactBirthdayRow[] };

  const birthdayByContactId = new Map<string, string>();
  for (const contact of (birthdayContacts as ContactBirthdayRow[] | null) ?? []) {
    if (contact.birthday) {
      birthdayByContactId.set(contact.id, contact.birthday);
    }
  }

  // Expand recurring & birthday events
  const expandedAppointments: AppointmentRow[] = [];
  for (const appointment of appointmentsData) {
    if (appointment.category === "birthday") {
      expandedAppointments.push(...expandBirthdayEvents(appointment, startDate, endDate, birthdayByContactId));
    } else {
      expandedAppointments.push(...expandRecurringEvent(appointment, startDate, endDate));
    }
  }

  const sourceAppointmentIds = Array.from(new Set(expandedAppointments
    .map((a) => (a._originalId ?? a.id) as string).filter(Boolean)));

  const { data: contactsRows } = sourceAppointmentIds.length > 0
    ? await supabase.from("appointment_contacts").select("appointment_id, role, contacts (id, name)").in("appointment_id", sourceAppointmentIds)
    : { data: [] as AppointmentContactRow[] };

  const participantsByAppointmentId = new Map<string, Array<{ id: string; name: string; role: string }>>();
  for (const row of (contactsRows || []) as AppointmentContactRow[]) {
    const appointmentId = row.appointment_id;
    const existing = participantsByAppointmentId.get(appointmentId) || [];
    const contact = extractSingle(row.contacts);
    existing.push({ id: contact?.id || "", name: contact?.name || "Unknown", role: row.role || "participant" });
    participantsByAppointmentId.set(appointmentId, existing);
  }

  for (const appointment of expandedAppointments) {
    const startTime = new Date(appointment.start_time);
    const endTime = new Date(appointment.end_time);
    const durationHours = ((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)).toFixed(1);
    const sourceId = appointment._originalId ?? appointment.id;
    const participants = participantsByAppointmentId.get(sourceId) || [];

    formattedEvents.push({
      id: appointment.id, title: appointment.title,
      description: appointment.description || undefined,
      time: appointment.is_all_day ? "Ganztägig" : startTime.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
      duration: appointment.is_all_day ? "Ganztägig" : `${durationHours}h`,
      date: startTime, endTime,
      location: appointment.location || undefined,
      type: (appointment.category as CalendarEvent["type"]) || "meeting",
      priority: (appointment.priority as CalendarEvent["priority"]) || "medium",
      participants, attendees: participants.length,
      category_color: appointment.category ? categoryMetadata.get(appointment.category)?.color : undefined,
      is_all_day: appointment.is_all_day || false,
      sourceScope: "internal",
      sourceId: appointment.category ? categoryMetadata.get(appointment.category)?.id : undefined,
    });
  }

  // External events
  const { data: externalEvents } = await supabase
    .from("external_events")
    .select(`id, title, description, start_time, end_time, location, all_day, recurrence_rule, external_calendars!inner (id, name, color, user_id, tenant_id)`)
    .or(`and(start_time.lte.${endDate.toISOString()},end_time.gte.${startDate.toISOString()}),and(start_time.gte.${startDate.toISOString()},start_time.lte.${endDate.toISOString()})`)
    .eq("external_calendars.tenant_id", tenantId)
    .order("start_time", { ascending: true });

  if (externalEvents) {
    const expandedExternal: ExternalEventRow[] = [];
    for (const ev of externalEvents as ExternalEventRow[]) expandedExternal.push(...expandRecurringEvent(ev, startDate, endDate));

    for (const ext of expandedExternal) {
      const st = new Date(ext.start_time);
      let et = new Date(ext.end_time);
      const isAllDay = ext.all_day || isExternalAllDayEvent(st, et);
      if (isAllDay) { et = new Date(et); et.setDate(et.getDate() - 1); et.setHours(23, 59, 59, 999); }
      const dur = ((et.getTime() - st.getTime()) / (1000 * 60 * 60)).toFixed(1);
      const externalCalendar = extractSingle<ExternalCalendarJoinRow>(ext.external_calendars as ExternalCalendarJoinRow | ExternalCalendarJoinRow[] | null);
      formattedEvents.push({
        id: `external-${ext.id}`, title: `📅 ${ext.title}`,
        description: ext.description || undefined,
        time: isAllDay ? "Ganztägig" : st.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
        duration: isAllDay ? "Ganztägig" : `${dur}h`,
        date: st, endTime: et, location: ext.location || undefined,
        type: "appointment", priority: "medium", participants: [], attendees: 0,
        category_color: externalCalendar?.color || "#6b7280",
        is_all_day: isAllDay, _isExternal: true,
        sourceScope: "external",
        sourceId: externalCalendar?.id,
      });
    }
  }

  // Event planning blocked times
  const currentUserId = userData.user?.id;
  const { data: eventPlanningData } = await supabase
    .from("event_planning_dates")
    .select(`*, event_plannings (title, user_id)`)
    .gte("date_time", startDate.toISOString())
    .lte("date_time", endDate.toISOString())
    .eq("event_plannings.user_id", currentUserId ?? '');

  if (eventPlanningData) {
    for (const eventDate of eventPlanningData as EventPlanningRow[]) {
      const eventPlanning = extractSingle(eventDate.event_plannings);
      if (eventPlanning) {
        const st = new Date(eventDate.date_time);
        const et = new Date(st.getTime() + 2 * 60 * 60 * 1000);
        formattedEvents.push({
          id: `blocked-${eventDate.id}`, title: `🔒 ${eventPlanning.title}`,
          time: st.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
          duration: "2h", date: st, endTime: et, type: "blocked", priority: "medium",
          participants: [], attendees: 0, sourceScope: "system", sourceId: "event-planning",
        });
      }
    }
  }

  if (leaveRequests) {
    for (const leave of leaveRequests as LeaveRequestRow[]) {
      const ls = new Date(leave.start_date + "T00:00:00");
      const le = new Date(leave.end_date + "T23:59:59");
      const profile = extractSingle(leave.profiles);
      const name = profile?.display_name || "Mitarbeiter";
      const isApproved = leave.status === "approved";
      formattedEvents.push({
        id: `leave-${leave.id}`,
        title: isApproved ? `🏖️ ${name} - Urlaub` : `⏳ ${name} - Urlaubsantrag`,
        time: "Ganztägig", duration: "Ganztägig", date: ls, endTime: le,
        type: isApproved ? "vacation" : "vacation_request", priority: "low",
        is_all_day: true, participants: [], attendees: 0, sourceScope: "system", sourceId: "leave-requests",
      });
    }
  }

  return formattedEvents;
}

export function useCalendarData(currentDate: Date, view: string) {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  // Stable query key based on date range, not exact date object
  const queryKey = useMemo(() => {
    const [start, end] = getDateRange(currentDate, view);
    return ["calendar-data", start.toISOString(), end.toISOString(), currentTenant?.id];
  }, [currentDate, view, currentTenant?.id]);

  const { data: appointments = [], isLoading: loading, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchCalendarData(currentDate, view, currentTenant?.id),
    enabled: view !== "polls" && !!currentTenant,
    placeholderData: (previousData: CalendarEvent[] | undefined) => previousData,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (view === "polls" || !currentTenant?.id) return;

    const prefetchOffset = view === "month" ? 30 : view === "week" ? 7 : 1;
    const prefetchDates = [
      new Date(currentDate.getTime() + prefetchOffset * 24 * 60 * 60 * 1000),
      new Date(currentDate.getTime() - prefetchOffset * 24 * 60 * 60 * 1000),
    ];

    for (const date of prefetchDates) {
      const [start, end] = getDateRange(date, view);
      queryClient.prefetchQuery({
        queryKey: ["calendar-data", start.toISOString(), end.toISOString(), currentTenant.id],
        queryFn: () => fetchCalendarData(date, view, currentTenant.id),
        staleTime: 5 * 60 * 1000,
      });
    }
  }, [currentDate, currentTenant?.id, queryClient, view]);

  const refreshAppointments = () => { refetch(); };

  return { appointments, loading, refreshAppointments };
}
