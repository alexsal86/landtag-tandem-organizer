import { cn } from "@/lib/utils";

export function CharCounter({ text, limit }: { text: string; limit: number | null }) {
  const count = text.length;
  if (limit === null) {
    return <span className="text-xs text-muted-foreground">{count} Zeichen</span>;
  }
  const remaining = limit - count;
  return (
    <span className={cn(
      "text-xs tabular-nums",
      remaining < 0 ? "text-destructive font-medium" :
      remaining < 50 ? "text-amber-500" :
      "text-muted-foreground",
    )}>
      {count} / {limit}
    </span>
  );
}
