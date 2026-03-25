import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import { Waypoint } from './RoutePlannerPanel';
import type { GeoPoint } from '@/hooks/geoContracts';

// Import leaflet-routing-machine after L is available
// @ts-ignore
import 'leaflet-routing-machine';

interface RouteSummaryContract {
  totalDistance: number;
  totalTime: number;
}

interface RouteContract {
  summary: RouteSummaryContract;
}

interface RoutesFoundEventContract {
  routes: RouteContract[];
}

interface RoutingControlContract {
  on(event: 'routesfound', handler: (event: RoutesFoundEventContract) => void): void;
  addTo(map: L.Map): void;
}

interface RoutingFactoryContract {
  osrmv1(config: { serviceUrl: string; profile: 'driving' }): unknown;
  control(config: {
    waypoints: L.LatLng[];
    routeWhileDragging: boolean;
    showAlternatives: boolean;
    fitSelectedRoutes: boolean;
    addWaypoints: boolean;
    show: boolean;
    lineOptions: {
      styles: Array<{ color: string; weight: number; opacity: number }>;
      extendToWaypoints: boolean;
      missingRouteTolerance: number;
    };
    router: unknown;
    createMarker: () => null;
  }): RoutingControlContract;
}

type LeafletWithRouting = typeof L & { Routing?: RoutingFactoryContract };

const getRoutingFactory = (): RoutingFactoryContract | null => {
  const routing = (L as LeafletWithRouting).Routing;
  return routing ?? null;
};

interface RoutingMachineProps {
  map: L.Map | null;
  waypoints: Waypoint[];
  onRouteFound?: (info: { distance: number; duration: number }) => void;
}

export const RoutingMachine = ({ map, waypoints, onRouteFound }: RoutingMachineProps) => {
  const routingControlRef = useRef<RoutingControlContract | null>(null);

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

    const routingFactory = getRoutingFactory();
    if (!routingFactory) {
      return;
    }

    const latLngs = waypoints.map((wp: GeoPoint) => L.latLng(wp.lat, wp.lng));

    const routingControl = routingFactory.control({
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
      router: routingFactory.osrmv1({
        serviceUrl: 'https://router.project-osrm.org/route/v1',
        profile: 'driving',
      }),
      createMarker: () => null, // Don't create default markers
    });

    routingControl.on('routesfound', (e) => {
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
