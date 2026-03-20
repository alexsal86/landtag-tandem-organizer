export interface Employee {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  hours_per_week: number;
  days_per_week: number;
}

export interface TimeEntry {
  id: string;
  user_id: string;
  work_date: string;
  started_at: string | null;
  ended_at: string | null;
  minutes: number | null;
  pause_minutes: number | null;
  notes: string | null;
  edited_by: string | null;
  edited_at: string | null;
  edit_reason: string | null;
}

export interface LeaveRequest {
  id: string;
  user_id: string;
  type: string;
  status: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  medical_reason?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  minutes_counted?: number | null;
  created_at: string;
}

export interface Correction {
  id: string;
  user_id: string;
  correction_date: string;
  correction_minutes: number;
  reason: string;
  created_by: string;
  created_at: string | null;
  creator_name?: string;
}

export interface PublicHoliday {
  id: string;
  holiday_date: string;
  name: string;
}
