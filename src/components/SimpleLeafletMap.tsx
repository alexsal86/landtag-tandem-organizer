import React, { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import * as L from 'leaflet';
import { ElectionDistrict } from '@/hooks/useElectionDistricts';
import { Badge } from '@/components/ui/badge';
import { MapPin, Users, Square } from 'lucide-react';

interface LeafletKarlsruheMapProps {
  districts: ElectionDistrict[];
  onDistrictClick: (district: ElectionDistrict) => void;
  selectedDistrict?: ElectionDistrict;
}

const getPartyColorHex = (party?: string): string => {
  const colorMap: Record<string, string> = {
    fdp: '#FFD700',
    'grüne': '#4CAF50',
    cdu: '#0066CC',
    spd: '#E3000F',
    afd: '#00A0E6',
    'die linke': '#BE3075',
  };
  return colorMap[party?.toLowerCase() || ''] || '#9E9E9E';
};

const icon = L.icon({
  iconUrl: '/leaflet/marker-icon.png',
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  shadowUrl: '/leaflet/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Simplified district boundaries - circular areas around center coordinates
const getDistrictBoundary = (district: ElectionDistrict): [number, number][] => {
  if (!district.center_coordinates) return [];
  
  const { lat, lng } = district.center_coordinates as { lat: number; lng: number };
  const radius = 0.02; // Approximate radius for visual representation
  const points: [number, number][] = [];
  
  // Create a simple circle with 12 points
  for (let i = 0; i < 12; i++) {
    const angle = (i * 2 * Math.PI) / 12;
    const latOffset = radius * Math.cos(angle);
    const lngOffset = radius * Math.sin(angle);
    points.push([lat + latOffset, lng + lngOffset]);
  }
  
  return points;
};

const SimpleLeafletMap: React.FC<LeafletKarlsruheMapProps> = ({ 
  districts, 
  onDistrictClick, 
  selectedDistrict 
}) => {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapEl.current || !districts.length) return;
    if (mapRef.current) return; // init once

    console.log('Initializing map with districts:', districts.length);

    const map = L.map(mapEl.current, {
      center: [48.5, 8.5], // Center of Baden-Württemberg
      zoom: 7,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    districts.forEach((district) => {
      if (!district.center_coordinates) return;

      const { lat, lng } = district.center_coordinates as { lat: number; lng: number };
      const partyColor = getPartyColorHex(district.representative_party);
      const isSelected = selectedDistrict?.id === district.id;
      const boundaries = getDistrictBoundary(district);

      // Add district polygon
      if (boundaries.length > 0) {
        const polygon = L.polygon(boundaries as any, {
          color: partyColor,
          weight: isSelected ? 3 : 2,
          opacity: 0.9,
          fillColor: partyColor,
          fillOpacity: isSelected ? 0.6 : 0.35,
        }).addTo(map);

        polygon.on('click', () => onDistrictClick(district));

        polygon.bindPopup(`
          <div class="p-2 min-w-[200px]">
            <div class="flex items-center gap-2 mb-2">
              <span class="px-2 py-1 rounded text-white text-xs font-medium" style="background-color: ${partyColor}">
                ${district.district_number}
              </span>
              <h3 class="font-semibold">${district.district_name}</h3>
            </div>
            <div class="space-y-1 text-sm text-gray-600">
              <div class="flex items-center gap-2">
                <span>📍</span>
                <span>${district.representative_name || 'Nicht bekannt'}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 border rounded text-xs">
                  ${district.representative_party || 'Partei unbekannt'}
                </span>
              </div>
              ${district.population ? `
                <div class="flex items-center gap-2">
                  <span>👥</span>
                  <span>${district.population.toLocaleString()} Einwohner</span>
                </div>
              ` : ''}
              ${district.area_km2 ? `
                <div class="flex items-center gap-2">
                  <span>📐</span>
                  <span>ca. ${district.area_km2} km²</span>
                </div>
              ` : ''}
            </div>
          </div>
        `);
      }

      // Add district center marker
      const marker = L.marker([lat, lng], { icon }).addTo(map);
      marker.on('click', () => onDistrictClick(district));
      marker.bindPopup(`
        <div class="text-center">
          <span class="px-2 py-1 rounded text-white text-xs font-medium" style="background-color: ${partyColor}">
            Wahlkreis ${district.district_number}
          </span>
          <div class="mt-1 font-semibold">${district.district_name}</div>
        </div>
      `);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [districts, onDistrictClick, selectedDistrict]);

  if (!districts.length) {
    return (
      <div className="relative w-full h-[400px] bg-card rounded-lg overflow-hidden border border-border flex items-center justify-center">
        <p className="text-muted-foreground">Keine Wahlkreisdaten verfügbar</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[400px] bg-card rounded-lg overflow-hidden border border-border">
      <div ref={mapEl} className="w-full h-full" />
      <div className="absolute top-4 right-4 z-[1000] space-y-2">
        <div className="bg-card/90 backdrop-blur-sm border border-border rounded-md p-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1 mb-1">
            <MapPin className="h-3 w-3" />
            <span>Wahlkreise Baden-Württemberg</span>
          </div>
          <div className="text-[10px]">
            {districts.length} Wahlkreise - Klicken für Details
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleLeafletMap;