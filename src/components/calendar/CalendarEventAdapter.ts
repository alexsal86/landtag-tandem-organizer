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

    console.log('🔄 Converting event to RBC:', event.id, event.title);
    console.log('📅 Original date object:', event.date);
    console.log('⏰ Original endTime object:', event.endTime);

    // Handle nested date objects from Supabase
    startTime = this.extractDateFromObject(event.date);
    
    // Handle endTime - priority: endTime > duration > default 1h
    if (event.endTime) {
      endTime = this.extractDateFromObject(event.endTime);
      
      // Special handling for external all-day events
      if (event.is_all_day && (event as any)._isExternal) {
        endTime = this.normalizeExternalAllDayEnd(startTime, endTime);
      }
    } else if (event.duration && event.duration !== "Ganztägig") {
      // Parse duration string (e.g., "2h", "30min", "1h 30min")
      const durationMs = this.parseDurationToMs(event.duration);
      endTime = new Date(startTime.getTime() + durationMs);
    } else if (event.is_all_day) {
      // For all-day events, end at end of day
      endTime = new Date(startTime);
      endTime.setHours(23, 59, 59, 999);
    } else {
      // Default to 1 hour if no end time or duration
      endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    }

    // Validate the extracted dates
    if (!this.isValidDate(startTime)) {
      console.error('❌ Invalid start date for event:', event.id, startTime);
      startTime = new Date(); // Fallback to current time
    }
    
    if (!this.isValidDate(endTime)) {
      console.error('❌ Invalid end date for event:', event.id, endTime);
      endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // Fallback to 1h later
    }

    console.log('✅ Converted dates - start:', startTime, 'end:', endTime);

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

  /**
   * Extract Date object from various formats (including nested Supabase objects)
   */
  private static extractDateFromObject(dateObj: any): Date {
    if (!dateObj) {
      return new Date();
    }

    // If it's already a Date object
    if (dateObj instanceof Date) {
      return new Date(dateObj.getTime());
    }

    // Handle nested Supabase date objects: {_type: "Date", value: {iso: "...", ...}}
    if (dateObj._type === "Date" && dateObj.value) {
      if (dateObj.value.iso) {
        return new Date(dateObj.value.iso);
      }
      if (dateObj.value.value) {
        return new Date(dateObj.value.value);
      }
    }

    // Handle simple string dates
    if (typeof dateObj === 'string') {
      return new Date(dateObj);
    }

    // Handle timestamp numbers
    if (typeof dateObj === 'number') {
      return new Date(dateObj);
    }

    console.warn('⚠️ Unknown date format:', dateObj);
    return new Date();
  }

  /**
   * Validate if a date object is valid
   */
  private static isValidDate(date: Date): boolean {
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * Normalize end time for external all-day events
   * External calendars often set all-day events to end at midnight of the next day,
   * but React Big Calendar displays this as spanning two days
   */
  private static normalizeExternalAllDayEnd(startTime: Date, endTime: Date): Date {
    // Check if this follows the external all-day pattern
    const isExternalAllDayPattern = this.isExternalAllDayPattern(startTime, endTime);
    
    if (isExternalAllDayPattern) {
      // Set end time to 23:59:59 of the start day
      const normalizedEnd = new Date(startTime);
      normalizedEnd.setHours(23, 59, 59, 999);
      
      console.log('🔧 CalendarEventAdapter: Normalized external all-day end time:', {
        original: endTime.toISOString(),
        normalized: normalizedEnd.toISOString(),
        startDay: startTime.toDateString(),
        endDay: endTime.toDateString()
      });
      
      return normalizedEnd;
    }
    
    return endTime;
  }

  /**
   * Check if dates follow external all-day event pattern
   */
  private static isExternalAllDayPattern(startTime: Date, endTime: Date): boolean {
    // Start at midnight
    const isStartMidnight = startTime.getHours() === 0 && 
                           startTime.getMinutes() === 0 && 
                           startTime.getSeconds() === 0;
    
    // End at midnight of next day
    const isEndMidnight = endTime.getHours() === 0 && 
                         endTime.getMinutes() === 0 && 
                         endTime.getSeconds() === 0;
    
    // Exactly 24 hours apart
    const timeDiff = endTime.getTime() - startTime.getTime();
    const is24Hours = timeDiff === 24 * 60 * 60 * 1000;
    
    return isStartMidnight && isEndMidnight && is24Hours;
  }
}