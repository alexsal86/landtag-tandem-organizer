import { CalendarEvent } from "@/components/CalendarView";

export function formatTimeRange(startTime: string, endTime?: Date | string, duration?: string): string {
  const start = startTime;
  
  if (endTime) {
    const end = typeof endTime === 'string' ? new Date(endTime) : endTime;
    const endTimeString = end.toTimeString().slice(0, 5);
    return `${start} bis ${endTimeString}`;
  }
  
  if (duration) {
    const [hours, minutes] = start.split(':').map(Number);
    const durationMinutes = parseInt(duration.replace(/\D/g, ''));
    const endHours = Math.floor((hours * 60 + minutes + durationMinutes) / 60);
    const endMinutes = (hours * 60 + minutes + durationMinutes) % 60;
    const endTimeString = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
    return `${start} bis ${endTimeString}`;
  }
  
  return start;
}

export function formatDuration(startTime: string, endTime?: Date | string, duration?: string): string {
  let totalMinutes = 0;
  
  if (endTime) {
    const start = new Date(`1970-01-01T${startTime}:00`);
    const end = typeof endTime === 'string' ? new Date(endTime) : endTime;
    const endTimeOnly = new Date(`1970-01-01T${end.toTimeString().slice(0, 8)}`);
    totalMinutes = Math.round((endTimeOnly.getTime() - start.getTime()) / (1000 * 60));
  } else if (duration) {
    totalMinutes = parseInt(duration.replace(/\D/g, ''));
  }
  
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours === 0) {
    return `${minutes} Min.`;
  } else if (minutes === 0) {
    return `${hours} Std.`;
  } else {
    return `${hours} Std. ${minutes} Min.`;
  }
}

export function formatEventDisplay(event: CalendarEvent): string {
  const timeRange = formatTimeRange(event.time, event.endTime, event.duration);
  const duration = formatDuration(event.time, event.endTime, event.duration);
  return `${timeRange} (${duration})`;
}

export function isMultiDayEvent(startTime: Date, endTime: Date): boolean {
  return startTime.toDateString() !== endTime.toDateString();
}

export function getEventDays(startTime: Date, endTime: Date): Date[] {
  const days: Date[] = [];
  const current = new Date(startTime);
  current.setHours(0, 0, 0, 0);
  
  const end = new Date(endTime);
  end.setHours(0, 0, 0, 0);
  
  while (current <= end) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return days;
}