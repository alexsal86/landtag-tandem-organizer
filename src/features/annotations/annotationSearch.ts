import { plainAnnotationComment } from "./mentions";
import type { AnnotationColor, DocumentAnnotation } from "./types";

export function searchAnnotationThreads(
  rows: DocumentAnnotation[],
  roots: DocumentAnnotation[],
  query: string,
  color: AnnotationColor | "",
  author: string,
): DocumentAnnotation[] {
  const needle = query.trim().toLocaleLowerCase("de");
  return roots.filter(
    (root) =>
      (!color || root.color === color) &&
      (!author || root.created_by === author) &&
      (!needle ||
        rows.some(
          (row) =>
            (row.id === root.id || row.parent_id === root.id) &&
            `${plainAnnotationComment(row.content)} ${row.quote_text ?? ""}`
              .toLocaleLowerCase("de")
              .includes(needle),
        )),
  );
}

export function nextAnnotationId(
  ids: string[],
  current: string | null,
  direction: 1 | -1,
): string | null {
  if (!ids.length) return null;
  const index = current ? ids.indexOf(current) : -1;
  return ids[
    index < 0
      ? direction === 1
        ? 0
        : ids.length - 1
      : (index + direction + ids.length) % ids.length
  ];
}
