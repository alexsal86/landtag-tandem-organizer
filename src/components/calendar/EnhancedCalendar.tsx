import React, { useState, useCallback, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, addDays, subDays, startOfDay, endOfDay, isSameDay, parseISO, addMinutes } from 'date-fns';
import { de } from 'date-fns/locale';

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  type: 'appointment' | 'meeting' | 'task' | 'personal' | 'deadline' | 'session' | 'blocked' | 'veranstaltung' | 'vacation' | 'vacation_request' | 'birthday';
  participants?: string[];
  priority?: 'low' | 'medium' | 'high';
  category?: string;
  resource?: any;
}

interface EnhancedCalendarProps {
  events: CalendarEvent[];
  date: Date;
  view: 'month' | 'week' | 'day';
  onNavigate: (date: Date) => void;
  onView: (view: 'month' | 'week' | 'day') => void;
  onSelectEvent?: (event: CalendarEvent) => void;
  onEventDrop?: (event: CalendarEvent, start: Date, end: Date) => void;
  onEventResize?: (event: CalendarEvent, start: Date, end: Date) => void;
}

interface DragState {
  isDragging: boolean;
  event: CalendarEvent | null;
  startY: number;
  startTime: Date | null;
  currentTime: Date | null;
}

export function EnhancedCalendar({
  events,
  date,
  view,
  onNavigate,
  onView,
  onSelectEvent,
  onEventDrop,
  onEventResize
}: EnhancedCalendarProps) {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    event: null,
    startY: 0,
    startTime: null,
    currentTime: null
  });

  // Time slots for week/day view (every 30 minutes)
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 0; hour < 24; hour++) {
      slots.push({ hour, minute: 0, label: `${hour.toString().padStart(2, '0')}:00` });
      slots.push({ hour, minute: 30, label: `${hour.toString().padStart(2, '0')}:30` });
    }
    return slots;
  }, []);

  const handleEventMouseDown = useCallback((event: CalendarEvent, e: React.MouseEvent) => {
    if (!onEventDrop) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const startTime = new Date(event.start);
    setDragState({
      isDragging: true,
      event,
      startY: e.clientY,
      startTime,
      currentTime: startTime
    });

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.isDragging) return;
      
      const deltaY = e.clientY - dragState.startY;
      const minutesDelta = Math.round(deltaY / 2); // 2px per minute
      const newTime = addMinutes(startTime, minutesDelta);
      
      setDragState(prev => ({
        ...prev,
        currentTime: newTime
      }));
    };

    const handleMouseUp = () => {
      if (dragState.currentTime && dragState.event && dragState.startTime) {
        const timeDiff = dragState.currentTime.getTime() - dragState.startTime.getTime();
        const newStart = new Date(dragState.currentTime);
        const newEnd = new Date(dragState.event.end.getTime() + timeDiff);
        
        onEventDrop(dragState.event, newStart, newEnd);
      }
      
      setDragState({
        isDragging: false,
        event: null,
        startY: 0,
        startTime: null,
        currentTime: null
      });
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [dragState, onEventDrop]);

  const renderEvent = useCallback((event: CalendarEvent, style: React.CSSProperties = {}) => {
    const isBeingDragged = dragState.isDragging && dragState.event?.id === event.id;
    const eventStyle = isBeingDragged && dragState.currentTime 
      ? { ...style, transform: `translateY(${(dragState.currentTime.getTime() - dragState.startTime!.getTime()) / 60000 * 2}px)` }
      : style;

    return (
      <div
        key={event.id}
        className={`
          absolute left-1 right-1 px-2 py-1 rounded text-xs cursor-move
          ${event.type === 'appointment' ? 'bg-blue-500 text-white' : ''}
          ${event.type === 'meeting' ? 'bg-green-500 text-white' : ''}
          ${event.type === 'task' ? 'bg-orange-500 text-white' : ''}
          ${event.type === 'personal' ? 'bg-purple-500 text-white' : ''}
          ${event.type === 'deadline' ? 'bg-red-500 text-white' : ''}
          ${event.type === 'session' ? 'bg-indigo-500 text-white' : ''}
          ${event.type === 'blocked' ? 'bg-orange-600 text-white' : ''}
          ${event.type === 'veranstaltung' ? 'bg-purple-600 text-white' : ''}
          ${event.type === 'vacation' ? 'bg-green-600 text-white' : ''}
          ${event.type === 'vacation_request' ? 'bg-yellow-500 text-black' : ''}
          ${event.type === 'birthday' ? 'bg-pink-500 text-white' : ''}
          ${isBeingDragged ? 'opacity-70 z-50' : 'hover:opacity-80'}
          transition-all duration-200
        `}
        style={eventStyle}
        onMouseDown={(e) => handleEventMouseDown(event, e)}
        onClick={() => onSelectEvent?.(event)}
      >
        <div className="font-medium truncate">{event.title}</div>
        {!event.allDay && (
          <div className="text-xs opacity-90">
            {format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}
          </div>
        )}
      </div>
    );
  }, [dragState, handleEventMouseDown, onSelectEvent]);

  const renderDayView = useCallback(() => {
    const dayEvents = events.filter(event => isSameDay(event.start, date));
    const allDayEvents = dayEvents.filter(event => event.allDay);
    const timedEvents = dayEvents.filter(event => !event.allDay);

    return (
      <div className="flex flex-col h-full">
        {/* All-day events section */}
        {allDayEvents.length > 0 && (
          <div className="border-b border-border p-2 bg-muted/30">
            <div className="text-sm font-medium text-muted-foreground mb-2">Ganztägig</div>
            {allDayEvents.map(event => (
              <div
                key={event.id}
                className={`
                  mb-1 px-2 py-1 rounded text-sm cursor-pointer
                  ${event.type === 'appointment' ? 'bg-blue-500 text-white' : ''}
                  ${event.type === 'meeting' ? 'bg-green-500 text-white' : ''}
                  ${event.type === 'task' ? 'bg-orange-500 text-white' : ''}
                  ${event.type === 'personal' ? 'bg-purple-500 text-white' : ''}
                  ${event.type === 'deadline' ? 'bg-red-500 text-white' : ''}
                  ${event.type === 'session' ? 'bg-indigo-500 text-white' : ''}
                  ${event.type === 'blocked' ? 'bg-orange-600 text-white' : ''}
                  ${event.type === 'veranstaltung' ? 'bg-purple-600 text-white' : ''}
                  ${event.type === 'vacation' ? 'bg-green-600 text-white' : ''}
                  ${event.type === 'vacation_request' ? 'bg-yellow-500 text-black' : ''}
                  ${event.type === 'birthday' ? 'bg-pink-500 text-white' : ''}
                `}
                onClick={() => onSelectEvent?.(event)}
              >
                {event.title}
              </div>
            ))}
          </div>
        )}

        {/* Time slots */}
        <div className="flex-1 overflow-auto">
          <div className="relative" style={{ height: timeSlots.length * 30 }}>
            {timeSlots.map((slot, index) => (
              <div
                key={`${slot.hour}-${slot.minute}`}
                className="absolute inset-x-0 border-b border-border/50"
                style={{ top: index * 30, height: 30 }}
              >
                <div className="text-xs text-muted-foreground px-2 py-1">
                  {slot.label}
                </div>
              </div>
            ))}
            
            {timedEvents.map(event => {
              const startMinutes = event.start.getHours() * 60 + event.start.getMinutes();
              const duration = (event.end.getTime() - event.start.getTime()) / (1000 * 60);
              const top = (startMinutes / 30) * 30;
              const height = Math.max((duration / 30) * 30, 30);

              return renderEvent(event, {
                top: `${top}px`,
                height: `${height}px`,
                zIndex: 10
              });
            })}
          </div>
        </div>
      </div>
    );
  }, [date, events, timeSlots, renderEvent, onSelectEvent]);

  const renderWeekView = useCallback(() => {
    const weekStart = startOfWeek(date, { locale: de });
    const weekEnd = endOfWeek(date, { locale: de });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    return (
      <div className="flex flex-col h-full">
        {/* Week header */}
        <div className="flex border-b border-border">
          <div className="w-16 border-r border-border p-2"></div>
          {days.map(day => (
            <div key={day.toISOString()} className="flex-1 border-r border-border last:border-r-0 p-2 text-center">
              <div className="text-sm font-medium">{format(day, 'EEE', { locale: de })}</div>
              <div className="text-lg">{format(day, 'd')}</div>
            </div>
          ))}
        </div>

        {/* All-day events row */}
        <div className="flex border-b border-border">
          <div className="w-16 border-r border-border p-2 text-xs text-muted-foreground">
            Ganztägig
          </div>
          {days.map(day => {
            const dayAllDayEvents = events.filter(event => 
              event.allDay && isSameDay(event.start, day)
            );
            
            return (
              <div key={day.toISOString()} className="flex-1 border-r border-border last:border-r-0 p-1 min-h-[40px]">
                {dayAllDayEvents.map(event => (
                  <div
                    key={event.id}
                    className={`
                      mb-1 px-2 py-1 rounded text-xs cursor-pointer
                      ${event.type === 'appointment' ? 'bg-blue-500 text-white' : ''}
                      ${event.type === 'meeting' ? 'bg-green-500 text-white' : ''}
                      ${event.type === 'task' ? 'bg-orange-500 text-white' : ''}
                      ${event.type === 'personal' ? 'bg-purple-500 text-white' : ''}
                      ${event.type === 'deadline' ? 'bg-red-500 text-white' : ''}
                      ${event.type === 'session' ? 'bg-indigo-500 text-white' : ''}
                      ${event.type === 'blocked' ? 'bg-orange-600 text-white' : ''}
                      ${event.type === 'veranstaltung' ? 'bg-purple-600 text-white' : ''}
                      ${event.type === 'vacation' ? 'bg-green-600 text-white' : ''}
                      ${event.type === 'vacation_request' ? 'bg-yellow-500 text-black' : ''}
                      ${event.type === 'birthday' ? 'bg-pink-500 text-white' : ''}
                    `}
                    onClick={() => onSelectEvent?.(event)}
                  >
                    {event.title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        <div className="flex-1 overflow-auto">
          <div className="relative flex" style={{ height: timeSlots.length * 30 }}>
            {/* Time labels */}
            <div className="w-16 border-r border-border">
              {timeSlots.map((slot, index) => (
                <div
                  key={`${slot.hour}-${slot.minute}`}
                  className="border-b border-border/50 text-xs text-muted-foreground px-2 py-1"
                  style={{ height: 30 }}
                >
                  {slot.minute === 0 ? slot.label : ''}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map(day => {
              const dayTimedEvents = events.filter(event => 
                !event.allDay && isSameDay(event.start, day)
              );

              return (
                <div
                  key={day.toISOString()}
                  className="flex-1 border-r border-border last:border-r-0 relative"
                >
                  {timeSlots.map((slot, index) => (
                    <div
                      key={`${slot.hour}-${slot.minute}`}
                      className="border-b border-border/50"
                      style={{ height: 30 }}
                    />
                  ))}
                  
                  {dayTimedEvents.map(event => {
                    const startMinutes = event.start.getHours() * 60 + event.start.getMinutes();
                    const duration = (event.end.getTime() - event.start.getTime()) / (1000 * 60);
                    const top = (startMinutes / 30) * 30;
                    const height = Math.max((duration / 30) * 30, 30);

                    return renderEvent(event, {
                      top: `${top}px`,
                      height: `${height}px`,
                      zIndex: 10
                    });
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }, [date, events, timeSlots, renderEvent, onSelectEvent]);

  const renderMonthView = useCallback(() => {
    const monthStart = startOfWeek(new Date(date.getFullYear(), date.getMonth(), 1), { locale: de });
    const monthEnd = endOfWeek(new Date(date.getFullYear(), date.getMonth() + 1, 0), { locale: de });
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    return (
      <div className="flex flex-col h-full">
        {/* Week headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
            <div key={day} className="p-2 text-center text-sm font-medium border-r border-border last:border-r-0">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="flex-1 grid grid-cols-7 gap-0">
          {days.map(day => {
            const dayEvents = events.filter(event => isSameDay(event.start, day));
            const isCurrentMonth = day.getMonth() === date.getMonth();
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={day.toISOString()}
                className={`
                  border-r border-b border-border last:border-r-0 p-1 min-h-[120px]
                  ${!isCurrentMonth ? 'bg-muted/30 text-muted-foreground' : ''}
                  ${isToday ? 'bg-primary/10' : ''}
                `}
              >
                <div className={`text-sm font-medium mb-1 ${isToday ? 'text-primary' : ''}`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map(event => (
                    <div
                      key={event.id}
                      className={`
                        text-xs px-1 py-0.5 rounded cursor-pointer truncate
                        ${event.type === 'appointment' ? 'bg-blue-500 text-white' : ''}
                        ${event.type === 'meeting' ? 'bg-green-500 text-white' : ''}
                        ${event.type === 'task' ? 'bg-orange-500 text-white' : ''}
                        ${event.type === 'personal' ? 'bg-purple-500 text-white' : ''}
                        ${event.type === 'deadline' ? 'bg-red-500 text-white' : ''}
                        ${event.type === 'session' ? 'bg-indigo-500 text-white' : ''}
                        ${event.type === 'blocked' ? 'bg-orange-600 text-white' : ''}
                        ${event.type === 'veranstaltung' ? 'bg-purple-600 text-white' : ''}
                        ${event.type === 'vacation' ? 'bg-green-600 text-white' : ''}
                        ${event.type === 'vacation_request' ? 'bg-yellow-500 text-black' : ''}
                        ${event.type === 'birthday' ? 'bg-pink-500 text-white' : ''}
                      `}
                      onClick={() => onSelectEvent?.(event)}
                    >
                      {event.allDay ? (
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="w-3 h-3" />
                          {event.title}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(event.start, 'HH:mm')} {event.title}
                        </span>
                      )}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      +{dayEvents.length - 3} mehr
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }, [date, events, onSelectEvent]);

  const navigate = useCallback((direction: 'prev' | 'next' | 'today') => {
    let newDate = new Date(date);
    
    if (direction === 'today') {
      newDate = new Date();
    } else if (direction === 'prev') {
      switch (view) {
        case 'month':
          newDate.setMonth(newDate.getMonth() - 1);
          break;
        case 'week':
          newDate = subWeeks(newDate, 1);
          break;
        case 'day':
          newDate = subDays(newDate, 1);
          break;
      }
    } else {
      switch (view) {
        case 'month':
          newDate.setMonth(newDate.getMonth() + 1);
          break;
        case 'week':
          newDate = addWeeks(newDate, 1);
          break;
        case 'day':
          newDate = addDays(newDate, 1);
          break;
      }
    }
    
    onNavigate(newDate);
  }, [date, view, onNavigate]);

  const getDateLabel = useCallback(() => {
    switch (view) {
      case 'month':
        return format(date, 'MMMM yyyy', { locale: de });
      case 'week':
        const weekStart = startOfWeek(date, { locale: de });
        const weekEnd = endOfWeek(date, { locale: de });
        return `${format(weekStart, 'd. MMM', { locale: de })} - ${format(weekEnd, 'd. MMM yyyy', { locale: de })}`;
      case 'day':
        return format(date, 'EEEE, d. MMMM yyyy', { locale: de });
      default:
        return '';
    }
  }, [date, view]);

  return (
    <Card className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('prev')}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('today')}>
            Heute
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('next')}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        
        <h2 className="text-lg font-semibold">{getDateLabel()}</h2>
        
        <div className="flex items-center gap-1">
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

      {/* Calendar content */}
      <div className="flex-1 overflow-hidden">
        {view === 'month' && renderMonthView()}
        {view === 'week' && renderWeekView()}
        {view === 'day' && renderDayView()}
      </div>
    </Card>
  );
}