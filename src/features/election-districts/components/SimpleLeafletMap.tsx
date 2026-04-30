import React, { useEffect, useRef, useState } from 'react';
import { debugConsole } from '@/utils/debugConsole';
import 'leaflet/dist/leaflet.css';
import '@/styles/leaflet-overrides.css';
import * as L from 'leaflet';
import { ElectionDistrict } from '@/hooks/useElectionDistricts';
import { PartyAssociation, usePartyAssociations } from '@/hooks/usePartyAssociations';
import { MapPin, Users, Square } from 'lucide-react';
import sunflowerIcon from '@/assets/sunflower.svg';

interface LeafletKarlsruheMapProps {
  districts: ElectionDistrict[];
  onDistrictClick: (district: ElectionDistrict) => void;
  selectedDistrict?: ElectionDistrict;
  showPartyAssociations?: boolean;
}

// Helper function to get party color for election districts and admin boundaries
const getPartyColorHex = (district?: ElectionDistrict, isPartyAssociationBoundary = false): string => {
  if (!district) return '#6b7280';
  
  // Green for party association boundaries
  if (isPartyAssociationBoundary) {
    return '#16a34a'; // Green color for party associations
  }
  
  // Different styling for administrative boundaries
  if (district.district_type === 'verwaltungsgrenze') {
    return '#8B5CF6'; // Purple for administrative boundaries
  }
  
  // Find the direct mandate representative for election districts
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

const getDistrictMarkerDimensions = (zoomLevel: number) => {
  const clampedZoom = Math.max(6, Math.min(13, zoomLevel));
  const size = Math.round(14 + (clampedZoom - 6) * 2);
  const fontSize = Math.max(9, Math.round(size * 0.4));
  const borderWidth = Math.max(1, Math.round(size * 0.08));

  return { size, fontSize, borderWidth };
};

const SimpleLeafletMap: React.FC<LeafletKarlsruheMapProps> = ({ 
  districts, 
  onDistrictClick, 
  selectedDistrict,
  showPartyAssociations = false
}) => {
  const { associations } = usePartyAssociations();
  const [zoomLevel, setZoomLevel] = useState(8);
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const districtLayerRef = useRef<L.LayerGroup | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const onDistrictClickRef = useRef(onDistrictClick);
  const hasFittedBoundsRef = useRef(false);

  // Keep callback ref in sync without triggering effects
  useEffect(() => {
    onDistrictClickRef.current = onDistrictClick;
  });

  // Initialize map once
  useEffect(() => {
    if (!mapEl.current) return;
    if (mapRef.current) return; // init once

    

    // Responsive initial zoom based on screen size
    const initialZoom = window.innerWidth < 768 ? 7 : 8;
    
    const map = L.map(mapEl.current, {
      center: [48.7758, 9.1829], // Center of Baden-Württemberg (Stuttgart area)
      zoom: initialZoom,
      zoomControl: true,
      attributionControl: true,
      preferCanvas: false, // Use SVG for better precision
    });
    mapRef.current = map;
    setZoomLevel(map.getZoom());

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      crossOrigin: 'anonymous',
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
  }, []);

  // Keep marker sizing in sync with map zoom
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleZoomEnd = () => {
      setZoomLevel(map.getZoom());
    };

    map.on('zoomend', handleZoomEnd);
    return () => {
      map.off('zoomend', handleZoomEnd);
    };
  }, []);

  // Update markers when showPartyAssociations changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !markerLayerRef.current) return;

    // Re-render markers when showPartyAssociations changes
    // This is handled in the main rendering effect above
  }, [showPartyAssociations, associations]);

  // Render districts and markers whenever data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !districtLayerRef.current || !markerLayerRef.current) return;

    // Clear existing layers
    districtLayerRef.current.clearLayers();
    markerLayerRef.current.clearLayers();

    if (!districts.length && !showPartyAssociations) return;

    let renderedBounds: L.LatLngBounds | null = null;

    // Collect all districts to render (normal districts + party association boundaries)
    const allDistrictsToRender: Array<{ district: ElectionDistrict; isPartyBoundary: boolean; associationName?: string }> = [];
    
    // Add normal districts
    districts.forEach(district => {
      allDistrictsToRender.push({ district, isPartyBoundary: false });
    });
    
    // Add party association boundary districts if enabled
    if (showPartyAssociations) {
      associations.forEach(association => {
        if (association.boundary_districts && association.boundary_districts.length > 0) {
          association.boundary_districts.forEach(boundaryDistrict => {
            allDistrictsToRender.push({ 
              district: boundaryDistrict, 
              isPartyBoundary: true, 
              associationName: association.name 
            });
          });
        }
      });
    }

    // Render districts using boundaries from database
    const geoJsonFeatures = allDistrictsToRender
      .filter(item => item.district.boundaries)
      .map(item => ({
        type: 'Feature' as const,
        properties: { 
          district_number: item.district.district_number,
          district_name: item.district.district_name,
          isPartyBoundary: item.isPartyBoundary,
          associationName: item.associationName
        },
        geometry: item.district.boundaries
      }));

    debugConsole.log(`[SimpleLeafletMap] rendering ${geoJsonFeatures.length} polygon features from ${allDistrictsToRender.length} districts`);

    if (geoJsonFeatures.length > 0) {
      // Wrap in a proper FeatureCollection so L.geoJSON reliably parses every feature
      const featureCollection = {
        type: 'FeatureCollection' as const,
        features: geoJsonFeatures,
      };
      const geoLayer = L.geoJSON(featureCollection as GeoJSON.FeatureCollection, {
        style: (feature) => {
          const districtNumber = feature?.properties?.district_number;
          const isPartyBoundary = feature?.properties?.isPartyBoundary;
          const allDistricts = allDistrictsToRender.map(item => item.district);
          const district = allDistricts.find(d => d.district_number === districtNumber);
          const isSelected = district && selectedDistrict?.id === district.id;
          const isAdministrative = district?.district_type === 'verwaltungsgrenze';
          const partyColor = getPartyColorHex(district, isPartyBoundary);
          
          return {
            color: isSelected ? '#ffffff' : (isPartyBoundary ? '#15803d' : (isAdministrative ? '#6B46C1' : partyColor)),
            weight: isSelected ? 4 : (isPartyBoundary ? 3 : (isAdministrative ? 2 : 2)),
            opacity: 1,
            fillColor: partyColor,
            fillOpacity: isSelected ? 0.7 : (isPartyBoundary ? 0.4 : (isAdministrative ? 0.3 : 0.25)),
            dashArray: isAdministrative ? '5, 5' : '',
            smoothFactor: 0, // No simplification for maximum precision
          } as L.PathOptions;
        },
        onEachFeature: (feature, layer) => {
          const districtNumber = feature?.properties?.district_number;
          const isPartyBoundary = feature?.properties?.isPartyBoundary;
          const associationName = feature?.properties?.associationName;
          const allDistricts = allDistrictsToRender.map(item => item.district);
          const district = allDistricts.find(d => d.district_number === districtNumber);
          if (!district) return;
          
          const isSelected = selectedDistrict?.id === district.id;
          const partyColor = getPartyColorHex(district, isPartyBoundary);
          const directMandate = district.representatives?.find(rep => rep.mandate_type === 'direct');

          const isAdministrative = district.district_type === 'verwaltungsgrenze';
          
          layer.on('mouseover', () => {
            (layer as L.Path).setStyle({ 
              weight: 4, 
              fillOpacity: isPartyBoundary ? 0.6 : (isAdministrative ? 0.5 : 0.5)
            });
          });
          layer.on('mouseout', () => {
            (layer as L.Path).setStyle({ 
              weight: isSelected ? 4 : (isPartyBoundary ? 3 : (isAdministrative ? 2 : 2)), 
              fillOpacity: isSelected ? 0.7 : (isPartyBoundary ? 0.4 : (isAdministrative ? 0.3 : 0.25))
            });
          });
          layer.on('click', () => onDistrictClickRef.current(district));

          let popupContent = `
            <div class="p-2 min-w-[200px]">
              <div class="flex items-center gap-2 mb-2">
                <span class="px-2 py-1 rounded text-white text-xs font-medium" style="background-color: ${partyColor}">${district.district_number}</span>
                <h3 class="font-semibold">${district.district_name || (isAdministrative ? `Kreis ${district.district_number}` : `Wahlkreis ${district.district_number}`)}</h3>
              </div>
              <div class="space-y-1 text-sm text-gray-600">
          `;

          if (isPartyBoundary) {
            popupContent += `
                <div class="mb-2 p-2 border-l-4 border-green-500 bg-green-50">
                  <div class="flex items-center gap-2 text-green-700">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" class="text-green-600" style="display: inline;"><path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L19 8V7L17 8V7C15 7 13.5 8.5 13.5 10.5S15 14 17 14V13L19 14V13L21 14V12C21 10.34 19.66 9 18 9H16C14.34 9 13 10.34 13 12V14C13 15.66 14.34 17 16 17H18C19.66 17 21 15.66 21 14V12C21 10.34 19.66 9 18 9ZM12 7C13.66 7 15 8.34 15 10V14C15 15.66 13.66 17 12 17S9 15.66 9 14V10C9 8.34 10.34 7 12 7ZM3 9V7L5 8V7L7 8V7C9 7 10.5 8.5 10.5 10.5S9 14 7 14V13L5 14V13L3 14V12C3 10.34 4.34 9 6 9H8C9.66 9 11 10.34 11 12V14C11 15.66 9.66 17 8 17H6C4.34 17 3 15.66 3 14V12C3 10.34 4.34 9 6 9Z"/></svg>
                    <strong>Grüner Kreisverband: ${associationName}</strong>
                  </div>
                  <div class="text-xs text-green-600 mt-1">Verwaltungsgrenze als Zuständigkeitsgebiet</div>
                </div>
                <div class="mb-2">
                  <strong>Typ:</strong> Verwaltungsgrenze<br>
                  <strong>Region:</strong> ${district.region || 'Baden-Württemberg'}
                </div>
            `;
          } else if (isAdministrative) {
            popupContent += `
                <div class="mb-2">
                  <strong>Typ:</strong> Verwaltungsgrenze<br>
                  <strong>Region:</strong> ${district.region || 'Baden-Württemberg'}
                </div>
            `;
          } else {
            popupContent += `
                ${directMandate ? `<div class="flex items-center gap-2"><span>🏆</span><span><strong>${directMandate.name}</strong> (${directMandate.party})</span></div>` : '<div class="text-gray-500">Kein Direktmandat</div>'}
                ${district.representatives && district.representatives.length > 1 ? `<div class="text-xs text-gray-500">${district.representatives.length - 1} weitere Abgeordnete</div>` : ''}
            `;
          }

          popupContent += `
                ${district.population ? `<div class="flex items-center gap-2"><span>👥</span><span>${district.population.toLocaleString()} Einwohner</span></div>` : ''}
                ${district.area_km2 ? `<div class="flex items-center gap-2"><span>📐</span><span>ca. ${district.area_km2} km²</span></div>` : ''}
              </div>
            </div>
          `;

          (layer as L.Layer).bindPopup(popupContent);
        },
      });

      geoLayer.addTo(districtLayerRef.current);
      renderedBounds = geoLayer.getBounds();
      
    }

    // Add markers with district numbers (only for election districts, not administrative boundaries)
    districts.filter(d => d.district_type !== 'verwaltungsgrenze').forEach((district) => {
      if (!district.center_coordinates) return;
      const { lat, lng } = district.center_coordinates as { lat: number; lng: number };
      const partyColor = getPartyColorHex(district);
      const directMandate = district.representatives?.find(rep => rep.mandate_type === 'direct');
      const { size, fontSize, borderWidth } = getDistrictMarkerDimensions(zoomLevel);
      
      const marker = L.marker([lat, lng], { 
        icon: L.divIcon({
          html: `<div style="background: white; border: ${borderWidth}px solid ${partyColor}; border-radius: 50%; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: ${fontSize}px; color: black; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">${district.district_number}</div>`,
          className: 'custom-district-marker',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2]
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

    // Add party association markers if enabled (independent of districts)
    if (showPartyAssociations && associations.length > 0) {
      
      associations.forEach((association) => {
        debugConsole.log(`Processing association: ${association.name}, has boundary_districts:`, !!association.boundary_districts?.length);
        
        // Use boundary_districts directly from associations, independent of the districts array
        association.boundary_districts?.forEach((boundaryDistrict) => {
          if (!boundaryDistrict.center_coordinates) {
            debugConsole.warn(`No center_coordinates for district: ${boundaryDistrict.district_number}`);
            return;
          }
          
          // Debug logging to see the actual structure
          debugConsole.log('Party association boundary district coordinates:', boundaryDistrict.center_coordinates);
          
          // Handle GeoJSON Point format: { "type": "Point", "coordinates": [lng, lat] }
          let lat: number, lng: number;
          
          if (typeof boundaryDistrict.center_coordinates === 'object' && boundaryDistrict.center_coordinates !== null) {
            // Check for GeoJSON Point format
            if ('type' in boundaryDistrict.center_coordinates && 
                boundaryDistrict.center_coordinates.type === 'Point' &&
                'coordinates' in boundaryDistrict.center_coordinates &&
                Array.isArray(boundaryDistrict.center_coordinates.coordinates) &&
                boundaryDistrict.center_coordinates.coordinates.length >= 2) {
              
              // GeoJSON format: coordinates[0] = longitude, coordinates[1] = latitude
              lng = boundaryDistrict.center_coordinates.coordinates[0];
              lat = boundaryDistrict.center_coordinates.coordinates[1];
              debugConsole.log(`Parsed GeoJSON Point: lng=${lng}, lat=${lat}`);
              
            } else if ('lat' in boundaryDistrict.center_coordinates && 'lng' in boundaryDistrict.center_coordinates) {
              lat = boundaryDistrict.center_coordinates.lat;
              lng = boundaryDistrict.center_coordinates.lng;
            } else if (
              'latitude' in (boundaryDistrict.center_coordinates as Record<string, unknown>) &&
              'longitude' in (boundaryDistrict.center_coordinates as Record<string, unknown>)
            ) {
              const coords = boundaryDistrict.center_coordinates as { latitude: number; longitude: number };
              lat = coords.latitude;
              lng = coords.longitude;
            } else if (
              Array.isArray(boundaryDistrict.center_coordinates) &&
              (boundaryDistrict.center_coordinates as unknown[]).length >= 2
            ) {
              // Assume [lat, lng] format for plain arrays
              lat = boundaryDistrict.center_coordinates[0];
              lng = boundaryDistrict.center_coordinates[1];
            } else {
              debugConsole.warn('Unable to parse coordinates for party association:', boundaryDistrict);
              return;
            }
          } else {
            debugConsole.warn('center_coordinates is not an object:', boundaryDistrict.center_coordinates);
            return;
          }
          
          if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) {
            debugConsole.warn('Invalid coordinates for party association:', { lat, lng, boundaryDistrict });
            return;
          }
          
          const marker = L.marker([lat, lng], {
            icon: L.divIcon({
              html: `
                <div style="
                  width: 32px; 
                  height: 32px; 
                  background: rgba(34, 197, 94, 0.9); 
                  border: 2px solid white; 
                  border-radius: 50%; 
                  display: flex; 
                  align-items: center; 
                  justify-content: center;
                  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                  font-size: 18px;
                ">
                  <img src="${sunflowerIcon}" alt="Sunflower" width="20" height="20" />
                </div>
              `,
              className: 'party-association-marker',
              iconSize: [32, 32],
              iconAnchor: [16, 16]
            })
          });

          const popupContent = `
            <div style="font-family: system-ui, -apple-system, sans-serif; min-width: 250px;">
              <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <img src="${sunflowerIcon}" alt="Sunflower" width="24" height="24" style="margin-right: 8px;" />
                <strong style="color: #22c55e; font-size: 16px;">Kreisverband</strong>
              </div>
              <p><strong>Wahlkreis:</strong> ${boundaryDistrict.district_name} (${boundaryDistrict.district_number})</p>
              <p><strong>Kreisverband:</strong> ${association.name}</p>
              ${association.email ? `<p><strong>E-Mail:</strong> <a href="mailto:${association.email}" style="color: #22c55e;">${association.email}</a></p>` : ''}
              ${association.phone ? `<p><strong>Telefon:</strong> ${association.phone}</p>` : ''}
              ${association.website ? `<p><strong>Website:</strong> <a href="${association.website}" target="_blank" style="color: #22c55e;">${association.website}</a></p>` : ''}
              ${association.full_address ? `<p><strong>Adresse:</strong> ${association.full_address}</p>` : ''}
            </div>
          `;

          marker.bindPopup(popupContent);
          markerLayerRef.current!.addLayer(marker);
        }); 
      });
    }

    // Fit bounds only on first data load
    if (!hasFittedBoundsRef.current && renderedBounds && renderedBounds.isValid()) {
      hasFittedBoundsRef.current = true;
      const paddingValue = window.innerWidth < 768 ? 10 : 20;
      map.fitBounds(renderedBounds, {
        padding: [paddingValue, paddingValue] as [number, number],
        maxZoom: 12,
      });
    } else if (!hasFittedBoundsRef.current) {
      // Fallback: if no polygons rendered, fit to marker centers so users see BW, not all of Europe
      const markerLatLngs: L.LatLng[] = [];
      districts.forEach((d) => {
        if (d.center_coordinates && typeof (d.center_coordinates as any).lat === 'number') {
          const c = d.center_coordinates as { lat: number; lng: number };
          markerLatLngs.push(L.latLng(c.lat, c.lng));
        }
      });
      if (markerLatLngs.length > 0) {
        hasFittedBoundsRef.current = true;
        map.fitBounds(L.latLngBounds(markerLatLngs), {
          padding: [20, 20] as [number, number],
          maxZoom: 11,
        });
      } else if (showPartyAssociations && associations.length > 0 && !districts.length) {
        hasFittedBoundsRef.current = true;
        map.setView([48.7758, 9.1829], 8);
      }
    }
  }, [districts, selectedDistrict, showPartyAssociations, associations]);

  return (
    <div className="relative w-full h-[400px] md:h-[500px] lg:h-[600px] bg-card rounded-lg overflow-hidden border border-border z-0">
      <div ref={mapEl} className="w-full h-full" />
      
      <div className="absolute top-4 right-4 z-[1000] space-y-2">
        <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg p-3 text-xs text-muted-foreground shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">Baden-Württemberg Wahlkreise</span>
          </div>
          <div className="space-y-1">
            {districts.filter(d => d.district_type !== 'verwaltungsgrenze').length > 0 && (
              <div className="flex items-center gap-1">
                <Square className="h-3 w-3" />
                <span>{districts.filter(d => d.district_type !== 'verwaltungsgrenze').length} Wahlkreise</span>
              </div>
            )}
            {districts.filter(d => d.district_type === 'verwaltungsgrenze').length > 0 && (
              <div className="flex items-center gap-1">
                <Square className="h-3 w-3 text-purple-500" />
                <span>{districts.filter(d => d.district_type === 'verwaltungsgrenze').length} Verwaltungsgrenzen</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>Klicken für Details</span>
            </div>
            {showPartyAssociations && (
              <div className="flex items-center gap-1">
                <span className="text-green-600">🌱</span>
                <span className="text-green-600">
                  {associations.reduce((count, assoc) => 
                    count + (assoc.boundary_districts?.length || 0), 0
                  )} Grüne Verwaltungsgebiete
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleLeafletMap;
