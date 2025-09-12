import React, { useRef, useEffect, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import * as L from 'leaflet';
import { ElectionDistrict } from '@/hooks/useElectionDistricts';
import { MapPin, Users, Square } from 'lucide-react';

interface LeafletKarlsruheMapProps {
  districts: ElectionDistrict[];
  onDistrictClick: (district: ElectionDistrict) => void;
  selectedDistrict?: ElectionDistrict | null;
}

// Get party color for styling
function getPartyColorHex(district: ElectionDistrict): string {
  const directMandate = district.representatives?.find(r => r.mandate_type === 'direct');
  const party = directMandate?.party?.toLowerCase() || '';
  
  const colors: { [key: string]: string } = {
    'cdu': '#000000',
    'spd': '#e3000f',
    'grüne': '#46962b',
    'fdp': '#ffed00',
    'afd': '#009ee0',
    'linke': '#be3075'
  };
  
  return colors[party] || '#666666';
}

// Define Leaflet icon
const customIcon = L.icon({
  iconUrl: '/leaflet/marker-icon.png',
  shadowUrl: '/leaflet/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Generate enhanced fallback boundary polygon for districts without database boundaries
function getEnhancedDistrictBoundary(district: ElectionDistrict): [number, number][] {
  const center = district.center_coordinates 
    ? [district.center_coordinates.lat, district.center_coordinates.lng] as [number, number]
    : [49.0, 8.4] as [number, number];

  const baseSize = 0.08 + (district.district_number % 5) * 0.02;
  const irregularity = 0.015;
  const numPoints = 8;
  
  const points: [number, number][] = [];
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    const distanceVariation = 1 + (Math.sin(angle * 3) * 0.3) + (Math.random() - 0.5) * irregularity;
    const radius = baseSize * distanceVariation;
    
    const lat = center[0] + radius * Math.cos(angle);
    const lng = center[1] + radius * Math.sin(angle);
    points.push([lat, lng]);
  }
  
  points.push(points[0]); // Close the polygon
  return points;
}

// Calculate polygon centroid
function calculatePolygonCentroid(coordinates: number[][]): [number, number] {
  let area = 0;
  let cx = 0;
  let cy = 0;
  
  for (let i = 0; i < coordinates.length - 1; i++) {
    const [lat0, lng0] = coordinates[i];
    const [lat1, lng1] = coordinates[i + 1];
    const a = lat0 * lng1 - lat1 * lng0;
    area += a;
    cx += (lat0 + lat1) * a;
    cy += (lng0 + lng1) * a;
  }
  
  area *= 0.5;
  if (area === 0) {
    const n = coordinates.length;
    const avgLat = coordinates.reduce((sum, coord) => sum + coord[0], 0) / n;
    const avgLng = coordinates.reduce((sum, coord) => sum + coord[1], 0) / n;
    return [avgLat, avgLng];
  }
  
  return [cx / (6 * area), cy / (6 * area)];
}

const SimpleLeafletMap: React.FC<LeafletKarlsruheMapProps> = ({ 
  districts, 
  onDistrictClick, 
  selectedDistrict 
}) => {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [isLoadingBoundaries, setIsLoadingBoundaries] = useState(false);
  const districtLayerRef = useRef<L.LayerGroup | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);

  // Initialize map once
  useEffect(() => {
    if (!mapEl.current) return;
    if (mapRef.current) return; // init once

    console.log('Initializing map with districts:', districts.length);

    // Initialize map even if no districts yet - they will be added later
    // Responsive initial zoom based on screen size
    const initialZoom = window.innerWidth < 768 ? 7 : 8;
    
    const map = L.map(mapEl.current, {
      center: [48.7758, 9.1829], // Center of Baden-Württemberg (Stuttgart area)
      zoom: initialZoom,
      zoomControl: true,
      attributionControl: true,
      renderer: L.svg() // Use SVG renderer for better geometry precision
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
  }, []); // Remove districts dependency to always initialize map

  // Add district polygons and markers directly from database
  useEffect(() => {
    if (!mapRef.current || !districtLayerRef.current || !markerLayerRef.current) return;

    // Clear existing layers
    districtLayerRef.current.clearLayers();
    markerLayerRef.current.clearLayers();

    if (!districts || districts.length === 0) return;

    console.log('Rendering districts via L.geoJSON ...');

    // Build a FeatureCollection from DB geometries (they are [lng, lat])
    const featureCollection: any = {
      type: 'FeatureCollection',
      features: districts
        .filter(d => d.boundaries && (d.boundaries.type === 'Polygon' || d.boundaries.type === 'MultiPolygon'))
        .map(d => ({
          type: 'Feature',
          geometry: d.boundaries,
          properties: { districtNumber: d.district_number }
        }))
    };

    const geoLayer = L.geoJSON(featureCollection, {
      style: (feature) => {
        const num = (feature?.properties as any)?.districtNumber as number;
        const d = districts.find(x => x.district_number === num);
        return {
          color: d ? getPartyColorHex(d) : '#666666',
          weight: 2,
          opacity: 0.8,
          fillOpacity: 0.3,
          smoothFactor: 0, // Disable geometry simplification for precise boundaries
        } as L.PathOptions;
      },
      onEachFeature: (feature, layer) => {
        const num = (feature?.properties as any)?.districtNumber as number;
        const d = districts.find(x => x.district_number === num);
        if (!d) return;
        layer.on('click', () => onDistrictClick(d));
        layer.on('mouseover', (e: any) => e.target.setStyle({ weight: 3, opacity: 1.0, fillOpacity: 0.5 }));
        layer.on('mouseout', (e: any) => e.target.setStyle({ weight: 2, opacity: 0.8, fillOpacity: 0.3 }));
      }
    });

    districtLayerRef.current.addLayer(geoLayer);

    // Markers overlay
    districts.forEach((district) => {
      const center = district.center_coordinates 
        ? [district.center_coordinates.lat, district.center_coordinates.lng] as [number, number]
        : [48.7758, 9.1829] as [number, number];
      const isSelected = selectedDistrict?.district_number === district.district_number;
      const markerHtml = `
        <div class="district-marker ${isSelected ? 'selected' : ''}" style="
          background: ${getPartyColorHex(district)};
          border: 2px solid white; border-radius: 50%; width: 32px; height: 32px;
          display: flex; align-items: center; justify-content: center;
          font-weight: bold; font-size: 14px; color: white; text-shadow: 1px 1px 2px rgba(0,0,0,0.7);
          box-shadow: 0 2px 8px rgba(0,0,0,0.3); cursor: pointer; transition: all 0.2s ease;
          ${isSelected ? 'transform: scale(1.2); box-shadow: 0 4px 12px rgba(0,0,0,0.4);' : ''}
        ">${district.district_number}</div>`;

      const marker = L.marker(center, { icon: L.divIcon({ html: markerHtml, className: 'custom-district-marker', iconSize: [32, 32], iconAnchor: [16, 16] }) })
        .on('click', () => onDistrictClick(district));
      markerLayerRef.current!.addLayer(marker);
    });

    // Fit map to features without zoom limitation
    const bounds = (geoLayer as any).getBounds?.();
    if (bounds && bounds.isValid()) {
      mapRef.current.fitBounds(bounds.pad(0.1), { padding: [20, 20] });
    }

    console.log('Districts rendered.');
  }, [districts, selectedDistrict, onDistrictClick]);

  if (!districts.length) {
    return (
      <div className="relative w-full h-[400px] md:h-[500px] lg:h-[600px] bg-card rounded-lg overflow-hidden border border-border flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Wahlkreisdaten werden geladen...</p>
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mt-2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[400px] md:h-[500px] lg:h-[600px] bg-card rounded-lg overflow-hidden border border-border">
      <div ref={mapEl} className="w-full h-full" />
      
      {isLoadingBoundaries && (
        <div className="absolute top-4 left-4 bg-background/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg border border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full"></div>
            Wahlkreisgrenzen werden geladen...
          </div>
        </div>
      )}

      {/* Map legend */}
      <div className="absolute bottom-4 left-4 bg-background/95 backdrop-blur-sm p-3 rounded-lg shadow-lg border border-border max-w-xs">
        <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
          <Square className="w-4 h-4" />
          Wahlkreise Baden-Württemberg
        </h4>
        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <MapPin className="w-3 h-3" />
            <span>Wahlkreis-Nummer</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-3 h-3" />
            <span>Farben zeigen Direktmandat-Partei</span>
          </div>
          <div className="text-xs mt-1 opacity-75">
            Klicken Sie auf einen Wahlkreis für Details
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleLeafletMap;