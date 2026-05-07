export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  time: string;
  duration: string;
  date: Date;
  endTime?: Date;
  location?: string;
  attendees?: number;
  participants?: Array<{
    id: string;
    name: string;
    role: string;
  }>;
  type: "meeting" | "appointment" | "deadline" | "session" | "blocked" | "veranstaltung" | "vacation" | "vacation_request" | "birthday";
  priority: "low" | "medium" | "high";
  category_color?: string;
  is_all_day?: boolean;
  allDay?: boolean;
  category?: {
    color: string;
  };
  _isExternal?: boolean;
  _isRecurring?: boolean;
  _originalId?: string;
  sourceScope?: "internal" | "external" | "system";
  sourceId?: string;
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
    case "vacation":
      return "bg-palette-green text-white";
    case "vacation_request":
      return "bg-palette-yellow text-black";
    case "veranstaltung":
      return "bg-palette-purple text-white";
    case "birthday":
      return "bg-palette-pink text-white";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export const getPriorityIndicator = (priority: CalendarEvent["priority"]) => {
  switch (priority) {
    case "high":
      return "border-l-4 border-l-destructive";
    case "medium":
      return "border-l-4 border-l-government-gold";
    case "low":
      return "border-l-4 border-l-muted-foreground";
  }
};
