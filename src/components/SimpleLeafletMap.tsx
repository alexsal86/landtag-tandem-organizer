import React, { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import * as L from 'leaflet';

const SimpleLeafletMap: React.FC = () => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    // Initialize plain Leaflet map (no react-leaflet)
    const map = L.map(containerRef.current, {
      center: [49.012, 8.4037],
      zoom: 10,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      detectRetina: true,
    }).addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="relative w-full h-[400px] bg-card rounded-lg overflow-hidden border border-border">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};

export default SimpleLeafletMap;