import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { rrulestr } from "rrule";
import type { CalendarEvent } from "../types";

const APPOINTMENT_SELECT = `
  id, title, description, start_time, end_time, category, priority,
  location, status, is_all_day, meeting_id, contact_id, poll_id,
  reminder_minutes, recurrence_rule, recurrence_end_date
`;

export function useCalendarData(currentDate: Date, view: string) {
  const { currentTenant } = useTenant();
  const [appointments, setAppointments] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (view === "polls") return;
    fetchAppointments();
  }, [currentDate, view, currentTenant]);

  const getDateRange = (): [Date, Date] => {
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
    // day / agenda
    const start = new Date(currentDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(currentDate);
    end.setHours(23, 59, 59, 999);
    return [start, end];
  };

  const fetchAppointments = async () => {
    if (!currentTenant) return;
    try {
      setLoading(true);
      const [startDate, endDate] = getDateRange();

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
          .not("recurrence_rule", "is", null)
          .order("start_time", { ascending: true }),
      ]);

      if (e1 || e2) {
        console.error("Error fetching appointments:", e1 || e2);
        return;
      }

      const appointmentsData = [...(regular || []), ...(recurring || [])];
      await processAppointments(appointmentsData, startDate, endDate);
    } catch (error) {
      console.error("Error fetching appointments:", error);
    } finally {
      setLoading(false);
    }
  };

  const processAppointments = async (appointmentsData: any[], startDate: Date, endDate: Date) => {
    try {
      const { data: categoriesData } = await supabase
        .from("appointment_categories")
        .select("name, color");

      const categoryColors = new Map<string, string>();
      categoriesData?.forEach((cat: any) => categoryColors.set(cat.name, cat.color));

      const formattedEvents: CalendarEvent[] = [];

      // Expand recurring & birthday events
      const expandedAppointments: any[] = [];
      for (const appointment of appointmentsData) {
        if (appointment.category === "birthday") {
          const events = await expandBirthdayEvents(appointment, startDate, endDate);
          expandedAppointments.push(...events);
        } else {
          expandedAppointments.push(...expandRecurringEvent(appointment, startDate, endDate));
        }
      }

      for (const appointment of expandedAppointments) {
        const startTime = new Date(appointment.start_time);
        const endTime = new Date(appointment.end_time);
        const durationHours = ((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)).toFixed(1);

        const { data: contactsData } = await supabase
          .from("appointment_contacts")
          .select(`role, contacts (id, name)`)
          .eq("appointment_id", appointment.id);

        const participants = contactsData?.map((c: any) => ({
          id: c.contacts?.id || "",
          name: c.contacts?.name || "Unknown",
          role: c.role || "participant",
        })) || [];

        formattedEvents.push({
          id: appointment.id,
          title: appointment.title,
          description: appointment.description || undefined,
          time: appointment.is_all_day ? "Ganztägig" : startTime.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
          duration: appointment.is_all_day ? "Ganztägig" : `${durationHours}h`,
          date: startTime,
          endTime,
          location: appointment.location || undefined,
          type: (appointment.category as CalendarEvent["type"]) || "meeting",
          priority: (appointment.priority as CalendarEvent["priority"]) || "medium",
          participants,
          attendees: participants.length,
          category_color: categoryColors.get(appointment.category),
          is_all_day: appointment.is_all_day || false,
        });
      }

      // External events
      if (currentTenant) {
        const { data: externalEvents } = await supabase
          .from("external_events")
          .select(`*, external_calendars!inner (name, color, calendar_type, user_id, tenant_id)`)
          .or(`and(start_time.lte.${endDate.toISOString()},end_time.gte.${startDate.toISOString()}),and(start_time.gte.${startDate.toISOString()},start_time.lte.${endDate.toISOString()})`)
          .eq("external_calendars.tenant_id", currentTenant.id)
          .order("start_time", { ascending: true });

        if (externalEvents) {
          const expandedExternal: any[] = [];
          for (const ev of externalEvents) {
            expandedExternal.push(...expandRecurringEvent(ev, startDate, endDate));
          }

          for (const ext of expandedExternal) {
            const st = new Date(ext.start_time);
            let et = new Date(ext.end_time);
            const isAllDay = ext.all_day || isExternalAllDayEvent(st, et);

            if (isAllDay) {
              et = new Date(et);
              et.setDate(et.getDate() - 1);
              et.setHours(23, 59, 59, 999);
            }

            const dur = ((et.getTime() - st.getTime()) / (1000 * 60 * 60)).toFixed(1);
            formattedEvents.push({
              id: `external-${ext.id}`,
              title: `📅 ${ext.title}`,
              description: ext.description || undefined,
              time: isAllDay ? "Ganztägig" : st.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
              duration: isAllDay ? "Ganztägig" : `${dur}h`,
              date: st,
              endTime: et,
              location: ext.location || undefined,
              type: "appointment",
              priority: "medium",
              participants: [],
              attendees: 0,
              category_color: ext.external_calendars?.color || "#6b7280",
              is_all_day: isAllDay,
              _isExternal: true,
            });
          }
        }
      }

      // Event planning blocked times
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData.user?.id;

      const { data: eventPlanningData } = await supabase
        .from("event_planning_dates")
        .select(`*, event_plannings (title, user_id)`)
        .gte("date_time", startDate.toISOString())
        .lte("date_time", endDate.toISOString())
        .eq("event_plannings.user_id", currentUserId);

      if (eventPlanningData) {
        for (const eventDate of eventPlanningData) {
          if (eventDate.event_plannings) {
            const st = new Date(eventDate.date_time);
            const et = new Date(st.getTime() + 2 * 60 * 60 * 1000);
            formattedEvents.push({
              id: `blocked-${eventDate.id}`,
              title: `🔒 ${(eventDate.event_plannings as any).title}`,
              time: st.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
              duration: "2h",
              date: st,
              endTime: et,
              type: "blocked",
              priority: "medium",
              participants: [],
              attendees: 0,
            });
          }
        }
      }

      // Vacation / vacation request events
      const { data: leaveRequests } = await supabase
        .from("leave_requests")
        .select("*, profiles!leave_requests_user_id_fkey(display_name)")
        .or(`and(start_date.lte.${endDate.toISOString().split("T")[0]},end_date.gte.${startDate.toISOString().split("T")[0]})`)
        .in("status", ["approved", "pending"]);

      if (leaveRequests) {
        for (const leave of leaveRequests) {
          const ls = new Date(leave.start_date + "T00:00:00");
          const le = new Date(leave.end_date + "T23:59:59");
          const name = (leave.profiles as any)?.display_name || "Mitarbeiter";
          const isApproved = leave.status === "approved";

          formattedEvents.push({
            id: `leave-${leave.id}`,
            title: isApproved ? `🏖️ ${name} - Urlaub` : `⏳ ${name} - Urlaubsantrag`,
            time: "Ganztägig",
            duration: "Ganztägig",
            date: ls,
            endTime: le,
            type: isApproved ? "vacation" : "vacation_request",
            priority: "low",
            is_all_day: true,
            participants: [],
            attendees: 0,
          });
        }
      }

      setAppointments(formattedEvents);
    } catch (error) {
      console.error("Error processing appointments:", error);
      setAppointments([]);
    }
  };

  const refreshAppointments = () => fetchAppointments();

  return { appointments, loading, refreshAppointments };
}

// ── Helpers ──

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function isExternalAllDayEvent(start: Date, end: Date): boolean {
  const sm = start.getHours() === 0 && start.getMinutes() === 0 && start.getSeconds() === 0;
  const em = end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0;
  const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  return sm && em && diff === 1;
}

function expandRecurringEvent(event: any, startDate: Date, endDate: Date): any[] {
  if (!event.recurrence_rule) return [event];
  try {
    const rule = rrulestr(event.recurrence_rule, { dtstart: new Date(event.start_time) });
    const expanded = event.recurrence_rule.includes("FREQ=YEARLY") || event.category === "birthday"
      ? (() => {
          const es = new Date(startDate);
          es.setFullYear(es.getFullYear() - 1);
          const ee = new Date(endDate);
          ee.setFullYear(ee.getFullYear() + 2);
          return rule.between(es, ee, true).filter(o => o >= startDate && o <= endDate);
        })()
      : rule.between(startDate, endDate, true);

    return expanded.map((occurrence, index) => {
      const origStart = new Date(event.start_time);
      const origEnd = new Date(event.end_time);
      const newStart = new Date(occurrence);

      let newEnd: Date;
      if (event.is_all_day || event.category === "birthday") {
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
  } catch {
    return [event];
  }
}

async function expandBirthdayEvents(event: any, startDate: Date, endDate: Date): Promise<any[]> {
  if (event.category !== "birthday" || !event.contact_id) return [event];
  try {
    const { data: contact } = await supabase.from("contacts").select("birthday").eq("id", event.contact_id).single();
    if (!contact?.birthday) return [event];

    const originalDate = new Date(event.start_time);
    const realBirthYear = new Date(contact.birthday).getFullYear();
    const maxYear = realBirthYear + 99;
    const startYear = startDate.getFullYear();
    const endYear = Math.min(endDate.getFullYear(), maxYear);

    const instances = [];
    for (let year = startYear; year <= endYear; year++) {
      if (year === originalDate.getFullYear()) continue;
      const bd = new Date(originalDate);
      bd.setFullYear(year);
      const bdStart = new Date(bd); bdStart.setHours(0, 0, 0, 0);
      const bdEnd = new Date(bd); bdEnd.setHours(23, 59, 59, 999);
      const age = year - realBirthYear;
      instances.push({
        ...event,
        id: `${event.id}-birthday-${year}`,
        title: `${event.title} (${age}. Geburtstag)`,
        start_time: bdStart.toISOString(),
        end_time: bdEnd.toISOString(),
        is_all_day: true,
        _isBirthdayInstance: true,
        _originalId: event.id,
      });
    }
    return [event, ...instances];
  } catch {
    return [event];
  }
}
