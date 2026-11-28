import { activeNavigationSection, sectionForPath } from "./navigationConfig";
import { GlobalCreateMenu } from "@/components/layout/GlobalCreateMenu";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, Menu, Settings, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AppNavigation } from "@/components/navigation/AppNavigation";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useSidebarProfile } from "./appNavigation/useNavPanelData";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function MobileHeader() {
  return useIsMobile() ? <MobileNavigation /> : null;
}

function MobileNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();

  const activeSection = sectionForPath(location.pathname);
  const appSettings = useAppSettings();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { data: userProfile } = useSidebarProfile();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-[hsl(var(--nav))] text-[hsl(var(--nav-foreground))] pt-safe-top px-safe">
      <div className="mobile-header-surface flex items-center justify-between px-4">
        {/* Left: Menu + Logo */}
        <div className="flex items-center gap-2">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="-ml-2 text-[hsl(var(--nav-foreground))] hover:bg-[hsl(var(--nav-hover))]">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Navigation öffnen</span>
              </Button>
            </SheetTrigger>
            <SheetContent
              side="top"
              aria-describedby={undefined}
              className="flex h-app w-full max-w-none flex-col gap-0 overflow-hidden border-0 p-0 pt-safe-top px-safe bg-[hsl(var(--nav))] text-[hsl(var(--nav-foreground))]"
            >
              <div className="flex h-14 shrink-0 items-center justify-between border-b border-[hsl(var(--nav-foreground)/0.1)] px-4">
                <SheetTitle className="text-base text-[hsl(var(--nav-foreground))]">Navigation</SheetTitle>
                <SheetClose asChild>
                  <Button variant="ghost" size="icon" className="text-[hsl(var(--nav-foreground))] hover:bg-[hsl(var(--nav-hover))]">
                    <X className="h-5 w-5" />
                    <span className="sr-only">Navigation schließen</span>
                  </Button>
                </SheetClose>
              </div>
              <div className="min-h-0 flex-1">
                <AppNavigation
                  activeSection={activeNavigationSection(activeSection)}
                  onNavigate={() => setMobileNavOpen(false)}
                  isMobile={true}
                  onFollowHelpHint={() => setMobileNavOpen(false)}
                />
              </div>
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2">
            {appSettings.app_logo_url && (
              <img
                src={appSettings.app_logo_url}
                alt="App Logo"
                crossOrigin="anonymous"
                className="h-8 w-8 object-contain"
              />
            )}
            <span className="font-semibold text-sm truncate max-w-[120px]">
              {appSettings.app_name}
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          <GlobalCreateMenu />
          {/* User Avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full p-0 text-[hsl(var(--nav-foreground))] hover:bg-[hsl(var(--nav-hover))]"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage
                    src={userProfile?.avatar_url || undefined}
                    alt={userProfile?.display_name || 'Benutzer'}
                  />
                  <AvatarFallback className="text-xs bg-[hsl(var(--nav-hover))] text-[hsl(var(--nav-foreground))]">
                    {userProfile?.display_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="sr-only">Benutzermenü öffnen</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => navigate('/profile/edit')}>
                <User className="mr-2 h-4 w-4" />
                Profil bearbeiten
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <Settings className="mr-2 h-4 w-4" />
                Einstellungen
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Abmelden
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
