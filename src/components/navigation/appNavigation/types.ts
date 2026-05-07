export type ActivePanel = 'home' | 'notifications' | 'casefiles' | 'appointments';
export type NotificationFilter = 'unread' | 'all';
export type QuickAccessAddCategory = 'pages' | 'case-items' | 'documents' | 'event-plannings';

export interface NavigationProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  isMobile?: boolean;
}

export type UpcomingAppointmentItem = {
  id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  is_all_day: boolean;
};
