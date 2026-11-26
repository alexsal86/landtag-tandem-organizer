// ─── DIN A4 constants ────────────────────────────────────────────────────────
export const PAGE_W_MM = 210;
export const PAGE_H_MM = 297;
export const MARGIN_L_MM = 25;
export const MARGIN_R_MM = 20;
export const CONTENT_W_MM = PAGE_W_MM - MARGIN_L_MM - MARGIN_R_MM; // 165 mm

// 1 mm = 3.7795 px @ 96 dpi
export const MM_TO_PX = 3.7795;
export const mmToPx = (mm: number) => mm * MM_TO_PX;
export const pxToMm = (px: number) => px / MM_TO_PX;
