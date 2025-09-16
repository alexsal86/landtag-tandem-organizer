import React, { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import * as L from 'leaflet';
import { ElectionDistrict } from '@/hooks/useElectionDistricts';
import { PartyAssociation, usePartyAssociations } from '@/hooks/usePartyAssociations';
import { MapPin, Users, Square } from 'lucide-react';

interface LeafletKarlsruheMapProps {
  districts: ElectionDistrict[];
  onDistrictClick: (district: ElectionDistrict) => void;
  selectedDistrict?: ElectionDistrict;
  showPartyAssociations?: boolean;
}

// Helper function to get party color for election districts and admin boundaries
const getPartyColorHex = (district?: ElectionDistrict): string => {
  if (!district) return '#6b7280';
  
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

const SimpleLeafletMap: React.FC<LeafletKarlsruheMapProps> = ({ 
  districts, 
  onDistrictClick, 
  selectedDistrict,
  showPartyAssociations = false
}) => {
  const { associations } = usePartyAssociations();
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const districtLayerRef = useRef<L.LayerGroup | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);

  // Initialize map once
  useEffect(() => {
    if (!mapEl.current) return;
    if (mapRef.current) return; // init once

    console.log('Initializing map...');

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
  }, []);

  // Render districts and markers whenever data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !districtLayerRef.current || !markerLayerRef.current) return;
    if (!districts.length) return;

    // Clear existing layers
    districtLayerRef.current.clearLayers();
    markerLayerRef.current.clearLayers();

    let renderedBounds: L.LatLngBounds | null = null;

    // Render districts using boundaries from database
    const geoJsonFeatures = districts
      .filter(district => district.boundaries)
      .map(district => ({
        type: 'Feature' as const,
        properties: { 
          district_number: district.district_number,
          district_name: district.district_name
        },
        geometry: district.boundaries
      }));

    if (geoJsonFeatures.length > 0) {
      const geoLayer = L.geoJSON(geoJsonFeatures as any, {
        style: (feature) => {
          const districtNumber = feature?.properties?.district_number;
          const district = districts.find(d => d.district_number === districtNumber);
          const isSelected = district && selectedDistrict?.id === district.id;
          const isAdministrative = district?.district_type === 'verwaltungsgrenze';
          const partyColor = getPartyColorHex(district);
          
          return {
            color: isSelected ? '#ffffff' : (isAdministrative ? '#6B46C1' : partyColor),
            weight: isSelected ? 4 : (isAdministrative ? 2 : 2),
            opacity: 1,
            fillColor: partyColor,
            fillOpacity: isSelected ? 0.7 : (isAdministrative ? 0.3 : 0.25),
            dashArray: isAdministrative ? '5, 5' : '',
            smoothFactor: 0, // No simplification for maximum precision
          } as L.PathOptions;
        },
        onEachFeature: (feature, layer) => {
          const districtNumber = feature?.properties?.district_number;
          const district = districts.find(d => d.district_number === districtNumber);
          if (!district) return;
          
          const isSelected = selectedDistrict?.id === district.id;
          const partyColor = getPartyColorHex(district);
          const directMandate = district.representatives?.find(rep => rep.mandate_type === 'direct');

          const isAdministrative = district.district_type === 'verwaltungsgrenze';
          
          layer.on('mouseover', () => {
            (layer as L.Path).setStyle({ 
              weight: 3, 
              fillOpacity: isAdministrative ? 0.5 : 0.5 
            });
          });
          layer.on('mouseout', () => {
            (layer as L.Path).setStyle({ 
              weight: isSelected ? 4 : (isAdministrative ? 2 : 2), 
              fillOpacity: isSelected ? 0.7 : (isAdministrative ? 0.3 : 0.25) 
            });
          });
          layer.on('click', () => onDistrictClick(district));

          let popupContent = `
            <div class="p-2 min-w-[200px]">
              <div class="flex items-center gap-2 mb-2">
                <span class="px-2 py-1 rounded text-white text-xs font-medium" style="background-color: ${partyColor}">${district.district_number}</span>
                <h3 class="font-semibold">${district.district_name || (isAdministrative ? `Kreis ${district.district_number}` : `Wahlkreis ${district.district_number}`)}</h3>
              </div>
              <div class="space-y-1 text-sm text-gray-600">
          `;

          if (isAdministrative) {
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
      console.log(`Rendered ${districts.length} districts from database`);
    }

    // Add markers with district numbers (only for election districts, not administrative boundaries)
    districts.filter(d => d.district_type !== 'verwaltungsgrenze').forEach((district) => {
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

    // Add markers for party associations if enabled
    if (showPartyAssociations && associations.length > 0) {
      associations.forEach(association => {
        // Try to find matching administrative boundary for positioning
        const matchingDistrict = districts.find(district => {
          if (district.district_type !== 'kreis') return false;
          
          const associationName = association.name.toLowerCase();
          const districtName = district.district_name.toLowerCase();
          
          // Simple name matching
          return districtName.includes(associationName) || 
                 associationName.includes(districtName) ||
                 associationName.replace(/[\/\-\s]+/g, '').includes(districtName.replace(/[\/\-\s]+/g, ''));
        });

        if (matchingDistrict && matchingDistrict.center_coordinates) {
          try {
            const coords = matchingDistrict.center_coordinates as { lat: number; lng: number };
            if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
              const marker = L.marker([coords.lat, coords.lng], {
                icon: L.divIcon({
                  html: `<div style="background: #16a34a; border: 2px solid #15803d; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 10px; color: white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">🌱</div>`,
                  className: 'green-party-marker',
                  iconSize: [24, 24],
                  iconAnchor: [12, 12]
                })
              });

              const popupContent = `
                <div style="min-width: 220px;">
                  <strong style="color: #1aa037; font-size: 16px;">🌱 ${association.name}</strong><br>
                  <small style="color: #1aa037; font-weight: bold;">GRÜNE Kreisverband</small><br>
                  ${association.full_address ? `
                    <div style="margin: 6px 0;">
                      <strong>📍 Adresse:</strong><br>
                      <span style="color: #666;">${association.full_address}</span>
                    </div>
                  ` : ''}
                  ${association.phone ? `
                    <div style="margin: 4px 0;">
                      <strong>📞 Telefon:</strong> <a href="tel:${association.phone}" style="color: #1aa037;">${association.phone}</a>
                    </div>
                  ` : ''}
                  ${association.email ? `
                    <div style="margin: 4px 0;">
                      <strong>📧 E-Mail:</strong> <a href="mailto:${association.email}" style="color: #1aa037;">${association.email}</a>
                    </div>
                  ` : ''}
                  ${association.website ? `
                    <div style="margin: 4px 0;">
                      <strong>🌐 Website:</strong> <a href="${association.website}" target="_blank" style="color: #1aa037;">Website besuchen</a>
                    </div>
                  ` : ''}
                  ${association.coverage_areas && Array.isArray(JSON.parse(association.coverage_areas || '[]')) && JSON.parse(association.coverage_areas).length > 0 ? `
                    <div style="margin: 6px 0;">
                      <strong>🗺️ Zuständigkeitsgebiet:</strong><br>
                      <small style="color: #666;">${JSON.parse(association.coverage_areas).join(', ')}</small>
                    </div>
                  ` : ''}
                </div>
              `;

              marker.bindPopup(popupContent);
              marker.addTo(markerLayerRef.current!);
            }
          } catch (error) {
            console.error('Error adding party association marker:', association.name, error);
          }
        }
      });
    }

    // Fit bounds without maxZoom constraint for best fit
    if (renderedBounds && renderedBounds.isValid()) {
      const paddingValue = window.innerWidth < 768 ? 10 : 20;
      map.fitBounds(renderedBounds, {
        padding: [paddingValue, paddingValue] as [number, number],
        maxZoom: 12,
      });
    }
  }, [districts, selectedDistrict, onDistrictClick, showPartyAssociations, associations]);
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