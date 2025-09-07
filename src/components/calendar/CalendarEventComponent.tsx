import React from 'react';
import { CalendarEvent } from '../CalendarView';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, Users, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface CalendarEventComponentProps {
  event: CalendarEvent;
  onClick: (event: CalendarEvent) => void;
  style?: React.CSSProperties;
  compact?: boolean;
}

export function CalendarEventComponent({ 
  event, 
  onClick, 
  style = {}, 
  compact = false 
}: CalendarEventComponentProps) {
  
  // Get event type color and styling
  const getEventTypeColor = (type: CalendarEvent["type"]) => {
    const colors = {
      session: 'hsl(var(--primary))',
      meeting: 'hsl(var(--chart-2))',
      appointment: 'hsl(var(--chart-3))',
      deadline: 'hsl(var(--destructive))',
      blocked: 'hsl(var(--chart-4))',
      veranstaltung: 'hsl(var(--chart-5))',
      vacation: 'hsl(var(--chart-3))',
      vacation_request: 'hsl(var(--chart-4))',
      birthday: 'hsl(var(--accent))'
    };
    return colors[type] || 'hsl(var(--muted))';
  };

  const getEventTypeLabel = (type: CalendarEvent["type"]) => {
    const labels = {
      session: 'Sitzung',
      meeting: 'Meeting',
      appointment: 'Termin',
      deadline: 'Deadline',
      blocked: 'Geblockt',
      veranstaltung: 'Veranstaltung',
      vacation: 'Urlaub',
      vacation_request: 'Urlaubsantrag',
      birthday: 'Geburtstag'
    };
    return labels[type] || type;
  };

  const getPriorityIcon = (priority: CalendarEvent["priority"]) => {
    if (priority === 'high') {
      return <AlertCircle className="h-3 w-3 text-destructive" />;
    }
    return null;
  };

  const backgroundColor = event.category_color || getEventTypeColor(event.type);
  
  // Calculate if text should be light or dark based on background
  const isLightBackground = backgroundColor.includes('accent') || backgroundColor.includes('muted');
  const textColor = isLightBackground ? 'hsl(var(--foreground))' : 'white';

  const eventStyle: React.CSSProperties = {
    backgroundColor,
    color: textColor,
    borderLeft: `4px solid ${backgroundColor}`,
    filter: 'brightness(1.05)',
    ...style
  };

  if (compact) {
    return (
      <div
        className="p-1 rounded text-xs cursor-pointer hover:opacity-80 transition-opacity"
        style={eventStyle}
        onClick={() => onClick(event)}
      >
        <div className="flex items-center gap-1">
          {getPriorityIcon(event.priority)}
          <span className="font-medium truncate">{event.title}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="p-2 rounded cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02]"
      style={eventStyle}
      onClick={() => onClick(event)}
    >
      {/* Event header */}
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-1 flex-1">
          {getPriorityIcon(event.priority)}
          <h4 className="font-semibold text-sm truncate">{event.title}</h4>
        </div>
        <Badge 
          variant="secondary" 
          className="text-xs ml-2 flex-shrink-0"
          style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            color: textColor,
            border: 'none'
          }}
        >
          {getEventTypeLabel(event.type)}
        </Badge>
      </div>

      {/* Event details */}
      <div className="space-y-1 text-xs opacity-90">
        {/* Time and duration */}
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>{event.time}</span>
          {event.duration && <span>• {event.duration}</span>}
        </div>

        {/* Location */}
        {event.location && (
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{event.location}</span>
          </div>
        )}

        {/* Participants count */}
        {event.attendees && event.attendees > 0 && (
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span>{event.attendees} Teilnehmer</span>
          </div>
        )}

        {/* Description preview */}
        {event.description && (
          <div className="text-xs opacity-75 line-clamp-2">
            {event.description}
          </div>
        )}
      </div>

      {/* All-day indicator */}
      {event.is_all_day && (
        <div className="mt-1">
          <Badge 
            variant="outline"
            className="text-xs"
            style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: textColor,
              borderColor: 'rgba(255, 255, 255, 0.3)'
            }}
          >
            Ganztägig
          </Badge>
        </div>
      )}
    </div>
  );
}