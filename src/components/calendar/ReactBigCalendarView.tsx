import React from 'react';
import { CalendarEvent } from '../CalendarView';
import { CalendarEventComponent } from './CalendarEventComponent';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export interface ReactBigCalendarViewProps {
  date: Date;
  events: CalendarEvent[];
  view: 'month' | 'week' | 'day';
  onNavigate: (date: Date) => void;
  onView: (view: 'month' | 'week' | 'day') => void;
  onSelectEvent: (event: CalendarEvent) => void;
  onSelectSlot?: (slotInfo: { start: Date; end: Date; slots: Date[] }) => void;
}

export function ReactBigCalendarView({
  date,
  events,
  view,
  onNavigate,
  onView,
  onSelectEvent,
  onSelectSlot
}: ReactBigCalendarViewProps) {
  
  return (
    <Card className="p-6">
      <div className="text-center space-y-4">
        <h2 className="text-xl font-semibold">Enhanced Calendar View (Phase 2)</h2>
        <p className="text-muted-foreground">
          Professionelle Kalender-Implementierung mit besserer Event-Darstellung
        </p>
        
        <div className="text-sm text-muted-foreground space-y-2">
          <p>Aktuelle Ansicht: <span className="font-medium">{view}</span></p>
          <p>Datum: <span className="font-medium">{format(date, 'dd. MMMM yyyy', { locale: de })}</span></p>
          <p>Termine: <span className="font-medium">{events.length}</span></p>
        </div>

        {/* Show sample events with enhanced styling */}
        {events.length > 0 && (
          <div className="mt-6 space-y-3">
            <h3 className="font-medium">Beispiel-Termine (Enhanced Styling):</h3>
            <div className="space-y-2 max-w-md mx-auto">
              {events.slice(0, 3).map((event) => (
                <CalendarEventComponent
                  key={event.id}
                  event={event}
                  onClick={onSelectEvent}
                />
              ))}
            </div>
          </div>
        )}
        
        <div className="mt-6 p-4 bg-accent/10 rounded-lg">
          <h4 className="font-medium mb-2">Phase 2 Features:</h4>
          <ul className="text-sm text-left space-y-1">
            <li>✅ Enhanced Event Component mit besserer Darstellung</li>
            <li>✅ Verbesserte Farben und Kontraste</li>
            <li>✅ Event-Type Badges und Icons</li>
            <li>✅ Priority Indicators</li>
            <li>✅ Responsive Design</li>
            <li>⏳ Complete Calendar Grid Integration</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}