import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface SubNavigationItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface MobileSubNavigationProps {
  items: SubNavigationItem[];
  activeItem: string;
  onItemChange: (id: string) => void;
}

export function MobileSubNavigation({ items, activeItem, onItemChange }: MobileSubNavigationProps) {
  if (items.length <= 1) return null;

  return (
    <div className="sticky top-14 z-40 bg-background border-b border-border">
      <ScrollArea className="w-full">
        <div className="flex gap-1 p-2 min-w-max">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onItemChange(item.id)}
                className={cn(
                  "px-3 py-2 text-sm rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap",
                  isActive
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground bg-muted/50 hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" className="h-2" />
      </ScrollArea>
    </div>
  );
}
