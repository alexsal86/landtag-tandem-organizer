import React, { useEffect, useRef } from "react";
import { CalendarEvent } from "../CalendarView";

interface DayViewProps {
  date: Date;
  events: CalendarEvent[];
  onAppointmentClick?: (appointment: CalendarEvent) => void;
}

export function DayView({ date, events, onAppointmentClick }: DayViewProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Scroll to 9 AM on mount
    if (scrollContainerRef.current) {
      const hour9Element = document.getElementById('hour-9');
      if (hour9Element) {
        hour9Element.scrollIntoView({ behavior: 'auto', block: 'start' });
      }
    }
  }, [date]);
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  const getEventsForHour = (hour: number) => {
    return events.filter(event => {
      // Filter by date and hour
      return event.date.toDateString() === date.toDateString() && 
             parseInt(event.time.split(':')[0]) === hour;
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
        return "bg-primary text-primary-foreground";
      case "meeting":
        return "bg-government-blue text-white";
      case "appointment":
        return "bg-secondary text-secondary-foreground";
      case "deadline":
        return "bg-destructive text-destructive-foreground";
      case "blocked":
        return "bg-orange-500 text-white";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Time grid */}
      <div className="flex-1 overflow-auto" ref={scrollContainerRef} style={{ maxHeight: 'calc(100vh - 200px)' }}>
        <div className="grid grid-cols-[80px,1fr] border border-border">
          {hours.map((hour) => (
            <React.Fragment key={hour}>
              {/* Time label */}
              <div 
                className="p-2 text-sm text-muted-foreground border-b border-border bg-muted/30 sticky left-0 z-10"
                id={hour === 9 ? 'hour-9' : undefined}
              >
                {hour.toString().padStart(2, '0')}:00
              </div>
              
               {/* Event slot */}
               <div className="min-h-[60px] p-1 border-b border-border relative">
                 {(() => {
                   const hourEvents = getEventsForHour(hour);
                   const eventLayout = getEventLayout(hourEvents);
                   
                   return eventLayout.map(({ event, column, totalColumns }) => {
                     const widthPercentage = 100 / totalColumns;
                     const leftOffset = (widthPercentage * column);
                     
                     return (
                       <div
                         key={event.id}
                         className={`absolute p-2 rounded text-xs cursor-pointer hover:opacity-80 transition-opacity ${getEventTypeColor(event.type)}`}
                         style={{ 
                           width: `${widthPercentage - 1}%`,
                           left: `${leftOffset}%`,
                           marginBottom: '4px'
                         }}
                         onClick={() => onAppointmentClick?.(event)}
                       >
                         <div className="font-medium truncate">{event.title}</div>
                         <div className="opacity-80">
                           {(() => {
                             const [hours, minutes] = event.time.split(':').map(Number);
                             const durationMinutes = parseInt(event.duration.replace(/\D/g, ''));
                             const endHours = Math.floor((hours * 60 + minutes + durationMinutes) / 60);
                             const endMinutes = (hours * 60 + minutes + durationMinutes) % 60;
                             const durationHours = (durationMinutes / 60).toFixed(1);
                             
                             return `${event.time} - ${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')} (${durationHours}h)`;
                           })()}
                         </div>
                         {event.location && (
                           <div className="opacity-70 truncate">{event.location}</div>
                         )}
                       </div>
                     );
                   });
                 })()}
               </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}