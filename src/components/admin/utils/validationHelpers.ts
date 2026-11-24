import { supabase } from "@/integrations/supabase/client";
import { ARBZG_MAX_DAILY_WORK_MINUTES, summarizeArbzgDay, type ArbzgDaySummary } from "@/features/timetracking/arbzg";
import { fmt } from "./timeFormatting";

/**
 * Prüft den gesamten Arbeitstag statt nur den einzelnen Eintrag: Die
 * 10-Stunden-Grenze gilt für die tatsächlich geleistete Arbeit ohne Pausen,
 * die Pausenpflicht (30/45 Minuten) für die Summe des Tages.
 */
export async function validateDay({
  userId,
  workDate,
  startedAt,
  endedAt,
  pauseMinutes,
  excludeEntryId,
}: {
  userId: string;
  workDate: string;
  startedAt: Date;
  endedAt: Date;
  pauseMinutes: number;
  excludeEntryId?: string;
}): Promise<ArbzgDaySummary> {
  const { data, error } = await supabase
    .from("time_entries")
    .select("id, started_at, ended_at, pause_minutes")
    .eq("user_id", userId)
    .eq("work_date", workDate);

  if (error) throw error;

  const day = summarizeArbzgDay([
    ...(data || []).filter(entry => entry.id !== excludeEntryId),
    { started_at: startedAt.toISOString(), ended_at: endedAt.toISOString(), pause_minutes: pauseMinutes },
  ]);

  if (day.workedMinutes > ARBZG_MAX_DAILY_WORK_MINUTES) {
    throw new Error(
      `Maximal 10:00 Stunden Arbeitszeit pro Tag (ohne Pausen) erlaubt. Mit diesem Eintrag: ${fmt(day.workedMinutes)}.`,
    );
  }

  return day;
}
