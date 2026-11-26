import { useEffect, useRef, type ReactElement, type ReactNode } from "react";
import { Anchor } from "@radix-ui/react-popover";
import { Popover, PopoverContent } from "@/components/ui/popover";

interface NavGroupPreviewProps {
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactElement;
  children: ReactNode;
}

export function NavGroupPreview({ label, open, onOpenChange, trigger, children }: NavGroupPreviewProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const anchor = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const keyboard = useRef(false);

  const clearTimer = () => clearTimeout(timer.current);
  useEffect(() => () => clearTimeout(timer.current), []);

  const closeAfterLeaving = () => {
    clearTimer();
    timer.current = setTimeout(() => {
      if (!content.current?.contains(document.activeElement)) onOpenChange(false);
    }, 220);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Anchor
        asChild
        ref={anchor}
        aria-keyshortcuts="ArrowRight"
        aria-haspopup="dialog"
        aria-expanded={open}
        onPointerEnter={(event) => {
          if (event.pointerType !== "mouse") return;
          clearTimer();
          if (!open) timer.current = setTimeout(() => onOpenChange(true), 350);
        }}
        onPointerLeave={closeAfterLeaving}
        onClickCapture={() => {
          clearTimer();
          onOpenChange(false);
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowRight") return;
          event.preventDefault();
          clearTimer();
          if (open) content.current?.focus();
          else {
            keyboard.current = true;
            onOpenChange(true);
          }
        }}
      >
        {trigger}
      </Anchor>
      <PopoverContent
        ref={content}
        tabIndex={-1}
        aria-label={label}
        side="right"
        align="start"
        sideOffset={10}
        className="w-72 max-w-[calc(100vw-1rem)] rounded-2xl p-3 shadow-lg"
        onPointerEnter={clearTimer}
        onPointerLeave={closeAfterLeaving}
        onFocusCapture={clearTimer}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) onOpenChange(false);
        }}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          if (keyboard.current) {
            keyboard.current = false;
            content.current?.focus();
          }
        }}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          clearTimer();
          if (content.current?.contains(document.activeElement)) anchor.current?.focus();
          onOpenChange(false);
        }}
        onInteractOutside={(event) => {
          if (event.target instanceof Node && anchor.current?.contains(event.target)) event.preventDefault();
        }}
      >
        <h2 className="px-2 pb-1 text-sm font-semibold">{label}</h2>
        {children}
      </PopoverContent>
    </Popover>
  );
}
