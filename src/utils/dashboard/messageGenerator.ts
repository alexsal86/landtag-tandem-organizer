import { TimeSlot } from './timeUtils';

export interface DashboardMessage {
  id: string;
  timeSlot: TimeSlot;
  dayOfWeek?: number;
  conditions?: {
    minAppointments?: number;
    maxAppointments?: number;
    taskThreshold?: number;
  };
  priority: number;
  text: string;
  variant?: 'motivational' | 'encouraging' | 'relaxed' | 'celebration';
}

export interface DashboardContext {
  timeSlot: TimeSlot;
  dayOfWeek: number;
  appointmentsCount: number;
  tasksCount: number;
}

export const messages: DashboardMessage[] = [
  {
    id: 'friday-morning',
    timeSlot: 'morning',
    dayOfWeek: 5,
    priority: 100,
    text: 'Heute geben wir nochmal zusammen alles - das Wochenende ruft!',
    variant: 'motivational'
  },
  {
    id: 'friday-evening',
    timeSlot: 'evening',
    dayOfWeek: 5,
    priority: 100,
    text: 'Danke für die Woche, das war großartig.',
    variant: 'celebration'
  },
  {
    id: 'monday-morning',
    timeSlot: 'morning',
    dayOfWeek: 1,
    priority: 80,
    text: 'Frisch in die neue Woche! Auf geht\'s!',
    variant: 'motivational'
  },
  {
    id: 'few-appointments',
    timeSlot: 'midday',
    conditions: { maxAppointments: 1 },
    priority: 50,
    text: 'Nur noch ein Termin heute. Das packen wir zusammen!',
    variant: 'encouraging'
  },
  {
    id: 'no-appointments',
    timeSlot: 'afternoon',
    conditions: { maxAppointments: 0 },
    priority: 60,
    text: 'Keine Termine mehr heute. Zeit für wichtige Aufgaben!',
    variant: 'encouraging'
  },
  {
    id: 'busy-day',
    timeSlot: 'morning',
    conditions: { minAppointments: 5 },
    priority: 50,
    text: 'Ein vollgepackter Tag wartet auf uns. Schritt für Schritt schaffen wir das!',
    variant: 'motivational'
  },
  {
    id: 'many-tasks',
    timeSlot: 'morning',
    conditions: { taskThreshold: 20 },
    priority: 40,
    text: 'Viele Aufgaben warten. Wir fangen mit den wichtigsten an!',
    variant: 'motivational'
  },
  {
    id: 'standard-morning',
    timeSlot: 'morning',
    priority: 10,
    text: 'Bereit für einen produktiven Tag?',
    variant: 'motivational'
  },
  {
    id: 'standard-midday',
    timeSlot: 'midday',
    priority: 10,
    text: 'Weiter geht\'s mit frischer Energie!',
    variant: 'encouraging'
  },
  {
    id: 'standard-afternoon',
    timeSlot: 'afternoon',
    priority: 10,
    text: 'Der Tag läuft gut. Bleiben wir dran!',
    variant: 'encouraging'
  },
  {
    id: 'standard-evening',
    timeSlot: 'evening',
    priority: 10,
    text: 'Ein guter Tag liegt hinter uns. Zeit, den Abend zu genießen.',
    variant: 'relaxed'
  },
  {
    id: 'standard-night',
    timeSlot: 'night',
    priority: 10,
    text: 'Ruhe und Erholung für morgen.',
    variant: 'relaxed'
  }
];

export const selectMessage = (context: DashboardContext): DashboardMessage => {
  const matchingMessages = messages.filter(msg => {
    if (msg.timeSlot !== context.timeSlot) return false;
    
    if (msg.dayOfWeek !== undefined && msg.dayOfWeek !== context.dayOfWeek) {
      return false;
    }
    
    if (msg.conditions) {
      const { minAppointments, maxAppointments, taskThreshold } = msg.conditions;
      
      if (minAppointments !== undefined && context.appointmentsCount < minAppointments) {
        return false;
      }
      
      if (maxAppointments !== undefined && context.appointmentsCount > maxAppointments) {
        return false;
      }
      
      if (taskThreshold !== undefined && context.tasksCount < taskThreshold) {
        return false;
      }
    }
    
    return true;
  });
  
  matchingMessages.sort((a, b) => b.priority - a.priority);
  
  return matchingMessages[0] || messages.find(m => m.id === 'standard-morning')!;
};
