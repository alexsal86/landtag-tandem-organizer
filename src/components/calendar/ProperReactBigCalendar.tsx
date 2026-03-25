import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import { debugConsole } from '@/utils/debugConsole';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { CalendarEventAdapter, type RBCEvent } from './CalendarEventAdapter';
import type { CalendarEvent } from './types';

interface CalendarEventViewModel extends RBCEvent {
  resource: CalendarEvent;
}

const toCalendarEventViewModel = (event: RBCEvent): CalendarEventViewModel | null => {
  const resource = event.resource;
  if (!resource || typeof resource !== 'object') {
    return null;
  }

  return event as CalendarEventViewModel;
};

/* ── Compact month event component ── */
const MonthEvent = ({ event }: { event: RBCEvent }) => {
  const rbcEvent = event;
  const timeStr = rbcEvent.allDay ? '' : format(rbcEvent.start, 'HH:mm', { locale: de });

  return (
    <div className="flex items-center gap-1 truncate text-[0.65rem] leading-tight">
      {timeStr && (
        <span className="font-semibold opacity-90">{timeStr}</span>
      )}
      <span className="truncate">{rbcEvent.title}</span>
    </div>
  );
};

interface ProperReactBigCalendarProps {
  events: CalendarEvent[];
  onEventSelect?: (event: CalendarEvent) => void;
  onEventDrop?: (event: CalendarEvent, start: Date, end: Date) => void;
  onEventResize?: (event: CalendarEvent, start: Date, end: Date) => void;
  onSelectSlot?: (slotInfo: { start: Date; end: Date; slots: Date[] }) => void;
  view?: string;
  date?: Date;
  onNavigate?: (date: Date) => void;
  onView?: (view: string) => void;
}

// Set up date-fns localizer with German locale
const locales = { 'de': de };
const localizer = dateFnsLocalizer({
  format: (date: Date, formatStr: string, options?: any) =>
    format(date, formatStr, { ...options, locale: de }),
  parse: (dateStr: string, formatStr: string, backupDate: Date) =>
    parse(dateStr, formatStr, backupDate, { locale: de }),
  startOfWeek: () => startOfWeek(new Date(), { locale: de }),
  getDay,
  locales,
});

// Create DnD Calendar with drag and drop support
const DnDCalendar = withDragAndDrop(Calendar);

const WeekHeader = ({ date }: { date: Date }) => {
  const isToday = isSameDay(date, new Date());
  const weekdayLabel = format(date, 'EEE', { locale: de }).replace(/\.$/, '').toUpperCase();

  return (
    <div className="rbc-custom-week-header">
      <span className="rbc-custom-weekday">{weekdayLabel}</span>
      <span className={isToday ? 'rbc-custom-day rbc-custom-day--today' : 'rbc-custom-day'}>
        {format(date, 'd', { locale: de })}
      </span>
    </div>
  );
};

// German messages for React Big Calendar
const messages = {
  allDay: 'Ganztägig',
  previous: 'Zurück',
  next: 'Weiter',
  today: 'Heute',
  month: 'Monat',
  week: 'Woche',
  day: 'Tag',
  agenda: 'Agenda',
  date: 'Datum',
  time: 'Zeit',
  event: 'Termin',
  noEventsInRange: 'Keine Termine in diesem Zeitraum.',
  showMore: (total: number) => `+ ${total} weitere`
};

// German date formats using date-fns tokens
const formats = {
  monthHeaderFormat: 'MMMM yyyy',
  dayHeaderFormat: 'EEEE, dd. MMMM yyyy',
  dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
    `${format(start, 'dd. MMM', { locale: de })} – ${format(end, 'dd. MMM yyyy', { locale: de })}`,
  timeGutterFormat: 'HH:mm',
  eventTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
    `${format(start, 'HH:mm', { locale: de })} – ${format(end, 'HH:mm', { locale: de })}`,
  dayFormat: 'dd',
  dateFormat: 'dd',
  weekdayFormat: 'EEEE',
  agendaHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
    `${format(start, 'dd. MMMM', { locale: de })} – ${format(end, 'dd. MMMM yyyy', { locale: de })}`,
  agendaDateFormat: 'EEEE, dd. MMMM',
  agendaTimeFormat: 'HH:mm',
  agendaTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
    `${format(start, 'HH:mm', { locale: de })} – ${format(end, 'HH:mm', { locale: de })}`,
  selectRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
    `${format(start, 'dd. MMM', { locale: de })} – ${format(end, 'dd. MMM', { locale: de })}`
};

const ProperReactBigCalendar: React.FC<ProperReactBigCalendarProps> = ({
  events,
  date,
  view,
  onNavigate,
  onView,
  onEventSelect,
  onSelectSlot,
  onEventDrop,
  onEventResize
}) => {
  const calendarContainerRef = useRef<HTMLDivElement>(null);
  const initialScrollTimeRef = useRef(new Date());


  // No locale setup needed - date-fns localizer handles it

  // Convert events to RBC format using the adapter
  const rbcEvents = useMemo(() => {
    debugConsole.log('🔄 REACT BIG CALENDAR - Processing events:', { 
      eventsProvided: !!events, 
      eventsCount: events?.length || 0,
      eventsData: events?.slice(0, 2)
    });
    
    if (!events || events.length === 0) {
      debugConsole.log('❌ REACT BIG CALENDAR - No events provided!');
      return [];
    }

    debugConsole.log('🔄 REACT BIG CALENDAR - Converting events to RBC format...');
    const convertedEvents = CalendarEventAdapter.toRBCEvents(events);
    debugConsole.log('🔄 REACT BIG CALENDAR - Converted events:', { 
      originalCount: events.length, 
      convertedCount: convertedEvents.length,
      convertedEvents: convertedEvents.slice(0, 2)
    });
    
    // Validate converted events
    const validEvents = convertedEvents.filter(event => {
      const isValid = event && event.start && event.end && event.title;
      if (!isValid) {
        debugConsole.warn('❌ REACT BIG CALENDAR - Invalid event found:', event);
      }
      return isValid;
    });

    debugConsole.log(`✅ REACT BIG CALENDAR - Final result: ${validEvents.length} valid events out of ${convertedEvents.length} total`);
    debugConsole.log('✅ REACT BIG CALENDAR - Sample events for rendering:', validEvents.slice(0, 3).map(e => ({
      id: e.id,
      title: e.title,
      start: e.start?.toISOString(),
      end: e.end?.toISOString(),
      allDay: e.allDay
    })));
    
    return validEvents;
  }, [events]);

  const overlappingEventIds = useMemo(() => {
    const overlappingIds = new Set<string>();

    for (let i = 0; i < rbcEvents.length; i += 1) {
      const currentEvent = rbcEvents[i];

      for (let j = i + 1; j < rbcEvents.length; j += 1) {
        const comparisonEvent = rbcEvents[j];
        const hasOverlap = currentEvent.start < comparisonEvent.end && comparisonEvent.start < currentEvent.end;

        if (!hasOverlap) {
          continue;
        }

        overlappingIds.add(String(currentEvent.id));
        overlappingIds.add(String(comparisonEvent.id));
      }
    }

    return overlappingIds;
  }, [rbcEvents]);

  // Event prop getter for custom styling with Grünen-CI colors
  const eventPropGetter = useCallback((event: RBCEvent) => {
    const viewModel = toCalendarEventViewModel(event);
    const originalEvent = viewModel?.resource;
    let className = '';
    const style: React.CSSProperties = {
      transition: 'all 0.2s ease',
    };

    // Color coding by type – all colors must have good contrast with white text
    const categoryColors: Record<string, string> = {
      'session': 'hsl(var(--primary))',
      'meeting': 'hsl(var(--chart-2))',
      'appointment': 'hsl(var(--chart-3))',
      'deadline': 'hsl(var(--destructive))',
      'blocked': 'hsl(var(--chart-4))',
      'veranstaltung': 'hsl(var(--chart-5))',
      'vacation': 'hsl(var(--chart-3))',
      'vacation_request': 'hsl(var(--chart-4))',
      'birthday': 'hsl(var(--primary))',
      'default': 'hsl(var(--primary))'
    };

    // Use category_color from external calendars when available, otherwise fall back to type mapping
    const bgColor = originalEvent?.category_color
      ? originalEvent.category_color
      : (categoryColors[originalEvent?.type || 'default'] || categoryColors.default);
    const hasOverlap = overlappingEventIds.has(String(event.id));
    
    style.backgroundColor = bgColor;
    style.background = bgColor;
    style.border = hasOverlap ? '1px solid white' : 'none';
    style.color = 'white';

    if (originalEvent?.type) {
      className = `event-${originalEvent.type}`;
    }

    if (originalEvent?.priority === 'high') {
      style.fontWeight = 'bold';
      style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    }

    return { 
      className, 
      style 
    };
  }, [overlappingEventIds]);

  // Day prop getter for today highlighting
  const dayPropGetter = useCallback((date: Date) => {
    const isToday = isSameDay(date, new Date());
    return {
      className: isToday ? 'rbc-today' : '',
      style: {}
    };
  }, []);

  // Handle event selection
  const handleSelectEvent = useCallback((rbcEvent: RBCEvent) => {
    const originalEvent = toCalendarEventViewModel(rbcEvent)?.resource;
    if (originalEvent && onEventSelect) {
      onEventSelect(originalEvent);
    }
  }, [onEventSelect]);

  // Handle slot selection for creating new events
  const handleSelectSlot = useCallback((slotInfo: { start: Date; end: Date; slots: Date[] }) => {
    if (onSelectSlot) {
      onSelectSlot(slotInfo);
    }
  }, [onSelectSlot]);

  // Handle event drop (drag and drop)
  const handleEventDrop = useCallback(({ event, start, end }: { event: RBCEvent; start: Date; end: Date }) => {
    const originalEvent = toCalendarEventViewModel(event)?.resource;
    if (originalEvent && onEventDrop) {
      onEventDrop(originalEvent, start, end);
    }
  }, [onEventDrop]);

  // Handle event resize
  const handleEventResize = useCallback(({ event, start, end }: { event: RBCEvent; start: Date; end: Date }) => {
    const originalEvent = toCalendarEventViewModel(event)?.resource;
    if (originalEvent && onEventResize) {
      onEventResize(originalEvent, start, end);
    }
  }, [onEventResize]);

  useEffect(() => {
    if (view !== Views.DAY && view !== Views.WEEK) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const calendarContainer = calendarContainerRef.current;
      if (!calendarContainer) {
        return;
      }

      const currentTimeIndicator = calendarContainer.querySelector('.rbc-current-time-indicator') as HTMLElement | null;
      const timeContent = calendarContainer.querySelector('.rbc-time-content') as HTMLElement | null;

      if (!currentTimeIndicator || !timeContent) {
        return;
      }

      const targetTop = Math.max(currentTimeIndicator.offsetTop - (timeContent.clientHeight * 0.35), 0);
      timeContent.scrollTo({ top: targetTop, behavior: 'smooth' });
    }, 150);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [date, view]);

  useEffect(() => {
    if (view !== Views.DAY && view !== Views.WEEK) {
      return;
    }

    const calendarContainer = calendarContainerRef.current;
    if (!calendarContainer) {
      return;
    }

    const timeContent = calendarContainer.querySelector('.rbc-time-content') as HTMLElement | null;
    const timeGutter = timeContent?.querySelector('.rbc-time-gutter') as HTMLElement | null;

    if (!timeContent || !timeGutter) {
      return;
    }

    const firstDayColumn = timeContent.querySelector('.rbc-day-slot.rbc-time-column');
    if (!firstDayColumn) {
      return;
    }

    const existingSingleSpacer = timeContent.querySelector(':scope > .rbc-time-gutter-spacer') as HTMLElement | null;
    if (existingSingleSpacer) {
      existingSingleSpacer.remove();
    }

    let spacerColumn = timeContent.querySelector(':scope > .rbc-time-gutter-spacer-column') as HTMLElement | null;
    if (!spacerColumn) {
      spacerColumn = document.createElement('div');
      spacerColumn.className = 'rbc-time-gutter-spacer-column';
      spacerColumn.setAttribute('aria-hidden', 'true');
      timeContent.insertBefore(spacerColumn, firstDayColumn);
    }

    const slotGroups = firstDayColumn.querySelectorAll(':scope > .rbc-timeslot-group');
    const spacerCount = slotGroups.length;
    const existingSpacerGroups = spacerColumn.querySelectorAll(':scope > .rbc-time-gutter-spacer');

    if (existingSpacerGroups.length !== spacerCount) {
      spacerColumn.replaceChildren();

      for (let index = 0; index < spacerCount; index += 1) {
        const spacer = document.createElement('div');
        spacer.className = 'rbc-timeslot-group rbc-time-gutter-spacer';
        spacerColumn.appendChild(spacer);
      }
    }
  }, [date, view]);

  return (
    <div ref={calendarContainerRef} className="h-full w-full bg-background min-h-[calc(100vh-180px)]">
      <DnDCalendar
        localizer={localizer}
        events={rbcEvents}
        startAccessor={(event: RBCEvent) => event.start}
        endAccessor={(event: RBCEvent) => event.end}
        titleAccessor={(event: RBCEvent) => event.title}
        allDayAccessor={(event: RBCEvent) => event.allDay || false}
        resourceAccessor={(event: RBCEvent) => event.resource}
        view={view as any}
        date={date}
        onNavigate={onNavigate}
        onView={onView}
        onSelectEvent={(event: RBCEvent) => handleSelectEvent(event)}
        onSelectSlot={handleSelectSlot}
        onEventDrop={(args: any) => handleEventDrop(args)}
        onEventResize={(args: any) => handleEventResize(args)}
        eventPropGetter={eventPropGetter as any}
        dayPropGetter={dayPropGetter}
        messages={messages}
        formats={{
          dayFormat: 'd',
          weekdayFormat: 'EEE',
          monthHeaderFormat: 'MMMM yyyy',
          dayHeaderFormat: 'EEEE, dd. MMMM yyyy',
          dayRangeHeaderFormat: ({ start, end }) => 
            `${format(start, 'dd. MMMM', { locale: de })} – ${format(end, 'dd. MMMM yyyy', { locale: de })}`,
          agendaDateFormat: 'EEEE, dd. MMMM',
          agendaTimeFormat: 'HH:mm',
          agendaTimeRangeFormat: ({ start, end }) => 
            `${format(start, 'HH:mm', { locale: de })} – ${format(end, 'HH:mm', { locale: de })}`,
          timeGutterFormat: 'HH:mm',
          eventTimeRangeFormat: ({ start, end }) => 
            `${format(start, 'HH:mm', { locale: de })} – ${format(end, 'HH:mm', { locale: de })}`,
          dateFormat: 'd',
          selectRangeFormat: ({ start, end }) =>
            `${format(start, 'dd. MMM', { locale: de })} – ${format(end, 'dd. MMM', { locale: de })}`
        }}
        toolbar={false}
        selectable
        resizable
        popup
        showMultiDayTimes
        scrollToTime={initialScrollTimeRef.current}
        enableAutoScroll
        step={30}
        timeslots={2}
        views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
        defaultView={Views.WEEK}
        components={{
          week: {
            header: WeekHeader,
          },
          month: {
            event: MonthEvent,
          },
        }}
        className="rbc-calendar"
        style={{ height: '100%', minHeight: 'calc(100vh - 220px)' }}
      />
    </div>
  );
}

export { ProperReactBigCalendar };
