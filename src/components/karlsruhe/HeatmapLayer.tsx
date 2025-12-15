import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

// Extend Leaflet types for heat layer
declare module 'leaflet' {
  function heatLayer(
    latlngs: [number, number, number][],
    options?: {
      radius?: number;
      blur?: number;
      maxZoom?: number;
      max?: number;
      minOpacity?: number;
      gradient?: Record<number, string>;
    }
  ): L.Layer;
}

interface HeatmapLayerProps {
  points: [number, number, number][]; // [lat, lng, intensity]
  radius?: number;
  blur?: number;
  maxZoom?: number;
  gradient?: Record<number, string>;
}

export const HeatmapLayer = ({ 
  points, 
  radius = 25, 
  blur = 15, 
  maxZoom = 17,
  gradient = {
    0.0: '#3b82f6',
    0.3: '#22c55e',
    0.5: '#eab308',
    0.7: '#f97316',
    1.0: '#ef4444',
  }
}: HeatmapLayerProps) => {
  const map = useMap();
  const heatLayerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    if (!map || points.length === 0) return;

    // Remove existing layer
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
    }

    // Create new heat layer
    const heat = L.heatLayer(points, {
      radius,
      blur,
      maxZoom,
      max: 1.0,
      minOpacity: 0.3,
      gradient,
    });

    heat.addTo(map);
    heatLayerRef.current = heat;

    return () => {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
    };
  }, [map, points, radius, blur, maxZoom, gradient]);

  return null;
};
