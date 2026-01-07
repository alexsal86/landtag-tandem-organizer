import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigationNotifications } from "@/hooks/useNavigationNotifications";

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
  const { navigationCounts } = useNavigationNotifications();
  
  if (items.length <= 1) return null;

  const getBadgeCount = (itemId: string): number => {
    return navigationCounts[itemId] || 0;
  };

  return (
    <div className="h-10 border-b border-border bg-background flex items-center px-4 gap-1">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeItem === item.id;
        const badgeCount = getBadgeCount(item.id);
        
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
            {badgeCount > 0 && (
              <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">
                {badgeCount}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}
