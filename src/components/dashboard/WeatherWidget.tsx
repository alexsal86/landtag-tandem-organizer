import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { getWeather, getWeatherIcon, translateCondition, LOCATIONS } from '@/utils/dashboard/weatherApi';
import type { WeatherData } from '@/utils/dashboard/weatherApi';
import { Skeleton } from '@/components/ui/skeleton';

interface WeatherCardProps {
  location: keyof typeof LOCATIONS;
}

const WeatherCard = ({ location }: WeatherCardProps) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const locationData = LOCATIONS[location];
  
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        setLoading(true);
        const data = await getWeather(locationData.lat, locationData.lon);
        setWeather(data);
      } catch (error) {
        console.error('Error fetching weather:', error);
        setWeather(null);
      } finally {
        setLoading(false);
      }
    };
    
    fetchWeather();
    
    const interval = setInterval(fetchWeather, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [locationData.lat, locationData.lon]);
  
  if (loading) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="p-4">
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-8 w-16 mb-1" />
          <Skeleton className="h-4 w-24" />
        </CardContent>
      </Card>
    );
  }
  
  if (!weather) {
    return null;
  }
  
  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardContent className="p-4">
        <div className="text-sm text-muted-foreground mb-2">{locationData.name}</div>
        <div className="flex items-center gap-3">
          <span className="text-4xl">{getWeatherIcon(weather.icon)}</span>
          <div>
            <div className="text-2xl font-semibold text-foreground">
              {weather.temperature}°C
            </div>
            <div className="text-sm text-muted-foreground">
              {translateCondition(weather.condition)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const WeatherWidget = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <WeatherCard location="karlsruhe" />
      <WeatherCard location="stuttgart" />
    </div>
  );
};
