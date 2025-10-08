import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { KarlsruheDistrict } from '@/hooks/useKarlsruheDistricts';

interface KarlsruheDistrictsMapProps {
  districts: KarlsruheDistrict[];
  onDistrictClick?: (district: KarlsruheDistrict) => void;
  selectedDistrict?: KarlsruheDistrict | null;
}

export const KarlsruheDistrictsMap = ({
  districts,
  onDistrictClick,
  selectedDistrict,
}: KarlsruheDistrictsMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersRef = useRef<Map<string, L.GeoJSON>>(new Map());
  const [mapReady, setMapReady] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [49.0069, 8.4037],
      zoom: 12,
      zoomControl: true,
      minZoom: 10,
      maxZoom: 16,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;
    setMapReady(true);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Render districts
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || districts.length === 0) return;

    const map = mapInstanceRef.current;

    // Clear existing layers
    layersRef.current.forEach(layer => layer.remove());
    layersRef.current.clear();

    // Add district layers
    districts.forEach(district => {
      if (!district.boundaries) return;

      // Special styling for city boundary
      const isCityBoundary = district.is_city_boundary || district.name.includes('Stadtgrenze');
      
      const layer = L.geoJSON(district.boundaries, {
        style: isCityBoundary ? {
          color: '#000000',
          weight: 3,
          fillOpacity: 0,
          dashArray: '8, 4',
        } : {
          color: district.color,
          weight: 2,
          fillColor: district.color,
          fillOpacity: selectedDistrict?.id === district.id ? 0.6 : 0.35,
        },
        onEachFeature: (feature, layer) => {
          // Skip labels and interactions for city boundary
          if (isCityBoundary) return;
          
          // Add district name label
          if (district.center_coordinates) {
            const label = L.marker([district.center_coordinates.lat, district.center_coordinates.lng], {
              icon: L.divIcon({
                className: 'district-label',
                html: `<div style="
                  background: white;
                  padding: 4px 8px;
                  border-radius: 4px;
                  font-size: 12px;
                  font-weight: 600;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                  white-space: nowrap;
                  pointer-events: none;
                ">${district.name}</div>`,
                iconSize: [0, 0],
              }),
            }).addTo(map);
            
            // Store label reference
            (layer as any).label = label;
          }

          // Add hover effect
          layer.on({
            mouseover: (e) => {
              const target = e.target;
              target.setStyle({
                fillOpacity: 0.6,
                weight: 3,
              });
            },
            mouseout: (e) => {
              const target = e.target;
              target.setStyle({
                fillOpacity: selectedDistrict?.id === district.id ? 0.6 : 0.35,
                weight: 2,
              });
            },
            click: () => {
              onDistrictClick?.(district);
            },
          });

          // Bind popup
          layer.bindPopup(`
            <div style="font-family: sans-serif;">
              <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">${district.name}</h3>
              ${district.population ? `<p style="margin: 4px 0;">Einwohner: ${district.population.toLocaleString('de-DE')}</p>` : ''}
            </div>
          `);
        },
      }).addTo(map);

      layersRef.current.set(district.id, layer);
    });

    // Fit bounds to show all districts
    const bounds = L.latLngBounds(
      districts
        .filter(d => d.center_coordinates)
        .map(d => [d.center_coordinates.lat, d.center_coordinates.lng])
    );
    
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [mapReady, districts, selectedDistrict, onDistrictClick]);

  // Update selected district style
  useEffect(() => {
    if (!mapReady) return;

    layersRef.current.forEach((layer, id) => {
      layer.setStyle({
        fillOpacity: selectedDistrict?.id === id ? 0.6 : 0.35,
      });
    });
  }, [selectedDistrict, mapReady]);

  return (
    <div
      ref={mapRef}
      className="w-full h-[600px] rounded-lg border border-border"
    />
  );
};
