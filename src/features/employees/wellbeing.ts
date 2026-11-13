export interface WellbeingPoint {
  id: string;
  meeting_date: string;
  status: string;
  mood: number | null;
  workload: number | null;
  balance: number | null;
}
export interface WellbeingThresholds { workload: number; consecutiveMeetings: number; fallingMoodOrBalance: boolean }
export const DEFAULT_WELLBEING_THRESHOLDS: WellbeingThresholds = { workload: 4, consecutiveMeetings: 2, fallingMoodOrBalance: true };

export function getWellbeingTrend(meetings: WellbeingPoint[], settings: Partial<WellbeingThresholds> = {}) {
  const config = { ...DEFAULT_WELLBEING_THRESHOLDS, ...settings };
  const points = meetings.filter(m => ["completed", "acknowledged"].includes(m.status))
    .sort((a, b) => Date.parse(a.meeting_date) - Date.parse(b.meeting_date) || a.id.localeCompare(b.id));
  const count = Math.max(2, Math.floor(config.consecutiveMeetings));
  const recent = points.slice(-count);
  const sustainedWorkload = recent.length === count && recent.every(p => p.workload !== null && p.workload >= config.workload);
  const last = points[points.length - 1], before = points[points.length - 2];
  const falling = config.fallingMoodOrBalance && !!last && !!before &&
    ((last.mood !== null && before.mood !== null && last.mood < before.mood) ||
     (last.balance !== null && before.balance !== null && last.balance < before.balance));
  return { points, sustainedWorkload, falling, needsConversation: sustainedWorkload || falling };
}
