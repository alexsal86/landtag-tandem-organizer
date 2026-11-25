import { describe, expect, it } from 'vitest';
import { computeLetterHeaderMetrics, MM_PER_PT } from './headerMetrics';

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
