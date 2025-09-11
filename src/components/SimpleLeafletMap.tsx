import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const SimpleLeafletMap: React.FC = () => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    console.info('SimpleLeafletMap mounted');
  }, []);

  return (
    <div className="relative w-full h-[400px] bg-card rounded-lg overflow-hidden border border-border">
      {isClient ? (
        <MapContainer
          center={[49.012, 8.4037]}
          zoom={10}
          className="w-full h-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </MapContainer>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
          Karte wird initialisiert...
        </div>
      )}
    </div>
  );
};

export default SimpleLeafletMap;