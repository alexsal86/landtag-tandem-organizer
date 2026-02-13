import {
  Home,
  MessageSquare,
  Calendar,
  CheckSquare,
  Briefcase,
  Users,
  MoreHorizontal,
  MapPin,
  Database,
  CalendarPlus,
  Vote,
  FileText,
  Archive,
  Phone,
} from "lucide-react";

export interface NavSubItem {
  id: string;
  label: string;
  icon: typeof Home;
}

export interface NavGroup {
  id: string;
  label: string;
  icon: typeof Home;
  subItems?: NavSubItem[];
  route?: string;
  adminOnly?: boolean;
}

// Main navigation groups
export const navigationGroups: NavGroup[] = [
  {
    id: "mywork",
    label: "Meine Arbeit",
    icon: Home,
    route: "/mywork"
  },
  {
    id: "communication",
    label: "Chat",
    icon: MessageSquare,
    subItems: [
      { id: "chat", label: "Chat", icon: MessageSquare },
    ]
  },
  {
    id: "calendar",
    label: "Kalender",
    icon: Calendar,
    subItems: [
      { id: "calendar", label: "Terminkalender", icon: Calendar },
      { id: "eventplanning", label: "Planungen", icon: CalendarPlus },
    ]
  },
  {
    id: "tasks",
    label: "Aufgaben",
    icon: CheckSquare,
    subItems: [
      { id: "tasks", label: "Aufgaben", icon: CheckSquare },
      { id: "decisions", label: "Entscheidungen", icon: Vote },
      { id: "meetings", label: "Jour fixe", icon: Calendar },
    ]
  },
  {
    id: "files",
    label: "Akten",
    icon: Briefcase,
    subItems: [
      { id: "casefiles", label: "FallAkten", icon: Briefcase },
      { id: "documents", label: "Dokumente", icon: FileText },
      { id: "drucksachen", label: "Drucksachen", icon: Archive },
      { id: "knowledge", label: "Wissen", icon: Database },
    ]
  },
  {
    id: "people",
    label: "Kontakte",
    icon: Users,
    route: "/contacts"
  },
  {
    id: "more",
    label: "Mehr",
    icon: MoreHorizontal,
    subItems: [
      { id: "karten", label: "Karten", icon: MapPin },
      { id: "calls", label: "Anrufe", icon: Phone },
    ]
  }
];

export function getNavigationGroups(): NavGroup[] {
  return navigationGroups;
}
