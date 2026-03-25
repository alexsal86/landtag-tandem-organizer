import 'leaflet';

declare module 'leaflet-routing-machine';
declare module 'leaflet.heat';

declare module 'leaflet' {
  interface RoutingRouteSummary {
    totalDistance: number;
    totalTime: number;
  }

  interface RoutingRoute {
    summary: RoutingRouteSummary;
  }

  interface RoutingRoutesFoundEvent {
    routes: RoutingRoute[];
  }

  interface RoutingControl extends Control {
    on(type: 'routesfound', fn: (event: RoutingRoutesFoundEvent) => void): this;
  }

  interface RoutingStatic {
    control(options: Record<string, unknown>): RoutingControl;
    osrmv1(options: { serviceUrl: string; profile: string }): unknown;
  }

  function heatLayer(
    latlngs: Array<[number, number, number]>,
    options?: {
      radius?: number;
      blur?: number;
      maxZoom?: number;
      max?: number;
      minOpacity?: number;
      gradient?: Record<number, string>;
    },
  ): Layer;

  namespace Routing {
    const control: RoutingStatic['control'];
    const osrmv1: RoutingStatic['osrmv1'];
  }
}
