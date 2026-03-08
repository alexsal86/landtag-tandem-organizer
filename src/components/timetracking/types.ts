export interface TimeEntryRow {
  id: string;
  work_date: string;
  started_at: string | null;
  ended_at: string | null;
  minutes: number | null;
  pause_minutes?: number | null;
  notes: string | null;
  edited_by?: string | null;
  edited_at?: string | null;
  edit_reason?: string | null;
  created_at?: string;
  user_id?: string;
}

export interface EmployeeSettingsRow {
  user_id: string;
  hours_per_month: number;
  days_per_month: number;
  hours_per_week: number;
  days_per_week: number;
  annual_vacation_days: number;
  carry_over_days: number;
  carry_over_expires_at: string | null;
  employment_start_date: string | null;
}

export interface LeaveRow {
  id: string;
  type: "vacation" | "sick" | "other" | "medical" | "overtime_reduction";
  start_date: string;
  end_date: string;
  status: string;
  reason: string | null;
  medical_reason?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  minutes_counted?: number | null;
}

export interface HistoryRow {
  id: string;
  entry_date: string;
  started_at: string | null;
  ended_at: string | null;
  minutes: number | null;
  pause_minutes: number | null;
  notes: string | null;
  change_type: string;
  changed_at: string;
}

export interface HolidayRow {
  id: string;
  holiday_date: string;
  name: string;
  is_nationwide?: boolean;
  state?: string | null;
}

export const MAX_PAUSE_MINUTES = 180;

export const fmt = (m: number) =>
  `${m < 0 ? "-" : ""}${Math.floor(Math.abs(m) / 60)}:${(Math.abs(m) % 60).toString().padStart(2, "0")}`;

export const getMedicalReasonLabel = (reason: string | null | undefined) => {
  const labels: Record<string, string> = {
    acute: "Akuter Arztbesuch",
    specialist: "Facharzttermin",
    follow_up: "Nachsorge",
    pregnancy: "Schwangerschaft",
  };
  return labels[reason || ""] || reason || "-";
};
