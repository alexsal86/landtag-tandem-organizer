import { DEFAULT_SPECIAL_DAYS, parseSpecialDaysSetting, type SpecialDay } from "@/utils/dashboard/specialDays";
import { supabase } from "@/integrations/supabase/client";

export async function fetchSpecialDays(tenantId: string | undefined): Promise<SpecialDay[]> {
  try {
    let query = supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "dashboard_special_day_hints")
      .limit(1);

    query = tenantId ? query.eq("tenant_id", tenantId) : query.is("tenant_id", null);

    const { data } = await query.maybeSingle();
    return parseSpecialDaysSetting(data?.setting_value) || DEFAULT_SPECIAL_DAYS;
  } catch {
    return DEFAULT_SPECIAL_DAYS;
  }
}
