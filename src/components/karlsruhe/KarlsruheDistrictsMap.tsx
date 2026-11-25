import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import L from '@/lib/leafletRuntime';
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
import { appendText, createMapIconBubble, safeContactHref } from '@/lib/leafletPopupDom';
import 'leaflet.heat';
import 'leaflet-routing-machine';

const LRouting = L.Routing;

/**
 * Helper function to get icon display for Leaflet markers
 * Handles both Lucide icons (as SVG) and emojis.
 * Returns an element so icon names are never parsed as HTML.
 * @param iconName - Icon identifier (Lucide icon name or emoji)
 * @param color - Color for the icon (used for Lucide icons)
 * @param size - Size of the icon in pixels
 */
const getIconDisplay = (iconName: string, color: string = '#ffffff', size: number = 18): HTMLElement => {
  const wrapper = document.createElement('span');
  // Check if it's a Lucide icon
  if (isLucideIcon(iconName)) {
    const svgString = lucideIconToSvg(iconName, color, size);
    if (svgString) {
      // Markup comes from the local Lucide icon map for a known icon name.
      wrapper.innerHTML = svgString;
      return wrapper;
    }
  }

  // Fallback: treat as emoji
  wrapper.style.fontSize = `${size}px`;
  wrapper.style.lineHeight = '1';
  wrapper.textContent = iconName;
  return wrapper;
};

const appendPopupDivider = (parent: HTMLElement): void => {
  const divider = document.createElement('div');
  Object.assign(divider.style, { marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #ddd' });
  parent.appendChild(divider);
};

const createStakeholderPopup = (stakeholder: StakeholderContact, tagFilter: string): HTMLElement => {
  const popup = document.createElement('div');
  Object.assign(popup.style, { fontFamily: 'sans-serif', minWidth: '220px' });

  const header = document.createElement('div');
  Object.assign(header.style, { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' });
  appendText(header, 'span', '🏢', { fontSize: '18px' });
  appendText(header, 'h3', stakeholder.name || 'Kontakt', { margin: '0', fontSize: '15px', fontWeight: '600' });
  popup.appendChild(header);

  if (stakeholder.organization) {
    appendText(popup, 'p', stakeholder.organization, { margin: '4px 0', color: '#666', fontSize: '13px' });
  }

  const address = [stakeholder.business_street, stakeholder.business_postal_code, stakeholder.business_city]
    .filter(Boolean)
    .join(', ');
  if (address) {
    appendText(popup, 'p', `📮 ${address}`, { margin: '4px 0', color: '#666', fontSize: '12px' });
  }
  appendText(popup, 'p', '📍 Geocodierte Adresse', { margin: '2px 0', fontSize: '11px', color: '#10b981' });

  appendPopupDivider(popup);
  if (stakeholder.email) {
    appendText(popup, 'p', `📧 ${stakeholder.email}`, { margin: '2px 0', fontSize: '12px' });
  }
  if (stakeholder.phone) {
    appendText(popup, 'p', `📞 ${stakeholder.phone}`, { margin: '2px 0', fontSize: '12px' });
  }
  if (stakeholder.website) {
    const websiteUrl = safeContactHref(stakeholder.website, 'website');
    const line = document.createElement('p');
    Object.assign(line.style, { margin: '2px 0', fontSize: '12px' });
    line.appendChild(document.createTextNode('🌐 '));
    if (websiteUrl) {
      const link = document.createElement('a');
      link.href = websiteUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.style.color = '#3b82f6';
      link.textContent = stakeholder.website;
      line.appendChild(link);
    } else {
      line.appendChild(document.createTextNode(stakeholder.website));
    }
    popup.appendChild(line);
  }

  appendPopupDivider(popup);
  appendText(popup, 'p', `Verknüpft über Tag: ${tagFilter}`, { margin: '0', fontSize: '11px', color: '#888' });
  const details = document.createElement('a');
  details.href = `/contacts/${encodeURIComponent(stakeholder.id)}`;
  details.target = '_blank';
  details.rel = 'noopener noreferrer';
  details.textContent = 'Details anzeigen';
  Object.assign(details.style, {
    display: 'inline-block',
    marginTop: '8px',
    padding: '4px 12px',
    background: '#3b82f6',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '4px',
    fontSize: '12px',
  });
  popup.appendChild(details);

  return popup;
};

/** District names are data: the label stays a text node inside the div icon. */
const createDistrictLabel = (name: string): HTMLElement => {
  const label = document.createElement('div');
  Object.assign(label.style, {
    padding: '4px 8px',
    fontSize: '13px',
    fontWeight: '700',
    textShadow: '-1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 1px 1px 0 white, 2px 2px 4px rgba(0,0,0,0.3)',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    textAlign: 'center',
  });
  label.textContent = name;
  return label;
};

const createDistrictPopup = (district: KarlsruheDistrict): HTMLElement => {
  const popup = document.createElement('div');
  popup.style.fontFamily = 'sans-serif';
  appendText(popup, 'h3', district.name, { margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' });
  if (district.population) {
    appendText(popup, 'p', `Einwohner: ${district.population.toLocaleString('de-DE')}`, { margin: '4px 0' });
  }
  return popup;
};

const createPopupButton = (label: string, background: string, onClick: () => void): HTMLButtonElement => {
  const button = document.createElement('button');
  button.type = 'button';
  Object.assign(button.style, {
    flex: '1',
    padding: '4px 8px',
    background,
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  });
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
};

const createFlagPopup = (flag: MapFlag, flagType: MapFlagType): HTMLElement => {
  const popup = document.createElement('div');
  Object.assign(popup.style, { fontFamily: 'sans-serif', minWidth: '200px' });

  const header = document.createElement('div');
  Object.assign(header.style, { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' });
  const icon = document.createElement('div');
  Object.assign(icon.style, { display: 'inline-flex', alignItems: 'center', justifyContent: 'center' });
  icon.appendChild(getIconDisplay(flagType.icon, flagType.color, 20));
  header.appendChild(icon);
  appendText(header, 'h3', flag.title, { margin: '0', fontSize: '16px', fontWeight: '600' });
  popup.appendChild(header);

  if (flag.description) {
    appendText(popup, 'p', flag.description, { margin: '8px 0', color: '#666' });
  }

  const actions = document.createElement('div');
  Object.assign(actions.style, { marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #ddd', display: 'flex', gap: '8px' });
  actions.appendChild(createPopupButton('Bearbeiten', '#3b82f6', () => {
    window.dispatchEvent(new CustomEvent('editFlag', { detail: flag.id }));
  }));
  actions.appendChild(createPopupButton('Löschen', '#ef4444', () => {
    window.dispatchEvent(new CustomEvent('deleteFlag', { detail: flag.id }));
  }));
  popup.appendChild(actions);

  return popup;
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
        const b = district.boundaries as { type?: string; features?: unknown[]; coordinates?: unknown };
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
            html: createMapIconBubble(28, getIconDisplay(flagType.icon, '#ffffff', 16), {
              background: `linear-gradient(135deg, ${flagType.color} 0%, ${flagType.color}dd 100%)`,
              boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
            }),
            iconSize: [28, 28],
            className: 'stakeholder-marker',
          }),
        });

        stakeholderMarker.bindPopup(createStakeholderPopup(stakeholder, flagType.tag_filter ?? ''));

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
      minZoom: 9,
      maxZoom: 18,
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
    L.control.scale({ position: 'bottomleft', metric: true, imperial: false, maxWidth: 140 }).addTo(map);
    setMapReady(true);
    onMapReady?.(map);

    return () => {
      onMapReady?.(null);
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
                html: createDistrictLabel(district.name),
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
          layer.bindPopup(createDistrictPopup(district));
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
          const precinctLabel = document.createElement('span');
          precinctLabel.textContent = `Wahlbezirk: ${title}`;
          leafletLayer.bindTooltip(precinctLabel, { sticky: true });
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
      .channel(`contacts_map_changes_${crypto.randomUUID()}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'contacts',
        filter: `contact_type=eq.organization`
      }, (payload: Record<string, any>) => {
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
          html: createMapIconBubble(32, getIconDisplay(flagType.icon, '#ffffff', 18), {
            background: flagType.color,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }),
          iconSize: [32, 32],
          className: 'map-flag-marker',
        }),
      });

      marker.bindPopup(createFlagPopup(flag, flagType));

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
      const position = document.createElement('span');
      position.textContent = String(index + 1);

      const marker = L.marker([wp.lat, wp.lng], {
        icon: L.divIcon({
          html: createMapIconBubble(28, position, {
            background: '#3b82f6',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            color: '#ffffff',
            fontWeight: 'bold',
            fontSize: '14px',
            cursor: 'default',
          }),
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
      className={`w-full h-[min(70dvh,600px)] min-h-[320px] rounded-lg border border-border z-0 md:h-[600px] ${flagMode ? 'cursor-crosshair' : ''}`}
    />
  );
};
