import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { KarlsruheDistrict } from '@/hooks/useKarlsruheDistricts';
import { MapFlag } from '@/hooks/useMapFlags';
import { MapFlagType } from '@/hooks/useMapFlagTypes';
import { useMapFlagStakeholders } from '@/hooks/useMapFlagStakeholders';

interface KarlsruheDistrictsMapProps {
  districts: KarlsruheDistrict[];
  onDistrictClick?: (district: KarlsruheDistrict) => void;
  selectedDistrict?: KarlsruheDistrict | null;
  flags?: MapFlag[];
  flagTypes?: MapFlagType[];
  visibleFlagTypes?: Set<string>;
  flagMode?: boolean;
  onFlagClick?: (coordinates: { lat: number; lng: number }) => void;
  onFlagEdit?: (flag: MapFlag) => void;
  onFlagDelete?: (flagId: string) => void;
}

export const KarlsruheDistrictsMap = ({
  districts,
  onDistrictClick,
  selectedDistrict,
  flags = [],
  flagTypes = [],
  visibleFlagTypes = new Set(),
  flagMode = false,
  onFlagClick,
  onFlagEdit,
  onFlagDelete,
}: KarlsruheDistrictsMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersRef = useRef<Map<string, L.GeoJSON>>(new Map());
  const flagLayersRef = useRef<Map<string, L.LayerGroup>>(new Map());
  const flagMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const stakeholderMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const [mapReady, setMapReady] = useState(false);
  const [showStakeholders, setShowStakeholders] = useState(true);

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

    // Click handler for flag mode
    map.on('click', (e) => {
      if (flagMode && onFlagClick) {
        onFlagClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    });

    mapInstanceRef.current = map;
    setMapReady(true);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [flagMode, onFlagClick]);

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
                  padding: 4px 8px;
                  font-size: 13px;
                  font-weight: 700;
                  text-shadow: 
                    -1px -1px 0 white,  
                    1px -1px 0 white,
                    -1px 1px 0 white,
                    1px 1px 0 white,
                    2px 2px 4px rgba(0,0,0,0.3);
                  white-space: nowrap;
                  pointer-events: none;
                  text-align: center;
                ">${district.name}</div>`,
                iconSize: [100, 30],
                iconAnchor: [50, 15],
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

  // Render flags and stakeholders
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Clear existing markers
    flagMarkersRef.current.forEach(marker => marker.remove());
    flagMarkersRef.current.clear();
    stakeholderMarkersRef.current.forEach(marker => marker.remove());
    stakeholderMarkersRef.current.clear();

    // Create layer groups for each flag type
    flagTypes.forEach(type => {
      if (!flagLayersRef.current.has(type.id)) {
        const layerGroup = L.layerGroup();
        flagLayersRef.current.set(type.id, layerGroup);
      }
    });

    // Add flag markers
    flags.forEach(flag => {
      const flagType = flagTypes.find(t => t.id === flag.flag_type_id);
      if (!flagType) return;

      const layerGroup = flagLayersRef.current.get(flagType.id);
      if (!layerGroup) return;

      const marker = L.marker([flag.coordinates.lat, flag.coordinates.lng], {
        icon: L.divIcon({
          html: `<div style="
            background: ${flagType.color};
            border-radius: 50%;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            border: 2px solid white;
            cursor: pointer;
          ">${flagType.icon}</div>`,
          iconSize: [32, 32],
          className: 'map-flag-marker',
        }),
      });

      marker.bindPopup(`
        <div style="font-family: sans-serif; min-width: 200px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="font-size: 20px;">${flagType.icon}</span>
            <h3 style="margin: 0; font-size: 16px; font-weight: 600;">${flag.title}</h3>
          </div>
          ${flag.description ? `<p style="margin: 8px 0; color: #666;">${flag.description}</p>` : ''}
          <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #ddd; display: flex; gap: 8px;">
            <button 
              onclick="window.dispatchEvent(new CustomEvent('editFlag', { detail: '${flag.id}' }))"
              style="flex: 1; padding: 4px 8px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;"
            >
              Bearbeiten
            </button>
            <button 
              onclick="window.dispatchEvent(new CustomEvent('deleteFlag', { detail: '${flag.id}' }))"
              style="flex: 1; padding: 4px 8px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;"
            >
              Löschen
            </button>
          </div>
        </div>
      `);

      marker.addTo(layerGroup);
      flagMarkersRef.current.set(flag.id, marker);

      // Add stakeholder markers for this flag
      if (showStakeholders && flag.tags && flag.tags.length > 0) {
        // Fetch stakeholders with matching tags
        const fetchStakeholders = async () => {
          const { data } = await import('@/integrations/supabase/client').then(m => m.supabase
            .from('contacts')
            .select('id, name, organization, email, phone, tags, business_description, website')
            .eq('contact_type', 'organization')
            .not('tags', 'is', null)
          );

          if (!data) return;

          // Filter stakeholders with matching tags
          const matchingStakeholders = data.filter(contact => 
            contact.tags && contact.tags.some((tag: string) => flag.tags.includes(tag))
          );

          // Add stakeholder markers near the flag
          matchingStakeholders.forEach((stakeholder, index) => {
            // Offset markers slightly so they don't overlap
            const offset = 0.0015;
            const angle = (index * (360 / matchingStakeholders.length)) * (Math.PI / 180);
            const lat = flag.coordinates.lat + (Math.cos(angle) * offset);
            const lng = flag.coordinates.lng + (Math.sin(angle) * offset);

            const stakeholderMarker = L.marker([lat, lng], {
              icon: L.divIcon({
                html: `<div style="
                  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                  border-radius: 50%;
                  width: 28px;
                  height: 28px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 14px;
                  box-shadow: 0 2px 6px rgba(0,0,0,0.25);
                  border: 2px solid white;
                  cursor: pointer;
                ">🏢</div>`,
                iconSize: [28, 28],
                className: 'stakeholder-marker',
              }),
            });

            const matchingTags = stakeholder.tags.filter((t: string) => flag.tags.includes(t));
            
            stakeholderMarker.bindPopup(`
              <div style="font-family: sans-serif; min-width: 220px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                  <span style="font-size: 18px;">🏢</span>
                  <h3 style="margin: 0; font-size: 15px; font-weight: 600;">${stakeholder.name}</h3>
                </div>
                ${stakeholder.organization ? `<p style="margin: 4px 0; color: #666; font-size: 13px;">${stakeholder.organization}</p>` : ''}
                ${stakeholder.business_description ? `<p style="margin: 8px 0; color: #666; font-size: 12px; line-height: 1.4;">${stakeholder.business_description.substring(0, 120)}${stakeholder.business_description.length > 120 ? '...' : ''}</p>` : ''}
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #ddd;">
                  ${stakeholder.email ? `<p style="margin: 2px 0; font-size: 12px;">📧 ${stakeholder.email}</p>` : ''}
                  ${stakeholder.phone ? `<p style="margin: 2px 0; font-size: 12px;">📞 ${stakeholder.phone}</p>` : ''}
                  ${stakeholder.website ? `<p style="margin: 2px 0; font-size: 12px;">🌐 <a href="${stakeholder.website}" target="_blank" style="color: #3b82f6;">${stakeholder.website}</a></p>` : ''}
                </div>
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #ddd;">
                  <p style="margin: 0; font-size: 11px; color: #888;">Verknüpft über Tags: ${matchingTags.join(', ')}</p>
                </div>
              </div>
            `);

            stakeholderMarker.addTo(map);
            stakeholderMarkersRef.current.set(`${flag.id}-${stakeholder.id}`, stakeholderMarker);
          });
        };

        fetchStakeholders();
      }
    });

    // Toggle layer visibility
    flagLayersRef.current.forEach((layerGroup, typeId) => {
      if (visibleFlagTypes.has(typeId)) {
        layerGroup.addTo(map);
      } else {
        layerGroup.remove();
      }
    });

    // Event listeners for edit/delete from popup
    const handleEditFlag = (e: any) => {
      const flagId = e.detail;
      const flag = flags.find(f => f.id === flagId);
      if (flag && onFlagEdit) onFlagEdit(flag);
    };

    const handleDeleteFlag = (e: any) => {
      const flagId = e.detail;
      if (onFlagDelete) onFlagDelete(flagId);
    };

    window.addEventListener('editFlag', handleEditFlag);
    window.addEventListener('deleteFlag', handleDeleteFlag);

    return () => {
      window.removeEventListener('editFlag', handleEditFlag);
      window.removeEventListener('deleteFlag', handleDeleteFlag);
    };
  }, [mapReady, flags, flagTypes, visibleFlagTypes, onFlagEdit, onFlagDelete, showStakeholders]);

  return (
    <div
      ref={mapRef}
      className={`w-full h-[600px] rounded-lg border border-border z-0 ${flagMode ? 'cursor-crosshair' : ''}`}
    />
  );
};
