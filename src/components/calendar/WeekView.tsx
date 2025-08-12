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

  const getEventTypeColor = (type: CalendarEvent["type"]) => {
    switch (type) {
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
                 const dayEvents = getEventsForDay(day).filter(event => parseInt(event.time.split(':')[0]) === hour);
                 const eventLayout = getEventLayout(dayEvents);
                 
                 return (
                   <div 
                     key={`${day.toDateString()}-${hour}`} 
                     className="min-h-[60px] p-1 border-b border-l border-border relative hover:bg-accent/20 overflow-hidden"
                   >
                     {eventLayout.map(({ event, column, totalColumns }) => {
                       const widthPercentage = 100 / totalColumns;
                       const leftOffset = (widthPercentage * column);
                       
                       return (
                         <div
                           key={event.id}
                           className={`absolute p-1 rounded text-xs border-l-2 cursor-pointer hover:opacity-80 transition-opacity ${getEventTypeColor(event.type)}`}
                           style={{ 
                             width: `${widthPercentage - 1}%`,
                             left: `${leftOffset}%`,
                             marginBottom: '4px'
                           }}
                           onClick={() => onAppointmentClick?.(event)}
                         >
                           <div className="font-medium truncate w-full">{event.title}</div>
                           <div className="opacity-80 truncate w-full">
                             {(() => {
                               const [hours, minutes] = event.time.split(':').map(Number);
                               const durationMinutes = parseInt(event.duration.replace(/\D/g, ''));
                               const endHours = Math.floor((hours * 60 + minutes + durationMinutes) / 60);
                               const endMinutes = (hours * 60 + minutes + durationMinutes) % 60;
                               const durationHours = (durationMinutes / 60).toFixed(1);
                               
                               return `${event.time} - ${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')} (${durationHours}h)`;
                             })()}
                           </div>
                         </div>
                       );
                     })}
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