export interface WeatherData {
  temperature: number;
  condition: string;
  icon: string;
}

interface BrightSkyResponse {
  weather: {
    temperature: number;
    condition: string;
    icon: string;
  };
}

const CACHE_DURATION = 5 * 60 * 1000;
const weatherCache = new Map<string, { data: WeatherData; timestamp: number }>();

export const LOCATIONS = {
  karlsruhe: { lat: 49.0069, lon: 8.4037, name: 'Karlsruhe' },
  stuttgart: { lat: 48.7758, lon: 9.1829, name: 'Stuttgart' }
} as const;

export const getWeather = async (lat: number, lon: number): Promise<WeatherData | null> => {
  const cacheKey = `${lat},${lon}`;
  const cached = weatherCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  
  try {
    const response = await fetch(
      `https://api.brightsky.dev/current_weather?lat=${lat}&lon=${lon}`
    );
    
    if (!response.ok) {
      console.error('Weather API error:', response.statusText);
      return null;
    }
    
    const data: BrightSkyResponse = await response.json();
    
    console.log('🌤️ Weather API Response:', data.weather);
    
    const weatherData: WeatherData = {
      temperature: Math.round(data.weather.temperature),
      condition: data.weather.condition,
      icon: data.weather.icon
    };
    
    console.log('🌤️ Weather Data prepared:', weatherData);
    
    weatherCache.set(cacheKey, { data: weatherData, timestamp: Date.now() });
    
    return weatherData;
  } catch (error) {
    console.error('Failed to fetch weather:', error);
    return null;
  }
};

export const getWeatherIcon = (condition: string): string => {
  const iconMap: Record<string, string> = {
    'clear-day': '☀️',
    'clear-night': '🌙',
    'partly-cloudy-day': '🌤️',
    'partly-cloudy-night': '☁️',
    'cloudy': '☁️',
    'fog': '🌫️',
    'wind': '💨',
    'rain': '🌧️',
    'sleet': '🌨️',
    'snow': '❄️',
    'hail': '🌨️',
    'thunderstorm': '⛈️'
  };
  
  return iconMap[condition] || '🌤️';
};

export const translateCondition = (condition: string): string => {
  console.log('🌤️ Translating condition:', condition);
  
  const translations: Record<string, string> = {
    // Icon-based conditions (from icon field)
    'clear-day': 'Sonnig',
    'clear-night': 'Klar',
    'partly-cloudy-day': 'Teilweise bewölkt',
    'partly-cloudy-night': 'Teilweise bewölkt',
    'cloudy': 'Bewölkt',
    // DWD Bright Sky API conditions (from condition field)
    'dry': 'Trocken',
    'fog': 'Nebel',
    'wind': 'Windig',
    'rain': 'Regen',
    'sleet': 'Schneeregen',
    'snow': 'Schnee',
    'hail': 'Hagel',
    'thunderstorm': 'Gewitter',
    // Additional common weather states
    'mist': 'Nebel',
    'drizzle': 'Nieselregen',
    'showers': 'Schauer',
    'heavy-rain': 'Starkregen',
    'freezing-rain': 'Gefrierender Regen',
    'light-snow': 'Leichter Schneefall',
    'heavy-snow': 'Starker Schneefall',
    'blizzard': 'Schneesturm',
  };
  
  const normalizedCondition = condition.toLowerCase().trim();
  const translated = translations[normalizedCondition] || 'Unbekannt';
  
  console.log('🌤️ Normalized:', normalizedCondition, '→ Translated:', translated);
  
  return translated;
};
