import type { FracRect } from "./types";
export interface OcrWord {
  text: string;
  rect: FracRect;
  confidence: number;
}
export function ocrWord(
  text: string,
  box: { x0: number; y0: number; x1: number; y1: number },
  width: number,
  height: number,
  confidence: number,
): OcrWord | null {
  if (
    ![box.x0, box.y0, box.x1, box.y1, width, height].every(Number.isFinite) ||
    !text.trim() ||
    width <= 0 ||
    height <= 0 ||
    box.x1 <= box.x0 ||
    box.y1 <= box.y0
  )
    return null;
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  const x = clamp(box.x0 / width),
    y = clamp(box.y0 / height);
  return {
    text,
    confidence,
    rect: {
      x,
      y,
      w: Math.max(0, clamp(box.x1 / width) - x),
      h: Math.max(0, clamp(box.y1 / height) - y),
    },
  };
}
