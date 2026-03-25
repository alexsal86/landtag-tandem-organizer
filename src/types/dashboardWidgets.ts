import type { Json } from '@/integrations/supabase/types';

export type WidgetSize =
  | '1x1' | '2x1' | '1x2' | '2x2' | '3x1' | '1x3' | '3x2' | '2x3' | '3x3'
  | '4x1' | '1x4' | '4x2' | '2x4' | '4x3' | '3x4' | '4x4' | '5x1' | '5x2'
  | '6x1' | '6x2' | '7x1' | '7x2' | '8x1' | '8x2';

export const DASHBOARD_WIDGET_TYPES = [
  'stats',
  'tasks',
  'schedule',
  'actions',
  'messages',
  'blackboard',
  'combined-messages',
  'quicknotes',
  'pomodoro',
  'habits',
  'calllog',
  'teamchat',
  'quickactions',
  'news',
  'appointmentfeedback',
  'stakeholder-network',
] as const;

export type DashboardWidgetType = (typeof DASHBOARD_WIDGET_TYPES)[number];

export interface DashboardWidgetConfigBase {
  theme?: string;
  refreshInterval?: number;
  showHeader?: boolean;
  compact?: boolean;
  autoSave?: boolean;
  notifications?: boolean;
  interactive?: boolean;
  animationSpeed?: number;
  cacheDuration?: number;
  maxItems?: number;
  customTitle?: string;
  customCSS?: string;
  priority?: number;
  showStreak?: boolean;
  showFollowUps?: boolean;
  showIcons?: boolean;
}

export interface DashboardQuicknotesConfig extends DashboardWidgetConfigBase {
  defaultNoteColor?: 'yellow' | 'blue' | 'green' | 'pink' | 'purple';
}

export interface DashboardPomodoroConfig extends DashboardWidgetConfigBase {
  workDuration?: number;
  breakDuration?: number;
}

export type DashboardDefaultWidgetConfig = DashboardWidgetConfigBase;

export interface WidgetConfigMap {
  stats: DashboardDefaultWidgetConfig;
  tasks: DashboardDefaultWidgetConfig;
  schedule: DashboardDefaultWidgetConfig;
  actions: DashboardDefaultWidgetConfig;
  messages: DashboardDefaultWidgetConfig;
  blackboard: DashboardDefaultWidgetConfig;
  'combined-messages': DashboardDefaultWidgetConfig;
  quicknotes: DashboardQuicknotesConfig;
  pomodoro: DashboardPomodoroConfig;
  habits: DashboardDefaultWidgetConfig;
  calllog: DashboardDefaultWidgetConfig;
  teamchat: DashboardDefaultWidgetConfig;
  quickactions: DashboardDefaultWidgetConfig;
  news: DashboardDefaultWidgetConfig;
  appointmentfeedback: DashboardDefaultWidgetConfig;
  'stakeholder-network': DashboardDefaultWidgetConfig;
}

interface DashboardWidgetBase<TType extends DashboardWidgetType> {
  id: string;
  type: TType;
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  widgetSize: WidgetSize;
  configuration?: WidgetConfigMap[TType];
  data?: Json;
}

export type DashboardWidget = {
  [TType in DashboardWidgetType]: DashboardWidgetBase<TType>;
}[DashboardWidgetType];

export interface DashboardLayout {
  id?: string;
  name: string;
  widgets: DashboardWidget[];
  isActive: boolean;
}

export const isDashboardWidgetType = (value: string): value is DashboardWidgetType =>
  DASHBOARD_WIDGET_TYPES.includes(value as DashboardWidgetType);
