import {
  Bell, BriefcaseBusiness, CalendarDays, ClipboardCheck, Clock, FileText,
  Flag, Hand, Handshake, House, Landmark, List, ListTodo, Mail, MapPin,
  Megaphone, MessagesSquare, Phone, Scale, Users,
} from "lucide-react";

export type AgendaIconConfig = { name: string; color: string };

export const agendaIcons = {
  hand: { icon: Hand, label: "Begrüßung" },
  list: { icon: List, label: "Tagesordnung" },
  tasks: { icon: ListTodo, label: "Aufgaben" },
  calendar: { icon: CalendarDays, label: "Termine" },
  clock: { icon: Clock, label: "Zeitplanung" },
  briefcase: { icon: BriefcaseBusiness, label: "Büro" },
  users: { icon: Users, label: "Team" },
  messages: { icon: MessagesSquare, label: "Austausch" },
  phone: { icon: Phone, label: "Telefon" },
  mail: { icon: Mail, label: "Post" },
  file: { icon: FileText, label: "Dokumente" },
  checklist: { icon: ClipboardCheck, label: "Nachbereitung" },
  landmark: { icon: Landmark, label: "Landtag" },
  scale: { icon: Scale, label: "Entscheidungen" },
  map: { icon: MapPin, label: "Wahlkreis" },
  house: { icon: House, label: "Bürgersprechstunde" },
  handshake: { icon: Handshake, label: "Zusammenarbeit" },
  megaphone: { icon: Megaphone, label: "Öffentlichkeitsarbeit" },
  flag: { icon: Flag, label: "Prioritäten" },
  bell: { icon: Bell, label: "Erinnerungen" },
};

export const agendaIconColors = [
  { value: "#475569", label: "Schiefergrau" },
  { value: "#1D4ED8", label: "Blau" },
  { value: "#0F766E", label: "Türkis" },
  { value: "#166534", label: "Grün" },
  { value: "#92400E", label: "Ocker" },
  { value: "#C2410C", label: "Orange" },
  { value: "#B91C1C", label: "Rot" },
  { value: "#A21CAF", label: "Magenta" },
  { value: "#6D28D9", label: "Violett" },
];

export function resolveAgendaIcon(config: unknown, linkedTask = false): AgendaIconConfig {
  const fallback = { name: linkedTask ? "tasks" : "list", color: agendaIconColors[0].value };
  if (!config || typeof config !== "object" || !("name" in config) || !("color" in config)) return fallback;
  return {
    name: typeof config.name === "string" && Object.prototype.hasOwnProperty.call(agendaIcons, config.name)
      ? config.name : fallback.name,
    color: typeof config.color === "string" && agendaIconColors.some(({ value }) => value === config.color)
      ? config.color : fallback.color,
  };
}
