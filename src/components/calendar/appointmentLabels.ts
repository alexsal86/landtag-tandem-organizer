import type { CalendarEvent } from "./types";

export interface AppointmentCategoryOption {
  name: string;
  label: string;
  color: string | null;
}

export const getEventTypeColor = (type: CalendarEvent["type"]) => {
  switch (type) {
    case "session":
      return "bg-primary text-primary-foreground";
    case "meeting":
      return "bg-government-blue text-white";
    case "appointment":
      return "bg-secondary text-secondary-foreground";
    case "deadline":
      return "bg-destructive text-destructive-foreground";
    case "blocked":
      return "bg-palette-orange text-white";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export const getEventTypeLabel = (
  type: CalendarEvent["type"],
  categories: AppointmentCategoryOption[],
) => {
  // Try to find the category in the loaded appointment categories first
  const category = categories.find((cat) => cat.name === type);
  if (category) {
    return category.label;
  }

  // Fallback to hardcoded labels
  switch (type) {
    case "session":
      return "Sitzung";
    case "meeting":
      return "Besprechung";
    case "appointment":
      return "Termin";
    case "deadline":
      return "Frist";
    case "blocked":
      return "Geplant";
    default:
      return "Unbekannt";
  }
};

export const getPriorityLabel = (priority: CalendarEvent["priority"]) => {
  switch (priority) {
    case "high":
      return "Hoch";
    case "medium":
      return "Mittel";
    case "low":
      return "Niedrig";
    default:
      return "Unbekannt";
  }
};

export const getPriorityColor = (priority: CalendarEvent["priority"]) => {
  switch (priority) {
    case "high":
      return "bg-destructive text-destructive-foreground";
    case "medium":
      return "bg-palette-yellow text-white";
    case "low":
      return "bg-palette-green text-white";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export const getGuestStatusColor = (status: string) => {
  switch (status) {
    case "confirmed":
      return "bg-palette-green/20 text-palette-green border-palette-green/40";
    case "declined":
      return "bg-palette-red/20 text-palette-red border-palette-red/40";
    case "invited":
      return "bg-palette-blue/20 text-palette-blue border-palette-blue/40";
    default:
      return "bg-muted text-foreground border-border";
  }
};

export const getGuestStatusText = (status: string) => {
  switch (status) {
    case "confirmed":
      return "Zugesagt";
    case "declined":
      return "Abgesagt";
    case "invited":
      return "Eingeladen";
    default:
      return status;
  }
};

export const getFeedbackStatusLabel = (status: "pending" | "completed" | "skipped") => {
  switch (status) {
    case "pending":
      return "Ausstehend";
    case "completed":
      return "Abgeschlossen";
    case "skipped":
      return "Übersprungen";
    default:
      return status;
  }
};

export const getFeedbackStatusColor = (status: "pending" | "completed" | "skipped") => {
  switch (status) {
    case "pending":
      return "bg-palette-yellow/20 text-palette-yellow border-palette-yellow/40";
    case "completed":
      return "bg-palette-green/20 text-palette-green border-palette-green/40";
    case "skipped":
      return "bg-muted text-foreground border-border";
    default:
      return "bg-muted text-foreground border-border";
  }
};
