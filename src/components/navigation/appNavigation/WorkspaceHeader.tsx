import { ChevronDown, Home } from "lucide-react";
import { Link } from "react-router-dom";
import { GlobalCreateMenu } from "@/components/layout/GlobalCreateMenu";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useFavicon } from "@/hooks/useFavicon";
import { useWorkspaceView } from "@/contexts/WorkspaceViewContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function WorkspaceHeader({ compact, onNavigate }: { compact: boolean; onNavigate: () => void }) {
  const { app_logo_url, app_name, app_subtitle } = useAppSettings();
  const { isDeputyView, loading, setView } = useWorkspaceView();
  useFavicon(app_logo_url);
  const viewName = isDeputyView ? "Abgeordnetenansicht" : "Mitarbeiteransicht";

  return (
    <div className="mission-header">
      <Link to="/mywork" onClick={onNavigate} className="mission-logo" aria-label="Startseite öffnen">
        {app_logo_url
          ? <img src={app_logo_url} alt="" crossOrigin="anonymous" className="size-8 object-contain" />
          : <Home className="size-4" aria-hidden="true" />}
      </Link>
      {!compact && (
        <div className="mission-brand">
          <span title={app_name}>{app_name || "LandtagsOS"}</span>
          {app_subtitle && <small title={app_subtitle}>{app_subtitle}</small>}
          {!loading && <small className="mission-view-name">{viewName}</small>}
        </div>
      )}
      <div className="mission-header-actions">
        {setView && (
          <DropdownMenu>
            <DropdownMenuTrigger className="mission-icon" disabled={loading} aria-label={`Workspace-Ansicht wechseln · ${viewName}`} title={viewName}>
              <ChevronDown aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side={compact ? "right" : "bottom"}>
              <DropdownMenuRadioGroup value={isDeputyView ? "abgeordneter" : "mitarbeiter"} onValueChange={value => {
                if (value === "abgeordneter" || value === "mitarbeiter") setView(value);
              }}>
                <DropdownMenuRadioItem value="abgeordneter">Abgeordnetenansicht</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="mitarbeiter">Mitarbeiteransicht</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <GlobalCreateMenu compact />
      </div>
    </div>
  );
}
