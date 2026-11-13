import { normalizedText, uniqueTextAnchor } from "./textAnchors";
import { textHighlightDraft } from "./textHighlights";
import { toFracRect } from "./annotationModel";
import type {
  AnnotationTextPage,
  DocumentAnnotation,
  DraftAnnotation,
} from "./types";

/** Read-only suggestion. Whole PDF text runs are used as reviewable bounds; caller must confirm. */
export async function suggestTextLocation(
  data: ArrayBuffer,
  annotation: DocumentAnnotation,
): Promise<DraftAnnotation | null> {
  const pdfjs = await import("@/lib/pdfjs");
  const task = pdfjs.getDocument({ data: data.slice(0) });
  try {
    const pdf = await task.promise;
    const pages = await Promise.all(
      Array.from({ length: pdf.numPages }, async (_, index) => {
        const page = await pdf.getPage(index + 1),
          viewport = page.getViewport({ scale: 1 }),
          content = await page.getTextContent();
        const items = content.items.filter(
          (item): item is Extract<typeof item, { str: string }> =>
            "str" in item && !!normalizedText(item.str),
        );
        return {
          page_number: index + 1,
          viewport,
          items,
          text: items.map((item) => normalizedText(item.str)).join(" "),
        };
      }),
    );
    const quotes = annotation.target_selector.pages?.map(
      (page) => page.quote_text,
    ) ?? [annotation.quote_text ?? ""];
    const selected: AnnotationTextPage[] = [];
    for (const quote of quotes) {
      const candidates = pages.flatMap((page) => {
        const match = uniqueTextAnchor(page.text, quote);
        return match ? [{ page, match }] : [];
      });
      // Also reject two matches on a page (uniqueTextAnchor null) rather than choose another page.
      const occurrences = pages.reduce((count, page) => {
        const needle = normalizedText(quote);
        if (!needle) return count;
        let start = 0;
        while ((start = page.text.indexOf(needle, start)) >= 0) {
          count++;
          start++;
        }
        return count;
      }, 0);
      if (candidates.length !== 1 || occurrences !== 1) return null;
      const { page, match } = candidates[0];
      let offset = 0;
      const rects = page.items.flatMap((item) => {
        const length = normalizedText(item.str).length,
          start = offset;
        offset += length + 1;
        if (start + length <= match.start || start >= match.end) return [];
        const transform = pdfjs.Util.transform(
          page.viewport.transform,
          item.transform,
        );
        const height = Math.hypot(transform[2], transform[3]) || item.height;
        const width = item.width;
        const angle = Math.atan2(transform[1], transform[0]);
        // Bounds include the complete intersecting text run; no fabricated character precision.
        const x = transform[4],
          y = transform[5];
        const corners = [
          { x, y },
          { x: x + width * Math.cos(angle), y: y + width * Math.sin(angle) },
          { x: x + height * Math.sin(angle), y: y - height * Math.cos(angle) },
          {
            x: x + width * Math.cos(angle) + height * Math.sin(angle),
            y: y + width * Math.sin(angle) - height * Math.cos(angle),
          },
        ];
        return [
          toFracRect(
            {
              x: Math.min(...corners.map((p) => p.x)),
              y: Math.min(...corners.map((p) => p.y)),
            },
            {
              x: Math.max(...corners.map((p) => p.x)),
              y: Math.max(...corners.map((p) => p.y)),
            },
            page.viewport.width,
            page.viewport.height,
          ),
        ];
      });
      const existing = selected.find((p) => p.page_number === page.page_number);
      if (existing) {
        existing.rects.push(...rects);
        existing.quote_text += `\n${quote}`;
      } else
        selected.push({
          page_number: page.page_number,
          rects,
          quote_text: quote,
        });
    }
    return textHighlightDraft(selected);
  } finally {
    await task.destroy();
  }
}
