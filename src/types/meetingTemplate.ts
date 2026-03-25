export interface MeetingTemplateChildItem {
  title: string;
  order_index: number;
  type?: string;
  is_available?: boolean;
  is_optional?: boolean;
  system_type?: string;
}

export interface MeetingTemplateItem {
  title: string;
  order_index: number;
  type?: string;
  system_type?: string;
  children?: MeetingTemplateChildItem[];
}

export interface MeetingTemplateRecord {
  id: string;
  name: string;
  description: string | null;
  template_items: MeetingTemplateItem[] | null;
  is_default?: boolean;
  default_participants?: Record<string, unknown>[];
  default_recurrence?: Record<string, unknown> | null;
  auto_create_count?: number;
  default_visibility?: string;
}

export const isMeetingTemplateChildItem = (value: unknown): value is MeetingTemplateChildItem =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as MeetingTemplateChildItem).title === 'string' &&
  typeof (value as MeetingTemplateChildItem).order_index === 'number';
