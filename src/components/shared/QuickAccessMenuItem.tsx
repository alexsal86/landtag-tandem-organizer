import { Star, StarOff } from "lucide-react";
import { useQuickAccessPages } from "@/hooks/useQuickAccessPages";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

interface QuickAccessMenuItemProps {
  id: string;
  label: string;
  icon: string;
  route: string;
}

export function QuickAccessMenuItem({ id, label, icon, route }: QuickAccessMenuItemProps) {
  const { isInQuickAccess, addPage, removePage } = useQuickAccessPages();
  const pinned = isInQuickAccess(id);

  return (
    <DropdownMenuItem
      onClick={(e) => {
        e.stopPropagation();
        if (pinned) {
          removePage(id);
        } else {
          addPage({ id, label, icon, route, type: 'item' });
        }
      }}
    >
      {pinned ? (
        <>
          <StarOff className="mr-2 h-4 w-4" />
          Aus Schnellzugriff entfernen
        </>
      ) : (
        <>
          <Star className="mr-2 h-4 w-4" />
          Zum Schnellzugriff
        </>
      )}
    </DropdownMenuItem>
  );
}
