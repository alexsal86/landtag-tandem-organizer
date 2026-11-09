import { useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useUserPreference } from "@/hooks/useUserPreference";
import type { BriefingDepth } from "./briefingModel";

interface EditorViews {
  scope: string;
  preparations: Record<string, BriefingDepth>;
}

/** Personal view preferences; never changes appointments.briefing_depth (the assignment). */
export function useBriefingEditorView() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const scope = `${currentTenant?.id ?? ""}:${user?.id ?? ""}`;
  const [stored, setStored] = useUserPreference<EditorViews | null>(`briefing-editor-views:${scope}`, null);

  const getView = useCallback((preparationId?: string | null): BriefingDepth | null => {
    if (!preparationId || stored?.scope !== scope) return null;
    const value = stored.preparations?.[preparationId];
    return value === "compact" || value === "full" ? value : null;
  }, [scope, stored]);

  const rememberView = useCallback((preparationId: string, depth: BriefingDepth) => {
    if (!user || !currentTenant) return;
    setStored(previous => ({
      scope,
      preparations: { ...(previous?.scope === scope ? previous.preparations : {}), [preparationId]: depth },
    }));
  }, [scope, user, currentTenant, setStored]);

  return { getView, rememberView };
}
