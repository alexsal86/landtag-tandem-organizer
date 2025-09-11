import React, { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import * as L from 'leaflet';
import { ElectionDistrict } from '@/hooks/useElectionDistricts';
import { Badge } from '@/components/ui/badge';
import { MapPin, Users, Square } from 'lucide-react';
import { loadElectoralDistrictsGeoJson } from '@/utils/geoJsonLoader';

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

// Enhanced district boundaries - more realistic shapes based on geography
const getEnhancedDistrictBoundary = (district: ElectionDistrict): [number, number][] => {
  if (!district.center_coordinates) return [];
  
  const { lat, lng } = district.center_coordinates as { lat: number; lng: number };
  const points: [number, number][] = [];
  
  // Create irregular polygon that looks more like real district boundaries
  const baseRadius = 0.025; // Slightly larger base radius
  const irregularityFactor = 0.4; // Add randomness to make it look more natural
  
  // Generate points with varying distances to create irregular shape
  for (let i = 0; i < 16; i++) { // More points for smoother boundaries
    const angle = (i * 2 * Math.PI) / 16;
    
    // Add some irregularity based on district characteristics
    const radiusVariation = 1 + (Math.sin(angle * 3) * irregularityFactor) + 
                           (Math.cos(angle * 2) * irregularityFactor * 0.7);
    const radius = baseRadius * radiusVariation;
    
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
  const [geoJsonData, setGeoJsonData] = useState<{ [key: number]: [number, number][] } | null>(null);
  const [isLoadingBoundaries, setIsLoadingBoundaries] = useState(true);

  // Load official GeoJSON boundaries from downloaded data
  useEffect(() => {
    const loadOfficialBoundaries = async () => {
      try {
        setIsLoadingBoundaries(true);
        console.log('Loading official electoral district boundaries...');
        
        // Load the actual GeoJSON data from the ZIP file
        const officialBoundaries = await loadElectoralDistrictsGeoJson();
        setGeoJsonData(officialBoundaries);
        console.log('Successfully loaded official boundaries for', Object.keys(officialBoundaries).length, 'districts');
        
      } catch (error) {
        console.error('Failed to load official boundaries, using fallback:', error);
        
        // Fallback to enhanced generated boundaries
        const fallbackData: { [key: number]: [number, number][] } = {};
        districts.forEach(district => {
          fallbackData[district.district_number] = getEnhancedDistrictBoundary(district);
        });
        setGeoJsonData(fallbackData);
      } finally {
        setIsLoadingBoundaries(false);
      }
    };

    if (districts.length > 0) {
      loadOfficialBoundaries();
    }
  }, [districts]);

  // Optimize map view with bounds fitting
  useEffect(() => {
    if (!mapRef.current || !geoJsonData || isLoadingBoundaries) return;
    
    console.log('Optimizing map view with loaded boundaries...');
    
    // Calculate bounds from all loaded districts
    const allBounds: [number, number][] = [];
    Object.values(geoJsonData).forEach(coordinates => {
      allBounds.push(...coordinates);
    });
    
    if (allBounds.length > 0) {
      console.log('Fitting map to', allBounds.length, 'boundary points');
      
      // Create bounds and fit map
      const bounds = L.latLngBounds(allBounds);
      const paddingValue = window.innerWidth < 768 ? 10 : 20; // Responsive padding
      
      mapRef.current.fitBounds(bounds, {
        padding: [paddingValue, paddingValue] as [number, number],
        maxZoom: window.innerWidth < 768 ? 9 : 10 // Responsive max zoom
      });
    }
  }, [geoJsonData, isLoadingBoundaries]);

  // Render districts with real boundaries if available
  useEffect(() => {
    if (!mapEl.current || !districts.length) return;
    if (mapRef.current) return; // init once

    console.log('Initializing map with districts:', districts.length);

    // Responsive initial zoom based on screen size
    const initialZoom = window.innerWidth < 768 ? 7 : 8;
    
    const map = L.map(mapEl.current, {
      center: [48.7758, 9.1829], // Center of Baden-Württemberg (Stuttgart area)
      zoom: initialZoom,
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true // Better performance for many polygons
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
      
      // Use loaded boundaries (either official or enhanced fallback)
      const boundaries = geoJsonData?.[district.district_number] || getEnhancedDistrictBoundary(district);

      // Add district polygon
      if (boundaries.length > 0) {
        console.log(`Rendering district ${district.district_number} with ${boundaries.length} boundary points`);
        const polygon = L.polygon(boundaries as any, {
          color: partyColor,
          weight: isSelected ? 4 : 2,
          opacity: 1,
          fillColor: partyColor,
          fillOpacity: isSelected ? 0.7 : 0.25,
        }).addTo(map);
        
        // Add hover effects
        polygon.on('mouseover', function(e) {
          this.setStyle({
            weight: 3,
            fillOpacity: 0.5
          });
        });
        
        polygon.on('mouseout', function(e) {
          this.setStyle({
            weight: isSelected ? 4 : 2,
            fillOpacity: isSelected ? 0.7 : 0.25
          });
        });

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
  }, [districts, onDistrictClick, selectedDistrict, geoJsonData]);

  if (!districts.length) {
    return (
      <div className="relative w-full h-[400px] md:h-[500px] lg:h-[600px] bg-card rounded-lg overflow-hidden border border-border flex items-center justify-center">
        <p className="text-muted-foreground">Keine Wahlkreisdaten verfügbar</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[400px] md:h-[500px] lg:h-[600px] bg-card rounded-lg overflow-hidden border border-border">
      <div ref={mapEl} className="w-full h-full" />
      
      {isLoadingBoundaries && (
        <div className="absolute top-4 left-4 bg-card/95 backdrop-blur-sm border border-border rounded-lg p-4 z-[1000] max-w-xs shadow-lg">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Lade Wahlkreisgrenzen
              </p>
              <p className="text-xs text-muted-foreground">
                Offizielle GeoJSON-Daten werden verarbeitet...
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className="absolute top-4 right-4 z-[1000] space-y-2">
        <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg p-3 text-xs text-muted-foreground shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">Baden-Württemberg Wahlkreise</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Square className="h-3 w-3" />
              <span>{districts.length} Wahlkreise</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>Klicken für Details</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleLeafletMap;