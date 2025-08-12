import React from "react";
import { CalendarEvent } from "../CalendarView";

interface WeekViewProps {
  weekStart: Date;
  events: CalendarEvent[];
}

export function WeekView({ weekStart, events }: WeekViewProps) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    return date;
  });
  
  const hours = Array.from({ length: 16 }, (_, i) => i + 6); // 6:00 to 21:00
  
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
    <div className="overflow-auto">
      {/* Header with days */}
      <div className="grid grid-cols-[80px,repeat(7,1fr)] border-b border-border bg-muted/30 sticky top-0 z-10">
        <div className="p-3 text-sm font-medium"></div>
        {days.map((day) => (
          <div key={day.toISOString()} className="p-3 text-center border-l border-border">
            <div className="text-sm font-medium">{formatDay(day)}</div>
          </div>
        ))}
      </div>

      {/* Time grid - using CSS Grid properly */}
      <div className="grid grid-cols-[80px,repeat(7,1fr)]">
        {hours.map((hour) => (
          <>
            {/* Time label for this hour */}
            <div 
              key={`time-${hour}`}
              className="p-2 text-sm text-muted-foreground border-b border-border bg-muted/20"
            >
              {hour.toString().padStart(2, '0')}:00
            </div>
            
            {/* Day columns for this hour */}
            {days.map((day) => {
              const dayEvents = getEventsForDay(day).filter(event => parseInt(event.time.split(':')[0]) === hour);
              return (
                <div 
                  key={`${day.toDateString()}-${hour}`} 
                  className="min-h-[60px] p-1 border-b border-l border-border relative hover:bg-accent/20"
                >
                  {dayEvents.map((event, index) => (
                    <div
                      key={event.id}
                      className={`p-1 rounded text-xs mb-1 border-l-2 ${getEventTypeColor(event.type)}`}
                    >
                      <div className="font-medium truncate">{event.title}</div>
                      <div className="opacity-80">{event.time}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}