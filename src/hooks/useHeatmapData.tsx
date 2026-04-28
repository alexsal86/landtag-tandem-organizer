import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';

export type HeatmapSource = 'contacts' | 'flags' | 'appointments';

interface HeatmapPoint {
  lat: number;
  lng: number;
  intensity: number;
}

export const useHeatmapData = (source: HeatmapSource, enabled: boolean = true) => {
  const { currentTenant } = useTenant();

  const { data: points, isLoading } = useQuery({
    queryKey: ['heatmap-data', source, currentTenant?.id],
    queryFn: async (): Promise<HeatmapPoint[]> => {
      if (!currentTenant?.id) return [];

      switch (source) {
        case 'contacts': {
          const { data, error } = await supabase
            .from('contacts')
            .select('coordinates')
            .eq('tenant_id', currentTenant.id)
            .not('coordinates', 'is', null);

          if (error) throw error;

          return (data || [])
            .filter((c: Record<string, any>) => c.coordinates && typeof c.coordinates === 'object')
            .map((c: Record<string, any>) => {
              const coords = c.coordinates as { lat: number; lng: number };
              return {
                lat: coords.lat,
                lng: coords.lng,
                intensity: 1,
              };
            });
        }

        case 'flags': {
          const { data, error } = await supabase
            .from('map_flags')
            .select('coordinates')
            .eq('tenant_id', currentTenant.id);

          if (error) throw error;

          return (data || [])
            .filter((f: Record<string, any>) => f.coordinates && typeof f.coordinates === 'object')
            .map((f: Record<string, any>) => {
              const coords = f.coordinates as { lat: number; lng: number };
              return {
                lat: coords.lat,
                lng: coords.lng,
                intensity: 1,
              };
            });
        }

        case 'appointments': {
          const { data, error } = await supabase
            .from('appointments')
            .select('coordinates')
            .eq('tenant_id', currentTenant.id)
            .not('coordinates', 'is', null);

          if (error) throw error;

          return (data || [])
            .filter((a: Record<string, any>) => a.coordinates && typeof a.coordinates === 'object')
            .map((a: Record<string, any>) => {
              const coords = a.coordinates as { lat: number; lng: number };
              return {
                lat: coords.lat,
                lng: coords.lng,
                intensity: 1,
              };
            });
        }

        default:
          return [];
      }
    },
    enabled: enabled && !!currentTenant?.id,
  });

  // Convert to leaflet.heat format: [lat, lng, intensity]
  const heatPoints: [number, number, number][] = (points || []).map(p => [p.lat, p.lng, p.intensity]);

  return {
    points: heatPoints,
    isLoading,
  };
};
