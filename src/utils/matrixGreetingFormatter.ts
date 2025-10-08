import { WeatherData, translateCondition, getWeatherIcon } from './dashboard/weatherApi';
import { selectMessage, DashboardContext } from './dashboard/messageGenerator';
import { getCurrentTimeSlot, getCurrentDayOfWeek } from './dashboard/timeUtils';

interface Appointment {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location?: string;
  category?: string;
}

interface MessageComponents {
  greeting?: string;
  weather?: WeatherData[];
  appointments?: Appointment[];
}

/**
 * Formats weather data for Matrix message
 */
export const formatWeatherForMatrix = (weatherData: WeatherData[]): string => {
  if (!weatherData || weatherData.length === 0) {
    return '';
  }

  const locations = ['Karlsruhe', 'Stuttgart'];
  const weatherLines = weatherData.map((data, index) => {
    const location = locations[index] || 'Unbekannt';
    const icon = getWeatherIcon(data.icon);
    const condition = translateCondition(data.condition);
    return `• ${location}: ${data.temperature}°C, ${condition} ${icon}`;
  });

  return `☀️ Wetter heute:\n${weatherLines.join('\n')}`;
};

/**
 * Formats appointments for Matrix message
 */
export const formatAppointmentsForMatrix = (appointments: Appointment[]): string => {
  if (!appointments || appointments.length === 0) {
    return '📅 Keine Termine heute 🎉';
  }

  const appointmentLines = appointments.map(apt => {
    const startTime = new Date(apt.start_time).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    });
    const endTime = new Date(apt.end_time).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    });
    const location = apt.location ? ` (${apt.location})` : '';
    return `• ${startTime} - ${endTime}: ${apt.title}${location}`;
  });

  return `📅 Deine Termine heute:\n${appointmentLines.join('\n')}`;
};

/**
 * Generates a morning greeting based on context
 */
export const generateMorningGreeting = (context: DashboardContext): string => {
  const message = selectMessage(context);
  const timeSlot = getCurrentTimeSlot();
  
  let greeting = '🌅 Guten Morgen!';
  if (timeSlot === 'midday') {
    greeting = '☀️ Hallo!';
  } else if (timeSlot === 'afternoon') {
    greeting = '👋 Guten Tag!';
  } else if (timeSlot === 'evening') {
    greeting = '🌆 Guten Abend!';
  }

  return `${greeting}\n\n${message.text}`;
};

/**
 * Assembles the complete morning message from components
 */
export const assembleMorningMessage = (components: MessageComponents): string => {
  const parts: string[] = [];

  // Add greeting if provided
  if (components.greeting) {
    parts.push(components.greeting);
  }

  // Add weather if provided
  if (components.weather && components.weather.length > 0) {
    const weatherText = formatWeatherForMatrix(components.weather);
    if (weatherText) {
      parts.push(weatherText);
    }
  }

  // Add appointments if provided
  if (components.appointments !== undefined) {
    const appointmentsText = formatAppointmentsForMatrix(components.appointments);
    if (appointmentsText) {
      parts.push(appointmentsText);
    }
  }

  // Add motivational closing
  if (parts.length > 0) {
    parts.push('Viel Erfolg heute! 💪');
  }

  return parts.join('\n\n');
};
