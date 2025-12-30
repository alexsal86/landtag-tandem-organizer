import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface SubNavigationItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface SubNavigationProps {
  items: SubNavigationItem[];
  activeItem: string;
  onItemChange: (id: string) => void;
}

export function SubNavigation({ items, activeItem, onItemChange }: SubNavigationProps) {
  if (items.length <= 1) return null;

  return (
    <div className="h-10 border-b border-border bg-background flex items-center px-4 gap-1">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeItem === item.id;
        
        return (
          <button
            key={item.id}
            onClick={() => onItemChange(item.id)}
            className={cn(
              "px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5",
              isActive
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
