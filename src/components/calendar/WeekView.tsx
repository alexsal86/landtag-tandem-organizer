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
                return (
                  <div 
                    key={`${day.toDateString()}-${hour}`} 
                    className="min-h-[60px] p-1 border-b border-l border-border relative hover:bg-accent/20 overflow-hidden"
                  >
                    {dayEvents.map((event, index) => (
                      <div
                        key={event.id}
                        className={`p-1 rounded text-xs mb-1 border-l-2 w-full max-w-full cursor-pointer hover:opacity-80 transition-opacity ${getEventTypeColor(event.type)}`}
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
                    ))}
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