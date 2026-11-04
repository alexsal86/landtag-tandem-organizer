import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

/** Pages through the visible area without splitting or remounting editor content. */
export function DaySlipPages({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ page: 1, pages: 1, atStart: true, atEnd: true });

  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    const measure = () => {
      const height = viewport.clientHeight;
      if (!height) return;
      const maximum = Math.max(0, viewport.scrollHeight - height);
      const pages = Math.max(1, Math.ceil(viewport.scrollHeight / height));
      const atEnd = viewport.scrollTop >= maximum - 1;
      const next = {
        page: atEnd ? pages : Math.min(pages, Math.floor((viewport.scrollTop + 1) / height) + 1),
        pages, atStart: viewport.scrollTop <= 1, atEnd,
      };
      setPosition(previous => Object.keys(next).every(key => previous[key as keyof typeof next] === next[key as keyof typeof next]) ? previous : next);
    };
    const resize = new ResizeObserver(measure);
    resize.observe(viewport);
    resize.observe(content);
    viewport.addEventListener("scroll", measure, { passive: true });
    measure();
    return () => { resize.disconnect(); viewport.removeEventListener("scroll", measure); };
  }, []);

  const turn = (direction: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const top = direction > 0
      ? position.page * viewport.clientHeight
      : (position.atEnd ? position.pages - 2 : position.page - 2) * viewport.clientHeight;
    viewport.scrollTo({ top: Math.max(0, top), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div ref={viewportRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain [overflow-wrap:anywhere]">
        <div ref={contentRef} className="relative flex min-h-full flex-col">{children}</div>
      </div>
      {position.pages > 1 && <nav aria-label="Tageszettel durchblättern" className="flex shrink-0 items-center justify-center gap-3 border-t border-border/60 bg-muted/20 px-3 py-1">
        <button type="button" aria-label="Vorherige Seite" disabled={position.atStart} onClick={() => turn(-1)} className="rounded p-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
        <span className="text-xs tabular-nums text-muted-foreground">Seite {position.page} von {position.pages}</span>
        <button type="button" aria-label="Nächste Seite" disabled={position.atEnd} onClick={() => turn(1)} className="rounded p-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
      </nav>}
    </div>
  );
}
