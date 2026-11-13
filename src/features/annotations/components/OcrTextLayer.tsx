import { useLayoutEffect, useRef } from "react";
import type { OcrWord } from "../ocrModel";
export function OcrTextLayer({
  words,
  width,
  height,
  selectable,
}: {
  words: OcrWord[];
  width: number;
  height: number;
  selectable: boolean;
}) {
  const layer = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    for (const span of layer.current?.querySelectorAll<HTMLSpanElement>(
      "span",
    ) ?? []) {
      span.style.transform = "none";
      const measured = span.getBoundingClientRect().width,
        target = Number(span.dataset.width);
      if (measured) span.style.transform = `scaleX(${target / measured})`;
    }
  }, [words, width, height]);
  return (
    <div
      ref={layer}
      className="aw-pdf-text aw-ocr-text"
      data-text-state="ready"
      data-selectable={selectable}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: selectable ? "auto" : "none",
        userSelect: selectable ? "text" : "none",
      }}
    >
      {words.map((word, index) => (
        <span
          key={index}
          data-width={word.rect.w * width}
          style={{
            position: "absolute",
            left: word.rect.x * width,
            top: word.rect.y * height,
            fontSize: word.rect.h * height,
            lineHeight: 1,
            whiteSpace: "pre",
            color: "transparent",
            transformOrigin: "left top",
            fontFamily: "sans-serif",
          }}
        >
          {word.text}{" "}
        </span>
      ))}
    </div>
  );
}
