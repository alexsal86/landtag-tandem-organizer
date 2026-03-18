// React 19 + recharts class component JSX compatibility shim
import type { ComponentType } from 'react';

declare module 'recharts' {
  // These components are class-based in recharts but need to work as JSX in React 19
  export const Legend: ComponentType<any>;
  export const XAxis: ComponentType<any>;
  export const YAxis: ComponentType<any>;
  export const Tooltip: ComponentType<any>;
  export const CartesianGrid: ComponentType<any>;
  export const Bar: ComponentType<any>;
  export const Line: ComponentType<any>;
  export const Area: ComponentType<any>;
  export const Pie: ComponentType<any>;
  export const Cell: ComponentType<any>;
  export const ResponsiveContainer: ComponentType<any>;
  export const BarChart: ComponentType<any>;
  export const LineChart: ComponentType<any>;
  export const AreaChart: ComponentType<any>;
  export const PieChart: ComponentType<any>;
  export const RadarChart: ComponentType<any>;
  export const Radar: ComponentType<any>;
  export const PolarGrid: ComponentType<any>;
  export const PolarAngleAxis: ComponentType<any>;
  export const PolarRadiusAxis: ComponentType<any>;
}
