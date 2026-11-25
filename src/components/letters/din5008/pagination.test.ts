import { describe, expect, it } from 'vitest';
import { computePageBreaks } from './pagination';

const LINE_HEIGHT_MM = 4.5;
const PAGE1_BODY_MM = 137.42; // contentBottom 259.54 - contentTop 122.12
const PAGE_N_BODY_MM = 234.54; // contentBottom 259.54 - page2Top 25

/** Line bottoms as the preview measures them: exact multiples of the grid. */
const gridBreaks = (lines: number, lineHeightMm = LINE_HEIGHT_MM): number[] =>
  Array.from({ length: lines }, (_, index) => (index + 1) * lineHeightMm);

describe('computePageBreaks', () => {
  it('returns no offsets for an empty flow', () => {
    expect(computePageBreaks([], PAGE1_BODY_MM, PAGE_N_BODY_MM, LINE_HEIGHT_MM)).toEqual([]);
  });

  it('keeps content that fits in one page on a single page', () => {
    const breaks = gridBreaks(24, LINE_HEIGHT_MM); // 108 mm of 137.42 mm
    expect(computePageBreaks(breaks, PAGE1_BODY_MM, PAGE_N_BODY_MM, LINE_HEIGHT_MM)).toEqual([0]);
  });

  it('does not add an empty follow page for a sub-line remainder', () => {
    // 111.3 mm fits on page 1, but the old snapping left 3.3 mm and started page 2.
    const breaks = [...gridBreaks(24, LINE_HEIGHT_MM), 111.3];
    expect(computePageBreaks(breaks, PAGE1_BODY_MM, PAGE_N_BODY_MM, LINE_HEIGHT_MM)).toEqual([0]);
  });

  it('breaks on the line grid once the content no longer fits', () => {
    const breaks = gridBreaks(40, LINE_HEIGHT_MM); // 180 mm, page 1 holds 137.42 mm
    const offsets = computePageBreaks(breaks, PAGE1_BODY_MM, PAGE_N_BODY_MM, LINE_HEIGHT_MM);

    expect(offsets).toEqual([0, 135]);
    offsets.slice(1).forEach((offset) => expect(offset % LINE_HEIGHT_MM).toBeCloseTo(0, 6));
  });

  it('uses the stored line height as the grid', () => {
    const lineHeightMm = 5.2;
    const breaks = gridBreaks(14, lineHeightMm); // 72.8 mm
    const offsets = computePageBreaks(breaks, 60, 60, lineHeightMm);

    expect(offsets).toEqual([0, 57.2]);
  });

  it('never produces a page without content when the last line fills the page exactly', () => {
    const breaks = gridBreaks(30, LINE_HEIGHT_MM); // 135 mm
    const offsets = computePageBreaks(breaks, PAGE1_BODY_MM, PAGE_N_BODY_MM, LINE_HEIGHT_MM);

    expect(offsets).toEqual([0]);
  });
});
