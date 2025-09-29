export type TimeSlot = 'morning' | 'midday' | 'afternoon' | 'evening' | 'night';

export const TIME_SLOTS = {
  morning: { start: 6, end: 11 },
  midday: { start: 11, end: 14 },
  afternoon: { start: 14, end: 18 },
  evening: { start: 18, end: 22 },
  night: { start: 22, end: 6 }
} as const;

export const getCurrentTimeSlot = (): TimeSlot => {
  const hour = new Date().getHours();
  
  if (hour >= TIME_SLOTS.morning.start && hour < TIME_SLOTS.morning.end) {
    return 'morning';
  } else if (hour >= TIME_SLOTS.midday.start && hour < TIME_SLOTS.midday.end) {
    return 'midday';
  } else if (hour >= TIME_SLOTS.afternoon.start && hour < TIME_SLOTS.afternoon.end) {
    return 'afternoon';
  } else if (hour >= TIME_SLOTS.evening.start && hour < TIME_SLOTS.evening.end) {
    return 'evening';
  } else {
    return 'night';
  }
};

export const getCurrentDayOfWeek = (): number => {
  return new Date().getDay();
};

export const getGreeting = (timeSlot: TimeSlot): string => {
  const greetings = {
    morning: 'Guten Morgen',
    midday: 'Hallo',
    afternoon: 'Guten Tag',
    evening: 'Guten Abend',
    night: 'Gute Nacht'
  };
  
  return greetings[timeSlot];
};
