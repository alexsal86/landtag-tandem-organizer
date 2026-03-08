import { useEffect, useState } from 'react';
import { getWeather, translateCondition, getWeatherIcon } from '@/utils/dashboard/weatherApi';

export const getWeatherHint = (condition: string, temp: number): string => {
  const lc = condition.toLowerCase();
  if (lc.includes('regen') || lc.includes('rain')) return '☔ Regenschirm nicht vergessen!';
  if (lc.includes('schnee') || lc.includes('snow')) return '❄️ Warme Kleidung empfohlen!';
  if (lc.includes('sonne') || lc.includes('clear') || lc.includes('heiter')) return '☀️ Perfektes Wetter für Außentermine!';
  if (temp > 25) return '🌡️ Heute wird es warm!';
  if (temp < 5) return '🧥 Zieh dich warm an!';
  if (lc.includes('bewölkt') || lc.includes('cloud')) return '☁️ Ein bewölkter Tag erwartet uns.';
  return '';
};

export const WeatherToggle = () => {
  const [showWeather, setShowWeather] = useState(false);
  const [weatherKarlsruhe, setWeatherKarlsruhe] = useState<{ temp: number; condition: string; icon: string } | null>(null);
  const [weatherStuttgart, setWeatherStuttgart] = useState<{ temp: number; condition: string; icon: string } | null>(null);

  useEffect(() => {
    if (!showWeather) return;
    const load = async () => {
      const [ka, st] = await Promise.all([getWeather(49.0069, 8.4037), getWeather(48.7758, 9.1829)]);
      if (ka) setWeatherKarlsruhe({ temp: ka.temperature, condition: ka.condition, icon: ka.icon });
      if (st) setWeatherStuttgart({ temp: st.temperature, condition: st.condition, icon: st.icon });
    };
    load();
  }, [showWeather]);

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setShowWeather(prev => !prev)}
        className="text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
      >
        {showWeather ? 'Wetter ausblenden' : 'Wetter anzeigen (optional)'}
      </button>
      {showWeather && (
        <div className="mt-2 text-xl lg:text-2xl font-light tracking-tight text-foreground/90 whitespace-pre-wrap">
          ☀️ <strong className="font-bold">Das Wetter heute:</strong>{'\n'}
          {weatherKarlsruhe && (() => {
            const translated = translateCondition(weatherKarlsruhe.condition);
            const hint = getWeatherHint(weatherKarlsruhe.condition, weatherKarlsruhe.temp);
            return <>{getWeatherIcon(weatherKarlsruhe.icon)} Karlsruhe: {Math.round(weatherKarlsruhe.temp)}°C, {translated}{hint ? ` ${hint}` : ''}{'\n'}</>;
          })()}
          {weatherStuttgart && (() => {
            const translated = translateCondition(weatherStuttgart.condition);
            const hint = getWeatherHint(weatherStuttgart.condition, weatherStuttgart.temp);
            return <>{getWeatherIcon(weatherStuttgart.icon)} Stuttgart: {Math.round(weatherStuttgart.temp)}°C, {translated}{hint ? ` ${hint}` : ''}</>;
          })()}
        </div>
      )}
    </div>
  );
};
