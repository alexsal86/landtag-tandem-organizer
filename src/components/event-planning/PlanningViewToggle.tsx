import { Grid2X2, List } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: "card" | "table";
  onChange: (value: "card" | "table") => void;
  label: string;
}

export function PlanningViewToggle({ value, onChange, label }: Props) {
  return <div className="inline-grid shrink-0 grid-cols-2 overflow-hidden rounded-xl border border-border bg-background" role="group" aria-label={label}>
    {([{ value: "card", label: "Kartenansicht", Icon: Grid2X2 }, { value: "table", label: "Listenansicht", Icon: List }] as const).map(option => <button
      key={option.value}
      type="button"
      title={option.label}
      aria-label={option.label}
      aria-pressed={value === option.value}
      onClick={() => onChange(option.value)}
      className={cn("flex h-8 w-8 items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-palette-green", value === option.value ? "bg-palette-green text-white hover:bg-palette-green/90" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
    ><option.Icon className="h-4 w-4" aria-hidden /></button>)}
  </div>;
}
