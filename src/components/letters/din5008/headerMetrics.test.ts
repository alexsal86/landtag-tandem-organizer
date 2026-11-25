import { describe, expect, it } from 'vitest';
import {
  bodyLineHeightCss,
  computeLetterHeaderMetrics,
  DEFAULT_BODY_LINE_HEIGHT_MM,
  MM_PER_PT,
  resolveBodyLineHeightMm,
  resolveBodyParagraphGapMm,
  resolvePage2TopMm,
} from './headerMetrics';

const SUBJECT_TOP_MM = 98.46;
const SUBJECT_LINE_HEIGHT_MM = 13 * MM_PER_PT * 1.2;
const SALUTATION_LINE_HEIGHT_MM = 11 * MM_PER_PT * 1.2;
const GAP_AFTER_SUBJECT_MM = 9;
const GAP_AFTER_SALUTATION_MM = 4.5;

const closeTo = (actual: number, expected: number) => expect(actual).toBeCloseTo(expected, 6);

describe('computeLetterHeaderMetrics', () => {
  it('places the salutation and content after a single-line subject', () => {
    const metrics = computeLetterHeaderMetrics({ subjectLines: 1, salutationLines: 1 });

    closeTo(metrics.subjectTopMm, SUBJECT_TOP_MM);
    closeTo(metrics.subjectLineHeightMm, SUBJECT_LINE_HEIGHT_MM);
    closeTo(metrics.subjectHeightMm, SUBJECT_LINE_HEIGHT_MM);
    closeTo(metrics.salutationTopMm, SUBJECT_TOP_MM + SUBJECT_LINE_HEIGHT_MM + GAP_AFTER_SUBJECT_MM);
    closeTo(metrics.salutationHeightMm, SALUTATION_LINE_HEIGHT_MM);
    closeTo(
      metrics.contentTopMm,
      SUBJECT_TOP_MM +
        SUBJECT_LINE_HEIGHT_MM +
        GAP_AFTER_SUBJECT_MM +
        SALUTATION_LINE_HEIGHT_MM +
        GAP_AFTER_SALUTATION_MM,
    );
    closeTo(metrics.contentTopMm, 122.12064);
  });

  it('moves the content down by one extra subject line for a two-line subject', () => {
    const oneLine = computeLetterHeaderMetrics({ subjectLines: 1, salutationLines: 1 });
    const twoLines = computeLetterHeaderMetrics({ subjectLines: 2, salutationLines: 1 });

    closeTo(twoLines.subjectHeightMm, 2 * SUBJECT_LINE_HEIGHT_MM);
    closeTo(twoLines.salutationTopMm, oneLine.salutationTopMm + SUBJECT_LINE_HEIGHT_MM);
    closeTo(twoLines.contentTopMm, oneLine.contentTopMm + SUBJECT_LINE_HEIGHT_MM);
    closeTo(twoLines.contentTopMm, 127.62432);
  });

  it('skips the salutation gap and height when no salutation is rendered', () => {
    const metrics = computeLetterHeaderMetrics({ subjectLines: 1, salutationLines: 0 });

    expect(metrics.salutationHeightMm).toBe(0);
    expect(metrics.gapAfterSalutationMm).toBe(0);
    closeTo(metrics.contentTopMm, metrics.salutationTopMm);
    closeTo(metrics.contentTopMm, SUBJECT_TOP_MM + SUBJECT_LINE_HEIGHT_MM + GAP_AFTER_SUBJECT_MM);
  });

  it('starts the content at the subject top when there is neither subject nor salutation', () => {
    const metrics = computeLetterHeaderMetrics({ subjectLines: 0, salutationLines: 0 });

    expect(metrics.subjectHeightMm).toBe(0);
    expect(metrics.gapAfterSubjectMm).toBe(0);
    closeTo(metrics.salutationTopMm, SUBJECT_TOP_MM);
    closeTo(metrics.contentTopMm, SUBJECT_TOP_MM);
  });

  it('uses the stored body line height for the shared page grid', () => {
    const layout = { content: { top: 98.46, maxHeight: 165, lineHeight: 5.2 } };

    expect(resolveBodyLineHeightMm(layout)).toBe(5.2);
  });

  it('falls back to the DIN default when no usable body line height is stored', () => {
    expect(resolveBodyLineHeightMm(null)).toBe(DEFAULT_BODY_LINE_HEIGHT_MM);
    expect(resolveBodyLineHeightMm({ content: { top: 98.46, maxHeight: 165, lineHeight: 0 } }))
      .toBe(DEFAULT_BODY_LINE_HEIGHT_MM);
  });

  it('uses one page-2 top edge for preview and PDF', () => {
    expect(resolvePage2TopMm({ content: { top: 98.46, maxHeight: 165, lineHeight: 4.5, page2TopMm: 32 } })).toBe(32);
    expect(resolvePage2TopMm({
      content: { top: 98.46, maxHeight: 165, lineHeight: 4.5 },
      margins: { left: 25, right: 20, top: 45, bottom: 25 },
    })).toBe(45);
    expect(resolvePage2TopMm(null)).toBe(45);
  });

  it('keeps exactly one blank line between body paragraphs', () => {
    expect(resolveBodyParagraphGapMm(4.5)).toBe(4.5);
    expect(resolveBodyParagraphGapMm(5.2)).toBe(5.2);
  });

  it('converts the stored pitch into a CSS line height that reproduces it', () => {
    const ratio = bodyLineHeightCss(4.5, 11);

    closeTo(ratio, 4.5 / (11 * MM_PER_PT));
    closeTo(ratio * 11 * MM_PER_PT, 4.5);
  });

  it('prefers measured DOM heights over the line-count estimate', () => {
    const metrics = computeLetterHeaderMetrics({
      subjectLines: 2,
      salutationLines: 1,
      subjectHeightMm: 13.5,
      salutationHeightMm: 6,
    });

    closeTo(metrics.subjectHeightMm, 13.5);
    closeTo(metrics.salutationHeightMm, 6);
    closeTo(metrics.salutationTopMm, SUBJECT_TOP_MM + 13.5 + GAP_AFTER_SUBJECT_MM);
    closeTo(metrics.contentTopMm, SUBJECT_TOP_MM + 13.5 + GAP_AFTER_SUBJECT_MM + 6 + GAP_AFTER_SALUTATION_MM);
  });
});
