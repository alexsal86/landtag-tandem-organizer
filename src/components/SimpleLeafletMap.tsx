import React from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const SimpleLeafletMap: React.FC = () => {
  return (
    <div className="relative w-full h-[400px] bg-card rounded-lg overflow-hidden border border-border">
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
    </div>
  );
};

export default SimpleLeafletMap;