import { useLayoutEffect, useRef, type ReactNode } from "react";

export const navigationIslandClass =
  "flex max-w-full min-w-0 self-stretch overflow-x-auto rounded-full border border-border/80 bg-card/90 shadow-lg shadow-black/8 backdrop-blur-sm [scrollbar-width:none]";

export const navigationIslandItemClass =
  "flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring aria-[current=page]:bg-transparent aria-[current=page]:text-white dark:aria-[current=page]:text-slate-950 data-[state=active]:bg-transparent data-[state=active]:text-white dark:data-[state=active]:text-slate-950";

export function NavigationIslandTrack({ activeItem, children }: { activeItem: string; children: ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const track = trackRef.current;
    const scroll = track?.parentElement;
    if (!track || !scroll) return;

    const updateIndicator = () => {
      const current = track.querySelector<HTMLElement>('[aria-current="page"], [aria-selected="true"]');
      track.style.setProperty("--active-tab-x", `${current?.offsetLeft ?? 0}px`);
      track.style.setProperty("--active-tab-width", `${current?.offsetWidth ?? 0}px`);
      if (!current) return;

      const start = current.offsetLeft;
      const end = start + current.offsetWidth;
      if (start < scroll.scrollLeft) scroll.scrollLeft = start;
      else if (end > scroll.scrollLeft + scroll.clientWidth) scroll.scrollLeft = end - scroll.clientWidth;
    };

    updateIndicator();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateIndicator);
    observer.observe(scroll);
    for (const item of track.querySelectorAll("button")) observer.observe(item);
    return () => observer.disconnect();
  }, [activeItem, children]);

  return (
    <div ref={trackRef} className="relative isolate flex w-max min-w-full items-center gap-1 p-1">
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-1 left-0 -z-10 w-(--active-tab-width) translate-x-(--active-tab-x) rounded-full bg-slate-900 shadow-sm transition-[translate,width] duration-350 ease-in-out motion-reduce:transition-none dark:bg-slate-100" />
      {children}
    </div>
  );
}
