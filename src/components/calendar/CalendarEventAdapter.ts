import { CalendarEvent } from "../CalendarView";

// React Big Calendar event interface
export interface RBCEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource?: any;
  allDay?: boolean;
  desc?: string;
}

/**
 * Adapter class to convert between our CalendarEvent format and React Big Calendar format
 */
export class CalendarEventAdapter {
  /**
   * Convert our CalendarEvent to RBC Event format
   */
  static toRBCEvent(event: CalendarEvent): RBCEvent {
    let startTime: Date;
    let endTime: Date;

    // Handle different date formats
    if (event.date instanceof Date) {
      startTime = new Date(event.date);
    } else {
      startTime = new Date(event.date);
    }

    // If time is provided as string, parse it
    if (event.time && typeof event.time === 'string') {
      const [hours, minutes] = event.time.split(':').map(Number);
      startTime.setHours(hours, minutes, 0, 0);
    }

    if (event.endTime) {
      endTime = new Date(event.endTime);
    } else if (event.duration) {
      // Parse duration string (e.g., "2h", "30min", "1h 30min")
      const durationMs = this.parseDurationToMs(event.duration);
      endTime = new Date(startTime.getTime() + durationMs);
    } else {
      // Default to 1 hour if no end time or duration
      endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    }

    return {
      id: event.id,
      title: event.title,
      start: startTime,
      end: endTime,
      allDay: event.is_all_day || false,
      desc: event.description,
      resource: event // Store the entire CalendarEvent as resource for easy access
    };
  }

  /**
   * Convert RBC Event back to our CalendarEvent format
   */
  static fromRBCEvent(rbcEvent: RBCEvent): CalendarEvent {
    // If resource is the full CalendarEvent, use it directly with updates
    if (rbcEvent.resource && typeof rbcEvent.resource === 'object' && 'id' in rbcEvent.resource) {
      return {
        ...rbcEvent.resource,
        date: rbcEvent.start,
        endTime: rbcEvent.end,
        title: rbcEvent.title,
        description: rbcEvent.desc || rbcEvent.resource.description,
        is_all_day: rbcEvent.allDay,
        time: rbcEvent.start.toTimeString().slice(0, 5) // Extract HH:MM format
      };
    }

    // Fallback: create new CalendarEvent from RBC event
    return {
      id: rbcEvent.id,
      title: rbcEvent.title,
      description: rbcEvent.desc || "",
      time: rbcEvent.start.toTimeString().slice(0, 5),
      duration: this.calculateDuration(rbcEvent.start, rbcEvent.end),
      date: rbcEvent.start,
      endTime: rbcEvent.end,
      type: "appointment",
      priority: "medium",
      is_all_day: rbcEvent.allDay,
      location: "",
      attendees: 0,
      participants: []
    };
  }

  /**
   * Convert array of CalendarEvents to RBC Events
   */
  static toRBCEvents(events: CalendarEvent[]): RBCEvent[] {
    return events.map(event => this.toRBCEvent(event));
  }

  /**
   * Convert array of RBC Events to CalendarEvents
   */
  static fromRBCEvents(rbcEvents: RBCEvent[]): CalendarEvent[] {
    return rbcEvents.map(event => this.fromRBCEvent(event));
  }

  /**
   * Parse duration string to milliseconds
   */
  private static parseDurationToMs(duration: string): number {
    const hours = duration.match(/(\d+)h/);
    const minutes = duration.match(/(\d+)min/);
    
    let totalMs = 0;
    if (hours) totalMs += parseInt(hours[1]) * 60 * 60 * 1000;
    if (minutes) totalMs += parseInt(minutes[1]) * 60 * 1000;
    
    return totalMs || 60 * 60 * 1000; // Default to 1 hour
  }

  /**
   * Calculate duration string from start and end dates
   */
  private static calculateDuration(start: Date, end: Date): string {
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (60 * 60 * 1000));
    const minutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
    
    if (hours > 0 && minutes > 0) {
      return `${hours}h ${minutes}min`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${minutes}min`;
    }
  }
}