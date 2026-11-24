import React, { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import '@/styles/leaflet-overrides.css';
import * as L from 'leaflet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, Building, Phone, Mail, Globe, Loader2 } from "lucide-react";
import { PartyAssociation, usePartyAssociations } from '@/hooks/usePartyAssociations';
import { hasOwnProperty } from '@/utils/typeSafety';

interface PartyAssociationMapProps {
  associations: PartyAssociationViewModel[];
  selectedAssociation?: PartyAssociationViewModel | null;
  onAssociationClick?: (association: PartyAssociationViewModel) => void;
}

interface PartyAssociationViewModel {
  id: string;
  name: string;
  fullAddress: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  centerCoordinates: { lat: number; lng: number } | null;
  coverageAreas: string[];
}

const toCoverageAreas = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
  }

  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
      }
    } catch {
      return [];
    }
  }

  return [];
};

const toAssociationViewModel = (association: PartyAssociation): PartyAssociationViewModel | null => {
  if (!association.name?.trim()) return null;
  const dynamicCoordinates = hasOwnProperty(association as unknown, 'center_coordinates')
    ? (association as unknown as Record<'center_coordinates', unknown>).center_coordinates
    : association.contact_info;
  const coordinates = dynamicCoordinates;
  const centerCoordinates =
    hasOwnProperty(coordinates, 'lat') &&
    hasOwnProperty(coordinates, 'lng') &&
    typeof coordinates.lat === 'number' &&
    typeof coordinates.lng === 'number'
      ? { lat: coordinates.lat, lng: coordinates.lng }
      : null;

  return {
    id: association.id,
    name: association.name,
    fullAddress: association.full_address ?? null,
    phone: association.phone ?? null,
    email: association.email ?? null,
    website: association.website ?? null,
    centerCoordinates,
    coverageAreas: toCoverageAreas(association.coverage_areas),
  };
};

/** Association markers and popups are built from elements, so contact data is never parsed as HTML. */
const appendText = (
  parent: HTMLElement,
  tag: 'span' | 'strong' | 'h3' | 'p' | 'div',
  text: string,
  styles: Record<string, string>,
): HTMLElement => {
  const element = document.createElement(tag);
  Object.assign(element.style, styles);
  element.textContent = text;
  parent.appendChild(element);
  return element;
};

const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

/** Contact values only become links for the scheme they belong to; anything else stays text. */
const safeContactHref = (
  raw: string | null | undefined,
  kind: 'phone' | 'email' | 'website',
): string | null => {
  const value = raw?.trim();
  if (!value) return null;

  if (kind === 'phone') {
    const digits = value.replace(/[^\d+]/g, '');
    return /^\+?\d{3,}$/.test(digits) ? `tel:${digits}` : null;
  }

  if (kind === 'email') {
    return EMAIL_PATTERN.test(value) ? `mailto:${value}` : null;
  }

  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
};

const appendContactRow = (
  parent: HTMLElement,
  icon: string,
  label: string,
  value: string,
  href: string | null,
  linkText: string,
  wrap: boolean,
): void => {
  const row = document.createElement('div');
  Object.assign(row.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px',
    background: '#f9fafb',
    borderRadius: '4px',
  });
  appendText(row, 'span', icon, { color: '#16a34a' });

  const body = document.createElement('div');
  appendText(body, 'strong', label, { color: '#374151', fontSize: '12px' });
  body.appendChild(document.createElement('br'));
  const valueStyles: Record<string, string> = {
    color: '#16a34a',
    textDecoration: 'none',
    fontWeight: '500',
    ...(wrap ? { wordBreak: 'break-all' } : {}),
  };

  if (href) {
    const link = document.createElement('a');
    Object.assign(link.style, valueStyles);
    link.href = href;
    link.textContent = linkText;
    if (href.startsWith('http')) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    body.appendChild(link);
  } else {
    appendText(body, 'span', value, valueStyles);
  }

  row.appendChild(body);
  parent.appendChild(row);
};

const createAssociationPopup = (association: PartyAssociationViewModel): HTMLElement => {
  const popup = document.createElement('div');
  Object.assign(popup.style, { minWidth: '250px', maxWidth: '300px' });

  const header = document.createElement('div');
  Object.assign(header.style, {
    borderBottom: '2px solid #16a34a',
    paddingBottom: '8px',
    marginBottom: '12px',
  });
  appendText(header, 'h3', `🌱 ${association.name}`, {
    color: '#15803d',
    fontSize: '18px',
    margin: '0',
    fontWeight: 'bold',
  });
  appendText(header, 'p', 'GRÜNE Kreisverband', {
    color: '#16a34a',
    fontWeight: 'bold',
    margin: '4px 0 0 0',
    fontSize: '14px',
  });
  popup.appendChild(header);

  if (association.fullAddress) {
    const address = document.createElement('div');
    Object.assign(address.style, {
      margin: '8px 0',
      padding: '8px',
      background: '#f0f9ff',
      borderRadius: '6px',
    });
    const row = document.createElement('div');
    Object.assign(row.style, { display: 'flex', alignItems: 'flex-start', gap: '8px' });
    appendText(row, 'span', '📍', { color: '#16a34a', fontSize: '16px' });
    const body = document.createElement('div');
    appendText(body, 'strong', 'Adresse:', { color: '#374151' });
    body.appendChild(document.createElement('br'));
    appendText(body, 'span', association.fullAddress, { color: '#6b7280', lineHeight: '1.4' });
    row.appendChild(body);
    address.appendChild(row);
    popup.appendChild(address);
  }

  const contacts = document.createElement('div');
  Object.assign(contacts.style, {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '8px',
    marginTop: '12px',
  });
  if (association.phone) {
    appendContactRow(
      contacts,
      '📞',
      'Telefon:',
      association.phone,
      safeContactHref(association.phone, 'phone'),
      association.phone,
      false,
    );
  }
  if (association.email) {
    appendContactRow(
      contacts,
      '📧',
      'E-Mail:',
      association.email,
      safeContactHref(association.email, 'email'),
      association.email,
      true,
    );
  }
  if (association.website) {
    appendContactRow(
      contacts,
      '🌐',
      'Website:',
      association.website,
      safeContactHref(association.website, 'website'),
      'Website besuchen',
      true,
    );
  }
  popup.appendChild(contacts);

  if (association.coverageAreas.length > 0) {
    const coverage = document.createElement('div');
    Object.assign(coverage.style, {
      marginTop: '12px',
      padding: '8px',
      background: '#f0fdf4',
      borderRadius: '6px',
      borderLeft: '3px solid #16a34a',
    });
    appendText(coverage, 'strong', '🗺️ Zuständigkeitsgebiet:', { color: '#15803d', fontSize: '12px' });
    coverage.appendChild(document.createElement('br'));
    appendText(coverage, 'span', association.coverageAreas.join(', '), {
      color: '#374151',
      fontSize: '12px',
      lineHeight: '1.4',
    });
    popup.appendChild(coverage);
  }

  return popup;
};

const PartyAssociationMap: React.FC<PartyAssociationMapProps> = ({ 
  associations, 
  selectedAssociation,
  onAssociationClick 
}) => {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);

  // Initialize map once
  useEffect(() => {
    if (!mapEl.current) return;
    if (mapRef.current) return;

    const map = L.map(mapEl.current, {
      center: [48.7758, 9.1829], // Center of Baden-Württemberg
      zoom: 8,
      zoomControl: true,
      attributionControl: true,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    markerLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
    };
  }, []);

  // Update markers when data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !markerLayerRef.current) return;

    // Clear existing markers
    markerLayerRef.current.clearLayers();

    if (!associations.length) return;

    let bounds = L.latLngBounds([]);
    let validMarkers = 0;

    associations.forEach((association) => {
      // Try to get coordinates from center_coordinates or parse from address
      let coords: { lat: number; lng: number } | null = null;
      
      if (association.centerCoordinates) {
        coords = association.centerCoordinates;
      } else if (association.fullAddress) {
        // For now, we'll use a simple city-based coordinate lookup
        // In production, you'd use a geocoding service
        coords = getCityCoordinates(association.fullAddress);
      }

      if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
        const isSelected = selectedAssociation?.id === association.id;
        
        const size = isSelected ? 32 : 28;
        const badge = document.createElement('span');
        badge.textContent = '🌱';

        const markerIcon = document.createElement('div');
        Object.assign(markerIcon.style, {
          background: isSelected ? '#15803d' : '#16a34a',
          border: '2px solid #15803d',
          borderRadius: '50%',
          width: `${size}px`,
          height: `${size}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          fontSize: '12px',
          color: '#ffffff',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          cursor: 'pointer',
        });
        markerIcon.appendChild(badge);

        const marker = L.marker([coords.lat, coords.lng], {
          icon: L.divIcon({
            html: markerIcon,
            className: 'green-party-marker',
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2]
          })
        });

        marker.bindPopup(createAssociationPopup(association), {
          maxWidth: 320,
          className: 'green-party-popup'
        });

        marker.on('click', () => {
          if (onAssociationClick) {
            onAssociationClick(association);
          }
        });

        marker.addTo(markerLayerRef.current!);
        bounds.extend([coords.lat, coords.lng]);
        validMarkers++;
      }
    });

    // Fit bounds to all markers
    if (validMarkers > 0 && bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [20, 20],
        maxZoom: 12
      });
    }

  }, [associations, selectedAssociation, onAssociationClick]);

  return (
    <div className="relative w-full h-[400px] md:h-[500px] lg:h-[600px] bg-card rounded-lg overflow-hidden border border-border">
      <div ref={mapEl} className="w-full h-full" />
      
      <div className="absolute top-4 right-4 z-[1000]">
        <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg p-3 text-xs text-muted-foreground shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-palette-green">🌱</span>
            <span className="font-medium text-foreground">GRÜNE Kreisverbände</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Building className="h-3 w-3 text-palette-green" />
              <span className="text-palette-green">{associations.length} Verbände</span>
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span>Baden-Württemberg</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Simple city-based coordinate lookup for Baden-Württemberg
const getCityCoordinates = (address: string): { lat: number; lng: number } | null => {
  const cityCoords: { [key: string]: { lat: number; lng: number } } = {
    'stuttgart': { lat: 48.7758, lng: 9.1829 },
    'karlsruhe': { lat: 49.0069, lng: 8.4037 },
    'mannheim': { lat: 49.4875, lng: 8.4660 },
    'freiburg': { lat: 47.9990, lng: 7.8421 },
    'heidelberg': { lat: 49.3988, lng: 8.6724 },
    'ulm': { lat: 48.3974, lng: 9.9934 },
    'heilbronn': { lat: 49.1427, lng: 9.2109 },
    'pforzheim': { lat: 48.8922, lng: 8.6881 },
    'reutlingen': { lat: 48.4919, lng: 9.2111 },
    'ludwigsburg': { lat: 48.8975, lng: 9.1906 },
    'esslingen': { lat: 48.7394, lng: 9.3094 },
    'tübingen': { lat: 48.5216, lng: 9.0576 },
    'constanz': { lat: 47.6779, lng: 9.1732 },
    'konstanz': { lat: 47.6779, lng: 9.1732 },
    'friedrichshafen': { lat: 47.6548, lng: 9.4750 },
    'aalen': { lat: 48.8439, lng: 10.0948 },
    'sindelfingen': { lat: 48.7143, lng: 8.9880 },
    'böblingen': { lat: 48.6847, lng: 9.0110 },
    'lörrach': { lat: 47.6158, lng: 7.6615 },
    'ravensburg': { lat: 47.7815, lng: 9.6128 },
    'schwäbisch gmünd': { lat: 48.7984, lng: 9.7995 },
    'baden-baden': { lat: 48.7606, lng: 8.2397 },
    'offenburg': { lat: 48.4722, lng: 7.9403 },
    'villingen-schwenningen': { lat: 48.0644, lng: 8.4559 },
    'nürtingen': { lat: 48.6275, lng: 9.3447 },
    'göppingen': { lat: 48.7033, lng: 9.6518 },
    'schwäbisch hall': { lat: 49.1081, lng: 9.7393 },
    'waiblingen': { lat: 48.8311, lng: 9.3159 },
    'weinheim': { lat: 49.5453, lng: 8.6692 },
    'bruchsal': { lat: 49.1242, lng: 8.5980 },
    'emmendingen': { lat: 48.1215, lng: 7.8510 },
    'biberach': { lat: 48.0956, lng: 9.7918 },
    'ettlingen': { lat: 49.0043, lng: 8.4077 },
    'schwetzingen': { lat: 49.3818, lng: 8.5694 },
    'heidenheim': { lat: 48.6761, lng: 10.1561 },
    'rottweil': { lat: 48.1681, lng: 8.6362 },
    'balingen': { lat: 48.2767, lng: 8.8514 },
    'freudenstadt': { lat: 48.4648, lng: 8.4118 }
  };

  const lowerAddress = address.toLowerCase();
  
  for (const [city, coords] of Object.entries(cityCoords)) {
    if (lowerAddress.includes(city)) {
      return coords;
    }
  }
  
  // Default to Stuttgart if no match found
  return { lat: 48.7758, lng: 9.1829 };
};

export const PartyAssociationsMapView = () => {
  const { associations, loading } = usePartyAssociations();
  const [selectedAssociation, setSelectedAssociation] = useState<PartyAssociationViewModel | null>(null);

  const handleAssociationClick = (association: PartyAssociationViewModel) => {
    setSelectedAssociation(association);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-palette-green" />
          <span>Kreisverbände werden geladen...</span>
        </div>
      </div>
    );
  }

  const activeAssociations = associations
    .map(toAssociationViewModel)
    .filter((association): association is PartyAssociationViewModel => association !== null);
  const associationsWithContact = activeAssociations.filter(a => a.phone || a.email || a.website);
  const associationsWithAddress = activeAssociations.filter(a => a.fullAddress);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <span className="text-palette-green text-2xl">🌱</span>
        <h1 className="text-3xl font-bold">GRÜNE Kreisverbände</h1>
        <Badge variant="outline" className="ml-2 border-palette-green text-palette-green">Baden-Württemberg</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Map Section */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-palette-green">
                <MapPin className="h-5 w-5" />
                Karte der Kreisverbände
              </CardTitle>
              <CardDescription>
                Klicken Sie auf einen Marker für Kontaktdetails
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeAssociations.length === 0 ? (
                <div className="flex items-center justify-center h-[400px] bg-muted rounded-lg">
                  <div className="text-center">
                    <span className="text-4xl mb-2 block">🌱</span>
                    <p className="text-muted-foreground mb-2">Keine Kreisverbände gefunden</p>
                    <p className="text-sm text-muted-foreground">Daten über die Administration importieren</p>
                  </div>
                </div>
              ) : (
                <PartyAssociationMap 
                  associations={activeAssociations}
                  selectedAssociation={selectedAssociation}
                  onAssociationClick={handleAssociationClick}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Statistics Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-palette-green">
                <Users className="h-5 w-5" />
                Übersicht
            </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Gesamt</span>
                  <Badge variant="secondary" className="bg-palette-green/20 text-palette-green">
                    {activeAssociations.length}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Mit Kontakt</span>
                  <Badge variant="outline" className="border-palette-green text-palette-green">
                    {associationsWithContact.length}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Mit Adresse</span>
                  <Badge variant="outline" className="border-palette-green text-palette-green">
                    {associationsWithAddress.length}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {selectedAssociation && (
            <Card className="border-palette-green/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-palette-green flex items-center gap-2">
                  <span>🌱</span>
                  {selectedAssociation.name}
                </CardTitle>
                <CardDescription className="text-palette-green font-medium">
                  Kreisverband Details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedAssociation.fullAddress && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="h-4 w-4 text-palette-green" />
                      <span className="text-sm font-medium">Adresse</span>
                    </div>
                    <p className="text-sm text-muted-foreground pl-6">
                      {selectedAssociation.fullAddress}
                    </p>
                  </div>
                )}
                
                {selectedAssociation.phone && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Phone className="h-4 w-4 text-palette-green" />
                      <span className="text-sm font-medium">Telefon</span>
                    </div>
                    <p className="text-sm text-muted-foreground pl-6">
                      <a href={`tel:${selectedAssociation.phone}`} className="text-palette-green hover:underline">
                        {selectedAssociation.phone}
                      </a>
                    </p>
                  </div>
                )}
                
                {selectedAssociation.email && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Mail className="h-4 w-4 text-palette-green" />
                      <span className="text-sm font-medium">E-Mail</span>
                    </div>
                    <p className="text-sm text-muted-foreground pl-6">
                      <a href={`mailto:${selectedAssociation.email}`} className="text-palette-green hover:underline break-all">
                        {selectedAssociation.email}
                      </a>
                    </p>
                  </div>
                )}
                
                {selectedAssociation.website && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Globe className="h-4 w-4 text-palette-green" />
                      <span className="text-sm font-medium">Website</span>
                    </div>
                    <p className="text-sm text-muted-foreground pl-6">
                      <a 
                        href={selectedAssociation.website} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-palette-green hover:underline break-all"
                      >
                        Website besuchen
                      </a>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default PartyAssociationsMapView;
