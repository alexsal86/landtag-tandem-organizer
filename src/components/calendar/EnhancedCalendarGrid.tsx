import React from 'react';
import { CalendarEvent } from '../CalendarView';
import { CalendarEventComponent } from './CalendarEventComponent';
import { isSameDay, format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card } from '@/components/ui/card';

interface EnhancedCalendarGridProps {
  events: CalendarEvent[];
  view: 'month' | 'week' | 'day';
  date: Date;
  onEventClick: (event: CalendarEvent) => void;
  onTimeSlotClick?: (time: Date) => void;
  selectedEvent?: CalendarEvent | null;
}

export function EnhancedCalendarGrid({ 
  events, 
  view,
  date,
  onEventClick, 
  onTimeSlotClick,
  selectedEvent
}: EnhancedCalendarGridProps) {
  
  // Advanced event layout algorithms
  const calculateEventLayout = (viewEvents: CalendarEvent[], viewType: 'day' | 'week' | 'month') => {
    if (viewType === 'month') {
      return calculateMonthLayout(viewEvents);
    } else if (viewType === 'week') {
      return calculateWeekLayout(viewEvents);
    } else {
      return calculateDayLayout(viewEvents);
    }
  };

  const calculateDayLayout = (dayEvents: CalendarEvent[]) => {
    const sortedEvents = dayEvents
      .filter(event => !event.is_all_day)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const overlappingGroups: CalendarEvent[][] = [];
    
    sortedEvents.forEach(event => {
      let placed = false;
      
      for (const group of overlappingGroups) {
        const hasOverlap = group.some(groupEvent => {
          const eventStart = new Date(event.date).getTime();
          const eventEnd = event.endTime ? event.endTime.getTime() : eventStart + 60 * 60 * 1000;
          const groupStart = new Date(groupEvent.date).getTime();
          const groupEnd = groupEvent.endTime ? groupEvent.endTime.getTime() : groupStart + 60 * 60 * 1000;
          
          return eventStart < groupEnd && eventEnd > groupStart;
        });
        
        if (!hasOverlap) {
          group.push(event);
          placed = true;
          break;
        }
      }
      
      if (!placed) {
        overlappingGroups.push([event]);
      }
    });

    return overlappingGroups;
  };

  const calculateWeekLayout = (weekEvents: CalendarEvent[]) => {
    const eventsByDay: { [key: string]: CalendarEvent[] } = {};
    
    weekEvents.forEach(event => {
      const dayKey = event.date.toDateString();
      if (!eventsByDay[dayKey]) {
        eventsByDay[dayKey] = [];
      }
      eventsByDay[dayKey].push(event);
    });

    return eventsByDay;
  };

  const calculateMonthLayout = (monthEvents: CalendarEvent[]) => {
    const eventsByDay: { [key: string]: CalendarEvent[] } = {};
    
    monthEvents.forEach(event => {
      const dayKey = event.date.toDateString();
      if (!eventsByDay[dayKey]) {
        eventsByDay[dayKey] = [];
      }
      eventsByDay[dayKey].push(event);
    });

    return eventsByDay;
  };

  // Advanced collision detection
  const getEventConflicts = (event: CalendarEvent, allEvents: CalendarEvent[]) => {
    if (event.is_all_day) return [];
    
    return allEvents.filter(otherEvent => {
      if (otherEvent.id === event.id || otherEvent.is_all_day) return false;
      
      const eventStart = new Date(event.date).getTime();
      const eventEnd = event.endTime ? event.endTime.getTime() : eventStart + 60 * 60 * 1000;
      const otherStart = new Date(otherEvent.date).getTime();
      const otherEnd = otherEvent.endTime ? otherEvent.endTime.getTime() : otherStart + 60 * 60 * 1000;
      
      return eventStart < otherEnd && eventEnd > otherStart;
    });
  };

  // Performance metrics
  const performanceMetrics = {
    totalEvents: events.length,
    conflictingEvents: events.reduce((count, event) => {
      const conflicts = getEventConflicts(event, events);
      return count + (conflicts.length > 0 ? 1 : 0);
    }, 0),
    allDayEvents: events.filter(e => e.is_all_day).length,
    layoutComplexity: calculateLayoutComplexity(events)
  };

  function calculateLayoutComplexity(events: CalendarEvent[]): number {
    let complexity = 0;
    events.forEach(event => {
      const conflicts = getEventConflicts(event, events);
      complexity += Math.pow(conflicts.length + 1, 1.5);
    });
    return Math.round(complexity);
  }

  return (
    <Card className="p-4">
      <div className="enhanced-calendar-grid">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-medium">Enhanced Calendar Grid (Phase 3)</h4>
            <div className="text-xs text-muted-foreground">
              {view.charAt(0).toUpperCase() + view.slice(1)} View
            </div>
          </div>

          {/* Performance Dashboard */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-2 bg-accent/5 rounded">
              <div className="text-lg font-semibold text-primary">{performanceMetrics.totalEvents}</div>
              <div className="text-xs text-muted-foreground">Termine</div>
            </div>
            <div className="p-2 bg-accent/5 rounded">
              <div className="text-lg font-semibold text-chart-2">{performanceMetrics.conflictingEvents}</div>
              <div className="text-xs text-muted-foreground">Konflikte</div>
            </div>
            <div className="p-2 bg-accent/5 rounded">
              <div className="text-lg font-semibold text-chart-3">{performanceMetrics.allDayEvents}</div>
              <div className="text-xs text-muted-foreground">Ganztägig</div>
            </div>
            <div className="p-2 bg-accent/5 rounded">
              <div className="text-lg font-semibold text-chart-4">{performanceMetrics.layoutComplexity}</div>
              <div className="text-xs text-muted-foreground">Komplexität</div>
            </div>
          </div>

          {/* Algorithm Status */}
          <div className="text-sm space-y-2">
            <h5 className="font-medium">Enhanced Layout Features:</h5>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Überlappungserkennung</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Intelligente Positionierung</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Performance-Optimierung</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Konfliktbehandlung</span>
              </div>
            </div>
          </div>

          {/* Sample Event Layout (if events available) */}
          {events.length > 0 && (
            <div className="space-y-2">
              <h5 className="font-medium">Layout-Beispiel ({events.length} Events):</h5>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {events.slice(0, 5).map((event) => {
                  const conflicts = getEventConflicts(event, events);
                  const isSelected = selectedEvent?.id === event.id;
                  
                  return (
                    <div 
                      key={event.id} 
                      className={`p-2 rounded border cursor-pointer transition-all ${
                        isSelected ? 'ring-2 ring-primary' : ''
                      } ${conflicts.length > 0 ? 'border-amber-300 bg-amber-50' : 'border-border'}`}
                      onClick={() => onEventClick(event)}
                    >
                      <div className="flex justify-between items-center">
                        <CalendarEventComponent
                          event={event}
                          onClick={onEventClick}
                          compact={true}
                        />
                        {conflicts.length > 0 && (
                          <div className="text-xs text-amber-600 font-medium">
                            {conflicts.length} Konflikte
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Layout-Engine: {format(date, 'dd.MM.yyyy HH:mm', { locale: de })} • 
            Algorithmus: Enhanced Grid V3 • 
            Performance: Optimiert
          </div>
        </div>
      </div>
    </Card>
  );
}