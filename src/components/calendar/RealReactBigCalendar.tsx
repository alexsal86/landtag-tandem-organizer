import React, { useState, useCallback, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, MapPin, Users } from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addWeeks, addMonths, subWeeks, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';
import { CalendarEvent } from '@/components/CalendarView';
import { CalendarEventComponent } from './CalendarEventComponent';

interface RealReactBigCalendarProps {
  events: CalendarEvent[];
  date: Date;
  view: 'month' | 'week' | 'day';
  onNavigate: (date: Date) => void;
  onView: (view: 'month' | 'week' | 'day') => void;
  onSelectEvent: (event: CalendarEvent) => void;
  onSelectSlot?: (slotInfo: { start: Date; end: Date; slots: Date[] }) => void;
}

interface DragState {
  isDragging: boolean;
  draggedEvent: CalendarEvent | null;
  dragPreview: {
    x: number;
    y: number;
    visible: boolean;
  };
}

export function RealReactBigCalendar({
  events,
  date,
  view,
  onNavigate,
  onView,
  onSelectEvent,
  onSelectSlot
}: RealReactBigCalendarProps) {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedEvent: null,
    dragPreview: { x: 0, y: 0, visible: false }
  });

  // Navigation handlers
  const navigatePrev = useCallback(() => {
    const newDate = view === 'month' 
      ? subMonths(date, 1)
      : view === 'week' 
        ? subWeeks(date, 1)
        : addDays(date, -1);
    onNavigate(newDate);
  }, [date, view, onNavigate]);

  const navigateNext = useCallback(() => {
    const newDate = view === 'month' 
      ? addMonths(date, 1)
      : view === 'week' 
        ? addWeeks(date, 1)
        : addDays(date, 1);
    onNavigate(newDate);
  }, [date, view, onNavigate]);

  const navigateToday = useCallback(() => {
    onNavigate(new Date());
  }, [onNavigate]);

  // Drag and drop handlers
  const handleMouseDown = useCallback((event: CalendarEvent, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setDragState({
      isDragging: true,
      draggedEvent: event,
      dragPreview: {
        x: e.clientX,
        y: e.clientY,
        visible: true
      }
    });

    const handleMouseMove = (e: MouseEvent) => {
      setDragState(prev => ({
        ...prev,
        dragPreview: {
          x: e.clientX,
          y: e.clientY,
          visible: true
        }
      }));
    };

    const handleMouseUp = (e: MouseEvent) => {
      // Find the target time slot
      const element = document.elementFromPoint(e.clientX, e.clientY);
      const timeSlot = element?.closest('[data-time-slot]');
      
      if (timeSlot && dragState.draggedEvent) {
        const newDateTime = timeSlot.getAttribute('data-time-slot');
        if (newDateTime) {
          // Here you would update the event in the database
          console.log('Moving event to:', newDateTime, dragState.draggedEvent);
          // Example: updateEventDateTime(draggedEvent.id, new Date(newDateTime));
        }
      }

      setDragState({
        isDragging: false,
        draggedEvent: null,
        dragPreview: { x: 0, y: 0, visible: false }
      });

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [dragState.draggedEvent]);

  // Event layout calculations
  const layoutEvents = useMemo(() => {
    const eventsByDate: Record<string, CalendarEvent[]> = {};
    
    events.forEach(event => {
      const dateKey = format(new Date(event.date), 'yyyy-MM-dd');
      if (!eventsByDate[dateKey]) {
        eventsByDate[dateKey] = [];
      }
      eventsByDate[dateKey].push(event);
    });

    // Sort events by time within each date
    Object.keys(eventsByDate).forEach(dateKey => {
      eventsByDate[dateKey].sort((a, b) => {
        const timeA = a.time || '00:00';
        const timeB = b.time || '00:00';
        return timeA.localeCompare(timeB);
      });
    });

    return eventsByDate;
  }, [events]);

  // Get days for the current view
  const getDaysInView = useMemo(() => {
    switch (view) {
      case 'month': {
        const start = startOfMonth(date);
        const end = endOfMonth(date);
        const monthStart = startOfWeek(start, { locale: de });
        const monthEnd = endOfWeek(end, { locale: de });
        return eachDayOfInterval({ start: monthStart, end: monthEnd });
      }
      case 'week': {
        const start = startOfWeek(date, { locale: de });
        const end = endOfWeek(date, { locale: de });
        return eachDayOfInterval({ start, end });
      }
      case 'day':
        return [date];
      default:
        return [];
    }
  }, [date, view]);

  const renderHeader = () => (
    <div className="flex items-center justify-between p-4 border-b border-border">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={navigatePrev}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={navigateNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={navigateToday}>
          Heute
        </Button>
      </div>
      
      <h2 className="text-lg font-semibold">
        {view === 'month' && format(date, 'MMMM yyyy', { locale: de })}
        {view === 'week' && `${format(startOfWeek(date, { locale: de }), 'dd. MMM', { locale: de })} - ${format(endOfWeek(date, { locale: de }), 'dd. MMM yyyy', { locale: de })}`}
        {view === 'day' && format(date, 'dd. MMMM yyyy', { locale: de })}
      </h2>

      <div className="flex gap-1">
        <Button 
          variant={view === 'month' ? 'default' : 'outline'} 
          size="sm" 
          onClick={() => onView('month')}
        >
          Monat
        </Button>
        <Button 
          variant={view === 'week' ? 'default' : 'outline'} 
          size="sm" 
          onClick={() => onView('week')}
        >
          Woche  
        </Button>
        <Button 
          variant={view === 'day' ? 'default' : 'outline'} 
          size="sm" 
          onClick={() => onView('day')}
        >
          Tag
        </Button>
      </div>
    </div>
  );

  const renderMonthView = () => (
    <div className="grid grid-cols-7 gap-0">
      {/* Day headers */}
      {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
        <div key={day} className="p-3 text-center font-medium text-muted-foreground border-b border-border">
          {day}
        </div>
      ))}
      
      {/* Calendar days */}
      {getDaysInView.map(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const dayEvents = layoutEvents[dateKey] || [];
        const isCurrentMonth = day.getMonth() === date.getMonth();
        
        return (
          <div
            key={day.toISOString()}
            className={`min-h-[120px] p-2 border-b border-r border-border relative ${
              !isCurrentMonth ? 'bg-muted/30' : ''
            } ${isToday(day) ? 'bg-accent/20' : ''}`}
            data-time-slot={day.toISOString()}
            onClick={() => onSelectSlot?.({ start: day, end: day, slots: [day] })}
          >
            <div className={`text-sm ${isToday(day) ? 'font-bold text-primary' : isCurrentMonth ? '' : 'text-muted-foreground'}`}>
              {format(day, 'd')}
            </div>
            
            <div className="mt-1 space-y-1">
              {dayEvents.slice(0, 3).map((event, idx) => (
                <div
                  key={event.id}
                  className="cursor-move"
                  onMouseDown={(e) => handleMouseDown(event, e)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEvent(event);
                  }}
                >
                  <CalendarEventComponent 
                    event={event} 
                    onClick={onSelectEvent}
                    compact
                  />
                </div>
              ))}
              {dayEvents.length > 3 && (
                <div className="text-xs text-muted-foreground">
                  +{dayEvents.length - 3} weitere
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderWeekView = () => (
    <div className="flex flex-col">
      {/* Time grid */}
      <div className="flex">
        {/* Time column */}
        <div className="w-16 flex-shrink-0">
          <div className="h-12 border-b border-border"></div>
          {Array.from({ length: 24 }, (_, hour) => (
            <div key={hour} className="h-12 border-b border-border text-xs text-muted-foreground p-1">
              {hour.toString().padStart(2, '0')}:00
            </div>
          ))}
        </div>
        
        {/* Days grid */}
        <div className="flex flex-1">
          {getDaysInView.map(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayEvents = layoutEvents[dateKey] || [];
            
            return (
              <div key={day.toISOString()} className="flex-1 border-r border-border">
                {/* Day header */}
                <div className={`h-12 border-b border-border p-2 text-center ${isToday(day) ? 'bg-accent text-accent-foreground' : ''}`}>
                  <div className="text-sm font-medium">{format(day, 'EEE', { locale: de })}</div>
                  <div className="text-xs">{format(day, 'd')}</div>
                </div>
                
                {/* Hour slots */}
                {Array.from({ length: 24 }, (_, hour) => {
                  const hourEvents = dayEvents.filter(event => {
                    const eventHour = parseInt(event.time?.split(':')[0] || '0');
                    return eventHour === hour;
                  });
                  
                  return (
                    <div
                      key={hour}
                      className="h-12 border-b border-border relative hover:bg-accent/10 cursor-pointer"
                      data-time-slot={new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour).toISOString()}
                      onClick={() => {
                        const slotDate = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour);
                        onSelectSlot?.({ start: slotDate, end: slotDate, slots: [slotDate] });
                      }}
                    >
                      {hourEvents.map(event => (
                        <div
                          key={event.id}
                          className="absolute inset-x-0 cursor-move z-10"
                          onMouseDown={(e) => handleMouseDown(event, e)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectEvent(event);
                          }}
                        >
                          <CalendarEventComponent 
                            event={event} 
                            onClick={onSelectEvent}
                            style={{ fontSize: '0.75rem' }}
                          />
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderDayView = () => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const dayEvents = layoutEvents[dateKey] || [];
    
    return (
      <div className="flex">
        {/* Time column */}
        <div className="w-20 flex-shrink-0">
          {Array.from({ length: 24 }, (_, hour) => (
            <div key={hour} className="h-16 border-b border-border text-sm text-muted-foreground p-2">
              {hour.toString().padStart(2, '0')}:00
            </div>
          ))}
        </div>
        
        {/* Events column */}
        <div className="flex-1 border-l border-border">
          {Array.from({ length: 24 }, (_, hour) => {
            const hourEvents = dayEvents.filter(event => {
              const eventHour = parseInt(event.time?.split(':')[0] || '0');
              return eventHour === hour;
            });
            
            return (
              <div
                key={hour}
                className="h-16 border-b border-border relative hover:bg-accent/10 cursor-pointer"
                data-time-slot={new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour).toISOString()}
                onClick={() => {
                  const slotDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour);
                  onSelectSlot?.({ start: slotDate, end: slotDate, slots: [slotDate] });
                }}
              >
                {hourEvents.map(event => (
                  <div
                    key={event.id}
                    className="absolute inset-x-2 cursor-move z-10"
                    onMouseDown={(e) => handleMouseDown(event, e)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEvent(event);
                    }}
                  >
                    <CalendarEventComponent 
                      event={event} 
                      onClick={onSelectEvent}
                    />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Card className="w-full">
      {renderHeader()}
      
      <div className="relative overflow-hidden">
        <div className={`transition-all duration-200 ${dragState.isDragging ? 'select-none' : ''}`}>
          {view === 'month' && renderMonthView()}
          {view === 'week' && renderWeekView()}
          {view === 'day' && renderDayView()}
        </div>
        
        {/* Drag preview */}
        {dragState.dragPreview.visible && dragState.draggedEvent && (
          <div
            className="fixed z-50 pointer-events-none opacity-80"
            style={{
              left: dragState.dragPreview.x - 50,
              top: dragState.dragPreview.y - 20,
            }}
          >
            <CalendarEventComponent 
              event={dragState.draggedEvent} 
              onClick={() => {}}
              compact
            />
          </div>
        )}
      </div>
      
      {/* Enhanced Features Badge */}
      <div className="p-3 border-t border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            <CalendarIcon className="w-3 h-3 mr-1" />
            Enhanced Calendar v2.0
          </Badge>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Drag & Drop
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              Smart Layout
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {events.length} Events
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}