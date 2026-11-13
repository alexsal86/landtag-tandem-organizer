import React, { useEffect, useRef, useState } from 'react';
import { debugConsole } from '@/utils/debugConsole';
import 'leaflet/dist/leaflet.css';
import '@/styles/leaflet-overrides.css';
import * as L from 'leaflet';
import { ElectionDistrict } from '@/hooks/useElectionDistricts';
import { usePartyAssociations } from '@/hooks/usePartyAssociations';
import { directMandateParty, partyColors, hasRenderableBoundary } from '../mapModel';
import { Plus, Minus, MoveDiagonal } from 'lucide-react';
import sunflowerIcon from '@/assets/sunflower.svg';

interface LeafletKarlsruheMapProps {
  districts: ElectionDistrict[];
  onDistrictClick: (district: ElectionDistrict) => void;
  selectedDistrict?: ElectionDistrict;
  showPartyAssociations?: boolean;
  showDistrictPolygons?: boolean;
  showDistrictMarkers?: boolean;
  focusedDistrict?: ElectionDistrict;
  showBaseMap?: boolean;
  selectedParties?: Set<string>;
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
  
  return partyColors[directMandateParty(district)] || '#9ca3af';
};

const getDistrictMarkerDimensions = (zoomLevel: number) => {
  const clampedZoom = Math.max(6, Math.min(13, zoomLevel));
  const size = Math.round(18 + (clampedZoom - 6) * 2);
  const fontSize = Math.max(9, Math.round(size * 0.4));
  const borderWidth = Math.max(2.5, Math.round(size * 0.1));

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
  showBaseMap = false,
  selectedParties,
}) => {
  const { associations } = usePartyAssociations();
  const [zoomLevel, setZoomLevel] = useState(8);
  const [mapReady, setMapReady] = useState(0);
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const districtLayerRef = useRef<L.LayerGroup | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const onDistrictClickRef = useRef(onDistrictClick);
  const hasFittedBoundsRef = useRef(false);
  const overviewBoundsRef = useRef<L.LatLngBounds | null>(null);
  const userNavigatedRef = useRef(false);

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
      zoomControl: false,
      keyboard: true,
      dragging: true,
      scrollWheelZoom: true,
      zoomSnap: 0.1,
      attributionControl: true,
      preferCanvas: false, // Use SVG for better precision
    });
    mapRef.current = map;
    map.on('dragstart zoomstart', (event: L.LeafletEvent) => {
      if ('originalEvent' in event) userNavigatedRef.current = true;
    });
    setZoomLevel(map.getZoom());

    tileLayerRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      crossOrigin: 'anonymous',
    });

    // Create separate layer groups for polygons and markers
    districtLayerRef.current = L.layerGroup().addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);
    hasFittedBoundsRef.current = false;
    // Flex layouts and mobile panels may resize the map after initialization.
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize({ pan: false });
      if (!userNavigatedRef.current && overviewBoundsRef.current) map.fitBounds(overviewBoundsRef.current, { padding: [32, 32], animate: false });
    });
    resizeObserver.observe(mapEl.current);
    setMapReady((n) => n + 1);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
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
      .filter(item => hasRenderableBoundary(item.district.boundaries))
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
            className: 'bw-district-path',
            color: isSelected ? '#2563eb' : (isPartyBoundary ? '#15803d' : (isAdministrative ? '#6B46C1' : '#ffffff')),
            weight: isSelected ? 4 : (isPartyBoundary ? 3 : 1.5),
            opacity: 1,
            fillColor: partyColor,
            fillOpacity: isSelected ? 0.85 : (isPartyBoundary ? 0.4 : (isAdministrative ? 0.3 : 0.6)),
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
          const directMandate = district.representatives?.find(rep => rep.mandate_type === 'direct');

          layer.on('mouseover', () => {
            (layer as L.Path).setStyle({ 
              weight: 4
            });
          });
          layer.on('mouseout', () => {
            (layer as L.Path).setStyle({ 
              weight: isSelected ? 4 : (isPartyBoundary ? 3 : 1.5)
            });
          });
          const tooltip = document.createElement('span');
          tooltip.textContent = `${district.district_number}: ${district.district_name}${directMandate ? ` · ${directMandate.party}` : ''}`;
          layer.bindTooltip(tooltip, { sticky: true });
          layer.on('add', () => {
            const element = (layer as L.Path).getElement();
            if (!element) return;
            element.setAttribute('tabindex', '0');
            element.setAttribute('role', 'button');
            element.setAttribute('aria-label', tooltip.textContent || 'Wahlkreis');
            element.setAttribute('aria-pressed', String(isSelected));
            element.addEventListener('keydown', event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                onDistrictClickRef.current(district);
              }
            });
          });
          layer.on('click', () => onDistrictClickRef.current(district));
        },
      });

      geoLayer.addTo(districtLayerRef.current);
      renderedBounds = geoLayer.getBounds();
      geoLayer.eachLayer(layer => {
        if ((layer as L.GeoJSON).feature?.properties?.district_id === selectedDistrict?.id) (layer as L.Path).bringToFront();
      });
      
    }

    // Add markers with district numbers (only for election districts, not administrative boundaries)
    const occupied: L.Point[] = [];
    [...districts].sort((a, b) => Number(b.id === selectedDistrict?.id) - Number(a.id === selectedDistrict?.id)).filter(d => showDistrictMarkers && d.district_type !== 'verwaltungsgrenze').forEach((district) => {
      if (!district.center_coordinates) return;
      const { lat, lng } = district.center_coordinates as { lat: number; lng: number };
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const partyColor = getPartyColorHex(district);
      const directMandate = district.representatives?.find(rep => rep.mandate_type === 'direct');
      const { size, fontSize, borderWidth } = getDistrictMarkerDimensions(zoomLevel);
      const point = map.project([lat, lng], zoomLevel);
      if (occupied.some(other => other.distanceTo(point) < size + 3)) return;
      occupied.push(point);
      
      const marker = L.marker([lat, lng], {
        alt: `WK:${district.id}`,
        icon: L.divIcon({
          html: `<div style="background: white; border: ${borderWidth}px solid ${partyColor}; border-radius: 50%; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: ${fontSize}px; color: black; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">${district.district_number}</div>`,
          className: 'custom-district-marker',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2]
        })
      });
      
      const label = document.createElement('span');
      label.textContent = `${district.district_number}: ${district.district_name}`;
      marker.bindTooltip(label);
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
      overviewBoundsRef.current = renderedBounds;
      map.invalidateSize({ pan: false });
      const paddingValue = 32;
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
  }, [districts, selectedDistrict, showPartyAssociations, associations, mapReady, zoomLevel, showDistrictMarkers]);

  useEffect(() => {
    const map = mapRef.current;
    const tiles = tileLayerRef.current;
    if (!map || !tiles) return;
    if (showBaseMap) tiles.addTo(map); else tiles.remove();
  }, [showBaseMap, mapReady]);

  // Keep the paths mounted so party and fill changes animate smoothly.
  useEffect(() => {
    districtLayerRef.current?.eachLayer(group => {
      if (!(group instanceof L.GeoJSON)) return;
      group.eachLayer(layer => {
        const feature = (layer as L.GeoJSON).feature as GeoJSON.Feature | undefined;
        const district = districts.find(d => d.id === feature?.properties?.district_id);
        if (!district || district.district_type === 'verwaltungsgrenze' || feature?.properties?.isPartyBoundary) return;
        const active = !selectedParties || selectedParties.has(directMandateParty(district));
        const selected = selectedDistrict?.id === district.id;
        (layer as L.Path).setStyle({
          color: selected ? '#2563eb' : showDistrictPolygons && active ? '#ffffff' : '#7b8475',
          fillOpacity: showDistrictPolygons && active ? (selected ? 0.85 : 0.6) : 0,
          weight: selected ? 4 : 1.5,
        });
      });
    });
    markerLayerRef.current?.eachLayer(layer => {
      if (!(layer instanceof L.Marker) || !layer.options.alt?.startsWith('WK:')) return;
      const district = districts.find(d => `WK:${d.id}` === layer.options.alt);
      const active = district && (!selectedParties || selectedParties.has(directMandateParty(district)));
      layer.setOpacity(active ? 1 : 0.2);
    });
  }, [selectedParties, showDistrictPolygons, districts, selectedDistrict, showPartyAssociations, associations, mapReady, zoomLevel, showDistrictMarkers]);

  // Search navigation also works when a layer is hidden or a boundary is missing.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusedDistrict) return;
    userNavigatedRef.current = true;
    map.stop();
    if (hasRenderableBoundary(focusedDistrict.boundaries)) {
      const layer = L.geoJSON({ type: 'Feature', properties: {}, geometry: focusedDistrict.boundaries } as GeoJSON.Feature);
      const bounds = layer.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [32, 32], maxZoom: 11, animate: true, duration: 0.6 });
    } else if (focusedDistrict.center_coordinates) {
      const { lat, lng } = focusedDistrict.center_coordinates;
      if (Number.isFinite(lat) && Number.isFinite(lng)) map.setView([lat, lng], 10, { animate: true });
    }
  }, [focusedDistrict, mapReady]);

  return (
    <div className="bw-election-map relative w-full h-[400px] md:h-full md:min-h-[600px] bg-[#e6eadf] rounded-lg overflow-hidden border border-border z-0">
      <div ref={mapEl} className="w-full h-full" />
      
      <div className="absolute top-3 left-3 z-[1000] flex flex-col gap-2">
        <button type="button" aria-label="Vergrößern" title="Vergrößern" className="bw-map-control" onClick={() => { userNavigatedRef.current = true; mapRef.current?.zoomIn(); }}><Plus className="h-4 w-4" /></button>
        <button type="button" aria-label="Verkleinern" title="Verkleinern" className="bw-map-control" onClick={() => { userNavigatedRef.current = true; mapRef.current?.zoomOut(); }}><Minus className="h-4 w-4" /></button>
        <button type="button" aria-label="Ganz Baden-Württemberg anzeigen" title="Gesamtansicht" className="bw-map-control mt-1" onClick={() => {
          userNavigatedRef.current = false;
          mapRef.current?.fitBounds(overviewBoundsRef.current || L.latLngBounds([[47.48, 7.5], [49.8, 10.52]]), { padding: [32, 32], animate: true });
        }}><MoveDiagonal className="h-4 w-4" /></button>
      </div>
      <div className="pointer-events-none absolute top-3 right-3 z-[1000] rounded-full border border-border bg-card/95 px-3 py-1.5 text-xs shadow-[0_2px_3px_rgba(20,30,10,0.08),0_5px_12px_rgba(20,30,10,0.14)]" role="status">
        {districts.filter(d => d.district_type !== 'verwaltungsgrenze').length} Wahlkreise
      </div>
    </div>
  );
};

export default SimpleLeafletMap;
