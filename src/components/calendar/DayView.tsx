import React, { useEffect, useRef } from "react";
import { CalendarEvent } from "../CalendarView";

interface DayViewProps {
  date: Date;
  events: CalendarEvent[];
}

export function DayView({ date, events }: DayViewProps) {
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
                {getEventsForHour(hour).map((event, index) => (
                  <div
                    key={event.id}
                    className={`p-2 rounded text-xs mb-1 ${getEventTypeColor(event.type)}`}
                    style={{ marginLeft: `${index * 5}px` }}
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
                ))}
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}