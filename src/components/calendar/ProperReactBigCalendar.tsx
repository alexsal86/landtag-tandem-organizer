import React, { useMemo, useCallback } from 'react';
import { Calendar, momentLocalizer, Views } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import moment from 'moment';
import 'moment/locale/de';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { CalendarEventAdapter, type RBCEvent } from './CalendarEventAdapter';
import type { CalendarEvent } from '../CalendarView';

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

// Set up German localizer
moment.locale('de');
const localizer = momentLocalizer(moment);

// Create DnD Calendar with drag and drop support
const DnDCalendar = withDragAndDrop(Calendar);

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

// German date formats
const formats = {
  monthHeaderFormat: 'MMMM YYYY',
  dayHeaderFormat: 'dddd, DD. MMMM YYYY',
  dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
    `${moment(start).format('DD. MMM')} – ${moment(end).format('DD. MMM YYYY')}`,
  timeGutterFormat: 'HH:mm',
  eventTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
    `${moment(start).format('HH:mm')} – ${moment(end).format('HH:mm')}`,
  dayFormat: 'DD',
  dateFormat: 'DD',
  weekdayFormat: 'ddd'
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
  // Set up German locale with Monday as first day of week
  moment.locale('de');
  moment.updateLocale('de', {
    week: {
      dow: 1, // Monday is the first day of the week
      doy: 4  // The week that contains Jan 4th is the first week of the year
    }
  });
  
  const localizer = momentLocalizer(moment);

  // Convert events to RBC format using the adapter
  const rbcEvents = useMemo(() => {
    return CalendarEventAdapter.toRBCEvents(events);
  }, [events]);

  // Event prop getter for custom styling
  const eventPropGetter = useCallback((event: RBCEvent) => {
    const originalEvent = event.resource as CalendarEvent;
    let className = '';
    let style: React.CSSProperties = {};

    if (originalEvent?.type) {
      className = `event-${originalEvent.type}`;
    }

    if (originalEvent?.priority === 'high') {
      style.fontWeight = 'bold';
    }

    return { className, style };
  }, []);

  // Day prop getter for today highlighting
  const dayPropGetter = useCallback((date: Date) => {
    const isToday = moment(date).isSame(moment(), 'day');
    return {
      className: isToday ? 'rbc-today' : '',
      style: {}
    };
  }, []);

  // Handle event selection
  const handleSelectEvent = useCallback((rbcEvent: RBCEvent) => {
    const originalEvent = rbcEvent.resource as CalendarEvent;
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
    const originalEvent = event.resource as CalendarEvent;
    if (originalEvent && onEventDrop) {
      onEventDrop(originalEvent, start, end);
    }
  }, [onEventDrop]);

  // Handle event resize
  const handleEventResize = useCallback(({ event, start, end }: { event: RBCEvent; start: Date; end: Date }) => {
    const originalEvent = event.resource as CalendarEvent;
    if (originalEvent && onEventResize) {
      onEventResize(originalEvent, start, end);
    }
  }, [onEventResize]);

  return (
    <div className="h-full w-full bg-background">
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
        onSelectEvent={handleSelectEvent}
        onSelectSlot={handleSelectSlot}
        onEventDrop={handleEventDrop}
        onEventResize={handleEventResize}
        eventPropGetter={eventPropGetter}
        dayPropGetter={dayPropGetter}
        messages={messages}
        formats={{
          dayFormat: 'dddd DD.MM',
          weekdayFormat: 'dddd',
          monthHeaderFormat: 'MMMM YYYY',
          dayHeaderFormat: 'dddd DD.MM.YYYY',
          dayRangeHeaderFormat: ({ start, end }) => 
            `${moment(start).format('DD.MM')} - ${moment(end).format('DD.MM.YYYY')}`,
          agendaDateFormat: 'DD.MM.YYYY',
          agendaTimeFormat: 'HH:mm',
          agendaTimeRangeFormat: ({ start, end }) => 
            `${moment(start).format('HH:mm')} - ${moment(end).format('HH:mm')}`,
          dateFormat: 'DD',
          timeGutterFormat: 'HH:mm'
        }}
        selectable
        resizable
        popup
        showMultiDayTimes
        step={30}
        timeslots={2}
        views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
        defaultView={Views.MONTH}
        className="rbc-calendar"
        style={{ height: '100%' }}
      />
    </div>
  );
}

export { ProperReactBigCalendar };
