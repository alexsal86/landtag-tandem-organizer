// Pure rules for the Redaktion planner (calendar drag & drop, crowding, image crops).
// UI and selftests import these so the behaviour stays testable in one place.

/** Default publish hour when an unscheduled post is dropped on a day. */
export const DEFAULT_PUBLISH_HOUR = 10;
/** From this many posts per day the calendar warns about a crowded day. */
export const CROWDED_DAY_THRESHOLD = 3;

/** Moves a post to another day and keeps its time of day (or 10:00 if it had none). */
export function rescheduleToDay(currentIso: string | null | undefined, targetDay: Date): Date {
  const next = new Date(targetDay);
  const current = currentIso ? new Date(currentIso) : null;
  if (current && !Number.isNaN(current.getTime())) {
    next.setHours(current.getHours(), current.getMinutes(), 0, 0);
  } else {
    next.setHours(DEFAULT_PUBLISH_HOUR, 0, 0, 0);
  }
  return next;
}

export function isCrowdedDay(postCount: number): boolean {
  return postCount >= CROWDED_DAY_THRESHOLD;
}

export interface CropFormat {
  id: "1:1" | "4:5" | "9:16" | "16:9";
  label: string;
  hint: string;
  ratio: number; // width / height
  outputWidth: number;
}

export const CROP_FORMATS: CropFormat[] = [
  { id: "1:1", label: "1:1 Quadrat", hint: "Feed", ratio: 1, outputWidth: 1080 },
  { id: "4:5", label: "4:5 Hochformat", hint: "Instagram-Feed", ratio: 4 / 5, outputWidth: 1080 },
  { id: "9:16", label: "9:16 Story", hint: "Story / Reel", ratio: 9 / 16, outputWidth: 1080 },
  { id: "16:9", label: "16:9 Quer", hint: "LinkedIn / X", ratio: 16 / 9, outputWidth: 1200 },
];

export interface CropRect { sx: number; sy: number; sw: number; sh: number }

/**
 * Largest crop of the given ratio that fits the source, centred on the focus point
 * (focusX/focusY in 0..1) and clamped to the image bounds.
 */
export function computeCropRect(srcW: number, srcH: number, ratio: number, focusX = 0.5, focusY = 0.5): CropRect {
  let sw = srcW;
  let sh = sw / ratio;
  if (sh > srcH) {
    sh = srcH;
    sw = sh * ratio;
  }
  const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), max);
  const sx = clamp(focusX * srcW - sw / 2, srcW - sw);
  const sy = clamp(focusY * srcH - sh / 2, srcH - sh);
  return { sx: Math.round(sx), sy: Math.round(sy), sw: Math.round(sw), sh: Math.round(sh) };
}

/** Text shown for a channel: its own caption, otherwise the master text. */
export function effectiveCaption(channelCaption: string | null | undefined, masterText: string): string {
  return channelCaption && channelCaption.trim() ? channelCaption : masterText;
}

/** Only topic IDs and the explicitly selected local time are transferred by drag and drop. */
export const PLANNER_TOPIC_MIME = "application/x-redaktion-topic";

export function parseTopicDrop(raw: string, day: Date): { topicId: string; scheduledFor: Date } | null {
  try {
    const payload: unknown = JSON.parse(raw);
    if (!payload || typeof payload !== "object" || !("topicId" in payload) || !("time" in payload)) return null;
    if (typeof payload.topicId !== "string" || !payload.topicId.trim() || typeof payload.time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(payload.time)) return null;
    const [hours, minutes] = payload.time.split(":").map(Number);
    const scheduledFor = new Date(day);
    scheduledFor.setHours(hours, minutes, 0, 0);
    if (Number.isNaN(scheduledFor.getTime())) return null;
    return { topicId: payload.topicId, scheduledFor };
  } catch {
    return null;
  }
}
