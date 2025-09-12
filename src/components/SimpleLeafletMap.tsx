import React, { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import * as L from 'leaflet';
import { ElectionDistrict } from '@/hooks/useElectionDistricts';
import { Badge } from '@/components/ui/badge';
import { MapPin, Users, Square } from 'lucide-react';
import { loadElectoralDistrictsGeoJson } from '@/utils/geoJsonLoader';
import { supabase } from '@/integrations/supabase/client';

interface LeafletKarlsruheMapProps {
  districts: ElectionDistrict[];
  onDistrictClick: (district: ElectionDistrict) => void;
  selectedDistrict?: ElectionDistrict;
}

// Helper function to get party color based on direct mandate
const getPartyColorHex = (district: ElectionDistrict): string => {
  // Find the direct mandate representative
  const directMandate = district.representatives?.find(rep => rep.mandate_type === 'direct');
  const party = directMandate?.party;
  
  switch (party?.toUpperCase()) {
    case 'CDU': return '#000000';
    case 'SPD': return '#dc2626';
    case 'GRÜNE': return '#16a34a';
    case 'FDP': return '#facc15';
    case 'AFD': return '#1e40af';
    case 'LINKE': return '#9333ea';
    default: return '#6b7280';
  }
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

// Helper types and functions for GeoJSON handling
// Minimal FeatureCollection type to avoid over-typing
type GeoJsonData = { type: 'FeatureCollection'; features: any[] };

const getDistrictNumberFromProps = (props: Record<string, any>): number | undefined => {
  // Prefer the official LTW 2021 key "Nummer" (case/space insensitive)
  const keys = Object.keys(props || {});
  const normalized = (k: string) => k.replace(/\s+/g, '').toLowerCase();
  const numKey = keys.find(k => normalized(k) === 'nummer');
  let raw: any = numKey ? props[numKey] : undefined;

  if (raw === undefined || raw === null) {
    // Conservative fallbacks seen in official exports
    raw = props['WK_NR'] ?? props['WKR_NR'] ?? props['WKNR'] ?? props['Wahlkreis_Nr'];
  }

  const n = raw !== undefined ? parseInt(String(raw), 10) : NaN;
  return Number.isNaN(n) ? undefined : n;
};

// Function to calculate true centroid of a polygon
const calculatePolygonCentroid = (coordinates: number[][]): [number, number] => {
  let totalArea = 0;
  let centroidX = 0;
  let centroidY = 0;
  
  for (let i = 0; i < coordinates.length - 1; i++) {
    const x0 = coordinates[i][0];
    const y0 = coordinates[i][1];
    const x1 = coordinates[i + 1][0];
    const y1 = coordinates[i + 1][1];
    
    const a = x0 * y1 - x1 * y0;
    totalArea += a;
    centroidX += (x0 + x1) * a;
    centroidY += (y0 + y1) * a;
  }
  
  totalArea *= 0.5;
  centroidX /= (6 * totalArea);
  centroidY /= (6 * totalArea);
  
  return [centroidY, centroidX]; // Return as [lat, lng] for Leaflet
};

const SimpleLeafletMap: React.FC<LeafletKarlsruheMapProps> = ({ 
  districts, 
  onDistrictClick, 
  selectedDistrict 
}) => {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [geoJsonData, setGeoJsonData] = useState<GeoJsonData | null>(null);
  const [isLoadingBoundaries, setIsLoadingBoundaries] = useState(true);
  const districtLayerRef = useRef<L.LayerGroup | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  // Sync data from official sources
  const syncOfficialData = async () => {
    try {
      console.log('Syncing districts from official sources...');
      await supabase.functions.invoke('sync-bw-districts');
      
      console.log('Syncing representatives from official sources...');
      await supabase.functions.invoke('sync-bw-representatives');
      
      // Refresh the page to load new data
      window.location.reload();
    } catch (error) {
      console.error('Error syncing data:', error);
    }
  };

  // Load official GeoJSON boundaries from downloaded data
  useEffect(() => {
    const loadOfficialBoundaries = async () => {
      try {
        setIsLoadingBoundaries(true);
        console.log('Loading official electoral district boundaries...');
        
        const fc = await loadElectoralDistrictsGeoJson();
        setGeoJsonData(fc);
        console.log('Successfully loaded official boundaries:', fc.features.length, 'Features');
      } catch (error) {
        console.error('Failed to load official boundaries, will use fallback polygons:', error);
        setGeoJsonData(null);
      } finally {
        setIsLoadingBoundaries(false);
      }
    };

    if (districts.length > 0) {
      loadOfficialBoundaries();
    }
  }, [districts]);

  // Initialize map once
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

    // Create separate layer groups for polygons and markers
    districtLayerRef.current = L.layerGroup().addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      districtLayerRef.current = null;
      markerLayerRef.current = null;
    };
  }, [districts]);

  // Render districts and markers whenever data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !districtLayerRef.current || !markerLayerRef.current) return;
    if (!districts.length) return;

    // Clear existing layers
    districtLayerRef.current.clearLayers();
    markerLayerRef.current.clearLayers();

    let renderedBounds: L.LatLngBounds | null = null;

    if (geoJsonData) {
      // Render official GeoJSON directly with Leaflet (handles Polygon & MultiPolygon correctly)
      let officialCount = 0;
      const geoLayer = L.geoJSON(geoJsonData as any, {
        style: (feature) => {
          const districtNumber = feature ? getDistrictNumberFromProps((feature as any).properties || {}) : undefined;
          const district = districts.find(d => d.district_number === districtNumber);
          const isSelected = district && selectedDistrict?.id === district.id;
          const partyColor = getPartyColorHex(district);
          if (district) officialCount++;
          return {
            color: partyColor,
            weight: isSelected ? 4 : 2,
            opacity: 1,
            fillColor: partyColor,
            fillOpacity: isSelected ? 0.7 : 0.25,
          } as L.PathOptions;
        },
        onEachFeature: (feature, layer) => {
          const districtNumber = getDistrictNumberFromProps((feature as any).properties || {});
          const district = districts.find(d => d.district_number === districtNumber);
          if (!district) return;
          const isSelected = selectedDistrict?.id === district.id;
          const partyColor = getPartyColorHex(district);
          const directMandate = district.representatives?.find(rep => rep.mandate_type === 'direct');

          layer.on('mouseover', () => {
            (layer as L.Path).setStyle({ weight: 3, fillOpacity: 0.5 });
          });
          layer.on('mouseout', () => {
            (layer as L.Path).setStyle({ weight: isSelected ? 4 : 2, fillOpacity: isSelected ? 0.7 : 0.25 });
          });
          layer.on('click', () => onDistrictClick(district));

          (layer as L.Layer).bindPopup(`
            <div class="p-2 min-w-[200px]">
              <div class="flex items-center gap-2 mb-2">
                <span class="px-2 py-1 rounded text-white text-xs font-medium" style="background-color: ${partyColor}">${district.district_number}</span>
                <h3 class="font-semibold">${district.district_name}</h3>
              </div>
              <div class="space-y-1 text-sm text-gray-600">
                ${directMandate ? `<div class="flex items-center gap-2"><span>🏆</span><span><strong>${directMandate.name}</strong> (${directMandate.party})</span></div>` : '<div class="text-gray-500">Kein Direktmandat</div>'}
                ${district.representatives && district.representatives.length > 1 ? `<div class="text-xs text-gray-500">${district.representatives.length - 1} weitere Abgeordnete</div>` : ''}
                ${district.population ? `<div class="flex items-center gap-2"><span>👥</span><span>${district.population.toLocaleString()} Einwohner</span></div>` : ''}
                ${district.area_km2 ? `<div class="flex items-center gap-2"><span>📐</span><span>ca. ${district.area_km2} km²</span></div>` : ''}
              </div>
            </div>
          `);
        },
      });

      geoLayer.addTo(districtLayerRef.current);
      renderedBounds = geoLayer.getBounds();
      console.log(`Rendered official GeoJSON layer with ${officialCount} matched districts`);
    } else {
      // Fallback: render generated polygons
      let fallbackCount = 0;
      const allFallbackBounds: [number, number][] = [];

      districts.forEach((district) => {
        const partyColor = getPartyColorHex(district);
        const isSelected = selectedDistrict?.id === district.id;
        const boundaries = getEnhancedDistrictBoundary(district);
        if (!boundaries.length) return;
        fallbackCount++;
        allFallbackBounds.push(...boundaries);

        const polygon = L.polygon(boundaries as any, {
          color: partyColor,
          weight: isSelected ? 4 : 2,
          opacity: 1,
          fillColor: partyColor,
          fillOpacity: isSelected ? 0.7 : 0.25,
        });

        polygon.on('mouseover', function () {
          this.setStyle({ weight: 3, fillOpacity: 0.5 });
        });
        polygon.on('mouseout', function () {
          this.setStyle({ weight: isSelected ? 4 : 2, fillOpacity: isSelected ? 0.7 : 0.25 });
        });
        polygon.on('click', () => onDistrictClick(district));
        polygon.addTo(districtLayerRef.current);
      });

      if (allFallbackBounds.length) {
        renderedBounds = L.latLngBounds(allFallbackBounds);
      }
      console.log(`Rendered ${fallbackCount} fallback district boundaries`);
    }

    // Add markers with representative info
    districts.forEach((district) => {
      if (!district.center_coordinates) return;
      const { lat, lng } = district.center_coordinates as { lat: number; lng: number };
      const partyColor = getPartyColorHex(district);
      const directMandate = district.representatives?.find(rep => rep.mandate_type === 'direct');
      
      const marker = L.marker([lat, lng], { 
        icon: L.divIcon({
          html: `<div style="background: white; border: 2px solid ${partyColor}; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 11px; color: black; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">${district.district_number}</div>`,
          className: 'custom-district-marker',
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        })
      });
      
      marker.on('click', () => onDistrictClick(district));
      
      // Enhanced tooltip with representative info
      if (directMandate) {
        marker.bindTooltip(
          `<strong>WK ${district.district_number}: ${district.district_name}</strong><br/>
           <strong>${directMandate.name}</strong> (${directMandate.party})<br/>
           Direktmandat`, 
          {
            permanent: false,
            direction: 'top',
            offset: [0, -20]
          }
        );
      }
      
      marker.addTo(markerLayerRef.current!);
    });

    // Fit bounds
    if (renderedBounds && renderedBounds.isValid()) {
      const paddingValue = window.innerWidth < 768 ? 10 : 20;
      map.fitBounds(renderedBounds, {
        padding: [paddingValue, paddingValue] as [number, number],
        maxZoom: window.innerWidth < 768 ? 9 : 10,
      });
    }
  }, [districts, selectedDistrict, geoJsonData, onDistrictClick]);
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
        
        <button
          onClick={syncOfficialData}
          className="bg-primary/95 backdrop-blur-sm text-primary-foreground px-3 py-2 rounded-lg text-sm hover:bg-primary shadow-lg"
        >
          Daten aktualisieren
        </button>
      </div>
    </div>
  );
};

export default SimpleLeafletMap;