import React, { useEffect, useRef } from "react";
import { CalendarEvent } from "../CalendarView";

interface WeekViewProps {
  weekStart: Date;
  events: CalendarEvent[];
  onAppointmentClick?: (appointment: CalendarEvent) => void;
}

export function WeekView({ weekStart, events, onAppointmentClick }: WeekViewProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Scroll to 9 AM on mount
    if (scrollContainerRef.current) {
      const hour9Element = document.getElementById('week-hour-9');
      if (hour9Element) {
        hour9Element.scrollIntoView({ behavior: 'auto', block: 'start' });
      }
    }
  }, [weekStart]);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    return date;
  });
  
  const hours = Array.from({ length: 24 }, (_, i) => i); // 0:00 to 23:00
  
  const getEventsForDay = (day: Date) => {
    return events.filter(event => {
      // Filter by the actual event date
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
    <div className="overflow-auto h-full">
      {/* Header with days */}
      <div className="grid grid-cols-[80px,repeat(7,1fr)] border-b border-border bg-muted/30 sticky top-0 z-10">
        <div className="p-3 text-sm font-medium"></div>
        {days.map((day) => (
          <div key={day.toISOString()} className="p-3 text-center border-l border-border">
            <div className="text-sm font-medium">{formatDay(day)}</div>
          </div>
        ))}
      </div>

      {/* Time grid with scrolling */}
      <div className="overflow-auto" ref={scrollContainerRef} style={{ maxHeight: 'calc(100vh - 300px)' }}>
        <div className="grid grid-cols-[80px,repeat(7,1fr)]">
          {hours.map((hour) => (
            <>
              {/* Time label for this hour */}
              <div 
                key={`time-${hour}`}
                id={hour === 9 ? 'week-hour-9' : undefined}
                className="p-2 text-sm text-muted-foreground border-b border-border bg-muted/20 sticky left-0 z-10"
              >
                {hour.toString().padStart(2, '0')}:00
              </div>
              
               {/* Day columns for this hour */}
               {days.map((day) => {
                 const dayEvents = getEventsForDay(day);
                 
                 // Find events that should be displayed in this hour slot
                 const hourEvents = dayEvents.filter(event => {
                   const [startHour] = event.time.split(':').map(Number);
                   
                   if (event.endTime) {
                     // Use actual end time
                     const eventStart = new Date(event.date);
                     const eventEnd = new Date(event.endTime);
                     const hourStart = new Date(day);
                     hourStart.setHours(hour, 0, 0, 0);
                     const hourEnd = new Date(day);
                     hourEnd.setHours(hour + 1, 0, 0, 0);
                     
                     // Event overlaps with this hour slot
                     return eventStart < hourEnd && eventEnd > hourStart;
                   } else {
                     // Fallback to duration calculation
                     const durationMinutes = parseInt(event.duration.replace(/\D/g, ''));
                     const endHour = Math.floor((startHour * 60 + durationMinutes) / 60);
                     return hour >= startHour && hour < endHour;
                   }
                 });
                 
                 const eventLayout = getEventLayout(hourEvents);
                 
                 return (
                   <div 
                     key={`${day.toDateString()}-${hour}`} 
                     className="min-h-[60px] p-1 border-b border-l border-border relative hover:bg-accent/20 overflow-hidden"
                   >
                      {eventLayout.map(({ event, column, totalColumns }) => {
                        const widthPercentage = 100 / totalColumns;
                        const leftOffset = (widthPercentage * column);
                        
                        // Calculate precise positioning and height
                        const [startHour, startMinutes] = event.time.split(':').map(Number);
                        let topOffset = 0;
                        let eventHeight = 58; // Default height
                        let isEventStart = hour === startHour;
                        
                        if (isEventStart) {
                          // This is the starting hour - calculate precise positioning
                          topOffset = (startMinutes / 60) * 60; // Convert minutes to pixels
                          
                          if (event.endTime) {
                            const eventStart = new Date(event.date);
                            const eventEnd = new Date(event.endTime);
                            
                            // Calculate how many hours this event spans from this starting hour
                            const remainingMs = eventEnd.getTime() - eventStart.getTime();
                            const remainingHours = remainingMs / (1000 * 60 * 60);
                            eventHeight = Math.max(remainingHours * 60, 20);
                          } else {
                            // Fallback to duration calculation
                            const durationMinutes = parseInt(event.duration.replace(/\D/g, ''));
                            eventHeight = Math.max(durationMinutes, 20);
                          }
                        } else {
                          // This is a continuation hour - show as full hour height
                          topOffset = 0;
                          eventHeight = 58;
                        }
                        
                        return (
                           <div
                             key={`${event.id}-${hour}`}
                             className={`absolute p-1 rounded text-xs cursor-pointer hover:opacity-80 transition-opacity ${getEventTypeColor(event)} ${!isEventStart ? 'border-l-4 border-l-yellow-400' : ''}`}
                             style={{ 
                               width: `${widthPercentage - 1}%`,
                               left: `${leftOffset}%`,
                               top: `${topOffset}px`,
                               height: `${eventHeight}px`,
                               marginBottom: '2px',
                               backgroundColor: event.category_color || undefined,
                               borderLeftColor: event.category_color || undefined,
                               zIndex: isEventStart ? 3 : 2
                             }}
                             onClick={() => onAppointmentClick?.(event)}
                           >
                            <div className="font-medium truncate w-full text-xs">
                              {!isEventStart ? `→ ${event.title}` : event.title}
                            </div>
                             <div className="opacity-80 truncate w-full text-xs">
                               {(() => {
                                 if (event.endTime) {
                                   // Use actual end time from database
                                   const startTimeStr = event.time;
                                   const endTimeStr = event.endTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                                   const startDate = event.date.toDateString();
                                   const endDate = event.endTime.toDateString();
                                   
                                   if (startDate === endDate) {
                                     // Same day - show different info based on whether this is start or continuation
                                     return isEventStart ? `${startTimeStr} - ${endTimeStr}` : `bis ${endTimeStr}`;
                                   } else {
                                     // Multi-day event
                                     const endDateStr = event.endTime.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                                     return isEventStart ? `${startTimeStr} - ${endDateStr} ${endTimeStr}` : `bis ${endDateStr} ${endTimeStr}`;
                                   }
                                 } else {
                                   // Fallback to duration calculation
                                   const [hours, minutes] = event.time.split(':').map(Number);
                                   const durationMinutes = parseInt(event.duration.replace(/\D/g, ''));
                                   const endTotalMinutes = hours * 60 + minutes + durationMinutes;
                                   const endHours = Math.floor(endTotalMinutes / 60);
                                   const endMinutes = endTotalMinutes % 60;
                                   
                                   return isEventStart ? `${event.time} - ${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}` : `bis ${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
                                 }
                               })()}
                             </div>
                          </div>
                        );
                      }).filter(Boolean)} {/* Remove null entries */}
                   </div>
                 );
               })}
            </>
          ))}
        </div>
      </div>
    </div>
  );
}