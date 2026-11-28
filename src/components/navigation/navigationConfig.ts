import {
  NotebookTabs, Newspaper, MessageSquare, Calendar, CheckSquare, Briefcase,
  Users, MapPin, Database, CalendarPlus, Vote, FileText, Calculator, StickyNote, Tags,
  Shield, Settings, type LucideIcon,
} from "lucide-react";
import { MODULE_ROUTES } from "@/lib/tenant-modules";
import type { ResolvedUserRole } from "@/hooks/useResolvedUserRole";

export interface NavigationAccess {
  role: ResolvedUserRole;
  hasAdminAccess: boolean;
}

export interface NavigationDestination {
  id: string;
  label: string;
  icon: LucideIcon;
  iconName: string;
  route: string;
  keywords?: string;
  permission?: "team" | "admin";
  preview?: "calendar" | "tasks" | "files" | "communication" | "people";
  create?: { label: string; route: string; keywords?: string };
}

export const navigationSections: {
  id: "focus" | "parliament" | "office" | "research";
  label: string;
  items: NavigationDestination[];
}[] = [
  { id: "focus", label: "Mein Tag", items: [
    { id: "mywork", label: "Meine Arbeit", route: "/mywork", icon: NotebookTabs, iconName: "NotebookTabs", keywords: "Heute Dashboard Übersicht Unterschriftenmappe Freigaben",
      create: { label: "Neuer Vorgang", route: "/mywork?tab=cases&action=create-caseitem", keywords: "Anliegen Akte Fall" } },
    { id: "calendar", label: "Kalender", route: "/calendar", icon: Calendar, iconName: "Calendar", keywords: "Termin Terminkalender Sprechstunde", preview: "calendar",
      create: { label: "Neuer Termin", route: "/calendar?action=create-appointment" } },
    { id: "chat", label: "Chat", route: "/chat", icon: MessageSquare, iconName: "MessageSquare", keywords: "Matrix Nachrichten Kommunikation", preview: "communication" },
    { id: "notes", label: "Notizen", route: "/notes", icon: StickyNote, iconName: "StickyNote", keywords: "Notiz Quick Note" },
  ] },
  { id: "parliament", label: "Parlament & Vorgänge", items: [
    { id: "casefiles", label: "Fallakten", route: "/casefiles", icon: Briefcase, iconName: "Briefcase", keywords: "Akte Akten Vorgang Anliegen Fälle", preview: "files",
      create: { label: "Neue Fallakte", route: "/casefiles?action=create-casefile", keywords: "Akte Fall Vorgang" } },
    { id: "contacts", label: "Kontakte", route: "/contacts", icon: Users, iconName: "Users", keywords: "Person Adressbuch Organisation", preview: "people",
      create: { label: "Neuer Kontakt", route: "/contacts?action=new" } },
    { id: "documents", label: "Dokumente", route: "/documents", icon: FileText, iconName: "FileText", keywords: "Datei PDF Presse",
      create: { label: "Dokument hochladen", route: "/documents?action=create-document", keywords: "Datei Upload" } },
    { id: "wissen", label: "Wissen", route: "/wissen", icon: Database, iconName: "Database", keywords: "Wissensdatenbank Themen Fakten Dossier" },
  ] },
  { id: "office", label: "Büro & Team", items: [
    { id: "tasks", label: "Aufgaben", route: "/tasks", icon: CheckSquare, iconName: "CheckSquare", keywords: "Stafette To-do Fristen", preview: "tasks",
      create: { label: "Neue Aufgabe", route: "/tasks?action=create-task" } },
    { id: "decisions", label: "Entscheidungen", route: "/decisions", icon: Vote, iconName: "Vote", keywords: "Abstimmung Beschluss",
      create: { label: "Neue Entscheidung", route: "/decisions?action=create-decision" } },
    { id: "meetings", label: "Jour fixe", route: "/meetings", icon: Calendar, iconName: "Calendar", keywords: "Sitzung Besprechung Protokoll" },
    { id: "eventplanning", label: "Planungen", route: "/eventplanning", icon: CalendarPlus, iconName: "CalendarPlus", keywords: "Veranstaltung Termin Event",
      create: { label: "Neue Planung", route: "/eventplanning?action=create-eventplanning", keywords: "Veranstaltung Termin" } },
    { id: "employee", label: "Team", route: "/employee", icon: Users, iconName: "Users", keywords: "Personal Mitarbeitende", permission: "team" },
  ] },
  { id: "research", label: "Recherche", items: [
    { id: "news", label: "News", route: "/news", icon: Newspaper, iconName: "Newspaper", keywords: "Nachrichten Meldungen RSS" },
    { id: "karten", label: "Karten", route: "/karten", icon: MapPin, iconName: "MapPin", keywords: "Karte Wahlkreis Geografie" },
    { id: "daten", label: "Daten", route: "/daten", icon: Calculator, iconName: "Calculator", keywords: "Statistik Analyse Wahl Ergebnisse" },
  ] },
];

export const topicsDestination: NavigationDestination = {
  id: "themen", label: "Themen", route: "/themen", icon: Tags, iconName: "Tags",
};
export const adminDestination: NavigationDestination = {
  id: "administration", label: "Administration", route: "/administration", icon: Shield, iconName: "Shield", permission: "admin",
};
export const settingsDestination: NavigationDestination = {
  id: "settings", label: "Einstellungen", route: "/settings", icon: Settings, iconName: "Settings",
};
export const lettersDestination: NavigationDestination = {
  id: "letters", label: "Briefverwaltung", route: "/documents?tab=letters", icon: FileText, iconName: "FileText", keywords: "Brief Briefe Schriftverkehr",
};

export function isDestinationAllowed(item: NavigationDestination, access: NavigationAccess) {
  if (item.permission === "team") return access.role === "abgeordneter" || access.role === "bueroleitung";
  if (item.permission === "admin") return access.hasAdminAccess;
  return true;
}

export function sectionForPath(pathname: string) {
  const section = pathname.split("/")[1];
  return section === "letters" ? "documents" : section || "dashboard";
}

export function activeNavigationSection(section: string) {
  switch (section) {
    case "vorgaenge":
    case "cases": return "mywork";
    case "employee-meeting": return "employee";
    default: return section;
  }
}

export function isNavigationModuleAllowed(route: string, isEnabled: (key: string) => boolean) {
  const segment = route.split(/[/?#]/)[1];
  const module = MODULE_ROUTES[segment === "event-planning" ? "eventplanning" : segment];
  return !module || isEnabled(module);
}

export function isSavedRouteAllowed(route: string, access: NavigationAccess) {
  if (!route.startsWith("/") || route.startsWith("//") || route.includes("\\")) return false;
  const section = activeNavigationSection(sectionForPath(route.split(/[?#]/)[0]));
  const destination = [...navigationSections.flatMap(({ items }) => items), adminDestination].find(item => item.id === section);
  return !destination || isDestinationAllowed(destination, access);
}

export function matchesNavigationCommand(query: string, ...fields: string[]) {
  const normalize = (value: string) => value.toLocaleLowerCase("de-DE").normalize("NFD")
    .replace(/\p{Diacritic}/gu, "").replace(/ß/g, "ss");
  const tokenize = (value: string) => normalize(value).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const searchable = tokenize(fields.join(" "));
  return tokenize(query).every(word => searchable.some(candidate => candidate.startsWith(word)));
}
