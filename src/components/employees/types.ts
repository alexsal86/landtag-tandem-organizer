import { eachDayOfInterval, isWeekend } from "date-fns";

export type LeaveType = "vacation" | "sick" | "other" | "medical" | "overtime_reduction";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancel_requested" | "cancelled";

export type EmployeeSettingsRow = {
  user_id: string;
  hours_per_week: number;
  timezone: string;
  workdays: boolean[];
  admin_id?: string | null;
  annual_vacation_days: number;
  employment_start_date: string | null;
  hours_per_month: number;
  days_per_month: number;
  days_per_week: number;
  last_meeting_date?: string | null;
  meeting_interval_months?: number;
  next_meeting_reminder_days?: number;
  carry_over_days?: number;
  carry_over_expires_at?: string | null;
};

export type Profile = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type LeaveRow = {
  id?: string;
  user_id: string;
  type: LeaveType;
  status: LeaveStatus;
  start_date: string;
  end_date?: string;
};

export type PendingLeaveRequest = {
  id: string;
  user_id: string;
  user_name: string;
  type: LeaveType;
  start_date: string;
  end_date: string;
  status: LeaveStatus;
};

export type Employee = EmployeeSettingsRow & Profile & {
  next_meeting_due?: string | null;
  open_meeting_requests?: number;
  last_meeting_id?: string | null;
};

export type LeaveAgg = {
  counts: Record<LeaveType, number>;
  lastDates: Partial<Record<LeaveType, string>>;
  approved: Record<LeaveType, number>;
  pending: Record<LeaveType, number>;
};

/** Calculate working days between two dates (excluding weekends) */
export function calculateWorkingDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = eachDayOfInterval({ start, end });
  return days.filter(day => !isWeekend(day)).length;
}

export function initLeaveAgg(): LeaveAgg {
  return {
    counts: { vacation: 0, sick: 0, other: 0, medical: 0, overtime_reduction: 0 },
    approved: { vacation: 0, sick: 0, other: 0, medical: 0, overtime_reduction: 0 },
    pending: { vacation: 0, sick: 0, other: 0, medical: 0, overtime_reduction: 0 },
    lastDates: {},
  };
}
