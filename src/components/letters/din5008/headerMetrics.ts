import type { LetterLayoutSettings } from '@/types/letterLayout';

/** 1 typographic point in millimetres. */
export const MM_PER_PT = 0.3528;

const DEFAULT_SUBJECT_TOP_MM = 98.46;
const DEFAULT_SUBJECT_FONT_SIZE_PT = 13;
const DEFAULT_SALUTATION_FONT_SIZE_PT = 11;
const LINE_HEIGHT_FACTOR = 1.2;
const GAP_AFTER_SUBJECT_MM = 9;
const GAP_AFTER_SALUTATION_MM = 4.5;

const toPositiveNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string') {
    const match = value.trim().toLowerCase().match(/([0-9]+(?:\.[0-9]+)?)/);
    if (match) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        return value.includes('px') ? parsed * 0.75 : parsed;
      }
    }
  }
  return null;
};

export const toFontSizePt = (value: unknown, fallback: number): number =>
  toPositiveNumber(value) ?? fallback;

/**
 * Baseline offset from the top of a 1.2 line box, used when the PDF places text
 * by baseline while the preview positions the line box by its top edge. Calibri
 * and its metric-compatible Carlito share this value because Carlito's wider
 * ascent tracks Calibri's ascent plus half its line gap.
 */
export const baselineOffsetMm = (fontSizePt: number): number =>
  fontSizePt * MM_PER_PT * 0.85;

/** Body line pitch used when a template does not store layout.content.lineHeight. */
export const DEFAULT_BODY_LINE_HEIGHT_MM = 4.5;

/**
 * Line pitch (mm) of the letter body. The preview renders every body line box
 * with exactly this height and the PDF advances its baseline by it, so both sit
 * on the same vertical grid and page breaks land on the same line.
 */
export const resolveBodyLineHeightMm = (layout?: Partial<LetterLayoutSettings> | null): number =>
  toPositiveNumber(layout?.content?.lineHeight) ?? DEFAULT_BODY_LINE_HEIGHT_MM;

/** Gap between two body paragraphs: one blank line, identical in preview and PDF. */
export const resolveBodyParagraphGapMm = (lineHeightMm: number): number => lineHeightMm;

/** Top edge of the body on page 2 and later (mm); preview and PDF share it. */
export const resolvePage2TopMm = (layout?: Partial<LetterLayoutSettings> | null): number =>
  toPositiveNumber(layout?.content?.page2TopMm) ?? toPositiveNumber(layout?.margins?.top) ?? 45;

/** Unitless CSS line-height that produces the stored mm pitch for a font size. */
export const bodyLineHeightCss = (lineHeightMm: number, fontSizePt: number): number =>
  fontSizePt > 0 ? lineHeightMm / (fontSizePt * MM_PER_PT) : 1;

export interface LetterHeaderMetricsInput {
  layout?: Partial<LetterLayoutSettings> | null;
  /** Number of rendered subject lines (0 = no subject). */
  subjectLines: number;
  /** Number of rendered salutation lines (0 = no salutation). */
  salutationLines: number;
  /** Measured subject height from the DOM; falls back to lines × line height. */
  subjectHeightMm?: number | null;
  /** Measured salutation height from the DOM; falls back to lines × line height. */
  salutationHeightMm?: number | null;
}

export interface LetterHeaderMetrics {
  subjectTopMm: number;
  subjectFontSizePt: number;
  subjectLineHeightMm: number;
  subjectHeightMm: number;
  gapAfterSubjectMm: number;
  salutationTopMm: number;
  salutationFontSizePt: number;
  salutationLineHeightMm: number;
  salutationHeightMm: number;
  gapAfterSalutationMm: number;
  contentTopMm: number;
}

/**
 * Single source of truth for the vertical header block (DIN 5008):
 * subject → 2 blank lines → salutation → 1 blank line → content.
 * Preview and PDF both call this so the body starts at the same position.
 */
export function computeLetterHeaderMetrics({
  layout,
  subjectLines,
  salutationLines,
  subjectHeightMm,
  salutationHeightMm,
}: LetterHeaderMetricsInput): LetterHeaderMetrics {
  const subjectTopMm = toPositiveNumber(layout?.subject?.top) ?? DEFAULT_SUBJECT_TOP_MM;
  const subjectFontSizePt = toFontSizePt(layout?.subject?.fontSize, DEFAULT_SUBJECT_FONT_SIZE_PT);
  const subjectLineHeightMm = subjectFontSizePt * MM_PER_PT * LINE_HEIGHT_FACTOR;
  const hasSubject = subjectLines > 0;
  const resolvedSubjectHeightMm = hasSubject
    ? (subjectHeightMm ?? subjectLines * subjectLineHeightMm)
    : 0;
  const gapAfterSubjectMm = hasSubject ? GAP_AFTER_SUBJECT_MM : 0;

  const salutationTopMm = subjectTopMm + resolvedSubjectHeightMm + gapAfterSubjectMm;
  const salutationFontSizePt = toFontSizePt(layout?.salutation?.fontSize, DEFAULT_SALUTATION_FONT_SIZE_PT);
  const salutationLineHeightMm = salutationFontSizePt * MM_PER_PT * LINE_HEIGHT_FACTOR;
  const hasSalutation = salutationLines > 0;
  const resolvedSalutationHeightMm = hasSalutation
    ? (salutationHeightMm ?? salutationLines * salutationLineHeightMm)
    : 0;
  const gapAfterSalutationMm = hasSalutation ? GAP_AFTER_SALUTATION_MM : 0;

  return {
    subjectTopMm,
    subjectFontSizePt,
    subjectLineHeightMm,
    subjectHeightMm: resolvedSubjectHeightMm,
    gapAfterSubjectMm,
    salutationTopMm,
    salutationFontSizePt,
    salutationLineHeightMm,
    salutationHeightMm: resolvedSalutationHeightMm,
    gapAfterSalutationMm,
    contentTopMm: salutationTopMm + resolvedSalutationHeightMm + gapAfterSalutationMm,
  };
}
