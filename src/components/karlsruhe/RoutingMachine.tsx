import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet-routing-machine';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import { Waypoint } from './RoutePlannerPanel';

// Extend Leaflet types for routing
declare module 'leaflet' {
  namespace Routing {
    function control(options: any): any;
    function osrmv1(options?: any): any;
  }
}

interface RoutingMachineProps {
  map: L.Map | null;
  waypoints: Waypoint[];
  onRouteFound?: (info: { distance: number; duration: number }) => void;
}

export const RoutingMachine = ({ map, waypoints, onRouteFound }: RoutingMachineProps) => {
  const routingControlRef = useRef<any>(null);

  useEffect(() => {
    if (!map) return;

    // Clean up existing control
    if (routingControlRef.current) {
      try {
        map.removeControl(routingControlRef.current);
      } catch (e) {
        // Ignore cleanup errors
      }
      routingControlRef.current = null;
    }

    // Need at least 2 waypoints for routing
    if (waypoints.length < 2) return;

    const latLngs = waypoints.map(wp => L.latLng(wp.lat, wp.lng));

    const routingControl = L.Routing.control({
      waypoints: latLngs,
      routeWhileDragging: false,
      showAlternatives: false,
      fitSelectedRoutes: false,
      addWaypoints: false,
      show: false, // Hide the default UI
      lineOptions: {
        styles: [
          { color: '#3b82f6', weight: 5, opacity: 0.8 },
          { color: '#1d4ed8', weight: 3, opacity: 1 },
        ],
        extendToWaypoints: true,
        missingRouteTolerance: 0,
      },
      router: L.Routing.osrmv1({
        serviceUrl: 'https://router.project-osrm.org/route/v1',
        profile: 'driving',
      }),
      createMarker: () => null, // Don't create default markers
    });

    routingControl.on('routesfound', (e: any) => {
      const routes = e.routes;
      if (routes && routes.length > 0 && onRouteFound) {
        const route = routes[0];
        onRouteFound({
          distance: route.summary.totalDistance,
          duration: route.summary.totalTime,
        });
      }
    });

    routingControl.addTo(map);
    routingControlRef.current = routingControl;

    return () => {
      if (routingControlRef.current && map) {
        try {
          map.removeControl(routingControlRef.current);
        } catch (e) {
          // Ignore cleanup errors
        }
        routingControlRef.current = null;
      }
    };
  }, [map, waypoints, onRouteFound]);

  return null;
};
