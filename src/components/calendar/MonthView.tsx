import React from "react";
import { Calendar } from "@/components/ui/calendar";
import { CalendarEvent } from "../CalendarView";
import { Badge } from "@/components/ui/badge";
import { formatEventDisplay } from "@/lib/timeUtils";

interface MonthViewProps {
  date: Date;
  events: CalendarEvent[];
  onDateSelect: (date: Date) => void;
}

export function MonthView({ date, events, onDateSelect }: MonthViewProps) {
  const getEventTypeColor = (type: CalendarEvent["type"]) => {
    switch (type) {
      case "session":
        return "bg-primary";
      case "meeting":
        return "bg-government-blue";
      case "appointment":
        return "bg-green-500";
      case "deadline":
        return "bg-destructive";
      case "blocked":
        return "bg-orange-500";
      case "veranstaltung":
        return "bg-purple-600";
      case "vacation":
        return "bg-green-500";
      case "vacation_request":
        return "bg-yellow-500";
      default:
        return "bg-muted";
    }
  };

  const getDayEvents = (day: Date) => {
    // Filter events by the specific day using the date field
    return events.filter(event => {
      // For single-day events, check if the event date matches
      if (!event.endTime || event.date.toDateString() === event.endTime.toDateString()) {
        return event.date.toDateString() === day.toDateString();
      }
      
      // For multi-day events (like vacations), check if this day is within the event's span
      const eventStart = new Date(event.date);
      const eventEnd = new Date(event.endTime);
      eventStart.setHours(0, 0, 0, 0);
      eventEnd.setHours(23, 59, 59, 999);
      day.setHours(12, 0, 0, 0); // Middle of day for comparison
      
      return day >= eventStart && day <= eventEnd;
    }).slice(0, 3); // Limit to 3 events per day for display
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(selectedDate) => selectedDate && onDateSelect(selectedDate)}
          className="rounded-md border"
          classNames={{
            day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
            day_today: "bg-accent text-accent-foreground",
          }}
        />
      </div>

      {/* Events for selected day */}
      <div className="bg-card rounded-lg border p-4">
        <h3 className="font-semibold mb-3">
          Termine für {date.toLocaleDateString('de-DE', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </h3>
        
        {getDayEvents(date).length > 0 ? (
          <div className="space-y-2">
            {getDayEvents(date).map((event) => (
              <div key={event.id} className="flex items-center gap-3 p-2 rounded hover:bg-accent">
                <div className={`w-3 h-3 rounded-full ${getEventTypeColor(event.type)}`} />
                <div className="flex-1">
                  <div className="font-medium">{event.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatEventDisplay(event)}
                    {event.location && ` • ${event.location}`}
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {event.type === "session" && "Sitzung"}
                  {event.type === "meeting" && "Meeting"}
                  {event.type === "appointment" && "Termin"}
                  {event.type === "deadline" && "Deadline"}
                  {event.type === "blocked" && "Geblockt"}
                  {event.type === "veranstaltung" && "Veranstaltung"}
                  {event.type === "vacation" && "Urlaub"}
                  {event.type === "vacation_request" && "Urlaubsantrag"}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">Keine Termine für diesen Tag</p>
        )}
      </div>
    </div>
  );
}