import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

/**
 * Schützt alle Kind-Routen: Nicht eingeloggte Nutzer werden zur /auth-Seite weitergeleitet.
 * Der aktuelle Pfad wird als `redirect`-Parameter übergeben, damit nach dem Login
 * automatisch dorthin weitergeleitet werden kann.
 */
export function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    const redirect = window.location.pathname + window.location.search;
    const to = redirect && redirect !== "/" ? `/auth?redirect=${encodeURIComponent(redirect)}` : "/auth";
    return <Navigate to={to} replace />;
  }

  return <Outlet />;
}
