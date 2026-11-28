import type { NavigationDestination } from "../navigationConfig";

export type NavPreviewGroup = NonNullable<NavigationDestination["preview"]>;
export type QuickAccessAddCategory = "pages" | "case-items" | "documents" | "event-plannings";

export interface NavigationProps {
  activeSection: string;
  isMobile?: boolean;
  onNavigate?: () => void;
  onFollowHelpHint?: () => void;
}

export type UpcomingAppointmentItem = {
  id: string;
  title: string;
  start_time: string;
  end_time?: string | null;
  location?: string | null;
  is_all_day: boolean;
  briefingStatus?: string;
  isExternal?: boolean;
};
