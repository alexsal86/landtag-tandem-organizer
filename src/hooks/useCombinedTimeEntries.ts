import { useMemo } from "react";
import { format, parseISO, eachDayOfInterval } from "date-fns";

interface TimeEntryRow {
  id: string;
  work_date: string;
  started_at: string | null;
  ended_at: string | null;
  minutes: number | null;
  pause_minutes?: number;
  notes: string | null;
  edited_by?: string | null;
  edited_at?: string | null;
  edit_reason?: string | null;
}

interface LeaveRow {
  id: string;
  type: string;
  start_date: string;
  end_date: string;
  status: string;
  reason: string | null;
  medical_reason?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  minutes_counted?: number | null;
}

interface HolidayRow {
  id: string;
  holiday_date: string;
  name: string;
  is_nationwide?: boolean;
  state?: string | null;
}

export interface CombinedTimeEntry {
  id: string;
  work_date: string;
  started_at: string | null;
  ended_at: string | null;
  minutes: number | null;
  pause_minutes: number;
  notes: string | null;
  entry_type: 'work' | 'sick' | 'vacation' | 'holiday' | 'medical' | 'overtime_reduction';
  is_editable: boolean;
  is_deletable: boolean;
  leave_id?: string;
  holiday_id?: string;
  type_label: string | null;
  type_icon: string;
  type_class: string;
  edited_by?: string | null;
  edited_at?: string | null;
  edit_reason?: string | null;
}

interface UseCombinedTimeEntriesParams {
  entries: TimeEntryRow[];
  sickLeaves: LeaveRow[];
  vacationLeaves: LeaveRow[];
  medicalLeaves: LeaveRow[];
  overtimeLeaves: LeaveRow[];
  holidays: HolidayRow[];
  monthStart: Date;
  monthEnd: Date;
  dailyMinutes: number;
}

const typeConfig = {
  work: { icon: '', label: null, className: '' },
  sick: { icon: '🤒', label: 'Krankheit', className: 'bg-orange-50 dark:bg-orange-950/20' },
  vacation: { icon: '🏖️', label: 'Urlaub', className: 'bg-blue-50 dark:bg-blue-950/20' },
  holiday: { icon: '🎉', label: 'Feiertag', className: 'bg-green-50 dark:bg-green-950/20' },
  medical: { icon: '🏥', label: 'Arzttermin', className: 'bg-purple-50 dark:bg-purple-950/20' },
  overtime_reduction: { icon: '⏰', label: 'Überstundenabbau', className: 'bg-amber-50 dark:bg-amber-950/20' },
};

export function useCombinedTimeEntries({
  entries,
  sickLeaves,
  vacationLeaves,
  medicalLeaves,
  overtimeLeaves,
  holidays,
  monthStart,
  monthEnd,
  dailyMinutes,
}: UseCombinedTimeEntriesParams): CombinedTimeEntry[] {
  return useMemo(() => {
    const combined: CombinedTimeEntry[] = [];
    const config = typeConfig;

    // Build date sets for priority checks
    const holidayDates = new Set(
      holidays
        .filter(h => {
          const d = parseISO(h.holiday_date);
          return d >= monthStart && d <= monthEnd && d.getDay() !== 0 && d.getDay() !== 6;
        })
        .map(h => h.holiday_date)
    );

    const sickDates = new Set<string>();
    sickLeaves.filter(l => l.status === 'approved').forEach(leave => {
      try {
        eachDayOfInterval({ start: parseISO(leave.start_date), end: parseISO(leave.end_date) })
          .filter(d => d >= monthStart && d <= monthEnd && d.getDay() !== 0 && d.getDay() !== 6)
          .forEach(day => sickDates.add(format(day, 'yyyy-MM-dd')));
      } catch (e) {
        console.error('Error processing sick leave dates:', e);
      }
    });

    const vacationDates = new Set<string>();
    vacationLeaves.filter(l => l.status === 'approved').forEach(leave => {
      try {
        eachDayOfInterval({ start: parseISO(leave.start_date), end: parseISO(leave.end_date) })
          .filter(d => d >= monthStart && d <= monthEnd && d.getDay() !== 0 && d.getDay() !== 6)
          .forEach(day => vacationDates.add(format(day, 'yyyy-MM-dd')));
      } catch (e) {
        console.error('Error processing vacation dates:', e);
      }
    });

    const overtimeDates = new Set<string>();
    overtimeLeaves.filter(l => l.status === 'approved').forEach(leave => {
      try {
        eachDayOfInterval({ start: parseISO(leave.start_date), end: parseISO(leave.end_date) })
          .filter(d => d >= monthStart && d <= monthEnd && d.getDay() !== 0 && d.getDay() !== 6)
          .forEach(day => overtimeDates.add(format(day, 'yyyy-MM-dd')));
      } catch (e) {
        console.error('Error processing overtime dates:', e);
      }
    });

    // PRIORITY 1: Holidays (ALWAYS shown, highest priority)
    holidays.forEach(holiday => {
      try {
        const holidayDate = parseISO(holiday.holiday_date);
        if (holidayDate < monthStart || holidayDate > monthEnd) return;
        if (holidayDate.getDay() === 0 || holidayDate.getDay() === 6) return;

        combined.push({
          id: `holiday-${holiday.id}`,
          work_date: holiday.holiday_date,
          started_at: null,
          ended_at: null,
          minutes: dailyMinutes,
          pause_minutes: 0,
          notes: holiday.name,
          entry_type: 'holiday',
          is_editable: false,
          is_deletable: false,
          holiday_id: holiday.id,
          type_label: config.holiday.label,
          type_icon: config.holiday.icon,
          type_class: config.holiday.className,
        });
      } catch (e) {
        console.error('Error processing holiday:', e);
      }
    });

    // PRIORITY 2: Sick leaves (only if NOT a holiday)
    sickLeaves
      .filter(l => l.status === 'approved')
      .forEach(leave => {
        try {
          eachDayOfInterval({
            start: parseISO(leave.start_date),
            end: parseISO(leave.end_date),
          })
            .filter(d => d >= monthStart && d <= monthEnd)
            .filter(d => d.getDay() !== 0 && d.getDay() !== 6)
            .forEach(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              // Skip if holiday takes priority
              if (holidayDates.has(dateStr)) return;
              // Skip if already added
              if (combined.some(c => c.work_date === dateStr)) return;

              combined.push({
                id: `sick-${leave.id}-${dateStr}`,
                work_date: dateStr,
                started_at: null,
                ended_at: null,
                minutes: dailyMinutes,
                pause_minutes: 0,
                notes: leave.reason || 'Krankheit',
                entry_type: 'sick',
                is_editable: false,
                is_deletable: false,
                leave_id: leave.id,
                type_label: config.sick.label,
                type_icon: config.sick.icon,
                type_class: config.sick.className,
              });
            });
        } catch (e) {
          console.error('Error processing sick leave:', e);
        }
      });

    // PRIORITY 3: Vacation leaves (only if NOT a holiday and NOT sick)
    vacationLeaves
      .filter(l => l.status === 'approved')
      .forEach(leave => {
        try {
          eachDayOfInterval({
            start: parseISO(leave.start_date),
            end: parseISO(leave.end_date),
          })
            .filter(d => d >= monthStart && d <= monthEnd)
            .filter(d => d.getDay() !== 0 && d.getDay() !== 6)
            .forEach(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              // Skip if holiday or sick takes priority
              if (holidayDates.has(dateStr)) return;
              if (sickDates.has(dateStr)) return;
              // Skip if already added
              if (combined.some(c => c.work_date === dateStr)) return;

              combined.push({
                id: `vacation-${leave.id}-${dateStr}`,
                work_date: dateStr,
                started_at: null,
                ended_at: null,
                minutes: dailyMinutes,
                pause_minutes: 0,
                notes: leave.reason || 'Urlaub',
                entry_type: 'vacation',
                is_editable: false,
                is_deletable: false,
                leave_id: leave.id,
                type_label: config.vacation.label,
                type_icon: config.vacation.icon,
                type_class: config.vacation.className,
              });
            });
        } catch (e) {
          console.error('Error processing vacation leave:', e);
        }
      });

    // PRIORITY 4: Overtime reduction (only if no higher priority)
    overtimeLeaves
      .filter(l => l.status === 'approved')
      .forEach(leave => {
        try {
          eachDayOfInterval({
            start: parseISO(leave.start_date),
            end: parseISO(leave.end_date),
          })
            .filter(d => d >= monthStart && d <= monthEnd)
            .filter(d => d.getDay() !== 0 && d.getDay() !== 6)
            .forEach(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              // Skip if higher priority exists
              if (holidayDates.has(dateStr)) return;
              if (sickDates.has(dateStr)) return;
              if (vacationDates.has(dateStr)) return;
              if (combined.some(c => c.work_date === dateStr)) return;

              combined.push({
                id: `overtime-${leave.id}-${dateStr}`,
                work_date: dateStr,
                started_at: null,
                ended_at: null,
                minutes: dailyMinutes,
                pause_minutes: 0,
                notes: leave.reason || 'Überstundenabbau',
                entry_type: 'overtime_reduction',
                is_editable: false,
                is_deletable: false,
                leave_id: leave.id,
                type_label: config.overtime_reduction.label,
                type_icon: config.overtime_reduction.icon,
                type_class: config.overtime_reduction.className,
              });
            });
        } catch (e) {
          console.error('Error processing overtime leave:', e);
        }
      });

    // PRIORITY 5: Medical appointments (can coexist with work)
    medicalLeaves
      .filter(l => l.status === 'approved')
      .forEach(leave => {
        try {
          const dateStr = leave.start_date;
          const date = parseISO(dateStr);
          if (date < monthStart || date > monthEnd) return;

          combined.push({
            id: `medical-${leave.id}`,
            work_date: dateStr,
            started_at: leave.start_time ? `${dateStr}T${leave.start_time}` : null,
            ended_at: leave.end_time ? `${dateStr}T${leave.end_time}` : null,
            minutes: leave.minutes_counted || dailyMinutes,
            pause_minutes: 0,
            notes: `${leave.medical_reason || 'Arzttermin'}${leave.reason ? ': ' + leave.reason : ''}`,
            entry_type: 'medical',
            is_editable: false,
            is_deletable: false,
            leave_id: leave.id,
            type_label: config.medical.label,
            type_icon: config.medical.icon,
            type_class: config.medical.className,
          });
        } catch (e) {
          console.error('Error processing medical leave:', e);
        }
      });

    // PRIORITY 6: Work entries (ONLY if no holiday/sick/vacation/overtime on that day)
    entries.forEach(e => {
      const dateStr = e.work_date;

      // IMPORTANT: Skip work entries on holidays/leave days
      if (holidayDates.has(dateStr)) {
        console.warn(`Arbeitseintrag an Feiertag ignoriert: ${dateStr}`);
        return;
      }
      if (sickDates.has(dateStr)) {
        console.warn(`Arbeitseintrag an Krankheitstag ignoriert: ${dateStr}`);
        return;
      }
      if (vacationDates.has(dateStr)) {
        console.warn(`Arbeitseintrag an Urlaubstag ignoriert: ${dateStr}`);
        return;
      }
      if (overtimeDates.has(dateStr)) {
        console.warn(`Arbeitseintrag an Überstundenabbau-Tag ignoriert: ${dateStr}`);
        return;
      }

      combined.push({
        id: e.id,
        work_date: e.work_date,
        started_at: e.started_at,
        ended_at: e.ended_at,
        minutes: e.minutes,
        pause_minutes: e.pause_minutes || 0,
        notes: e.notes,
        entry_type: 'work',
        is_editable: true,
        is_deletable: true,
        type_label: config.work.label,
        type_icon: config.work.icon,
        type_class: config.work.className,
        edited_by: e.edited_by,
        edited_at: e.edited_at,
        edit_reason: e.edit_reason,
      });
    });

    // Sort by date descending
    combined.sort((a, b) => new Date(b.work_date).getTime() - new Date(a.work_date).getTime());

    return combined;
  }, [entries, sickLeaves, vacationLeaves, medicalLeaves, overtimeLeaves, holidays, monthStart, monthEnd, dailyMinutes]);
}
