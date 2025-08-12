import React from "react";
import { CalendarEvent } from "../CalendarView";

interface DayViewProps {
  date: Date;
  events: CalendarEvent[];
}

export function DayView({ date, events }: DayViewProps) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  const getEventsForHour = (hour: number) => {
    return events.filter(event => {
      const eventHour = parseInt(event.time.split(':')[0]);
      return eventHour === hour;
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
    <div className="flex flex-col">
      {/* Time grid */}
      <div className="grid grid-cols-[80px,1fr] border border-border">
        {hours.map((hour) => (
          <React.Fragment key={hour}>
            {/* Time label */}
            <div className="p-2 text-sm text-muted-foreground border-b border-border bg-muted/30">
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
                  <div className="opacity-80">{event.time} ({event.duration})</div>
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
  );
}