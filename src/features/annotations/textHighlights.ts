import type {
  AnnotationSelector,
  AnnotationTextPage,
  DocumentAnnotation,
  DraftAnnotation,
} from "./types";

export function textHighlightDraft(
  pages: AnnotationTextPage[],
): DraftAnnotation | null {
  const selected = pages
    .filter((page) => page.rects.length && page.quote_text.trim())
    .sort((a, b) => a.page_number - b.page_number);
  if (!selected.length) return null;
  return {
    annotation_type: "highlight",
    page_number: selected[0].page_number,
    target_selector: {
      rects: selected[0].rects,
      ...(selected.length > 1 ? { pages: selected } : {}),
    },
    quote_text: selected
      .map((page) => page.quote_text)
      .join("\n\n")
      .slice(0, 2000),
  };
}

export function highlightOnPage<T extends DraftAnnotation>(
  annotation: T,
  pageNumber: number,
): T | null {
  if (
    annotation.annotation_type === "highlight" &&
    annotation.target_selector.pages?.length
  ) {
    const page = annotation.target_selector.pages.find(
      (p) => p.page_number === pageNumber,
    );
    return page
      ? {
          ...annotation,
          page_number: pageNumber,
          target_selector: { rects: page.rects },
          quote_text: page.quote_text,
        }
      : null;
  }
  return annotation.page_number === pageNumber ? annotation : null;
}

/** Geometry edits on one page preserve the remaining pages and their text anchors. */
export function updateHighlightPage(
  selector: AnnotationSelector,
  pageNumber: number,
  patch: AnnotationSelector,
): AnnotationSelector {
  if (!selector.pages?.length) return patch;
  return {
    ...selector,
    ...(selector.pages[0].page_number === pageNumber
      ? { rects: patch.rects }
      : {}),
    pages: selector.pages.map((page) =>
      page.page_number === pageNumber
        ? { ...page, rects: patch.rects ?? page.rects }
        : page,
    ),
  };
}

export function annotationPageLabel(
  annotation: Pick<DocumentAnnotation, "page_number" | "target_selector">,
): string | null {
  const pages = annotation.target_selector.pages?.map(
    (page) => page.page_number,
  );
  return pages?.length
    ? `Seiten ${pages.join(", ")}`
    : annotation.page_number
      ? `Seite ${annotation.page_number}`
      : null;
}
