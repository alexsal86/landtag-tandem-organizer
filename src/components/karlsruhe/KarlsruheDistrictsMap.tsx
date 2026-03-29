import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@/styles/leaflet-overrides.css';
import { KarlsruheDistrict } from '@/hooks/useKarlsruheDistricts';
import { MapFlag } from '@/hooks/useMapFlags';
import { MapFlagType } from '@/hooks/useMapFlagTypes';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { lucideIconToSvg, isLucideIcon } from '@/utils/lucideIconToSvg';
import { debugConsole } from '@/utils/debugConsole';
import { Feature, LayerConfig, hasProperties, isFeatureCollection } from '@/types/geoDomain';
import 'leaflet.heat';
import 'leaflet-routing-machine';

const LRouting = L.Routing;

/**
 * Helper function to get icon display for Leaflet markers
 * Handles both Lucide icons (as SVG) and emojis
 * @param iconName - Icon identifier (Lucide icon name or emoji)
 * @param color - Color for the icon (used for Lucide icons)
 * @param size - Size of the icon in pixels
 * @returns HTML string for icon display
 */
const getIconDisplay = (iconName: string, color: string = '#ffffff', size: number = 18): string => {
  // Check if it's a Lucide icon
  if (isLucideIcon(iconName)) {
    const svgString = lucideIconToSvg(iconName, color, size);
    if (svgString) {
      return svgString;
    }
  }
  
  // Fallback: treat as emoji
  return `<span style="font-size: ${size}px; line-height: 1;">${iconName}</span>`;
};



interface StakeholderContact {
  id: string;
  name: string | null;
  organization: string | null;
  email: string | null;
  phone: string | null;
  tags: string[] | null;
  website: string | null;
  coordinates: { lat: number; lng: number } | null;
  business_street: string | null;
  business_city: string | null;
  business_postal_code: string | null;
}

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
  showStakeholders?: boolean;
  showDistrictBoundaries?: boolean;
  isColorMap?: boolean;
  // Routing props
  waypoints?: { id: string; lat: number; lng: number; name?: string }[];
  showRouting?: boolean;
  onRouteFound?: (info: { distance: number; duration: number }) => void;
  // Heatmap props
  showHeatmap?: boolean;
  heatmapPoints?: [number, number, number][];
  showElectionPrecincts?: boolean;
  electionPrecinctGeoJsonUrl?: string;
  onMapReady?: (map: L.Map | null) => void;
}

interface DistrictGeoProperties {
  GEN?: string;
  [key: string]: unknown;
}

interface DistrictLayerConfig extends LayerConfig<Feature<DistrictGeoProperties>> {
  district: KarlsruheDistrict;
}

interface ElectionPrecinctGeoProperties {
  [key: string]: unknown;
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
  showStakeholders = true,
  showDistrictBoundaries = true,
  isColorMap = false,
  waypoints = [],
  showRouting = false,
  onRouteFound,
  showHeatmap = false,
  heatmapPoints = [],
  showElectionPrecincts = false,
  electionPrecinctGeoJsonUrl = 'https://transparenz.karlsruhe.de/dataset/61eaf3b7-5e8c-4742-be4b-4068cd9e901c/resource/77edb714-6b50-4fc3-98f3-5559bcdff20f/download/wahlbezirke.geojson',
  onMapReady,
}: KarlsruheDistrictsMapProps) => {
  const { currentTenant } = useTenant();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersRef = useRef<Map<string, L.GeoJSON>>(new Map());
  const flagLayersRef = useRef<Map<string, L.LayerGroup>>(new Map());
  const flagMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const stakeholderMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const electionPrecinctLayerRef = useRef<L.GeoJSON | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [electionPrecinctFeatures, setElectionPrecinctFeatures] = useState<Feature<ElectionPrecinctGeoProperties>[] | null>(null);
  const districtLayerConfigs = useMemo<DistrictLayerConfig[]>(() => {
    if (!showDistrictBoundaries) return [];

    return districts
      .map((district) => {
        const b = district.boundaries as any;
        if (!b) return null;

        let features: Feature<DistrictGeoProperties>[];

        if (isFeatureCollection<DistrictGeoProperties>(b)) {
          // Already a FeatureCollection — use as-is
          features = b.features.filter((f): f is Feature<DistrictGeoProperties> =>
            hasProperties<DistrictGeoProperties>(f),
          );
        } else if (b.type === 'Polygon' || b.type === 'MultiPolygon') {
          // Raw geometry — wrap into a Feature
          features = [{
            type: 'Feature' as const,
            properties: { name: district.name, color: district.color } as DistrictGeoProperties,
            geometry: { type: b.type, coordinates: b.coordinates },
          }];
        } else {
          return null;
        }

        if (features.length === 0) return null;

        return {
          id: district.id,
          label: district.name,
          visible: true,
          district,
          features,
        };
      })
      .filter((layer): layer is DistrictLayerConfig => layer !== null);
  }, [districts, showDistrictBoundaries]);

  const visibleStakeholderTypes = useMemo(
    () => flagTypes.filter((type) => visibleFlagTypes.has(type.id) && type.tag_filter),
    [flagTypes, visibleFlagTypes],
  );

  const getElectionPrecinctName = useCallback((properties?: ElectionPrecinctGeoProperties): string => {
    if (!properties) return 'Wahlbezirk';

    const labelKeys = ['name', 'Name', 'wahlbezirk', 'Wahlbezirk', 'bezirk', 'Bezirk', 'id', 'ID'];
    for (const key of labelKeys) {
      const value = properties[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
      if (typeof value === 'number') {
        return value.toString();
      }
    }

    return 'Wahlbezirk';
  }, []);

  // Extract stakeholder loading logic into a reusable function
  const loadStakeholders = useCallback(async () => {
    if (!mapInstanceRef.current || !showStakeholders || !currentTenant?.id) return;

    const map = mapInstanceRef.current;

    // Clear existing stakeholder markers
    stakeholderMarkersRef.current.forEach(marker => marker.remove());
    stakeholderMarkersRef.current.clear();

    if (visibleStakeholderTypes.length === 0) return;

    const activeTagFilters = Array.from(
      new Set(
        visibleStakeholderTypes
          .map((flagType) => flagType.tag_filter?.trim().toLowerCase())
          .filter((tag): tag is string => Boolean(tag)),
      ),
    );

    if (activeTagFilters.length === 0) return;

    const { data: allData, error } = await supabase
      .from('contacts')
      .select('id, name, organization, email, phone, tags, website, coordinates, business_street, business_city, business_postal_code')
      .eq('tenant_id', currentTenant.id)
      .eq('contact_type', 'organization')
      .not('coordinates', 'is', null)
      .not('tags', 'is', null);

    if (error) {
      debugConsole.error('Error loading stakeholder contacts:', error);
      return;
    }

    const stakeholders = (allData ?? []) as StakeholderContact[];

    for (const flagType of visibleStakeholderTypes) {
      const normalizedTag = flagType.tag_filter?.trim().toLowerCase();
      if (!normalizedTag) continue;

      const data = stakeholders.filter((contact) =>
        contact.tags?.some((tag) => tag.trim().toLowerCase() === normalizedTag),
      );

      if (data.length === 0) continue;

      // Add stakeholder markers
      data.forEach((stakeholder) => {
        if (!stakeholder.coordinates) return;
        const lat = stakeholder.coordinates.lat;
        const lng = stakeholder.coordinates.lng;

        const stakeholderMarker = L.marker([lat, lng], {
          icon: L.divIcon({
            html: `<div style="
              background: linear-gradient(135deg, ${flagType.color} 0%, ${flagType.color}dd 100%);
              border-radius: 50%;
              width: 28px;
              height: 28px;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 2px 6px rgba(0,0,0,0.25);
              border: 2px solid white;
              cursor: pointer;
            ">${getIconDisplay(flagType.icon, '#ffffff', 16)}</div>`,
            iconSize: [28, 28],
            className: 'stakeholder-marker',
          }),
        });

        // Build address display
        const addressParts = [
          stakeholder.business_street,
          stakeholder.business_postal_code,
          stakeholder.business_city
        ].filter(Boolean);
        const addressDisplay = addressParts.length > 0 ? addressParts.join(', ') : null;

        stakeholderMarker.bindPopup(`
          <div style="font-family: sans-serif; min-width: 220px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <span style="font-size: 18px;">🏢</span>
              <h3 style="margin: 0; font-size: 15px; font-weight: 600;">${stakeholder.name}</h3>
            </div>
            ${stakeholder.organization ? `<p style="margin: 4px 0; color: #666; font-size: 13px;">${stakeholder.organization}</p>` : ''}
            ${addressDisplay ? `<p style="margin: 4px 0; color: #666; font-size: 12px;">📮 ${addressDisplay}</p>` : ''}
            <p style="margin: 2px 0; font-size: 11px; color: #10b981;">📍 Geocodierte Adresse</p>
            
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #ddd;">
              ${stakeholder.email ? `<p style="margin: 2px 0; font-size: 12px;">📧 ${stakeholder.email}</p>` : ''}
              ${stakeholder.phone ? `<p style="margin: 2px 0; font-size: 12px;">📞 ${stakeholder.phone}</p>` : ''}
              ${stakeholder.website ? `<p style="margin: 2px 0; font-size: 12px;">🌐 <a href="${stakeholder.website}" target="_blank" style="color: #3b82f6;">${stakeholder.website}</a></p>` : ''}
            </div>
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #ddd;">
              <p style="margin: 0; font-size: 11px; color: #888;">Verknüpft über Tag: ${flagType.tag_filter}</p>
              <a href="/contacts/${stakeholder.id}" target="_blank" style="display: inline-block; margin-top: 8px; padding: 4px 12px; background: #3b82f6; color: white; text-decoration: none; border-radius: 4px; font-size: 12px;">Details anzeigen</a>
            </div>
          </div>
        `);

        stakeholderMarker.addTo(map);
        stakeholderMarkersRef.current.set(`${flagType.id}-${stakeholder.id}`, stakeholderMarker);
      });
    }
  }, [showStakeholders, visibleStakeholderTypes, currentTenant?.id]);

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

    tileLayerRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
      crossOrigin: 'anonymous',
      className: isColorMap ? '' : 'grayscale-map',
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
      tileLayerRef.current = null;
    };
  }, [flagMode, onFlagClick]);

  // Update tile layer when color mode changes
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !tileLayerRef.current) return;

    const map = mapInstanceRef.current;
    
    // Remove old tile layer
    tileLayerRef.current.remove();
    
    // Add new tile layer with updated className
    tileLayerRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
      crossOrigin: 'anonymous',
      className: isColorMap ? '' : 'grayscale-map',
    }).addTo(map);
  }, [isColorMap, mapReady]);

  // Render districts
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || districts.length === 0) return;

    const map = mapInstanceRef.current;

    // Clear existing layers
    layersRef.current.forEach(layer => layer.remove());
    layersRef.current.clear();

    // Add district layers
    districtLayerConfigs.forEach(({ district, features }) => {

      // Special styling for city boundary
      const isCityBoundary = district.is_city_boundary || district.name.includes('Stadtgrenze');
      
      const layer = L.geoJSON({ type: 'FeatureCollection', features } as GeoJSON.GeoJsonObject, {
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
            (layer as L.Layer & { label?: L.Marker }).label = label;
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
      districtLayerConfigs
        .filter((layer) => layer.district.center_coordinates)
        .map((layer) => [layer.district.center_coordinates.lat, layer.district.center_coordinates.lng])
    );
    
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [mapReady, districtLayerConfigs, selectedDistrict, onDistrictClick]);

  // Update selected district style
  useEffect(() => {
    if (!mapReady) return;

    layersRef.current.forEach((layer, id) => {
      layer.setStyle({
        fillOpacity: selectedDistrict?.id === id ? 0.6 : 0.35,
      });
    });
  }, [selectedDistrict, mapReady]);

  // Load election precinct GeoJSON on demand
  useEffect(() => {
    if (!showElectionPrecincts || electionPrecinctFeatures) return;

    const loadElectionPrecincts = async () => {
      try {
        const response = await fetch(electionPrecinctGeoJsonUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const geojson = await response.json() as unknown;
        if (isFeatureCollection<ElectionPrecinctGeoProperties>(geojson)) {
          const features = geojson.features.filter((feature): feature is Feature<ElectionPrecinctGeoProperties> =>
            hasProperties<ElectionPrecinctGeoProperties>(feature),
          );
          setElectionPrecinctFeatures(features);
        }
      } catch (error) {
        debugConsole.error('Konnte Wahlbezirke-GeoJSON nicht laden:', error);
      }
    };

    void loadElectionPrecincts();
  }, [showElectionPrecincts, electionPrecinctFeatures, electionPrecinctGeoJsonUrl]);

  // Render election precinct overlay
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    if (electionPrecinctLayerRef.current) {
      electionPrecinctLayerRef.current.remove();
      electionPrecinctLayerRef.current = null;
    }

    if (!showElectionPrecincts || !electionPrecinctFeatures || electionPrecinctFeatures.length === 0) {
      return;
    }

    const layer = L.geoJSON(
      { type: 'FeatureCollection', features: electionPrecinctFeatures } as GeoJSON.GeoJsonObject,
      {
        style: {
          color: '#1d4ed8',
          weight: 1,
          fillColor: '#60a5fa',
          fillOpacity: 0.08,
        },
        onEachFeature: (feature, leafletLayer) => {
          const title = getElectionPrecinctName(feature.properties as ElectionPrecinctGeoProperties | undefined);
          leafletLayer.bindTooltip(`Wahlbezirk: ${title}`, { sticky: true });
        },
      },
    ).addTo(mapInstanceRef.current);

    electionPrecinctLayerRef.current = layer;

    return () => {
      if (electionPrecinctLayerRef.current) {
        electionPrecinctLayerRef.current.remove();
        electionPrecinctLayerRef.current = null;
      }
    };
  }, [mapReady, showElectionPrecincts, electionPrecinctFeatures, getElectionPrecinctName]);

  // Setup realtime subscription for contact updates
  useEffect(() => {
    if (!mapReady) return;

    debugConsole.log('Setting up realtime subscription for contacts');

    const channel = supabase
      .channel('contacts_map_changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'contacts',
        filter: `contact_type=eq.organization`
      }, (payload) => {
        const updated = payload.new;
        debugConsole.log('Contact updated via realtime:', updated);
        
        if (updated && typeof updated === 'object' && ('coordinates' in updated || 'tags' in updated)) {
          debugConsole.log('Relevant stakeholder change found, reloading stakeholders...');
          void loadStakeholders();
        }
      })
      .subscribe();
    
    return () => {
      debugConsole.log('Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [mapReady, loadStakeholders]);

  // Load stakeholders when dependencies change
  useEffect(() => {
    if (!mapReady) return;
    loadStakeholders();
  }, [mapReady, loadStakeholders]);

  // Render flags
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Clear existing flag markers
    flagMarkersRef.current.forEach(marker => marker.remove());
    flagMarkersRef.current.clear();

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
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            border: 2px solid white;
            cursor: pointer;
          ">${getIconDisplay(flagType.icon, '#ffffff', 18)}</div>`,
          iconSize: [32, 32],
          className: 'map-flag-marker',
        }),
      });

      marker.bindPopup(`
        <div style="font-family: sans-serif; min-width: 200px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <div style="display: inline-flex; align-items: center; justify-content: center;">${getIconDisplay(flagType.icon, flagType.color, 20)}</div>
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
    const handleEditFlag = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      const flagId = customEvent.detail;
      const flag = flags.find(f => f.id === flagId);
      if (flag && onFlagEdit) onFlagEdit(flag);
    };

    const handleDeleteFlag = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      const flagId = customEvent.detail;
      if (onFlagDelete) onFlagDelete(flagId);
    };

    window.addEventListener('editFlag', handleEditFlag);
    window.addEventListener('deleteFlag', handleDeleteFlag);

    return () => {
      window.removeEventListener('editFlag', handleEditFlag);
      window.removeEventListener('deleteFlag', handleDeleteFlag);
    };
  }, [mapReady, flags, flagTypes, visibleFlagTypes, onFlagEdit, onFlagDelete, showStakeholders]);

  // Render heatmap
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !showHeatmap || heatmapPoints.length === 0) return;

    const map = mapInstanceRef.current;

    const heat = L.heatLayer(heatmapPoints, {
      radius: 25,
      blur: 15,
      maxZoom: 17,
      max: 1.0,
      minOpacity: 0.3,
      gradient: {
        0.0: '#3b82f6',
        0.3: '#22c55e',
        0.5: '#eab308',
        0.7: '#f97316',
        1.0: '#ef4444',
      },
    });

    heat.addTo(map);

    return () => {
      map.removeLayer(heat);
    };
  }, [mapReady, showHeatmap, heatmapPoints]);

  // Render waypoint markers
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || waypoints.length === 0) return;

    const map = mapInstanceRef.current;
    const markers: L.Marker[] = [];

    waypoints.forEach((wp, index) => {
      const marker = L.marker([wp.lat, wp.lng], {
        icon: L.divIcon({
          html: `<div style="
            background: #3b82f6;
            border-radius: 50%;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            border: 2px solid white;
            color: white;
            font-weight: bold;
            font-size: 14px;
          ">${index + 1}</div>`,
          iconSize: [28, 28],
          className: 'waypoint-marker',
        }),
      });
      marker.addTo(map);
      markers.push(marker);
    });

    return () => {
      markers.forEach(m => m.remove());
    };
  }, [mapReady, waypoints]);

  // Routing
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !showRouting || waypoints.length < 2) return;

    const map = mapInstanceRef.current;
    const latLngs = waypoints.map(wp => L.latLng(wp.lat, wp.lng));

    const routingControl = LRouting.control({
      waypoints: latLngs,
      routeWhileDragging: false,
      showAlternatives: false,
      fitSelectedRoutes: false,
      addWaypoints: false,
      show: false,
      lineOptions: {
        styles: [
          { color: '#3b82f6', weight: 5, opacity: 0.8 },
          { color: '#1d4ed8', weight: 3, opacity: 1 },
        ],
        extendToWaypoints: true,
        missingRouteTolerance: 0,
      },
      router: LRouting.osrmv1({
        serviceUrl: 'https://router.project-osrm.org/route/v1',
        profile: 'driving',
      }),
      createMarker: () => null,
    });

    routingControl.on('routesfound', (event: { routes?: Array<{ summary: { totalDistance: number; totalTime: number } }> }) => {
      const routes = event.routes;
      if (routes && routes.length > 0 && onRouteFound) {
        const route = routes[0];
        onRouteFound({
          distance: route.summary.totalDistance,
          duration: route.summary.totalTime,
        });
      }
    });

    routingControl.addTo(map);

    return () => {
      try {
        map.removeControl(routingControl);
      } catch (e) {}
    };
  }, [mapReady, showRouting, waypoints, onRouteFound]);

  return (
    <div
      ref={mapRef}
      className={`w-full h-[600px] rounded-lg border border-border z-0 ${flagMode ? 'cursor-crosshair' : ''}`}
    />
  );
};
