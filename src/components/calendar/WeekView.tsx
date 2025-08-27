import React, { useEffect, useRef, useState } from "react";
import { CalendarEvent } from "../CalendarView";
import { formatEventDisplay, isMultiDayEvent, getEventDays } from "@/lib/timeUtils";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface WeekViewProps {
  weekStart: Date;
  events: CalendarEvent[];
  onAppointmentClick?: (appointment: CalendarEvent) => void;
}

export function WeekView({ weekStart, events, onAppointmentClick }: WeekViewProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [documentCounts, setDocumentCounts] = useState<Record<string, number>>({});
  
  // Separate all-day and timed events
  const allDayEvents = events.filter(event => event.is_all_day);
  const timedEvents = events.filter(event => !event.is_all_day);
  
  useEffect(() => {
    // Scroll to 9 AM on mount
    if (scrollContainerRef.current) {
      const hour9Element = document.getElementById('week-hour-9');
      if (hour9Element) {
        hour9Element.scrollIntoView({ behavior: 'auto', block: 'start' });
      }
    }
  }, [weekStart]);

  useEffect(() => {
    // Fetch document counts for all events
    const fetchDocumentCounts = async () => {
      const appointmentIds = events.map(event => event.id).filter(Boolean);
      if (appointmentIds.length === 0) return;

      try {
        const { data } = await supabase
          .from('appointment_documents')
          .select('appointment_id')
          .in('appointment_id', appointmentIds);

        const counts: Record<string, number> = {};
        data?.forEach(doc => {
          counts[doc.appointment_id] = (counts[doc.appointment_id] || 0) + 1;
        });
        setDocumentCounts(counts);
      } catch (error) {
        console.error('Error fetching document counts:', error);
      }
    };

    fetchDocumentCounts();
  }, [events]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    return date;
  });
  
  const hours = Array.from({ length: 24 }, (_, i) => i); // 0:00 to 23:00
  
  const getEventsForDay = (day: Date) => {
    return timedEvents.filter(event => {
      // Filter by the actual event date
      return event.date.toDateString() === day.toDateString();
    });
  };

  const getAllDayEventsForDay = (day: Date) => {
    return allDayEvents.filter(event => {
      // Check if this day is within the event's span for multi-day events
      if (event.endTime) {
        const eventStart = new Date(event.date);
        const eventEnd = new Date(event.endTime);
        eventStart.setHours(0, 0, 0, 0);
        eventEnd.setHours(23, 59, 59, 999);
        day.setHours(12, 0, 0, 0); // Middle of day for comparison
        return day >= eventStart && day <= eventEnd;
      }
      return event.date.toDateString() === day.toDateString();
    });
  };

  // Helper function to check if two events overlap
  const eventsOverlap = (event1: CalendarEvent, event2: CalendarEvent): boolean => {
    const getEventTimes = (event: CalendarEvent) => {
      const [hours, minutes] = event.time.split(':').map(Number);
      const startMinutes = hours * 60 + minutes;
      const durationMinutes = parseInt(event.duration.replace(/\D/g, ''));
      const endMinutes = startMinutes + durationMinutes;
      return { start: startMinutes, end: endMinutes };
    };

    const times1 = getEventTimes(event1);
    const times2 = getEventTimes(event2);

    return times1.start < times2.end && times2.start < times1.end;
  };

  // Helper function to get layout for overlapping events
  const getEventLayout = (hourEvents: CalendarEvent[]) => {
    const layout: Array<{ event: CalendarEvent; column: number; totalColumns: number }> = [];
    const groups: CalendarEvent[][] = [];

    // Group overlapping events
    hourEvents.forEach(event => {
      let addedToGroup = false;
      
      for (const group of groups) {
        if (group.some(groupEvent => eventsOverlap(event, groupEvent))) {
          group.push(event);
          addedToGroup = true;
          break;
        }
      }
      
      if (!addedToGroup) {
        groups.push([event]);
      }
    });

    // Create layout information
    groups.forEach(group => {
      const totalColumns = group.length;
      group.forEach((event, index) => {
        layout.push({
          event,
          column: index,
          totalColumns
        });
      });
    });

    return layout;
  };

  const getEventTypeColor = (event: CalendarEvent) => {
    // If the event has a category color from the database, use it
    if (event.category_color) {
      return `text-white border-2`;
    }
    
    // Fallback to hardcoded colors for built-in types
    switch (event.type) {
      case "session":
        return "bg-primary/80 text-primary-foreground border-primary";
      case "meeting":
        return "bg-government-blue/80 text-white border-government-blue";
      case "appointment":
        return "bg-green-100 text-green-800 border-green-300";
      case "deadline":
        return "bg-red-100 text-red-800 border-red-300";
      case "blocked":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "veranstaltung":
        return "bg-purple-100 text-purple-800 border-purple-300";
      default:
        return "bg-muted text-muted-foreground border-muted";
    }
  };

  const formatDay = (date: Date) => {
    return date.toLocaleDateString('de-DE', { 
      weekday: 'short', 
      day: 'numeric',
      month: 'short'
    });
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header with days - sticky */}
      <div className="grid grid-cols-[64px,1fr] border-b sticky top-0 bg-background z-20">
        <div className="border-r bg-muted/20"></div>
        <div className="grid grid-cols-7">
          {days.map((day, index) => (
            <div
              key={index}
              className="p-2 border-r text-center h-12"
            >
              <div className="font-medium text-sm">{formatDay(day)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* All-day events section - sticky */}
      {allDayEvents.length > 0 && (
        <div className="grid grid-cols-[64px,1fr] border-b bg-background sticky top-12 z-10">
          <div className="border-r text-xs text-muted-foreground p-2 text-right bg-muted/20 flex items-center justify-end">
            Ganztägig
          </div>
          <div className="grid grid-cols-7">
            {days.map((day, dayIndex) => (
              <div key={`allday-${dayIndex}`} className="border-r p-1 min-h-[48px] bg-muted/10">
                {getAllDayEventsForDay(day).map((event) => {
                  // Calculate span for multi-day events
                  let spanDays = 1;
                  let isEventStart = event.date.toDateString() === day.toDateString();
                  
                  if (event.endTime && isEventStart) {
                    const eventStart = new Date(event.date);
                    const eventEnd = new Date(event.endTime);
                    eventStart.setHours(0, 0, 0, 0);
                    eventEnd.setHours(0, 0, 0, 0);
                    
                    // Calculate the actual days between start and end (inclusive)
                    const timeDiff = eventEnd.getTime() - eventStart.getTime();
                    const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));
                    spanDays = daysDiff + 1;
                    
                    // Limit span to remaining days in the week
                    const remainingDays = 7 - dayIndex;
                    spanDays = Math.min(spanDays, remainingDays);
                  }
                  
                  // Only render at the start of the event to avoid duplicates
                  if (!isEventStart && event.endTime) {
                    return null;
                  }
                  
                  return (
                    <div
                      key={event.id}
                      className={`text-xs p-2 mb-1 rounded cursor-pointer hover:opacity-80 transition-opacity ${getEventTypeColor(event)}`}
                      style={{ 
                        backgroundColor: event.category_color || undefined,
                        gridColumn: spanDays > 1 ? `span ${spanDays}` : undefined,
                        width: spanDays > 1 ? `calc(${spanDays * 100}% + ${spanDays - 1}px)` : undefined,
                        position: spanDays > 1 ? 'relative' : undefined,
                        zIndex: spanDays > 1 ? 10 : undefined,
                        marginBottom: '4px'
                      }}
                      onClick={() => onAppointmentClick?.(event)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium truncate">
                          {event.title}
                        </div>
                        {documentCounts[event.id] > 0 && (
                          <div className="flex items-center space-x-1 ml-1">
                            <FileText className="h-3 w-3" />
                            <span className="text-xs">{documentCounts[event.id]}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scrollable time grid */}
      <div className="flex-1 flex bg-background overflow-hidden">
        {/* Hours column - sticky */}
        <div className="w-16 border-r bg-muted/20 sticky left-0 z-10">
          {hours.map((hour) => (
            <div
              key={hour}
              id={hour === 9 ? 'week-hour-9' : undefined}
              className="h-16 border-b text-xs text-muted-foreground p-2 text-right"
            >
              {hour.toString().padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {/* Calendar content - scrollable */}
        <div className="flex-1 overflow-auto" ref={scrollContainerRef}>
          <div 
            className="relative"
          >
            <div className="grid grid-cols-7">
              {/* Days columns with events */}
              {days.map((day, dayIndex) => (
                <div key={dayIndex} className="border-r relative">
                  {/* Hour cells */}
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="h-16 border-b hover:bg-accent/50 transition-colors"
                    />
                  ))}

                  {/* Timed events overlay */}
                  <div className="absolute inset-0 pointer-events-none">
                    {(() => {
                      const dayEvents = getEventsForDay(day);
                      const eventLayout = getEventLayout(dayEvents);
                      
                      return eventLayout.map(({ event, column, totalColumns }) => {
                        const widthPercentage = 100 / totalColumns;
                        const leftOffset = (widthPercentage * column);
                        
                        // Calculate precise positioning and height
                        const [startHour, startMinutes] = event.time.split(':').map(Number);
                        let topOffset = startHour * 64 + (startMinutes / 60) * 64; // Convert to pixels (64px per hour)
                        let eventHeight = 62; // Default height
                        
                        if (event.endTime) {
                          // Calculate actual height based on end time
                          const eventEnd = new Date(event.endTime);
                          
                          if (eventEnd.toDateString() === day.toDateString()) {
                            // Event ends on same day
                            const endHour = eventEnd.getHours();
                            const endMinutes = eventEnd.getMinutes();
                            
                            // Calculate total duration in pixels
                            const startTotalMinutes = startHour * 60 + startMinutes;
                            const endTotalMinutes = endHour * 60 + endMinutes;
                            const durationMinutes = endTotalMinutes - startTotalMinutes;
                            eventHeight = Math.max((durationMinutes * 64) / 60, 20); // Minimum 20px height
                          } else {
                            // Multi-day event - extends to end of day
                            const hoursToEndOfDay = 24 - startHour;
                            const minutesToEndOfDay = hoursToEndOfDay * 60 - startMinutes;
                            eventHeight = (minutesToEndOfDay * 64) / 60;
                          }
                        } else {
                          // Fallback to duration calculation
                          const durationMinutes = parseInt(event.duration.replace(/\D/g, ''));
                          eventHeight = Math.max((durationMinutes * 64) / 60, 20);
                        }
                        
                        return (
                          <div
                            key={event.id}
                            className={`absolute p-1 rounded text-xs cursor-pointer hover:opacity-80 transition-opacity pointer-events-auto ${getEventTypeColor(event)}`}
                            style={{ 
                              width: `${widthPercentage - 1}%`,
                              left: `${leftOffset}%`,
                              top: `${topOffset}px`,
                              height: `${eventHeight}px`,
                              marginLeft: '4px',
                              backgroundColor: event.category_color || undefined,
                              borderLeftColor: event.category_color || undefined,
                              zIndex: 5
                            }}
                            onClick={() => onAppointmentClick?.(event)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="font-medium truncate text-xs">{event.title}</div>
                              {documentCounts[event.id] > 0 && (
                                <div className="flex items-center space-x-1 ml-1">
                                  <FileText className="h-3 w-3" />
                                  <span className="text-xs">{documentCounts[event.id]}</span>
                                </div>
                              )}
                            </div>
                            <div className="opacity-80 truncate w-full text-xs">
                              {formatEventDisplay(event)}
                            </div>
                            {event.location && (
                              <div className="text-xs opacity-75 truncate">
                                {event.location}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}