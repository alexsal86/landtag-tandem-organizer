import type { ReactNode } from "react";
import { useActionPermission } from "@/hooks/useActionPermission";

interface RequireActionProps {
  action: string;
  children: ReactNode;
  fallback?: ReactNode;
  /** Wenn true, beim Laden den Inhalt anzeigen (optimistic). Default: false. */
  optimistic?: boolean;
}

/**
 * Render-Gate für Aktionen. Ersetzt hardcoded Role-Checks.
 * Beispiel:
 *   <RequireAction action="letter.send">
 *     <Button>Versenden</Button>
 *   </RequireAction>
 */
export function RequireAction({ action, children, fallback = null, optimistic = false }: RequireActionProps) {
  const { allowed, isLoading } = useActionPermission(action);
  if (isLoading) return optimistic ? <>{children}</> : null;
  return <>{allowed ? children : fallback}</>;
}
