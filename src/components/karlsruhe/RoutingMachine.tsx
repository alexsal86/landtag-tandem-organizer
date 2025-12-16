import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import { Waypoint } from './RoutePlannerPanel';

// Import leaflet-routing-machine after L is available
// @ts-ignore
import 'leaflet-routing-machine';

// Access Routing from the global L object after import
const LRouting = (L as any).Routing;

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

    const routingControl = LRouting.control({
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
      router: LRouting.osrmv1({
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
