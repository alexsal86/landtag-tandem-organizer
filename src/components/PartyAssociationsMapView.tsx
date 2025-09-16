import React, { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import * as L from 'leaflet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, Building, Phone, Mail, Globe, Loader2 } from "lucide-react";
import { usePartyAssociations } from '@/hooks/usePartyAssociations';

interface PartyAssociationMapProps {
  associations: any[];
  selectedAssociation?: any;
  onAssociationClick?: (association: any) => void;
}

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

    associations.forEach(association => {
      // Try to get coordinates from center_coordinates or parse from address
      let coords: { lat: number; lng: number } | null = null;
      
      if (association.center_coordinates) {
        coords = association.center_coordinates;
      } else if (association.full_address) {
        // For now, we'll use a simple city-based coordinate lookup
        // In production, you'd use a geocoding service
        coords = getCityCoordinates(association.full_address);
      }

      if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
        const isSelected = selectedAssociation?.id === association.id;
        
        const marker = L.marker([coords.lat, coords.lng], {
          icon: L.divIcon({
            html: `<div style="background: ${isSelected ? '#15803d' : '#16a34a'}; border: 2px solid #15803d; border-radius: 50%; width: ${isSelected ? 32 : 28}px; height: ${isSelected ? 32 : 28}px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; color: white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); cursor: pointer;">🌱</div>`,
            className: 'green-party-marker',
            iconSize: [isSelected ? 32 : 28, isSelected ? 32 : 28],
            iconAnchor: [isSelected ? 16 : 14, isSelected ? 16 : 14]
          })
        });

        const popupContent = `
          <div style="min-width: 250px; max-width: 300px;">
            <div style="border-bottom: 2px solid #16a34a; padding-bottom: 8px; margin-bottom: 12px;">
              <h3 style="color: #15803d; font-size: 18px; margin: 0; font-weight: bold;">🌱 ${association.name}</h3>
              <p style="color: #16a34a; font-weight: bold; margin: 4px 0 0 0; font-size: 14px;">GRÜNE Kreisverband</p>
            </div>
            
            ${association.full_address ? `
              <div style="margin: 8px 0; padding: 8px; background: #f0f9ff; border-radius: 6px;">
                <div style="display: flex; align-items: flex-start; gap: 8px;">
                  <span style="color: #16a34a; font-size: 16px;">📍</span>
                  <div>
                    <strong style="color: #374151;">Adresse:</strong><br>
                    <span style="color: #6b7280; line-height: 1.4;">${association.full_address}</span>
                  </div>
                </div>
              </div>
            ` : ''}
            
            <div style="display: grid; grid-template-columns: 1fr; gap: 8px; margin-top: 12px;">
              ${association.phone ? `
                <div style="display: flex; align-items: center; gap: 8px; padding: 6px; background: #f9fafb; border-radius: 4px;">
                  <span style="color: #16a34a;">📞</span>
                  <div>
                    <strong style="color: #374151; font-size: 12px;">Telefon:</strong><br>
                    <a href="tel:${association.phone}" style="color: #16a34a; text-decoration: none; font-weight: 500;">${association.phone}</a>
                  </div>
                </div>
              ` : ''}
              
              ${association.email ? `
                <div style="display: flex; align-items: center; gap: 8px; padding: 6px; background: #f9fafb; border-radius: 4px;">
                  <span style="color: #16a34a;">📧</span>
                  <div>
                    <strong style="color: #374151; font-size: 12px;">E-Mail:</strong><br>
                    <a href="mailto:${association.email}" style="color: #16a34a; text-decoration: none; font-weight: 500; word-break: break-all;">${association.email}</a>
                  </div>
                </div>
              ` : ''}
              
              ${association.website ? `
                <div style="display: flex; align-items: center; gap: 8px; padding: 6px; background: #f9fafb; border-radius: 4px;">
                  <span style="color: #16a34a;">🌐</span>
                  <div>
                    <strong style="color: #374151; font-size: 12px;">Website:</strong><br>
                    <a href="${association.website}" target="_blank" style="color: #16a34a; text-decoration: none; font-weight: 500; word-break: break-all;">Website besuchen</a>
                  </div>
                </div>
              ` : ''}
            </div>
            
            ${association.coverage_areas && JSON.parse(association.coverage_areas || '[]').length > 0 ? `
              <div style="margin-top: 12px; padding: 8px; background: #f0fdf4; border-radius: 6px; border-left: 3px solid #16a34a;">
                <strong style="color: #15803d; font-size: 12px;">🗺️ Zuständigkeitsgebiet:</strong><br>
                <span style="color: #374151; font-size: 12px; line-height: 1.4;">${JSON.parse(association.coverage_areas).join(', ')}</span>
              </div>
            ` : ''}
          </div>
        `;

        marker.bindPopup(popupContent, {
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
            <span className="text-green-600">🌱</span>
            <span className="font-medium text-foreground">GRÜNE Kreisverbände</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Building className="h-3 w-3 text-green-600" />
              <span className="text-green-600">{associations.length} Verbände</span>
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
  const [selectedAssociation, setSelectedAssociation] = useState<any>(null);

  const handleAssociationClick = (association: any) => {
    setSelectedAssociation(association);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-green-600" />
          <span>Kreisverbände werden geladen...</span>
        </div>
      </div>
    );
  }

  const activeAssociations = associations.filter(a => a.name && a.name.trim());
  const associationsWithContact = activeAssociations.filter(a => a.phone || a.email || a.website);
  const associationsWithAddress = activeAssociations.filter(a => a.full_address);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <span className="text-green-600 text-2xl">🌱</span>
        <h1 className="text-3xl font-bold">GRÜNE Kreisverbände</h1>
        <Badge variant="outline" className="ml-2 border-green-600 text-green-600">Baden-Württemberg</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Map Section */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700">
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
              <CardTitle className="text-lg flex items-center gap-2 text-green-700">
                <Users className="h-5 w-5" />
                Übersicht
            </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Gesamt</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    {activeAssociations.length}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Mit Kontakt</span>
                  <Badge variant="outline" className="border-green-600 text-green-600">
                    {associationsWithContact.length}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Mit Adresse</span>
                  <Badge variant="outline" className="border-green-600 text-green-600">
                    {associationsWithAddress.length}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {selectedAssociation && (
            <Card className="border-green-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-green-700 flex items-center gap-2">
                  <span>🌱</span>
                  {selectedAssociation.name}
                </CardTitle>
                <CardDescription className="text-green-600 font-medium">
                  Kreisverband Details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedAssociation.full_address && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">Adresse</span>
                    </div>
                    <p className="text-sm text-muted-foreground pl-6">
                      {selectedAssociation.full_address}
                    </p>
                  </div>
                )}
                
                {selectedAssociation.phone && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Phone className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">Telefon</span>
                    </div>
                    <p className="text-sm text-muted-foreground pl-6">
                      <a href={`tel:${selectedAssociation.phone}`} className="text-green-600 hover:underline">
                        {selectedAssociation.phone}
                      </a>
                    </p>
                  </div>
                )}
                
                {selectedAssociation.email && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Mail className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">E-Mail</span>
                    </div>
                    <p className="text-sm text-muted-foreground pl-6">
                      <a href={`mailto:${selectedAssociation.email}`} className="text-green-600 hover:underline break-all">
                        {selectedAssociation.email}
                      </a>
                    </p>
                  </div>
                )}
                
                {selectedAssociation.website && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Globe className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">Website</span>
                    </div>
                    <p className="text-sm text-muted-foreground pl-6">
                      <a 
                        href={selectedAssociation.website} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-green-600 hover:underline break-all"
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