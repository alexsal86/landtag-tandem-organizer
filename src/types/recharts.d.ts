// React 19 + recharts JSX compatibility shim
import type { ComponentType, ReactNode } from 'react';

type RechartsDataPoint = Record<string, unknown>;
type RechartsPrimitive = string | number;

type RechartsFormatterResult = ReactNode | [ReactNode, ReactNode];

interface BaseRechartsProps {
  children?: ReactNode;
  className?: string;
  strokeDasharray?: string;
  vertical?: boolean;
  horizontal?: boolean;
  [key: string]: unknown;
}

interface ResponsiveContainerProps extends BaseRechartsProps {
  width?: string | number;
  height?: string | number;
  minWidth?: string | number;
  minHeight?: string | number;
  debounce?: number;
}

interface PieLabelInput {
  percent?: number;
  name?: RechartsPrimitive;
  value?: RechartsPrimitive;
  payload?: RechartsDataPoint;
}

interface PieProps extends BaseRechartsProps {
  data?: RechartsDataPoint[];
  dataKey?: string | ((entry: RechartsDataPoint) => unknown);
  cx?: string | number;
  cy?: string | number;
  innerRadius?: string | number;
  outerRadius?: string | number;
  paddingAngle?: number;
  fill?: string;
  labelLine?: boolean;
  label?: ReactNode | ((props: PieLabelInput) => ReactNode);
  animationBegin?: number;
  animationDuration?: number;
}

interface CellProps extends BaseRechartsProps {
  fill?: string;
}

interface TooltipPayloadItem {
  name?: RechartsPrimitive;
  value?: RechartsPrimitive;
  color?: string;
  dataKey?: RechartsPrimitive;
  payload?: RechartsDataPoint;
}

interface LegendPayloadItem {
  value?: RechartsPrimitive;
  color?: string;
  dataKey?: RechartsPrimitive;
  payload?: RechartsDataPoint;
}

interface CartesianAxisProps extends BaseRechartsProps {
  dataKey?: string | ((entry: RechartsDataPoint) => unknown);
  tickLine?: boolean;
  axisLine?: boolean;
  tickFormatter?: (value: unknown, index?: number) => string;
  width?: number;
  hide?: boolean;
  domain?: [number, number];
  ticks?: number[];
  type?: string;
  unit?: RechartsPrimitive;
  name?: RechartsPrimitive;
  tick?: object;
  allowDecimals?: boolean;
  label?: ReactNode | object;
}

interface BarProps extends BaseRechartsProps {
  label?: boolean | {
    position?: "top";
    fill?: string;
    fontSize?: number;
    formatter?: (value: unknown) => ReactNode;
  };
  dataKey?: string | ((entry: RechartsDataPoint) => unknown);
  fill?: string;
  name?: RechartsPrimitive;
  stackId?: string | number;
}

interface LineProps extends BaseRechartsProps {
  dataKey?: string | ((entry: RechartsDataPoint) => unknown);
  stroke?: string;
  type?: string;
  name?: string;
  connectNulls?: boolean;
  strokeWidth?: number;
}

interface ChartWrapperProps extends BaseRechartsProps {
  data?: unknown[];
  layout?: string;
  margin?: { left?: number; right?: number; top?: number; bottom?: number };
}

declare module 'recharts' {
  export interface TooltipProps extends import('react').Attributes {
    labelFormatter?: (label: unknown) => import('react').ReactNode;
    children?: ReactNode;
    className?: string;
    content?: ReactNode | ((props: { active?: boolean; payload?: TooltipPayloadItem[]; label?: unknown }) => ReactNode);
    cursor?: boolean | object;
    formatter?: (
      value: unknown,
      name: unknown,
      item: TooltipPayloadItem,
      index: number,
      payload: unknown
    ) => RechartsFormatterResult | unknown;
    [key: string]: unknown;
  }

  export interface LegendProps extends import('react').Attributes {
    children?: ReactNode;
    className?: string;
    verticalAlign?: 'top' | 'middle' | 'bottom';
    payload?: LegendPayloadItem[];
    [key: string]: unknown;
  }

  export const Legend: ComponentType<LegendProps>;
  export const XAxis: ComponentType<CartesianAxisProps>;
  export const YAxis: ComponentType<CartesianAxisProps>;
  export const Tooltip: ComponentType<TooltipProps>;
  export const CartesianGrid: ComponentType<BaseRechartsProps>;
  export const Bar: ComponentType<BarProps>;
  export const Line: ComponentType<LineProps>;
  export const Area: ComponentType<LineProps & { fill?: string }>;
  export const Pie: ComponentType<PieProps>;
  export const Cell: ComponentType<CellProps>;
  export const ResponsiveContainer: ComponentType<ResponsiveContainerProps>;
  export const BarChart: ComponentType<ChartWrapperProps>;
  export const LineChart: ComponentType<ChartWrapperProps>;
  export const AreaChart: ComponentType<ChartWrapperProps>;
  export const PieChart: ComponentType<ChartWrapperProps>;
}
