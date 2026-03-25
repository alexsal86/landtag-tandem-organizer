import type { ChecklistItem, Collaborator, EventPlanning, Profile } from "@/components/event-planning/types";

export type ChecklistItemModel = ChecklistItem;

export interface ChecklistAutomationActionConfig {
  guest_count?: number;
  sent_count?: number;
  rsvp_url?: string;
  planner_url?: string;
  label?: string;
}

export interface ChecklistAutomationAction {
  id: string;
  action_type: "rsvp" | "social_media" | "email" | "social_planner";
  is_enabled?: boolean;
  action_config?: ChecklistAutomationActionConfig;
}

export interface EventPlanningListRowModel {
  planning: EventPlanning;
  isCompleted: boolean;
  creatorBadgeColor?: string | null;
  collaborators: ReadonlyArray<Collaborator>;
}

export interface AppointmentContactRef {
  id: string;
  name?: string;
  first_name?: string | null;
  last_name?: string | null;
}

export interface AppointmentGuestInput {
  name: string;
  email: string;
}

export interface CreateAppointmentPayload {
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
  priority: "low" | "medium" | "high" | "urgent";
  category: string;
  status: string;
  reminder_minutes: number;
  user_id: string;
  tenant_id: string;
  is_all_day: boolean;
  has_external_guests: boolean;
}

export interface ProfileBadgeModel extends Profile {
  badge_color?: string | null;
}
