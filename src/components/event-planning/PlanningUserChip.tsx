import { useEffect, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { mentionColors } from "@/utils/mentionColors";
import { AVAILABLE_COLORS, getHashedColor } from "@/utils/userColors";
import { cn } from "@/lib/utils";

export function planningUserInitials(name: string | null | undefined): string {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (!parts.length) return "?";
  return (parts.length > 1 ? `${Array.from(parts[0])[0]}${Array.from(parts[parts.length - 1])[0]}` : Array.from(parts[0]).slice(0, 2).join("")).toLocaleUpperCase("de-DE");
}

interface Props {
  userId: string;
  name?: string | null;
  color?: string | null;
  compact?: boolean;
  role?: string;
}

export function PlanningUserChip({ userId, name, color, compact = false, role = "Verantwortlich" }: Props) {
  const [collapsed, setCollapsed] = useState(compact);
  useEffect(() => {
    setCollapsed(compact);
    if (compact) return;
    const timer = window.setTimeout(() => setCollapsed(true), 3000);
    return () => window.clearTimeout(timer);
  }, [compact, userId, name]);
  const configured = (color || getHashedColor(userId)).trim().toLowerCase();
  const colors = mentionColors(configured);
  const palette = AVAILABLE_COLORS.find(c => [c.value, c.hex, c.baseHex, c.classes.split(" ")[0]].includes(configured));
  const customHex = /^#[0-9a-f]{3}$/i.test(configured) ? `#${Array.from(configured.slice(1)).map(c => c + c).join("")}` : configured;
  const baseColor = /^#[0-9a-f]{6}$/i.test(customHex) ? customHex : palette?.baseHex ?? colors.text;
  const rgb = [1, 3, 5].map(offset => parseInt(baseColor.slice(offset, offset + 2), 16));
  const initialText = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000 > 155 ? "#172012" : "#ffffff";
  const label = name?.trim() || "Unbekannt";
  return <Tooltip>
    <TooltipTrigger asChild>
      <span tabIndex={0} aria-label={`${role}: ${label}`} className="inline-flex shrink-0 items-center rounded-full p-1 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring" style={{ backgroundColor: `color-mix(in srgb, ${baseColor} 15%, var(--background))`, color: colors.text }}>
        <span className={cn("flex shrink-0 items-center justify-center rounded-full font-semibold", compact ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs")} style={{ backgroundColor: baseColor, color: initialText }}>{planningUserInitials(name)}</span>
        <span aria-hidden={collapsed} className={cn("overflow-hidden whitespace-nowrap transition-[max-width,opacity,margin] duration-500 motion-reduce:transition-none", collapsed ? "ml-0 max-w-0 opacity-0" : "ml-2 mr-2 max-w-44 opacity-100")}>{label}</span>
      </span>
    </TooltipTrigger>
    <TooltipContent>{role}: {label}</TooltipContent>
  </Tooltip>;
}
