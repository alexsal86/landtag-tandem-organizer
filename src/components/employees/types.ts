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

export type EmployeeRow = Employee;

export type EmployeeStatus = "active" | "inactive" | "unknown";

export type EmployeeFilter = {
  query?: string;
  status?: EmployeeStatus;
  hasPendingLeaves?: boolean;
  hasOverdueMeetings?: boolean;
};

export type EmployeeTableAction =
  | "update_hours"
  | "update_days_per_week"
  | "update_days_per_month"
  | "update_vacation_days"
  | "update_start_date"
  | "schedule_meeting";

export type EmployeeMutationDTO<TData> = {
  ok: boolean;
  action: EmployeeTableAction | "leave_action" | "cancel_approval";
  data: TData | null;
  errorMessage: string | null;
};

export type EmployeeMutationActionResult = {
  userId: string;
  field: "hours_per_week" | "days_per_week" | "days_per_month" | "annual_vacation_days" | "employment_start_date" | "leave_status";
  value: number | string;
};

export type LeaveAgg = {
  counts: Record<LeaveType, number>;
  lastDates: Partial<Record<LeaveType, string>>;
  approved: Record<LeaveType, number>;
  pending: Record<LeaveType, number>;
};

export type EmployeeMeetingType =
  | "annual_review"
  | "probation_review"
  | "development_review"
  | "regular"
  | "probation"
  | "development"
  | "performance"
  | "conflict";

export type EmployeeMeetingStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "cancelled_by_employee"
  | "rescheduled";

export type MeetingPreparationData = {
  notes?: string;
  private_notes?: string;
};

export type ProtocolData = {
  wellbeing_mood?: string;
  wellbeing_workload?: string;
  wellbeing_balance?: string;
  wellbeing_mood_rating?: number;
  wellbeing_workload_rating?: number;
  wellbeing_balance_rating?: number;
  review_successes?: string;
  review_challenges?: string;
  review_learnings?: string;
  projects_status?: string;
  projects_blockers?: string;
  projects_support?: string;
  development_skills?: string;
  development_training?: string;
  development_career?: string;
  team_dynamics?: string;
  team_communication?: string;
  goals?: string;
  feedback_mutual?: string;
  next_steps?: string;
};

export type ActionItemOwner = "employee" | "supervisor" | "both";
export type ActionItemStatus = "open" | "in_progress" | "completed";

export type ActionItem = {
  id?: string;
  description: string;
  owner: ActionItemOwner;
  assigned_to?: string;
  due_date?: string;
  status: ActionItemStatus;
  notes?: string;
  completed_at?: string;
  created_at?: string;
  updated_at?: string;
  meeting_id?: string;
  tenant_id?: string;
  task_id?: string;
};

type MeetingParticipant = {
  display_name?: string | null;
};

export type EmployeeMeeting = {
  id: string;
  employee_id: string;
  conducted_by: string;
  meeting_date: string;
  meeting_type: EmployeeMeetingType;
  status: EmployeeMeetingStatus;
  protocol_data?: ProtocolData | null;
  employee_preparation?: MeetingPreparationData | null;
  supervisor_preparation?: MeetingPreparationData | null;
  shared_during_meeting?: boolean | null;
  cancellation_reason?: string | null;
  reschedule_request_reason?: string | null;
  employee_name?: string;
  supervisor_name?: string;
  employee?: MeetingParticipant | null;
  supervisor?: MeetingParticipant | null;
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
