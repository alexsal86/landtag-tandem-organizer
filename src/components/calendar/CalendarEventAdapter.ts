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
    const startTime = new Date(event.date);
    let endTime: Date;

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
      resource: {
        originalEvent: event,
        type: event.type,
        priority: event.priority,
        categoryColor: event.category_color,
        location: event.location,
        attendees: event.attendees,
        participants: event.participants
      }
    };
  }

  /**
   * Convert RBC Event back to our CalendarEvent format
   */
  static fromRBCEvent(rbcEvent: RBCEvent): CalendarEvent {
    const originalEvent = rbcEvent.resource?.originalEvent;
    
    if (originalEvent) {
      // Update the original event with any changes from RBC
      return {
        ...originalEvent,
        date: rbcEvent.start,
        endTime: rbcEvent.end,
        title: rbcEvent.title,
        description: rbcEvent.desc,
        is_all_day: rbcEvent.allDay
      };
    }

    // Fallback: create new CalendarEvent from RBC event
    return {
      id: rbcEvent.id,
      title: rbcEvent.title,
      description: rbcEvent.desc,
      time: rbcEvent.start.toTimeString(),
      duration: this.calculateDuration(rbcEvent.start, rbcEvent.end),
      date: rbcEvent.start,
      endTime: rbcEvent.end,
      type: rbcEvent.resource?.type || "appointment",
      priority: rbcEvent.resource?.priority || "medium",
      is_all_day: rbcEvent.allDay,
      category_color: rbcEvent.resource?.categoryColor,
      location: rbcEvent.resource?.location,
      attendees: rbcEvent.resource?.attendees,
      participants: rbcEvent.resource?.participants
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