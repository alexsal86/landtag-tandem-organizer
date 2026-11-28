import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useNavigationNotifications } from "@/hooks/useNavigationNotifications";
import { trackPageVisit } from "@/hooks/useRecentlyVisited";
import { prefetchRoute } from "@/lib/routePrefetch";
import type { NavigationDestination } from "../navigationConfig";

export function useSidebarNavigation() {
  const navigate = useNavigate();
  const { markNavigationAsVisited } = useNavigationNotifications({ observe: false });

  return useCallback((item: NavigationDestination) => {
    prefetchRoute(item.id);
    trackPageVisit(item.id, item.label, item.iconName, item.route);
    void markNavigationAsVisited(item.id);
    navigate(item.route);
  }, [markNavigationAsVisited, navigate]);
}
