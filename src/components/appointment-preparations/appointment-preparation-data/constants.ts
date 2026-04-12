import type { AppointmentPreparation } from "@/hooks/useAppointmentPreparation";
import {
  FileTextIcon,
  FolderIcon,
  MessageSquareIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react";

export const VISIT_REASON_OPTIONS = [
  { value: 'einladung', label: 'Einladung der Person/Einrichtung' },
  { value: 'eigeninitiative', label: 'Eigeninitiative' },
  { value: 'fraktionsarbeit', label: 'Fraktionsarbeit' },
  { value: 'pressetermin', label: 'Pressetermin' },
] as const;

export const COMPANION_TYPE_OPTIONS = [
  { value: 'mitarbeiter', label: 'Mitarbeiter' },
  { value: 'fraktion', label: 'Fraktion' },
  { value: 'partei', label: 'Partei' },
  { value: 'presse', label: 'Presse' },
  { value: 'sonstige', label: 'Sonstige' },
] as const;

export const DRESS_CODE_OPTIONS = [
  { value: "casual", label: "Casual" },
  { value: "business_casual", label: "Business Casual" },
  { value: "business_formal", label: "Business Formal" },
  { value: "festlich", label: "Festlich" },
  { value: "uniform", label: "Uniformpflicht" },
  { value: "custom", label: "Benutzerdefiniert" },
];

export const FIELD_SECTIONS = {
  basics: {
    title: "Grundlagen",
    icon: FileTextIcon,
    fields: [
      { key: "last_meeting_date", label: "Letztes Treffen", placeholder: "Datum des letzten Treffens", type: "date" },
      { key: "objectives", label: "Ziele", placeholder: "Welche Ziele sollen erreicht werden?", multiline: true },
    ],
  },
  people: {
    title: "Personen",
    icon: UsersIcon,
    fields: [
      { key: "audience", label: "Zielgruppe", placeholder: "An wen richtet sich der Termin?" },
    ],
  },
  materials: {
    title: "Materialien & Unterlagen",
    icon: FolderIcon,
    fields: [
      { key: "materials_needed", label: "Benötigte Materialien", placeholder: "Welche Materialien werden benötigt?" },
      { key: "facts_figures", label: "Fakten & Zahlen", placeholder: "Wichtige Daten und Statistiken", multiline: true },
      { key: "position_statements", label: "Positionspapiere", placeholder: "Offizielle Positionen und Standpunkte", multiline: true },
    ],
  },
  communication: {
    title: "Kommunikation",
    icon: MessageSquareIcon,
    fields: [
      { key: "briefing_notes", label: "Weitere Notizen", placeholder: "Optionale ergänzende Briefing-Notizen", multiline: true },
    ],
  },
  framework: {
    title: "Rahmenbedingungen",
    icon: SettingsIcon,
    fields: [
      { key: "technology_setup", label: "Technik-Setup", placeholder: "Technische Voraussetzungen" },
      { key: "dress_code", label: "Kleiderordnung", placeholder: "Angemessene Kleidung für den Anlass", type: "select" },
      { key: "event_type", label: "Veranstaltungstyp", placeholder: "Art der Veranstaltung" },
    ],
  },
} as const;

export function getPreparationDataWithDefaults(
  preparationData: AppointmentPreparation['preparation_data'],
) {
  return {
    ...preparationData,
    social_media_planned: preparationData.social_media_planned ?? false,
    press_planned: preparationData.press_planned ?? false,
  };
}
