// Central types and enums for time tracking across admin and employee views

export enum LeaveType {
  Vacation = "vacation",
  Sick = "sick",
  Medical = "medical",
  OvertimeReduction = "overtime_reduction",
  Other = "other",
}

export enum LeaveStatus {
  Pending = "pending",
  Approved = "approved",
  Rejected = "rejected",
  CancelRequested = "cancel_requested",
  Cancelled = "cancelled",
}

export interface MonthlyBreakdown {
  month: Date;
  workedMinutes: number;
  creditMinutes: number;
  targetMinutes: number;
  balance: number;
}

export interface YearlyBalanceResult {
  yearlyBalance: number;
  yearlyBreakdown: MonthlyBreakdown[];
  loading: boolean;
}

export interface EmployeeSettingsBase {
  hours_per_week: number;
  days_per_week: number;
}
