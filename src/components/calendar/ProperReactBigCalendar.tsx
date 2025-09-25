import React, { useMemo, useCallback, useEffect } from 'react';
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
  weekdayFormat: 'dddd',
  agendaHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
    `${moment(start).format('DD. MMMM')} – ${moment(end).format('DD. MMMM YYYY')}`,
  agendaDateFormat: 'dddd, DD. MMMM',
  agendaTimeFormat: 'HH:mm',
  agendaTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
    `${moment(start).format('HH:mm')} – ${moment(end).format('HH:mm')}`,
  selectRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
    `${moment(start).format('DD. MMM')} – ${moment(end).format('DD. MMM')}`
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
  useEffect(() => {
    moment.locale('de', {
      months: 'Januar_Februar_März_April_Mai_Juni_Juli_August_September_Oktober_November_Dezember'.split('_'),
      monthsShort: 'Jan_Feb_Mär_Apr_Mai_Jun_Jul_Aug_Sep_Okt_Nov_Dez'.split('_'),
      weekdays: 'Sonntag_Montag_Dienstag_Mittwoch_Donnerstag_Freitag_Samstag'.split('_'),
      weekdaysShort: 'So_Mo_Di_Mi_Do_Fr_Sa'.split('_'),
      weekdaysMin: 'So_Mo_Di_Mi_Do_Fr_Sa'.split('_'),
      longDateFormat: {
        LT: 'HH:mm',
        LTS: 'HH:mm:ss',
        L: 'DD.MM.YYYY',
        LL: 'D. MMMM YYYY',
        LLL: 'D. MMMM YYYY HH:mm',
        LLLL: 'dddd, D. MMMM YYYY HH:mm'
      },
      calendar: {
        sameDay: '[heute um] LT [Uhr]',
        nextDay: '[morgen um] LT [Uhr]',
        nextWeek: 'dddd [um] LT [Uhr]',
        lastDay: '[gestern um] LT [Uhr]',
        lastWeek: '[letzten] dddd [um] LT [Uhr]',
        sameElse: 'L'
      },
      relativeTime: {
        future: 'in %s',
        past: 'vor %s',
        s: 'ein paar Sekunden',
        ss: '%d Sekunden',
        m: 'einer Minute',
        mm: '%d Minuten',
        h: 'einer Stunde',
        hh: '%d Stunden',
        d: 'einem Tag',
        dd: '%d Tagen',
        M: 'einem Monat',
        MM: '%d Monaten',
        y: 'einem Jahr',
        yy: '%d Jahren'
      },
      week: {
        dow: 1, // Monday is the first day of the week
        doy: 4  // The week that contains Jan 4th is the first week of the year
      }
    });
  }, []);
  
  const localizer = momentLocalizer(moment);

  // Convert events to RBC format using the adapter
  const rbcEvents = useMemo(() => {
    console.log('🔄 Converting events to RBC format, input events:', events.length);
    if (events.length === 0) {
      console.log('⚠️ No events to convert');
      return [];
    }
    
    const converted = CalendarEventAdapter.toRBCEvents(events);
    console.log('✅ RBC events created:', converted.length, 'events');
    
    // Validate converted events
    const validEvents = converted.filter(event => {
      const isValid = event.start instanceof Date && 
                     event.end instanceof Date && 
                     !isNaN(event.start.getTime()) && 
                     !isNaN(event.end.getTime());
      if (!isValid) {
        console.error('❌ Invalid RBC event detected:', event);
      }
      return isValid;
    });
    
    console.log('📊 Valid RBC events:', validEvents.length);
    console.log('📊 Sample RBC events:', validEvents.slice(0, 2).map(e => ({
      id: e.id,
      title: e.title,
      start: e.start?.toISOString(),
      end: e.end?.toISOString(),
      allDay: e.allDay
    })));
    
    return validEvents;
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
    <div className="h-full w-full bg-background min-h-[600px]">
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
          dayFormat: 'D',
          weekdayFormat: 'ddd',
          monthHeaderFormat: 'MMMM YYYY',
          dayHeaderFormat: 'dddd, DD. MMMM YYYY',
          dayRangeHeaderFormat: ({ start, end }) => 
            `${moment(start).format('DD. MMMM')} – ${moment(end).format('DD. MMMM YYYY')}`,
          agendaDateFormat: 'dddd, DD. MMMM',
          agendaTimeFormat: 'HH:mm',
          agendaTimeRangeFormat: ({ start, end }) => 
            `${moment(start).format('HH:mm')} – ${moment(end).format('HH:mm')}`,
          timeGutterFormat: 'HH:mm',
          eventTimeRangeFormat: ({ start, end }) => 
            `${moment(start).format('HH:mm')} – ${moment(end).format('HH:mm')}`,
          dateFormat: 'D',
          selectRangeFormat: ({ start, end }) =>
            `${moment(start).format('DD. MMM')} – ${moment(end).format('DD. MMM')}`
        }}
        toolbar={false}
        selectable
        resizable
        popup
        showMultiDayTimes
        step={30}
        timeslots={2}
        views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
        defaultView={Views.MONTH}
        className="rbc-calendar"
        style={{ height: '100%', minHeight: '500px' }}
      />
    </div>
  );
}

export { ProperReactBigCalendar };
