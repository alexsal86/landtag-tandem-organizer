// React 19 + recharts class component JSX compatibility shim
import type { ComponentType, ReactNode } from 'react';

type RechartsDataPoint = Record<string, unknown>;

interface BaseRechartsProps {
  children?: ReactNode;
  className?: string;
}

interface ResponsiveContainerProps extends BaseRechartsProps {
  width?: string | number;
  height?: string | number;
  minWidth?: string | number;
  minHeight?: string | number;
  debounce?: number;
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
  label?: ReactNode | ((props: unknown) => ReactNode);
}

interface CellProps extends BaseRechartsProps {
  fill?: string;
}

interface TooltipProps extends BaseRechartsProps {
  formatter?: (
    value: unknown,
    name: unknown,
    item: unknown,
    index: number,
    payload: unknown
  ) => ReactNode;
}

interface LegendPayloadItem {
  value?: string | number;
  color?: string;
  dataKey?: string | number;
  payload?: RechartsDataPoint;
}

interface LegendProps extends BaseRechartsProps {
  verticalAlign?: 'top' | 'middle' | 'bottom';
  payload?: LegendPayloadItem[];
}

interface CartesianAxisProps extends BaseRechartsProps {
  dataKey?: string | ((entry: RechartsDataPoint) => unknown);
}

interface BarProps extends BaseRechartsProps {
  dataKey?: string | ((entry: RechartsDataPoint) => unknown);
  fill?: string;
}

interface LineProps extends BaseRechartsProps {
  dataKey?: string | ((entry: RechartsDataPoint) => unknown);
  stroke?: string;
}

declare module 'recharts' {
  export const Legend: ComponentType<LegendProps>;
  export const XAxis: ComponentType<CartesianAxisProps>;
  export const YAxis: ComponentType<CartesianAxisProps>;
  export const Tooltip: ComponentType<TooltipProps>;
  export const CartesianGrid: ComponentType<BaseRechartsProps>;
  export const Bar: ComponentType<BarProps>;
  export const Line: ComponentType<LineProps>;
  export const Pie: ComponentType<PieProps>;
  export const Cell: ComponentType<CellProps>;
  export const ResponsiveContainer: ComponentType<ResponsiveContainerProps>;
  export const BarChart: ComponentType<BaseRechartsProps>;
  export const LineChart: ComponentType<BaseRechartsProps>;
  export const PieChart: ComponentType<BaseRechartsProps>;
}
