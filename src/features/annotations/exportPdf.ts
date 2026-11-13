import {
  PDFDocument,
  StandardFonts,
  rgb,
  degrees,
  type PDFPage,
  type PDFFont,
} from "pdf-lib";
import { annotationNumbers } from "./annotationModel";
import { annotationPinAnchor } from "./annotationModel";
import { exportAnnotationPages, exportPoint } from "./exportModel";
import { highlightOnPage, annotationPageLabel } from "./textHighlights";
import { plainAnnotationComment } from "./mentions";
import { annotationTaskStatusLabel } from "./taskModel";
import type { DocumentAnnotation, AnnotationFileKind } from "./types";

const COLORS = {
  yellow: rgb(0.9, 0.65, 0),
  green: rgb(0.1, 0.6, 0.25),
  red: rgb(0.9, 0.15, 0.15),
  blue: rgb(0.1, 0.4, 0.9),
};
/** A new document receives copies of the original pages; storage/original bytes are never changed. */
export async function exportAnnotatedPdf(
  file: Blob,
  kind: AnnotationFileKind,
  title: string,
  annotations: DocumentAnnotation[],
  version: string,
  authorName: (id: string) => string,
): Promise<Uint8Array> {
  const output = await PDFDocument.create();
  if (kind === "pdf") {
    const source = await PDFDocument.load(await file.arrayBuffer());
    const pages = await output.copyPages(source, source.getPageIndices());
    pages.forEach((page) => output.addPage(page));
  } else {
    const bitmap = await createImageBitmap(file);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Bildexport nicht verfügbar");
      context.drawImage(bitmap, 0, 0);
      const image = await output.embedPng(canvas.toDataURL("image/png"));
      const page = output.addPage([image.width, image.height]);
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: image.width,
        height: image.height,
      });
    } finally {
      bitmap.close();
    }
  }
  const font = await output.embedFont(StandardFonts.Helvetica);
  const safe = (text: string) =>
    Array.from(text)
      .map((c) => {
        try {
          font.encodeText(c);
          return c;
        } catch {
          return "?";
        }
      })
      .join("");
  const numbers = annotationNumbers(annotations),
    roots = annotations.filter((a) => !a.parent_id);
  const originalPages = output.getPages();
  for (const annotation of roots) {
    if (annotation.file_version && annotation.file_version !== version)
      continue;
    for (const pageNumber of exportAnnotationPages(annotation)) {
      const page = originalPages[pageNumber - 1];
      if (!page) continue;
      const projected =
        kind === "pdf" ? highlightOnPage(annotation, pageNumber) : annotation;
      if (!projected) continue;
      drawMark(page, projected, numbers[annotation.id], font);
    }
  }
  let page: PDFPage,
    y = 0;
  const newPage = () => {
    page = output.addPage([595.28, 841.89]);
    y = 796;
  };
  const line = (text: string, size = 10) => {
    const words = safe(text).split(/\s+/);
    let current = "";
    const flush = () => {
      if (y < 45) newPage();
      page.drawText(current, {
        x: 42,
        y,
        size,
        font,
        color: rgb(0.12, 0.12, 0.12),
      });
      y -= size + 5;
      current = "";
    };
    for (const word of words) {
      // Split even long unbroken links/identifiers to keep every line on the page.
      for (const chunk of word.match(/.{1,70}/g) ?? [""]) {
        if (
          current &&
          font.widthOfTextAtSize(`${current} ${chunk}`, size) > 510
        )
          flush();
        current += `${current ? " " : ""}${chunk}`;
      }
    }
    if (current) flush();
  };
  newPage();
  line(`Anmerkungen: ${title}`, 16);
  line(
    `Export vom ${new Date().toLocaleString("de-DE")} · ${roots.length} Anmerkungen`,
  );
  y -= 8;
  for (const annotation of roots) {
    line(
      `${numbers[annotation.id]}. ${annotationPageLabel(annotation) ?? "Bild"} · ${annotation.resolved ? "Erledigt" : "Offen"} · ${authorName(annotation.created_by)}`,
      12,
    );
    if (annotation.file_version && annotation.file_version !== version)
      line(
        "Ältere Dateiversion: Markierung wurde nicht auf die aktuelle Datei gezeichnet.",
      );
    if (annotation.quote_text) line(`Text: ${annotation.quote_text}`);
    line(plainAnnotationComment(annotation.content) || "Ohne Kommentar");
    if (annotation.assigned_to)
      line(`Zuständig: ${authorName(annotation.assigned_to)}`);
    if (annotation.task_id)
      line(`Aufgabe: ${annotationTaskStatusLabel(annotation.task_status)}`);
    for (const reply of annotations.filter(
      (a) => a.parent_id === annotation.id,
    ))
      line(
        `Antwort ${authorName(reply.created_by)}: ${plainAnnotationComment(reply.content)}`,
      );
    y -= 12;
  }
  output.setTitle(`${title} – Anmerkungen`);
  return output.save();
}

function drawMark(
  page: PDFPage,
  annotation: DocumentAnnotation,
  number: number,
  font: PDFFont,
) {
  const { width, height, x: cropX, y: cropY } = page.getCropBox(),
    color = COLORS[annotation.color],
    selector = annotation.target_selector;
  // Copy pages can retain a nonzero rotation. Work in the visible, rotated coordinate system.
  const rotation = ((page.getRotation().angle % 360) + 360) % 360;
  const visibleWidth = rotation === 90 || rotation === 270 ? height : width,
    visibleHeight = rotation === 90 || rotation === 270 ? width : height;
  // Transform the drawing coordinate system to the page's visible orientation.
  // PDF-lib's low-level operators preserve the original page contents and rotation.
  const point = (p: { x: number; y: number }) => {
    const v = exportPoint(p, visibleWidth, visibleHeight);
    if (rotation === 90) return { x: cropX + width - v.y, y: cropY + v.x };
    if (rotation === 180)
      return { x: cropX + width - v.x, y: cropY + height - v.y };
    if (rotation === 270) return { x: cropX + v.y, y: cropY + height - v.x };
    return { x: cropX + v.x, y: cropY + v.y };
  };
  for (const rect of selector.rects ?? []) {
    const corners = [
      point({ x: rect.x, y: rect.y }),
      point({ x: rect.x + rect.w, y: rect.y }),
      point({ x: rect.x + rect.w, y: rect.y + rect.h }),
      point({ x: rect.x, y: rect.y + rect.h }),
    ];
    const xs = corners.map((p) => p.x),
      ys = corners.map((p) => p.y);
    page.drawRectangle({
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
      ...(annotation.annotation_type === "highlight"
        ? { color, opacity: 0.27 }
        : { borderColor: color, borderWidth: 1.5 }),
    });
  }
  const points = (selector.points ?? []).map(point);
  if (annotation.annotation_type === "polygon" && points.length >= 3) {
    for (let i = 0; i < points.length; i++)
      page.drawLine({
        start: points[i],
        end: points[(i + 1) % points.length],
        color,
        thickness: 1.5,
      });
  }
  if (annotation.annotation_type === "arrow" && points.length === 2) {
    const [start, end] = points;
    page.drawLine({ start, end, color, thickness: 2 });
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    for (const offset of [-0.45, 0.45])
      page.drawLine({
        start: end,
        end: {
          x: end.x - 10 * Math.cos(angle + offset),
          y: end.y - 10 * Math.sin(angle + offset),
        },
        color,
        thickness: 2,
      });
  }
  if (annotation.annotation_type === "note" && selector.points?.[0]) {
    const anchor = selector.points[0];
    const flag = (x: number, y: number) =>
      point({
        x: anchor.x + x / visibleWidth,
        y: anchor.y - y / visibleHeight,
      });
    page.drawLine({ start: flag(0, 0), end: flag(0, 24), color, thickness: 2 });
    page.drawLine({
      start: flag(0, 24),
      end: flag(16, 18),
      color,
      thickness: 2,
    });
    page.drawLine({
      start: flag(16, 18),
      end: flag(0, 12),
      color,
      thickness: 2,
    });
  }
  const anchor = annotationPinAnchor(annotation.annotation_type, selector);
  if (anchor) {
    const center = {
        x: anchor.x,
        y:
          anchor.y +
          (annotation.annotation_type === "note" ? 10 / visibleHeight : 0),
      },
      p = point(center);
    page.drawCircle({ x: p.x, y: p.y, size: 8, color });
    const textPoint = point({
      x: center.x - (2.5 * String(number).length) / visibleWidth,
      y: center.y + 3 / visibleHeight,
    });
    page.drawText(String(number), {
      ...textPoint,
      size: 8,
      font,
      color: rgb(1, 1, 1),
      rotate: degrees(rotation),
    });
  }
}
