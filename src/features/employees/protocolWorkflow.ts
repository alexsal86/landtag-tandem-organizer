import type { EmployeeMeetingStatus } from "@/components/employees/types";

export const isProtocolLocked = (status: EmployeeMeetingStatus): boolean =>
  status === "pending_acknowledgement" || status === "acknowledged";

export const canEditProtocol = (status: EmployeeMeetingStatus): boolean =>
  status === "scheduled" || status === "in_progress";
