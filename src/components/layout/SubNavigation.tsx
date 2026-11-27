import { memo } from "react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigationNotifications } from "@/hooks/useNavigationNotifications";
import { prefetchRoute } from "@/lib/routePrefetch";
import { NavigationIslandTrack, navigationIslandClass, navigationIslandItemClass } from "./NavigationIsland";

interface SubNavigationProps {
  items: { id: string; label: string; icon: LucideIcon }[];
  activeItem: string;
  onItemChange: (id: string) => void;
}

export const SubNavigation = memo(function SubNavigation({ items, activeItem, onItemChange }: SubNavigationProps) {
  const { navigationCounts } = useNavigationNotifications();

  return (
    <nav aria-label="Bereiche" className={navigationIslandClass}>
      <NavigationIslandTrack activeItem={activeItem}>
        {items.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-current={activeItem === id ? "page" : undefined}
            onClick={() => onItemChange(id)}
            onMouseEnter={() => prefetchRoute(id)}
            className={navigationIslandItemClass}
          >
            <Icon aria-hidden="true" className="size-4" />
            {label}
            {navigationCounts[id] > 0 && (
              <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">{navigationCounts[id]}</Badge>
            )}
          </button>
        ))}
      </NavigationIslandTrack>
    </nav>
  );
});
