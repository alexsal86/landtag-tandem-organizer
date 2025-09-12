import React, { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import * as L from 'leaflet';
import { ElectionDistrict } from '@/hooks/useElectionDistricts';

interface BasicMapProps {
  districts: ElectionDistrict[];
  onDistrictClick: (district: ElectionDistrict) => void;
  selectedDistrict?: ElectionDistrict;
}

const getPartyColorHex = (party?: string): string => {
  const colorMap: Record<string, string> = {
    fdp: '#FFD700',
    'grüne': '#4CAF50',
    cdu: '#0066CC',
    spd: '#E3000F',
    afd: '#00A0E6',
    'die linke': '#BE3075',
  };
  return colorMap[party?.toLowerCase() || ''] || '#9E9E9E';
};

const icon = L.icon({
  iconUrl: '/leaflet/marker-icon.png',
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  shadowUrl: '/leaflet/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const getDistrictBoundaries = (districtNumber: number): [number, number][] => {
  const baseLatitude = 49.012;
  const baseLongitude = 8.4037;
  const offset = 0.02;

  switch (districtNumber) {
    case 1:
      return [
        [baseLatitude + offset, baseLongitude - offset],
        [baseLatitude + offset, baseLongitude + offset / 2],
        [baseLatitude, baseLongitude + offset / 2],
        [baseLatitude, baseLongitude - offset],
      ];
    case 2:
      return [
        [baseLatitude + offset, baseLongitude + offset / 2],
        [baseLatitude + offset, baseLongitude + offset * 2],
        [baseLatitude, baseLongitude + offset * 2],
        [baseLatitude, baseLongitude + offset / 2],
      ];
    case 3:
      return [
        [baseLatitude, baseLongitude - offset],
        [baseLatitude, baseLongitude + offset / 2],
        [baseLatitude - offset, baseLongitude + offset / 2],
        [baseLatitude - offset, baseLongitude - offset],
      ];
    case 4:
      return [
        [baseLatitude, baseLongitude + offset / 2],
        [baseLatitude, baseLongitude + offset * 2],
        [baseLatitude - offset, baseLongitude + offset * 2],
        [baseLatitude - offset, baseLongitude + offset / 2],
      ];
    default:
      return [
        [baseLatitude, baseLongitude],
        [baseLatitude + 0.01, baseLongitude + 0.01],
        [baseLatitude, baseLongitude + 0.01],
      ];
  }
};

const LeafletBasicKarlsruheMap: React.FC<BasicMapProps> = ({ districts, onDistrictClick, selectedDistrict }) => {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapEl.current) return;
    if (mapRef.current) return; // init once

    const map = L.map(mapEl.current, {
      center: [49.012, 8.4037],
      zoom: 10,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // Draw polygons and markers
    districts.forEach((district) => {
      const partyColor = getPartyColorHex(district.representatives?.find(rep => rep.mandate_type === 'direct')?.party);
      const boundaries = getDistrictBoundaries(district.district_number);

      const polygon = L.polygon(boundaries as any, {
        color: partyColor,
        weight: selectedDistrict?.id === district.id ? 3 : 2,
        opacity: 0.9,
        fillColor: partyColor,
        fillOpacity: selectedDistrict?.id === district.id ? 0.6 : 0.35,
      }).addTo(map);

      polygon.on('click', () => onDistrictClick(district));

      if (district.center_coordinates) {
        const { lat, lng } = district.center_coordinates as { lat: number; lng: number };
        const marker = L.marker([lat, lng], { icon }).addTo(map);
        marker.on('click', () => onDistrictClick(district));
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [districts, onDistrictClick, selectedDistrict]);

  // Update view when selectedDistrict changes
  useEffect(() => {
    if (!mapRef.current || !selectedDistrict?.center_coordinates) return;
    const { lat, lng } = selectedDistrict.center_coordinates as { lat: number; lng: number };
    mapRef.current.setView([lat, lng], 12, { animate: true });
  }, [selectedDistrict]);

  return (
    <div className="relative w-full h-[400px] bg-card rounded-lg overflow-hidden border border-border">
      <div ref={mapEl} className="w-full h-full" />
    </div>
  );
};

export default LeafletBasicKarlsruheMap;
