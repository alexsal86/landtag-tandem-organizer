import { supabase } from "@/integrations/supabase/client";
import { fmt } from "./timeFormatting";

export async function validateDailyLimit(
  selectedUserId: string,
  workDate: string,
  grossMinutes: number,
  excludeEntryId?: string
): Promise<void> {
  const { data, error } = await supabase
    .from("time_entries")
    .select("id, started_at, ended_at")
    .eq("user_id", selectedUserId)
    .eq("work_date", workDate);

  if (error) throw error;

  const alreadyLogged = (data || []).reduce((sum: number, entry: { id: string; started_at?: string | null; ended_at?: string | null }) => {
    if (entry.id === excludeEntryId || !entry.started_at || !entry.ended_at) return sum;
    const duration = Math.round(
      (new Date(entry.ended_at).getTime() - new Date(entry.started_at).getTime()) / 60000
    );
    return sum + duration;
  }, 0);

  if (alreadyLogged + grossMinutes > 600) {
    throw new Error(
      `Maximal 10:00 Stunden pro Tag erlaubt. Bereits erfasst: ${fmt(alreadyLogged)}. Mit diesem Eintrag: ${fmt(alreadyLogged + grossMinutes)}.`
    );
  }
}
