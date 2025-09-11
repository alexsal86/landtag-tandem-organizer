import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ElectionDistrict } from '@/hooks/useElectionDistricts';
import { Badge } from '@/components/ui/badge';
import { MapPin, Users, Square } from 'lucide-react';

// Fix for default markers - simpler approach
const icon = L.icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface LeafletKarlsruheMapProps {
  districts: ElectionDistrict[];
  onDistrictClick: (district: ElectionDistrict) => void;
  selectedDistrict?: ElectionDistrict;
}

const getPartyColor = (party?: string): string => {
  switch (party?.toLowerCase()) {
    case 'fdp': return '#FFEB3B'; // Yellow
    case 'grüne': return '#4CAF50'; // Green  
    case 'cdu': return '#2196F3'; // Blue
    case 'spd': return '#F44336'; // Red
    case 'afd': return '#795548'; // Brown
    case 'die linke': return '#9C27B0'; // Purple
    default: return '#9E9E9E'; // Gray
  }
};

const getPartyColorHex = (party?: string): string => {
  const colorMap: Record<string, string> = {
    'fdp': '#FFD700',
    'grüne': '#4CAF50', 
    'cdu': '#0066CC',
    'spd': '#E3000F',
    'afd': '#00A0E6',
    'die linke': '#BE3075',
  };
  return colorMap[party?.toLowerCase() || ''] || '#9E9E9E';
};

// Simple district boundaries based on district numbers - in a real app these would come from actual geodata
const getDistrictBoundaries = (districtNumber: number): [number, number][] => {
  const baseLatitude = 49.012;
  const baseLongitude = 8.4037;
  const offset = 0.02;
  
  switch (districtNumber) {
    case 1: // Karlsruhe I
      return [
        [baseLatitude + offset, baseLongitude - offset],
        [baseLatitude + offset, baseLongitude + offset/2],
        [baseLatitude, baseLongitude + offset/2],
        [baseLatitude, baseLongitude - offset],
      ];
    case 2: // Karlsruhe II  
      return [
        [baseLatitude + offset, baseLongitude + offset/2],
        [baseLatitude + offset, baseLongitude + offset*2],
        [baseLatitude, baseLongitude + offset*2],
        [baseLatitude, baseLongitude + offset/2],
      ];
    case 3: // Ettlingen
      return [
        [baseLatitude, baseLongitude - offset],
        [baseLatitude, baseLongitude + offset/2],
        [baseLatitude - offset, baseLongitude + offset/2],
        [baseLatitude - offset, baseLongitude - offset],
      ];
    case 4: // Bruchsal-Schwetzingen
      return [
        [baseLatitude, baseLongitude + offset/2],
        [baseLatitude, baseLongitude + offset*2],
        [baseLatitude - offset, baseLongitude + offset*2],
        [baseLatitude - offset, baseLongitude + offset/2],
      ];
    default:
      return [
        [baseLatitude, baseLongitude],
        [baseLatitude + 0.01, baseLongitude + 0.01],
        [baseLatitude, baseLongitude + 0.01],
      ];
  }
};

const MapController = ({ selectedDistrict }: { selectedDistrict?: ElectionDistrict }) => {
  const map = useMap();
  
  useEffect(() => {
    if (selectedDistrict?.center_coordinates) {
      const coords = selectedDistrict.center_coordinates as { lat: number; lng: number };
      map.setView([coords.lat, coords.lng], 12, { animate: true });
    }
  }, [selectedDistrict, map]);
  
  return null;
};

const LeafletKarlsruheMap: React.FC<LeafletKarlsruheMapProps> = ({ 
  districts, 
  onDistrictClick, 
  selectedDistrict 
}) => {
  const mapRef = useRef<L.Map>(null);

  // Add error handling
  if (!districts || districts.length === 0) {
    return (
      <div className="relative w-full h-[400px] bg-card rounded-lg overflow-hidden border border-border flex items-center justify-center">
        <p className="text-muted-foreground">Keine Wahlkreisdaten verfügbar</p>
      </div>
    );
  }

  console.log('LeafletKarlsruheMap rendering with districts:', districts.length);

  return (
    <div className="relative w-full h-[400px] bg-card rounded-lg overflow-hidden border border-border">
      <MapContainer
        center={[49.012, 8.4037]}
        zoom={10}
        className="w-full h-full"
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapController selectedDistrict={selectedDistrict} />
        
        {districts.map((district) => {
          const boundaries = getDistrictBoundaries(district.district_number);
          const isSelected = selectedDistrict?.id === district.id;
          const partyColor = getPartyColorHex(district.representative_party);
          
          return (
            <React.Fragment key={district.id}>
              {/* District polygon */}
              <Polygon
                positions={boundaries}
                pathOptions={{
                  fillColor: partyColor,
                  fillOpacity: isSelected ? 0.7 : 0.4,
                  color: partyColor,
                  weight: isSelected ? 3 : 2,
                  opacity: 0.8,
                }}
                eventHandlers={{
                  click: () => onDistrictClick(district),
                  mouseover: (e) => {
                    e.target.setStyle({
                      fillOpacity: 0.6,
                      weight: 3,
                    });
                  },
                  mouseout: (e) => {
                    e.target.setStyle({
                      fillOpacity: isSelected ? 0.7 : 0.4,
                      weight: isSelected ? 3 : 2,
                    });
                  },
                }}
              >
                <Popup>
                  <div className="p-2 min-w-[200px]">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge 
                        variant="secondary" 
                        style={{ backgroundColor: partyColor, color: '#fff' }}
                      >
                        {district.district_number}
                      </Badge>
                      <h3 className="font-semibold text-card-foreground">
                        {district.district_name}
                      </h3>
                    </div>
                    
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3 w-3" />
                        <span>{district.representative_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {district.representative_party}
                        </Badge>
                      </div>
                      {district.population && (
                        <div className="flex items-center gap-2">
                          <Users className="h-3 w-3" />
                          <span>{district.population.toLocaleString()} Einwohner</span>
                        </div>
                      )}
                      {district.area_km2 && (
                        <div className="flex items-center gap-2">
                          <Square className="h-3 w-3" />
                          <span>ca. {district.area_km2} km²</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Popup>
              </Polygon>
              
              {/* District center marker with simple marker */}
              {district.center_coordinates && (
                <Marker
                  position={[
                    (district.center_coordinates as { lat: number; lng: number }).lat,
                    (district.center_coordinates as { lat: number; lng: number }).lng
                  ]}
                  icon={icon}
                  eventHandlers={{
                    click: () => onDistrictClick(district),
                  }}
                >
                  <Popup>
                    <div className="text-center">
                      <Badge 
                        variant="secondary" 
                        style={{ backgroundColor: partyColor, color: '#fff' }}
                      >
                        Wahlkreis {district.district_number}
                      </Badge>
                      <div className="mt-1 font-semibold">{district.district_name}</div>
                    </div>
                  </Popup>
                </Marker>
              )}
            </React.Fragment>
          );
        })}
      </MapContainer>
      
      {/* Map controls overlay */}
      <div className="absolute top-4 right-4 z-[1000] space-y-2">
        <div className="bg-card/90 backdrop-blur-sm border border-border rounded-md p-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1 mb-1">
            <MapPin className="h-3 w-3" />
            <span>Wahlkreise Karlsruhe</span>
          </div>
          <div className="text-[10px]">
            Klicken für Details
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeafletKarlsruheMap;