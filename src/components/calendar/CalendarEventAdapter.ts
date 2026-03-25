import { CalendarEvent } from "./types";
import { debugConsole } from '@/utils/debugConsole';

// React Big Calendar event interface
export interface RBCEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource?: unknown;
  allDay?: boolean;
  desc?: string;
}

/**
 * Adapter class to convert between our CalendarEvent format and React Big Calendar format
 */
export class CalendarEventAdapter {
  private static isObjectRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private static isCalendarEventResource(value: unknown): value is CalendarEvent {
    if (!this.isObjectRecord(value)) {
      return false;
    }

    return (
      typeof value.id === 'string' &&
      typeof value.title === 'string' &&
      typeof value.duration === 'string' &&
      typeof value.type === 'string' &&
      typeof value.priority === 'string'
    );
  }

  private static isNestedDateValue(value: unknown): value is { iso?: string; value?: string | number } {
    if (!this.isObjectRecord(value)) {
      return false;
    }

    const iso = value.iso;
    const innerValue = value.value;
    const isoValid = typeof iso === 'string' || typeof iso === 'undefined';
    const valueValid = typeof innerValue === 'string' || typeof innerValue === 'number' || typeof innerValue === 'undefined';

    return isoValid && valueValid;
  }

  private static isDateWrapper(value: unknown): value is { _type: 'Date'; value: { iso?: string; value?: string | number } } {
    if (!this.isObjectRecord(value) || value._type !== 'Date') {
      return false;
    }

    return this.isNestedDateValue(value.value);
  }

  private static getRecordString(value: Record<string, unknown>, key: string): string | undefined {
    const entry = value[key];
    return typeof entry === 'string' ? entry : undefined;
  }

  private static getRecordBoolean(value: Record<string, unknown>, key: string): boolean | undefined {
    const entry = value[key];
    return typeof entry === 'boolean' ? entry : undefined;
  }

  /**
   * Convert our CalendarEvent to RBC Event format
   */
  static toRBCEvent(event: CalendarEvent): RBCEvent {
    let startTime: Date;
    let endTime: Date;

    debugConsole.log('🔄 Converting event to RBC:', event.id, event.title);
    debugConsole.log('📅 Original date object:', event.date);
    debugConsole.log('⏰ Original endTime object:', event.endTime);

    // Handle nested date objects from Supabase
    startTime = this.extractDateFromObject(event.date);
    
    // Handle endTime - priority: endTime > duration > default 1h
    if (event.endTime) {
      endTime = this.extractDateFromObject(event.endTime);
      
      // Special handling for all-day events (both external and internal)
      if (event.is_all_day || event.duration === "Ganztägig") {
        endTime = this.normalizeAllDayEnd(startTime, endTime, event);
      }
    } else if (event.duration && event.duration !== "Ganztägig") {
      // Parse duration string (e.g., "2h", "30min", "1h 30min")
      const durationMs = this.parseDurationToMs(event.duration);
      endTime = new Date(startTime.getTime() + durationMs);
    } else if (event.is_all_day || event.duration === "Ganztägig") {
      // For all-day events, end at end of day
      endTime = new Date(startTime);
      endTime.setHours(23, 59, 59, 999);
    } else {
      // Default to 1 hour if no end time or duration
      endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    }

    // Validate the extracted dates
    if (!this.isValidDate(startTime)) {
      debugConsole.error('❌ Invalid start date for event:', event.id, startTime);
      startTime = new Date(); // Fallback to current time
    }
    
    if (!this.isValidDate(endTime)) {
      debugConsole.error('❌ Invalid end date for event:', event.id, endTime);
      endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // Fallback to 1h later
    }

    debugConsole.log('✅ Converted dates - start:', startTime, 'end:', endTime);

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
    if (this.isCalendarEventResource(rbcEvent.resource)) {
      const resource = rbcEvent.resource;
      return {
        ...resource,
        date: rbcEvent.start,
        endTime: rbcEvent.end,
        title: rbcEvent.title,
        description: rbcEvent.desc || resource.description || "",
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
  private static extractDateFromObject(dateObj: unknown): Date {
    if (!dateObj) {
      return new Date();
    }

    // If it's already a Date object
    if (dateObj instanceof Date) {
      return new Date(dateObj.getTime());
    }

    // Handle nested Supabase date objects: {_type: "Date", value: {iso: "...", ...}}
    if (this.isDateWrapper(dateObj)) {
      if (typeof dateObj.value.iso === 'string') {
        return new Date(dateObj.value.iso);
      }
      if (typeof dateObj.value.value === 'string' || typeof dateObj.value.value === 'number') {
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

    debugConsole.warn('⚠️ Unknown date format:', dateObj);
    return new Date();
  }

  /**
   * Validate if a date object is valid
   */
  private static isValidDate(date: Date): boolean {
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * Normalize end time for all-day events (both external and internal)
   * All-day events often have end_time set to midnight of the next day,
   * but should be displayed as single-day events ending at 23:59:59
   */
  private static normalizeAllDayEnd(startTime: Date, endTime: Date, eventInfo: unknown = {}): Date {
    const info = this.isObjectRecord(eventInfo) ? eventInfo : {};
    const isExternal = this.getRecordBoolean(info, '_isExternal') || false;
    const eventType = this.getRecordString(info, 'type');
    const category = this.getRecordString(info, 'category');
    const title = this.getRecordString(info, 'title') || 'Unknown event';
    
    // Special handling for birthdays and other recurring all-day events
    if (eventType === 'birthday' || category === 'birthday') {
      // Always normalize birthdays to single-day events
      const normalizedEnd = new Date(startTime);
      normalizedEnd.setHours(23, 59, 59, 999);
      
      debugConsole.log('🎂 CalendarEventAdapter: Normalized birthday end time:', {
        title,
        original: endTime.toISOString(),
        normalized: normalizedEnd.toISOString(),
        startDay: startTime.toDateString(),
        endDay: endTime.toDateString()
      });
      
      return normalizedEnd;
    }
    
    // Check if this follows the all-day pattern (ends at midnight of next day)
    const isAllDayPattern = this.isAllDayPattern(startTime, endTime);
    
    if (isAllDayPattern) {
      // Set end time to 23:59:59 of the start day
      const normalizedEnd = new Date(startTime);
      normalizedEnd.setHours(23, 59, 59, 999);
      
      debugConsole.log('🔧 CalendarEventAdapter: Normalized all-day end time:', {
        original: endTime.toISOString(),
        normalized: normalizedEnd.toISOString(),
        startDay: startTime.toDateString(),
        endDay: endTime.toDateString(),
        isExternal,
        eventType
      });
      
      return normalizedEnd;
    }
    
    // For actual multi-day events, return original end time
    return endTime;
  }

  /**
   * Check if dates follow all-day event pattern (internal or external)
   */
  private static isAllDayPattern(startTime: Date, endTime: Date): boolean {
    // Check if end time is midnight of the next day
    const isEndMidnight = endTime.getHours() === 0 && 
                         endTime.getMinutes() === 0 && 
                         endTime.getSeconds() === 0;
    
    // Check if it's exactly 24 hours apart (single day event)
    const timeDiff = endTime.getTime() - startTime.getTime();
    const is24Hours = timeDiff === 24 * 60 * 60 * 1000;
    
    // For internal events, start time might not be midnight
    // But if it ends at midnight and is 24 hours, it's likely a single-day all-day event
    return isEndMidnight && is24Hours;
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
      
      debugConsole.log('🔧 CalendarEventAdapter: Normalized external all-day end time:', {
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
