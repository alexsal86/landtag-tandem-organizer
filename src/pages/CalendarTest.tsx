import React from 'react';
import { CalendarEvent } from '@/components/CalendarView';
import { DayView } from '@/components/calendar/DayView';

// Test component to demonstrate the calendar alignment issue
export function CalendarTest() {
  // Create some test events to demonstrate the alignment problem
  const testEvents: CalendarEvent[] = [
    {
      id: '1',
      title: 'Termin um 09:00',
      time: '09:00',
      duration: '60min',
      date: new Date(),
      type: 'meeting',
      priority: 'medium'
    },
    {
      id: '2',
      title: 'Termin um 09:30', 
      time: '09:30',
      duration: '30min',
      date: new Date(),
      type: 'appointment',
      priority: 'high'
    },
    {
      id: '3',
      title: 'Termin um 10:15',
      time: '10:15', 
      duration: '45min',
      date: new Date(),
      type: 'meeting',
      priority: 'low'
    },
    {
      id: '4',
      title: 'Termin um 11:00',
      time: '11:00',
      duration: '30min',
      date: new Date(),
      type: 'session',
      priority: 'high'
    },
    {
      id: '5',
      title: 'Termin um 11:45',
      time: '11:45',
      duration: '15min',
      date: new Date(),
      type: 'deadline',
      priority: 'high'
    }
  ];

  return (
    <div className="h-screen w-full p-4">
      <h1 className="text-2xl font-bold mb-4">Calendar Day View Test</h1>
      <div className="border rounded-lg h-[600px]">
        <DayView 
          date={new Date()}
          events={testEvents}
          onAppointmentClick={(event) => console.log('Clicked:', event)}
          onPreparationClick={(event) => console.log('Preparation:', event)}
        />
      </div>
    </div>
  );
}

export default CalendarTest;