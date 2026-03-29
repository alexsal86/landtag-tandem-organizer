import { useQuery } from '@tanstack/react-query';
import { isFeatureCollection, Feature } from '@/types/geoDomain';
import { debugConsole } from '@/utils/debugConsole';

/**
 * Generic hook to load and cache a GeoJSON layer from a file path or URL.
 * Returns the features array ready for Leaflet rendering.
 */
export function useGeoJsonLayer(sourceType: string, sourcePath: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: ['geojson-layer', sourcePath],
    queryFn: async (): Promise<Feature[]> => {
      if (!sourcePath) return [];

      const url = sourceType === 'geojson_file'
        ? sourcePath.startsWith('/') ? sourcePath : `/data/${sourcePath}`
        : sourcePath;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load GeoJSON from ${url}: ${response.status}`);
      }

      const geojson = await response.json();

      if (isFeatureCollection(geojson)) {
        return geojson.features;
      }

      // Try if it's a single feature
      if (geojson?.type === 'Feature' && geojson?.geometry) {
        return [geojson as Feature];
      }

      debugConsole.warn('Invalid GeoJSON structure from', url);
      return [];
    },
    enabled: enabled && !!sourcePath && sourceType !== 'database',
    staleTime: 1000 * 60 * 30, // Cache for 30 minutes
    gcTime: 1000 * 60 * 60,
  });
}
