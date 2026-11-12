import { describe, expect, it } from "vitest";
import { getAnnotationFileKind, isMeaningfulRect, polygonIsValid, selectionRectsToFrac, toFracRect } from "./annotationModel";

describe("annotation model", () => {
  it("detects PDFs and JPG/PNG/WebP images only", () => {
    expect(getAnnotationFileKind("a.PDF")).toBe("pdf");
    expect(getAnnotationFileKind("b.webp")).toBe("image");
    expect(getAnnotationFileKind("c.jpeg")).toBe("image");
    expect(getAnnotationFileKind("d.docx")).toBeNull();
  });
  it("stores rects as size-independent fractions", () => {
    expect(toFracRect({ x: 200, y: 100 }, { x: 100, y: 50 }, 400, 200)).toEqual({ x: 0.25, y: 0.25, w: 0.25, h: 0.25 });
  });
  it("ignores click-sized rects", () => {
    expect(isMeaningfulRect({ x: 0, y: 0, w: 0.001, h: 0.2 })).toBe(false);
  });
  it("requires at least three polygon points", () => {
    expect(polygonIsValid([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(false);
  });
  it("drops empty and duplicate selection rects", () => {
    const page = { left: 10, top: 10, width: 100, height: 100 };
    const r = { left: 20, top: 20, width: 50, height: 10 };
    expect(selectionRectsToFrac([r, r, { left: 0, top: 0, width: 0, height: 5 }], page)).toHaveLength(1);
  });
});
