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

    // 1. Regular work entries
    entries.forEach(e => {
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
      });
    });

    // 2. Approved sick leaves
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
              // Skip if already a work entry on this day
              if (combined.some(c => c.work_date === dateStr && c.entry_type === 'work')) return;
              
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

    // 3. Approved vacation leaves
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

    // 4. Holidays in month (only if not weekend and no other entry)
    holidays.forEach(holiday => {
      try {
        const holidayDate = parseISO(holiday.holiday_date);
        if (holidayDate < monthStart || holidayDate > monthEnd) return;
        if (holidayDate.getDay() === 0 || holidayDate.getDay() === 6) return;
        
        const dateStr = holiday.holiday_date;
        if (combined.some(c => c.work_date === dateStr)) return;
        
        combined.push({
          id: `holiday-${holiday.id}`,
          work_date: dateStr,
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

    // 5. Approved medical appointments
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

    // 6. Approved overtime reduction
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

    // Sort by date descending
    combined.sort((a, b) => new Date(b.work_date).getTime() - new Date(a.work_date).getTime());

    return combined;
  }, [entries, sickLeaves, vacationLeaves, medicalLeaves, overtimeLeaves, holidays, monthStart, monthEnd, dailyMinutes]);
}
