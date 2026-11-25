import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  citationText,
  copyText,
  fileStem,
  todayLabel,
  type CitationInput,
} from "./citation";

export type { CitationInput } from "./citation";

/** Serialize only the rendered figure (no toolbar, no scripts) with explicit pixel size. */
export function svgMarkup(svg: SVGSVGElement): string {
  const rect = svg.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width || svg.clientWidth || 640));
  const height = Math.max(1, Math.round(rect.height || svg.clientHeight || 360));
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  if (!clone.getAttribute("viewBox"))
    clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent =
    "text{font-family:system-ui,-apple-system,'Segoe UI',sans-serif}";
  clone.insertBefore(style, clone.firstChild);
  return new XMLSerializer().serializeToString(clone);
}

export async function svgToPng(markup: string, scale = 2): Promise<Blob> {
  const image = new Image();
  const source = URL.createObjectURL(
    new Blob([markup], { type: "image/svg+xml;charset=utf-8" }),
  );
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("SVG konnte nicht gerendert werden."));
      image.src = source;
    });
    const match = /viewBox="([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)"/.exec(markup);
    const width = Math.max(1, Number(match?.[3] ?? image.naturalWidth ?? 640));
    const height = Math.max(1, Number(match?.[4] ?? image.naturalHeight ?? 360));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas wird nicht unterstützt.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("PNG konnte nicht erzeugt werden.")),
        "image/png",
      ),
    );
  } finally {
    URL.revokeObjectURL(source);
  }
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Wraps one rendered figure and offers the same exports for every chart in Daten. */
export function ChartExport({
  title,
  filename,
  citation,
  children,
}: {
  title: string;
  filename: string;
  citation?: CitationInput;
  children: ReactNode;
}) {
  const area = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const findSvg = () => area.current?.querySelector("svg") ?? null;
  const run = async (task: () => Promise<string> | string) => {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      setStatus(await task());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Export fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };
  const base = fileStem(filename);
  return (
    <div className="space-y-2">
      <div ref={area}>{children}</div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() =>
            run(() => {
              const svg = findSvg();
              if (!svg) throw new Error("Keine Grafik gefunden.");
              download(
                new Blob([svgMarkup(svg)], { type: "image/svg+xml;charset=utf-8" }),
                `${base}.svg`,
              );
              return "SVG gespeichert.";
            })
          }
        >
          SVG
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const svg = findSvg();
              if (!svg) throw new Error("Keine Grafik gefunden.");
              download(await svgToPng(svgMarkup(svg)), `${base}.png`);
              return "PNG gespeichert.";
            })
          }
        >
          PNG
        </Button>
        {citation && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await copyText(
                  citationText({
                    ...citation,
                    accessedAt: citation.accessedAt ?? todayLabel(),
                  }),
                );
                return "Zahlenzitat kopiert.";
              })
            }
          >
            Zahlenzitat
          </Button>
        )}
        <span className="text-xs text-muted-foreground">{title}</span>
        {status && (
          <span role="status" className="text-xs text-muted-foreground">
            {status}
          </span>
        )}
      </div>
    </div>
  );
}
