import React, { useEffect, useRef, useState } from 'react';
import { debugConsole } from '@/utils/debugConsole';
import 'leaflet/dist/leaflet.css';
import '@/styles/leaflet-overrides.css';
import * as L from 'leaflet';
import { ElectionDistrict } from '@/hooks/useElectionDistricts';
import { usePartyAssociations } from '@/hooks/usePartyAssociations';
import { MapPin, Users, Square } from 'lucide-react';
import { getPartyColor } from '../partyColors';
import { hasRenderableBoundary } from '../mapModel';
import sunflowerIcon from '@/assets/sunflower.svg';

interface LeafletKarlsruheMapProps {
  districts: ElectionDistrict[];
  onDistrictClick: (district: ElectionDistrict) => void;
  selectedDistrict?: ElectionDistrict;
  showPartyAssociations?: boolean;
  showDistrictPolygons?: boolean;
  showDistrictMarkers?: boolean;
  focusedDistrict?: ElectionDistrict;
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
  
  return getPartyColor(party);
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
  showPartyAssociations = false,
  showDistrictPolygons = true,
  showDistrictMarkers = true,
  focusedDistrict,
}) => {
  const { associations } = usePartyAssociations();
  const [zoomLevel, setZoomLevel] = useState(8);
  const [mapReady, setMapReady] = useState(0);
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
    hasFittedBoundsRef.current = false;
    // Flex layouts and mobile panels may resize the map after initialization.
    const resizeObserver = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    resizeObserver.observe(mapEl.current);
    setMapReady((n) => n + 1);

    return () => {
      resizeObserver.disconnect();
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
      .filter(item => hasRenderableBoundary(item.district.boundaries)
        && (item.isPartyBoundary || item.district.district_type === 'verwaltungsgrenze' || showDistrictPolygons))
      .map(item => ({
        type: 'Feature' as const,
        properties: { 
          district_id: item.district.id,
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
          const districtId = feature?.properties?.district_id;
          const isPartyBoundary = feature?.properties?.isPartyBoundary;
          const allDistricts = allDistrictsToRender.map(item => item.district);
          const district = allDistricts.find(d => d.id === districtId);
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
          const districtId = feature?.properties?.district_id;
          const isPartyBoundary = feature?.properties?.isPartyBoundary;
          const allDistricts = allDistrictsToRender.map(item => item.district);
          const district = allDistricts.find(d => d.id === districtId);
          if (!district) return;
          
          const isSelected = selectedDistrict?.id === district.id;

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
        },
      });

      geoLayer.addTo(districtLayerRef.current);
      renderedBounds = geoLayer.getBounds();
      
    }

    // Add markers with district numbers (only for election districts, not administrative boundaries)
    districts.filter(d => showDistrictMarkers && d.district_type !== 'verwaltungsgrenze').forEach((district) => {
      if (!district.center_coordinates) return;
      const { lat, lng } = district.center_coordinates as { lat: number; lng: number };
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
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
      
      marker.on('click', () => onDistrictClickRef.current(district));
      
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

          marker.on('click', () => onDistrictClickRef.current(
            districts.find(district => district.id === boundaryDistrict.id) ?? boundaryDistrict
          ));
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
        const center = d.center_coordinates as { lat?: number; lng?: number } | null | undefined;
        if (center && typeof center.lat === 'number' && typeof center.lng === 'number') {
          markerLatLngs.push(L.latLng(center.lat, center.lng));
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
  }, [districts, selectedDistrict, showPartyAssociations, associations, mapReady, zoomLevel, showDistrictPolygons, showDistrictMarkers]);

  // Search navigation also works when a layer is hidden or a boundary is missing.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusedDistrict) return;
    map.stop();
    if (hasRenderableBoundary(focusedDistrict.boundaries)) {
      const layer = L.geoJSON({ type: 'Feature', properties: {}, geometry: focusedDistrict.boundaries } as GeoJSON.Feature);
      const bounds = layer.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 11, animate: false });
    } else if (focusedDistrict.center_coordinates) {
      const { lat, lng } = focusedDistrict.center_coordinates;
      if (Number.isFinite(lat) && Number.isFinite(lng)) map.setView([lat, lng], 10, { animate: false });
    }
  }, [focusedDistrict, mapReady]);

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
                <Square className="h-3 w-3 text-palette-purple" />
                <span>{districts.filter(d => d.district_type === 'verwaltungsgrenze').length} Verwaltungsgrenzen</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>Klicken für Details</span>
            </div>
            {showPartyAssociations && (
              <div className="flex items-center gap-1">
                <span className="text-palette-green">🌱</span>
                <span className="text-palette-green">
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
