import type { DashboardLayout, DashboardWidget } from '@/types/dashboardWidgets';
import type { ComponentType } from 'react';

export interface DashboardWidgetSuggestion {
  id: string;
  type: 'widget' | 'layout' | 'optimization' | 'workflow';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  action: string;
  icon: ComponentType;
  reason: string;
  timeContext?: string;
  widgetType?: DashboardWidget['type'];
  confidence: number;
}

export interface DashboardPresenceUser {
  user_id: string;
  email?: string;
  avatar_url?: string;
  cursor_position?: { x: number; y: number };
}

export type DashboardPresenceState = Record<string, DashboardPresenceUser[]>;

export interface LayoutUpdatePayload {
  layout: DashboardLayout;
  user_id?: string;
  user_email?: string;
  timestamp?: number;
}

export interface WidgetUpdatePayload {
  user_id?: string;
  widget: DashboardWidget;
}

export interface CursorUpdatePayload {
  user_id?: string;
  position: { x: number; y: number };
}

export interface DatabaseLayoutUpdatePayload {
  new: {
    owner_id?: string;
    layout_data?: DashboardLayout;
  };
}

export interface BroadcastPayloadEnvelope<TPayload> {
  payload: TPayload;
}
