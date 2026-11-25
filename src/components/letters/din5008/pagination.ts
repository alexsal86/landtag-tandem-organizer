/**
 * Page break computation for the letter body flow.
 *
 * The preview lays out body lines on a grid of `layout.content.lineHeight`, so
 * line positions and page capacities share one unit. A page break is only
 * inserted when content actually remains beyond it: a remainder that is only
 * grid rounding or a trailing margin must not spawn an empty follow page.
 */
const EPSILON_MM = 0.01;

export function computePageBreaks(
  breaks: number[],
  page1BodyMm: number,
  pageNBodyMm: number,
  lineHeightMm: number,
): number[] {
  if (breaks.length === 0) return [];

  const lastBreak = breaks[breaks.length - 1] ?? 0;
  // pageOffsets[i] = the flow offset (mm) where page i starts.
  const pageOffsets: number[] = [0];
  let consumed = 0;

  while (consumed < lastBreak) {
    const isFirst = pageOffsets.length === 1;
    const capacity = isFirst ? page1BodyMm : pageNBodyMm;
    const limit = consumed + capacity;

    let bestBreak = consumed;

    if (lastBreak <= limit + EPSILON_MM) {
      // Everything that is left fits on this page. Do not snap to the grid here:
      // that would leave a sub-line remainder and create an empty next page.
      bestBreak = lastBreak;
    } else {
      for (const candidate of breaks) {
        if (candidate <= consumed) continue;
        if (candidate <= limit + 0.1) {
          bestBreak = candidate;
        } else {
          break;
        }
      }

      // Single block taller than a page: force-advance instead of looping.
      if (bestBreak <= consumed) bestBreak = limit;

      // End the page flush with a complete line of the shared grid.
      if (lineHeightMm > 0) {
        bestBreak = Math.floor(bestBreak / lineHeightMm) * lineHeightMm;
        if (bestBreak <= consumed) bestBreak = consumed + lineHeightMm;
      }
    }

    if (lastBreak - bestBreak <= EPSILON_MM) break;

    consumed = bestBreak;
    pageOffsets.push(consumed);
  }

  return pageOffsets;
}
