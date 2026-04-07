import { useIsMobile } from "@/hooks/use-mobile";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Calendar,
  CalendarPlus,
  CheckSquare,
  FileSignature,
  FileText,
  LogOut,
  Mail,
  Menu,
  Search,
  Settings,
  User,
  Vote,
  X,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AppNavigation } from "@/components/AppNavigation";
import { NotificationBell } from "@/components/NotificationBell";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function MobileHeader() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { currentTenant } = useTenant();
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const activeSection = (() => {
    const path = location.pathname.split("/")[1] || "dashboard";
    return path || "dashboard";
  })();

  const [appSettings, setAppSettings] = useState({ app_name: "LandtagsOS", app_logo_url: "" });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [userProfile, setUserProfile] = useState<{ display_name?: string | null; avatar_url?: string | null } | null>(null);

  const {
    contacts,
    appointments,
    tasks,
    documents,
    letters,
    protocols,
    caseFiles,
    activeDecisions,
    archivedDecisions,
    activePlannings,
    archivedPlannings,
    archivedTasks,
    isLoading,
    isError,
    hasResults,
  } = useGlobalSearch({ query: searchQuery, enabled: showMobileSearch });

  const closeMobileSearch = useCallback(() => {
    setShowMobileSearch(false);
    setSearchQuery("");
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      const { data: settings } = await supabase
        .from("app_settings")
        .select("setting_key, setting_value")
        .in("setting_key", ["app_name", "app_logo_url"]);

      if (settings) {
        const settingsMap = settings.reduce((acc, item) => {
          acc[item.setting_key] = item.setting_value || "";
          return acc;
        }, {} as Record<string, string>);

        setAppSettings({
          app_name: settingsMap.app_name || "LandtagsOS",
          app_logo_url: settingsMap.app_logo_url || "",
        });
      }
    };

    loadSettings();
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      if (user && currentTenant?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, avatar_url")
          .eq("user_id", user.id)
          .eq("tenant_id", currentTenant.id)
          .maybeSingle();

        setUserProfile(profile);
      }
    };

    loadProfile();
  }, [user, currentTenant]);

  useEffect(() => {
    if (!showMobileSearch) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    searchInputRef.current?.focus();

    window.history.pushState({ mobileSearchOpen: true }, "");

    const handlePopState = () => {
      closeMobileSearch();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMobileSearch();
      }
    };

    window.addEventListener("popstate", handlePopState);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showMobileSearch, closeMobileSearch]);

  const resultGroups = useMemo(
    () => [
      {
        label: "Kontakte",
        items: contacts.map((item) => ({
          id: item.id,
          title: item.name,
          subtitle: item.organization || item.email || undefined,
          icon: User,
          to: `/?section=contacts&contact=${item.id}&highlight=${item.id}`,
        })),
      },
      {
        label: "Aufgaben",
        items: tasks.map((item) => ({
          id: item.id,
          title: item.title,
          subtitle: item.due_date ? format(new Date(item.due_date), "dd.MM.yyyy", { locale: de }) : undefined,
          icon: CheckSquare,
          to: `/?section=tasks&task=${item.id}&highlight=${item.id}`,
        })),
      },
      {
        label: "Dokumente",
        items: documents.map((item) => ({
          id: item.id,
          title: item.title,
          subtitle: item.category || item.document_type || undefined,
          icon: FileText,
          to: `/?section=documents&document=${item.id}&highlight=${item.id}`,
        })),
      },
      {
        label: "Termine",
        items: appointments.map((item) => ({
          id: item.id,
          title: item.title,
          subtitle: item.start_time ? format(new Date(item.start_time), "dd.MM.yyyy HH:mm", { locale: de }) : undefined,
          icon: Calendar,
          to: `/?section=calendar&appointment=${item.id}&highlight=${item.id}`,
        })),
      },
      {
        label: "Briefe",
        items: letters.map((item) => ({ id: item.id, title: item.title, subtitle: item.recipient_name || undefined, icon: Mail, to: `/letters/${item.id}?highlight=${item.id}` })),
      },
      {
        label: "Protokolle",
        items: protocols.map((item) => ({ id: item.id, title: item.title, subtitle: item.meeting_date ? format(new Date(item.meeting_date), "dd.MM.yyyy", { locale: de }) : undefined, icon: FileSignature, to: `/?section=meetings&meeting=${item.id}&highlight=${item.id}` })),
      },
      {
        label: "Fallakten",
        items: caseFiles.map((item) => ({ id: item.id, title: item.title, subtitle: item.reference_number || undefined, icon: Briefcase, to: `/?section=casefiles&casefile=${item.id}&highlight=${item.id}` })),
      },
      {
        label: "Entscheidungen",
        items: activeDecisions.map((item) => ({ id: item.id, title: item.title, subtitle: item.status || undefined, icon: Vote, to: `/decisions?id=${item.id}&highlight=${item.id}` })),
      },
      {
        label: "Archivierte Entscheidungen",
        items: archivedDecisions.map((item) => ({ id: item.id, title: item.title, subtitle: "Archiv", icon: Vote, to: `/decisions?id=${item.id}&highlight=${item.id}` })),
      },
      {
        label: "Planungen",
        items: activePlannings.map((item) => ({ id: item.id, title: item.title, subtitle: item.location || undefined, icon: CalendarPlus, to: `/eventplanning/${item.id}?highlight=${item.id}` })),
      },
      {
        label: "Archivierte Planungen",
        items: archivedPlannings.map((item) => ({ id: item.id, title: item.title, subtitle: "Archiv", icon: CalendarPlus, to: `/eventplanning/${item.id}?highlight=${item.id}` })),
      },
      {
        label: "Archivierte Aufgaben",
        items: archivedTasks.map((item) => ({ id: item.id, title: item.title, subtitle: "Archiv", icon: CheckSquare, to: `/?section=tasks&archived=true&task=${item.id}&highlight=${item.id}` })),
      },
    ].filter((group) => group.items.length > 0),
    [
      contacts,
      tasks,
      documents,
      appointments,
      letters,
      protocols,
      caseFiles,
      activeDecisions,
      archivedDecisions,
      activePlannings,
      archivedPlannings,
      archivedTasks,
    ],
  );

  if (!isMobile) return null;

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-[hsl(var(--nav))] text-[hsl(var(--nav-foreground))]">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="-ml-2 text-[hsl(var(--nav-foreground))] hover:bg-[hsl(var(--nav-hover))]">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Navigation öffnen</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-[72px] bg-[hsl(var(--nav))] border-[hsl(var(--nav-foreground)/0.1)]">
                <AppNavigation
                  activeSection={activeSection}
                  onSectionChange={(section) => {
                    navigate(section === "dashboard" ? "/" : `/${section}`);
                    setMobileNavOpen(false);
                  }}
                  isMobile={true}
                />
              </SheetContent>
            </Sheet>

            <div className="flex items-center gap-2">
              {appSettings.app_logo_url && <img src={appSettings.app_logo_url} alt="App Logo" crossOrigin="anonymous" className="h-8 w-8 object-contain" />}
              <span className="font-semibold text-sm truncate max-w-[120px]">{appSettings.app_name}</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setShowMobileSearch(true)} className="text-[hsl(var(--nav-foreground))] hover:bg-[hsl(var(--nav-hover))]">
              <Search className="h-5 w-5" />
              <span className="sr-only">Suchen</span>
            </Button>

            <NotificationBell />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full p-0 text-[hsl(var(--nav-foreground))] hover:bg-[hsl(var(--nav-hover))]">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={userProfile?.avatar_url || undefined} alt={userProfile?.display_name || "Benutzer"} />
                    <AvatarFallback className="text-xs bg-[hsl(var(--nav-hover))] text-[hsl(var(--nav-foreground))]">
                      {userProfile?.display_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="sr-only">Benutzermenü öffnen</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => navigate("/profile/edit")}>
                  <User className="mr-2 h-4 w-4" />
                  Profil bearbeiten
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/settings")}>
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

      {showMobileSearch && (
        <div className="fixed inset-0 z-[60] bg-background">
          <div className="flex items-center gap-2 p-4 border-b">
            <Search className="h-5 w-5 text-muted-foreground shrink-0" />
            <Input
              ref={searchInputRef}
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Suchen..."
              className="flex-1 border-0 focus-visible:ring-0 px-0"
            />
            <Button variant="ghost" size="icon" aria-label="Suche schließen" onClick={closeMobileSearch}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="p-4 space-y-4 max-h-[calc(100vh-72px)] overflow-y-auto">
            {searchQuery.length < 2 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Mindestens 2 Zeichen eingeben.</p>
            ) : isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-8">Suche läuft…</p>
            ) : isError ? (
              <p className="text-sm text-destructive text-center py-8">Suche konnte nicht geladen werden.</p>
            ) : !hasResults ? (
              <p className="text-sm text-muted-foreground text-center py-8">Keine Treffer gefunden.</p>
            ) : (
              resultGroups.map((group) => (
                <div key={group.label} className="space-y-2">
                  <h3 className="text-xs uppercase tracking-wide text-muted-foreground">{group.label}</h3>
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <button
                        key={`${group.label}-${item.id}`}
                        type="button"
                        onClick={() => {
                          navigate(item.to);
                          closeMobileSearch();
                        }}
                        className="w-full rounded-md border p-3 text-left flex items-center gap-3 active:scale-[0.99]"
                      >
                        <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          {item.subtitle && (
                            <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                          )}
                        </div>
                        {item.subtitle === "Archiv" && <Badge variant="outline" className="ml-auto text-xs">Archiv</Badge>}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
