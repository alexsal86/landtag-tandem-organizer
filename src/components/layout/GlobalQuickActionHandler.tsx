import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

/**
 * GlobalQuickActionHandler - Zentrale Verwaltung von QuickActions, die eine Navigation erfordern
 * 
 * Die meisten QuickActions werden bereits in den jeweiligen View-Komponenten behandelt
 * (z.B. TasksView, MeetingsView, etc.) über den `action` URL-Parameter.
 * 
 * Diese Komponente behandelt nur die Fälle, die eine Navigation zu einer anderen Seite erfordern,
 * wenn der Benutzer nicht auf der richtigen Seite ist.
 */
export function GlobalQuickActionHandler() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const action = searchParams.get("action");
    if (!action) return;

    // Actions, die eine Navigation zu einer anderen Seite erfordern
    switch (action) {
      case "create-contact":
        // Navigate to contact creation page and clear action
        navigate("/contacts/new");
        searchParams.delete("action");
        setSearchParams(searchParams, { replace: true });
        break;
      // Andere Actions werden in den jeweiligen Views behandelt
      // (TasksView, MeetingsView, EventPlanningView, etc.)
      default:
        break;
    }
  }, [searchParams, navigate, setSearchParams]);

  // Diese Komponente rendert keine UI
  return null;
}
