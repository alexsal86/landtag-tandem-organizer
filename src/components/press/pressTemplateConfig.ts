import { supabase } from '@/integrations/supabase/client';

export const PRESS_TEMPLATE_SETTINGS_KEY = 'press_templates_v1';

export interface PressTemplateConfig {
  id: string;
  name: string;
  description?: string;
  default_title?: string;
  default_excerpt?: string;
  default_content_html?: string;
  default_tags?: string;
  is_default?: boolean;
  is_active?: boolean;
  layout_settings?: any;
  header_elements?: any[];
  footer_elements?: any[];
}

export const parsePressTemplates = (rawValue?: string | null): PressTemplateConfig[] => {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const loadPressTemplates = async (tenantId: string): Promise<PressTemplateConfig[]> => {
  const { data, error } = await supabase
    .from('app_settings')
    .select('setting_value')
    .eq('tenant_id', tenantId)
    .eq('setting_key', PRESS_TEMPLATE_SETTINGS_KEY)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return parsePressTemplates(data?.setting_value);
};

export const persistPressTemplates = async (tenantId: string, templates: PressTemplateConfig[]) => {
  const serialized = JSON.stringify(templates);

  const { data: existing, error: findError } = await supabase
    .from('app_settings')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('setting_key', PRESS_TEMPLATE_SETTINGS_KEY)
    .maybeSingle();

  if (findError) {
    throw findError;
  }

  const query = existing
    ? supabase.from('app_settings').update({ setting_value: serialized }).eq('id', existing.id)
    : supabase.from('app_settings').insert({ tenant_id: tenantId, setting_key: PRESS_TEMPLATE_SETTINGS_KEY, setting_value: serialized });

  const { error } = await query;
  if (error) {
    throw error;
  }
};
