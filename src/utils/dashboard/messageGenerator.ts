import { TimeSlot } from './timeUtils';

export interface DashboardMessage {
  id: string;
  timeSlot: TimeSlot;
  dayOfWeek?: number;
  isHoliday?: boolean;
  seasonalMonth?: number | number[];
  conditions?: {
    minAppointments?: number;
    maxAppointments?: number;
    taskThreshold?: number;
    completedTasks?: number;
  };
  priority: number;
  text: string;
  variant?: 'motivational' | 'encouraging' | 'relaxed' | 'celebration' | 'warning';
}

export interface DashboardContext {
  timeSlot: TimeSlot;
  dayOfWeek: number;
  appointmentsCount: number;
  tasksCount: number;
  completedTasks: number;
  isHoliday: boolean;
  month: number;
}

export const messages: DashboardMessage[] = [
  // Bestehende Nachrichten
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
    id: 'midweek-hump',
    timeSlot: 'morning',
    dayOfWeek: 3,
    priority: 90,
    text: 'Mittwoch - die Woche ist halb geschafft! Weiter so!',
    variant: 'motivational'
  },
  {
    id: 'holiday-relax',
    timeSlot: 'morning',
    isHoliday: true,
    priority: 120,
    text: 'Ein Feiertag! Genieße die freie Zeit und entspann dich.',
    variant: 'relaxed'
  },
  {
    id: 'tasks-almost-done',
    timeSlot: 'evening',
    conditions: { taskThreshold: 10, completedTasks: 8 },
    priority: 70,
    text: 'Fast alle Aufgaben erledigt! Super Leistung heute!',
    variant: 'celebration'
  },
  {
    id: 'overloaded-evening',
    timeSlot: 'evening',
    conditions: { taskThreshold: 15, minAppointments: 3 },
    priority: 80,
    text: 'Noch viel zu tun? Priorisiere und mach dir den Abend leicht!',
    variant: 'warning'
  },
  {
    id: 'saturday-morning',
    timeSlot: 'morning',
    dayOfWeek: 6,
    priority: 90,
    text: 'Willkommen am Samstag! Lass uns den Tag entspannt angehen.',
    variant: 'relaxed'
  },
  {
    id: 'saturday-few-appointments',
    timeSlot: 'midday',
    dayOfWeek: 6,
    conditions: { maxAppointments: 1 },
    priority: 70,
    text: 'Ein ruhiger Samstag mit wenig Terminen. Perfekt für deine To-Dos!',
    variant: 'encouraging'
  },
  {
    id: 'saturday-busy',
    timeSlot: 'afternoon',
    dayOfWeek: 6,
    conditions: { minAppointments: 3 },
    priority: 80,
    text: 'Ein aktiver Samstag! Schrittweise alles erledigen.',
    variant: 'motivational'
  },
  {
    id: 'sunday-morning',
    timeSlot: 'morning',
    dayOfWeek: 0,
    priority: 90,
    text: 'Sonntagmorgen – Zeit, Energie für die neue Woche zu tanken!',
    variant: 'relaxed'
  },
  {
    id: 'sunday-no-appointments',
    timeSlot: 'afternoon',
    dayOfWeek: 0,
    conditions: { maxAppointments: 0 },
    priority: 70,
    text: 'Ein freier Sonntag! Nutze die Zeit für dich.',
    variant: 'relaxed'
  },
  {
    id: 'sunday-many-tasks',
    timeSlot: 'evening',
    dayOfWeek: 0,
    conditions: { taskThreshold: 10 },
    priority: 80,
    text: 'Viele Aufgaben am Sonntag? Lass uns die wichtigsten abschließen!',
    variant: 'motivational'
  },
  {
    id: 'christmas-season',
    timeSlot: 'morning',
    seasonalMonth: 12,
    priority: 110,
    text: 'Die Weihnachtszeit beginnt! Genieße die festliche Stimmung.',
    variant: 'celebration'
  },
  {
    id: 'new-year',
    timeSlot: 'morning',
    seasonalMonth: 1,
    priority: 110,
    text: 'Frohes neues Jahr! Starte mit frischem Elan ins Jahr!',
    variant: 'motivational'
  },
  {
    id: 'summer-vibes',
    timeSlot: 'midday',
    seasonalMonth: [6, 7, 8],
    priority: 100,
    text: 'Sonnige Sommertage! Nutze die Energie für deine Aufgaben.',
    variant: 'motivational'
  },
  {
    id: 'autumn-relax',
    timeSlot: 'evening',
    seasonalMonth: [9, 10, 11],
    priority: 100,
    text: 'Ein gemütlicher Herbstabend – Zeit, den Tag entspannt ausklingen zu lassen.',
    variant: 'relaxed'
  },
  {
    id: 'spring-busy',
    timeSlot: 'morning',
    seasonalMonth: [3, 4, 5],
    conditions: { minAppointments: 3 },
    priority: 90,
    text: 'Frühling und voller Terminkalender? Wir rocken das!',
    variant: 'motivational'
  },
  // Neue Standard-Nachrichten für jede Variante
  // Motivational
  {
    id: 'standard-motivational-1',
    timeSlot: 'morning',
    priority: 10,
    text: 'Heute ist dein Tag, um Großes zu erreichen!',
    variant: 'motivational'
  },
  {
    id: 'standard-motivational-2',
    timeSlot: 'midday',
    priority: 10,
    text: 'Halte das Tempo hoch, du bist auf dem richtigen Weg!',
    variant: 'motivational'
  },
  {
    id: 'standard-motivational-3',
    timeSlot: 'afternoon',
    priority: 10,
    text: 'Jeder Schritt bringt dich deinem Ziel näher. Weiter so!',
    variant: 'motivational'
  },
  {
    id: 'standard-motivational-4',
    timeSlot: 'morning',
    priority: 10,
    text: 'Nutze die Energie des Tages und leg los!',
    variant: 'motivational'
  },
  {
    id: 'standard-motivational-5',
    timeSlot: 'midday',
    priority: 10,
    text: 'Du hast das Zeug dazu, heute zu glänzen!',
    variant: 'motivational'
  },
  // Encouraging
  {
    id: 'standard-encouraging-1',
    timeSlot: 'morning',
    priority: 10,
    text: 'Ein neuer Tag, neue Möglichkeiten. Du schaffst das!',
    variant: 'encouraging'
  },
  {
    id: 'standard-encouraging-2',
    timeSlot: 'midday',
    priority: 10,
    text: 'Du machst das super, bleib dran!',
    variant: 'encouraging'
  },
  {
    id: 'standard-encouraging-3',
    timeSlot: 'afternoon',
    priority: 10,
    text: 'Kleine Fortschritte zählen. Mach weiter so!',
    variant: 'encouraging'
  },
  {
    id: 'standard-encouraging-4',
    timeSlot: 'evening',
    priority: 10,
    text: 'Du hast schon so viel geschafft. Stolz auf dich!',
    variant: 'encouraging'
  },
  {
    id: 'standard-encouraging-5',
    timeSlot: 'midday',
    priority: 10,
    text: 'Jeder Moment ist eine Chance, voranzugehen!',
    variant: 'encouraging'
  },
  // Relaxed
  {
    id: 'standard-relaxed-1',
    timeSlot: 'evening',
    priority: 10,
    text: 'Zeit, den Tag entspannt ausklingen zu lassen.',
    variant: 'relaxed'
  },
  {
    id: 'standard-relaxed-2',
    timeSlot: 'night',
    priority: 10,
    text: 'Gönn dir eine Pause, morgen geht\'s weiter.',
    variant: 'relaxed'
  },
  {
    id: 'standard-relaxed-3',
    timeSlot: 'afternoon',
    priority: 10,
    text: 'Nimm dir einen Moment, um durchzuatmen.',
    variant: 'relaxed'
  },
  {
    id: 'standard-relaxed-4',
    timeSlot: 'evening',
    priority: 10,
    text: 'Ein ruhiger Abend wartet auf dich. Genieße ihn!',
    variant: 'relaxed'
  },
  {
    id: 'standard-relaxed-5',
    timeSlot: 'night',
    priority: 10,
    text: 'Schalte ab und lade deine Energie auf.',
    variant: 'relaxed'
  },
  // Celebration
  {
    id: 'standard-celebration-1',
    timeSlot: 'evening',
    priority: 10,
    text: 'Wow, was für ein Tag! Feiere deine Erfolge!',
    variant: 'celebration'
  },
  {
    id: 'standard-celebration-2',
    timeSlot: 'afternoon',
    priority: 10,
    text: 'Du hast das richtig gut gemacht. Zeit zum Feiern!',
    variant: 'celebration'
  },
  {
    id: 'standard-celebration-3',
    timeSlot: 'evening',
    priority: 10,
    text: 'Ein großartiger Tag! Stolz auf deine Leistung!',
    variant: 'celebration'
  },
  {
    id: 'standard-celebration-4',
    timeSlot: 'midday',
    priority: 10,
    text: 'Super Arbeit bisher! Das verdient Anerkennung!',
    variant: 'celebration'
  },
  {
    id: 'standard-celebration-5',
    timeSlot: 'evening',
    priority: 10,
    text: 'Ein erfolgreicher Tag – das hast du klasse gemacht!',
    variant: 'celebration'
  },
  // Warning
  {
    id: 'standard-warning-1',
    timeSlot: 'morning',
    priority: 10,
    text: 'Viel zu tun? Plane deinen Tag, um alles zu schaffen.',
    variant: 'warning'
  },
  {
    id: 'standard-warning-2',
    timeSlot: 'midday',
    priority: 10,
    text: 'Zeit knapp? Konzentriere dich auf die Prioritäten.',
    variant: 'warning'
  },
  {
    id: 'standard-warning-3',
    timeSlot: 'afternoon',
    priority: 10,
    text: 'Noch viel offen? Fokussiere dich auf das Wichtigste.',
    variant: 'warning'
  },
  {
    id: 'standard-warning-4',
    timeSlot: 'evening',
    priority: 10,
    text: 'Nicht alles geschafft? Morgen ist ein neuer Tag.',
    variant: 'warning'
  },
  {
    id: 'standard-warning-5',
    timeSlot: 'morning',
    priority: 10,
    text: 'Voller Terminkalender? Bleib organisiert!',
    variant: 'warning'
  },
  // Bestehende Standard-Nachrichten
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
    // Zeitfenster prüfen
    if (msg.timeSlot !== context.timeSlot) return false;

    // Wochentag prüfen
    if (msg.dayOfWeek !== undefined && msg.dayOfWeek !== context.dayOfWeek) {
      return false;
    }

    // Feiertag prüfen
    if (msg.isHoliday !== undefined && msg.isHoliday !== context.isHoliday) {
      return false;
    }

    // Saisonale Monate prüfen
    if (msg.seasonalMonth !== undefined) {
      const months = Array.isArray(msg.seasonalMonth) ? msg.seasonalMonth : [msg.seasonalMonth];
      if (!months.includes(context.month)) {
        return false;
      }
    }

    // Bedingungen prüfen
    if (msg.conditions) {
      const { minAppointments, maxAppointments, taskThreshold, completedTasks } = msg.conditions;

      if (minAppointments !== undefined && context.appointmentsCount < minAppointments) {
        return false;
      }

      if (maxAppointments !== undefined && context.appointmentsCount > maxAppointments) {
        return false;
      }

      if (taskThreshold !== undefined && context.tasksCount < taskThreshold) {
        return false;
      }

      if (completedTasks !== undefined && context.completedTasks < completedTasks) {
        return false;
      }
    }

    return true;
  });

  // Nach Priorität sortieren
  matchingMessages.sort((a, b) => b.priority - a.priority);

  // Höchste Priorität zurückgeben oder Standard-Morgen-Nachricht
  return matchingMessages[0] || messages.find(m => m.id === 'standard-morning')!;
};
