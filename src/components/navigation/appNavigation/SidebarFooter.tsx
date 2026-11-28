import { useRef, useState } from "react";
import { HelpCircle, LogOut, PanelLeftClose, PanelLeftOpen, Settings, Shield, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SunflowerThemeToggle } from "@/components/ui/sunflower-theme-toggle";
import { UserStatusSelector } from "@/components/status/UserStatusSelector";
import { HelpDialog } from "../HelpDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useUserStatus } from "@/hooks/useUserStatus";
import { notify } from "@/lib/notify";
import { SidebarIconButton } from "./SidebarControls";
import { cn } from "@/lib/utils";

export function SidebarFooter({
  compact, profile, hasAdminAccess, isAdminPage, onAdmin, onNavigate, onFollowHelpHint, onToggle, ghost,
}: {
  compact: boolean;
  ghost?: boolean;
  profile?: { display_name?: string | null; avatar_url?: string | null } | null;
  hasAdminAccess: boolean;
  isAdminPage: boolean;
  onAdmin: () => void;
  onNavigate: () => void;
  onFollowHelpHint?: () => void;
  onToggle?: () => void;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const helpTrigger = useRef<HTMLButtonElement>(null);
  const { user, signOut } = useAuth();
  const { currentStatus, getStatusDisplay } = useUserStatus();
  const status = getStatusDisplay(currentStatus ?? undefined);
  const navigate = useNavigate();
  const name = profile?.display_name || user?.email || "Profil";
  const changePage = (route: string) => {
    onNavigate();
    navigate(route);
  };
  const handleSignOut = async () => {
    try {
      await signOut();
      notify.success("Erfolgreich abgemeldet");
      changePage("/auth");
    } catch {
      notify.error("Fehler beim Abmelden");
    }
  };

  return (
    <footer className="mission-footer">
      <UserStatusSelector showOnlineUsers>
        <button type="button" className="mission-profile" title={name}
          aria-label={status ? `Profil · ${name} · ${status.label}` : `Profil · ${name}`}>
          <span className="relative shrink-0">
            <Avatar className="size-7">
              <AvatarImage src={profile?.avatar_url || undefined} alt="" />
              <AvatarFallback className="text-xs">{name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            {status && <span aria-hidden="true" className="mission-status-dot" style={{ backgroundColor: status.color }} />}
          </span>
          {!compact && (
            <span className="min-w-0 text-left">
              <span className="block truncate text-[13px] font-semibold">{name}</span>
              {status && <span className="mission-meta block truncate">{status.label}</span>}
            </span>
          )}
        </button>
      </UserStatusSelector>
      <div className="mission-footer-actions">
        <SidebarIconButton ref={helpTrigger} label="Information" onClick={() => setHelpOpen(true)} aria-haspopup="dialog" aria-expanded={helpOpen}>
          <HelpCircle aria-hidden="true" />
        </SidebarIconButton>
        {hasAdminAccess && (
          <SidebarIconButton label="Administration" onClick={onAdmin} aria-current={isAdminPage ? "page" : undefined}>
            <Shield aria-hidden="true" />
          </SidebarIconButton>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger className="mission-icon" aria-label="Einstellungen" title="Einstellungen">
            <Settings aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" side="right" align="end">
            <DropdownMenuLabel>
              <p className="truncate">{name}</p>
              <p className="truncate text-xs font-normal text-muted-foreground">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="flex items-center justify-between gap-3 px-2 py-2">
              <span className="text-label">Dunkelmodus</span><SunflowerThemeToggle />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => changePage("/profile-edit")}><User />Profil bearbeiten</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => changePage("/settings")}><Settings />Einstellungen</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void handleSignOut()} className="text-destructive focus:text-destructive">
              <LogOut />Abmelden
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {onToggle && (
          <SidebarIconButton label={ghost ? "Sidebar ausblenden" : compact ? "Sidebar ausklappen" : "Sidebar einklappen"} onClick={onToggle}
            aria-expanded={!compact} aria-keyshortcuts="Meta+Backslash Control+B" className={cn(compact && "mission-toggle-compact")}>
            {compact ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
          </SidebarIconButton>
        )}
      </div>
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} onFollowHint={onFollowHelpHint} returnFocusRef={helpTrigger} />
    </footer>
  );
}
