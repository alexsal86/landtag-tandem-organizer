import "./appNavigation/sidebar.css";
import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { ChevronRight, Compass, MoreHorizontal, Plus, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useTenantModuleGate } from "@/hooks/useTenantFeatureFlag";
import { useResolvedUserRole } from "@/hooks/useResolvedUserRole";
import { useRecentlyVisited } from "@/hooks/useRecentlyVisited";
import { useQuickAccessPages } from "@/hooks/useQuickAccessPages";
import { useUserPreference } from "@/hooks/useUserPreference";
import { useMatrixUnread } from "@/contexts/MatrixUnreadContext";
import { useWorkspaceView } from "@/contexts/WorkspaceViewContext";
import { useGlobalCreateActions } from "@/components/layout/globalCreateActions";
import { SHOW_RECENT_PREF_KEY } from "./appNavigation/sidebarMode";
import { targetsSamePage } from "@/lib/quickAccessTargets";
import { cn } from "@/lib/utils";
import { adminDestination, isDestinationAllowed, isNavigationModuleAllowed, navigationSections, topicsDestination, type NavigationDestination } from "./navigationConfig";
import { NavGroupPreview } from "./appNavigation/NavGroupPreview";
import { QuickAccessSection, RecentlyVisitedSection } from "./appNavigation/QuickAccessSection";
import { FocusSummary } from "./appNavigation/FocusSummary";
import { appointmentLabel } from "./appNavigation/sidebarAppointments";
import { CommandSearchTrigger, SidebarIconButton } from "./appNavigation/SidebarControls";
import { WorkspaceHeader } from "./appNavigation/WorkspaceHeader";
import { SidebarFooter } from "./appNavigation/SidebarFooter";
import { useNavPanelData } from "./appNavigation/useNavPanelData";
import { useFocusSummary } from "./appNavigation/useFocusSummary";
import { useSavedNavigation } from "./appNavigation/useSavedNavigation";
import { useSidebarNavigation } from "./appNavigation/useSidebarNavigation";
import type { NavigationProps, QuickAccessAddCategory, NavPreviewGroup } from "./appNavigation/types";

type Badge = { value: number | string; kind: "action" | "unread" | "time"; label: string };

export function AppNavigation({
  activeSection, onNavigate, isMobile, onFollowHelpHint, compact = false, ghost, onToggle,
}: NavigationProps & { compact?: boolean; ghost?: boolean; onToggle?: () => void }) {
  const access = useResolvedUserRole();
  const moduleEnabled = useTenantModuleGate(false);
  const { isDeputyView } = useWorkspaceView();
  const { totalUnreadCount } = useMatrixUnread();
  const { pages, addPage, removePage } = useQuickAccessPages();
  const { recentPages } = useRecentlyVisited();
  const [showRecent] = useUserPreference(SHOW_RECENT_PREF_KEY, false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [category, setCategory] = useState<QuickAccessAddCategory | null>(null);
  const [context, setContext] = useState<string | null>(null);
  const afterContextClose = useRef<(() => void) | null>(null);
  const [railResearchOpen, setRailResearchOpen] = useState(false);
  const researchId = useId();
  const actions = useGlobalCreateActions();
  const navigateTo = useSidebarNavigation();
  const sections = navigationSections.map(section => ({
    ...section, items: section.items.filter(item => isDestinationAllowed(item, access) && isNavigationModuleAllowed(item.route, moduleEnabled)),
  }));
  const research = sections.find(section => section.id === "research")!;
  const activeResearch = research.items.some(item => item.id === activeSection);
  const [researchOpen, setResearchOpen] = useState(activeResearch);
  useEffect(() => {
    if (activeResearch) setResearchOpen(true);
  }, [activeResearch, activeSection]);

  const previewGroup: NavPreviewGroup | null = sections.flatMap(section => section.items).find(item => item.id === context)?.preview ?? null;
  const data = useNavPanelData({ previewGroup, quickAccessPopoverOpen: pickerOpen, quickAccessAddCategory: category });
  const { approvalCount, taskCount, caseCount } = useFocusSummary(true, access.isAbgeordneter && isDeputyView, moduleEnabled("module.casefiles"));
  const personalActions = approvalCount + taskCount + caseCount;
  const personalActionLabel = [
    approvalCount && `${approvalCount} offene Freigaben`,
    taskCount && `${taskCount} persönliche Aufgaben`,
    caseCount && `${caseCount} Vorgänge mit Handlungsbedarf`,
  ].filter(Boolean).join(", ");
  const displayed = useSavedNavigation(pages, access, true);
  const recentlyVisited = useSavedNavigation(showRecent ? recentPages : [], access, !!showRecent);
  const pinnable = [...sections.flatMap(section => section.items), topicsDestination];
  const options = pinnable.map(pinFor);
  const closeAfterNavigation = () => {
    setContext(null);
    setRailResearchOpen(false);
    onNavigate?.();
  };

  function pinFor(item: NavigationDestination) {
    return { id: item.id, label: item.label, icon: item.iconName, route: item.route };
  }

  function activate(event: MouseEvent, item: NavigationDestination) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    closeAfterNavigation();
    navigateTo(item);
  }

  function visitSavedPage(event: MouseEvent, route: string) {
    const item = pinnable.find(item => item.route === route);
    if (item) activate(event, item);
  }

  const badges: Record<string, Badge | undefined> = {
    mywork: personalActions > 0 ? { value: personalActions, kind: "action", label: personalActionLabel } : undefined,
    tasks: taskCount > 0 ? { value: taskCount, kind: "action", label: `${taskCount} persönliche Aufgaben mit Handlungsbedarf` } : undefined,
    chat: totalUnreadCount > 0 ? { value: totalUnreadCount, kind: "unread", label: `${totalUnreadCount} ungelesene Chatnachrichten` } : undefined,
    calendar: data.nextAppointment ? { value: appointmentLabel(data.nextAppointment), kind: "time", label: `Nächster Termin · ${appointmentLabel(data.nextAppointment)}` } : undefined,
  };

  const renderBadge = (badge: Badge, rail: boolean) => (
    <span aria-hidden="true" className={cn("mission-badge", `mission-badge-${badge.kind}`, !rail && "mission-row-badge")}>
      {rail && badge.kind === "time" ? <span className="mission-time-dot" /> : typeof badge.value === "number" && badge.value > 99 ? "99+" : badge.value}
    </span>
  );

  const renderItem = (item: NavigationDestination, rail = compact) => {
    const badge = badges[item.id];
    const pin = pages.find(page => targetsSamePage(page, item));
    const togglePin = () => { if (pin) removePage(pin.id); else addPage(pinFor(item)); };
    const pinLabel = pin ? `${item.label} aus Schnellzugriff entfernen` : `${item.label} anheften`;
    const itemActions = actions.filter(action => action.destination === item.id);
    const link = (
      <Link to={item.route} onClick={event => activate(event, item)}
        aria-keyshortcuts={!rail && item.preview ? "ArrowRight" : undefined}
        onKeyDown={event => {
          if (!rail && item.preview && event.key === "ArrowRight" && !event.altKey && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
            event.preventDefault();
            setContext(item.id);
          }
        }}
        aria-current={activeSection === item.id ? "page" : undefined}
        aria-label={badge ? `${item.label} · ${badge.label}` : item.label}
        className={cn("mission-link", rail && "mission-rail-link")}>
        <item.icon aria-hidden="true" />
        {!rail && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
        {rail && badge && renderBadge(badge, true)}
      </Link>
    );

    return (
      <div className="mission-row" key={item.id}>
        {rail ? <Tooltip><TooltipTrigger asChild>{link}</TooltipTrigger><TooltipContent className="mission-tooltip" side="right">
          {item.label}{badge && ` · ${badge.label}`}
        </TooltipContent></Tooltip> : link}
        {!rail && !item.preview && (
          <div className="mission-row-actions">
            {item.create && (
              <Link to={item.create.route} className="mission-icon" aria-label={item.create.label} title={item.create.label} onClick={closeAfterNavigation}>
                <Plus aria-hidden="true" />
              </Link>
            )}
            {itemActions.map(action => (
              <SidebarIconButton key={action.id} label={action.label} onClick={() => action.run()}><Plus aria-hidden="true" /></SidebarIconButton>
            ))}
            <SidebarIconButton label={pinLabel} aria-pressed={!!pin} onClick={togglePin}>
              <Star className={cn(pin && "fill-current")} aria-hidden="true" />
            </SidebarIconButton>
          </div>
        )}
        {!rail && item.preview && (
          <div className="mission-row-actions">
            <Popover open={context === item.id} onOpenChange={open => setContext(open ? item.id : null)}>
              <PopoverTrigger asChild>
                <button type="button" className="mission-icon" aria-label={`Aktionen für ${item.label}`} title={`Aktionen für ${item.label}`}>
                  <MoreHorizontal aria-hidden="true" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="right" align="start" aria-label={item.label} className="w-72 max-w-[calc(100vw-1rem)] p-2" onCloseAutoFocus={() => {
                const action = afterContextClose.current;
                afterContextClose.current = null;
                if (action) window.setTimeout(action, 0);
              }}>
                <NavGroupPreview group={item.preview} data={data} onNavigate={closeAfterNavigation} />
                <div className="mt-1 border-t pt-1">
                  {item.create && (
                    <Link to={item.create.route} className="mission-preview-link flex items-center gap-2" onClick={closeAfterNavigation}>
                      <Plus className="size-4" aria-hidden="true" />{item.create.label}
                    </Link>
                  )}
                  {itemActions.map(action => (
                    <button key={action.id} type="button" className="mission-preview-link flex items-center gap-2" onClick={() => {
                      afterContextClose.current = () => action.run();
                      setContext(null);
                    }}>
                      <action.icon className="size-4" aria-hidden="true" />{action.label}
                    </button>
                  ))}
                  <button type="button" className="mission-preview-link flex items-center gap-2" onClick={() => {
                    togglePin();
                    setContext(null);
                  }}>
                    <Star className={cn("size-4", pin && "fill-current")} aria-hidden="true" />
                    {pin ? "Aus Schnellzugriff entfernen" : "Zum Schnellzugriff hinzufügen"}
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}
        {!rail && badge && renderBadge(badge, false)}
      </div>
    );
  };

  const renderSection = (section: (typeof sections)[number]) => (
    <section key={section.id} aria-label={section.label}>
      {!compact && <div className={cn("mission-section-heading", section.id === "focus" && "mission-focus-heading")}>
        <h2>{section.label}</h2>
        {section.id === "focus" && <span className="mission-meta">Heute</span>}
      </div>}
      {section.items.map(item => renderItem(item))}
      {section.id === "focus" && !compact && (
        <FocusSummary approvalCount={approvalCount} nextAppointment={data.nextAppointment} onNavigate={closeAfterNavigation} />
      )}
    </section>
  );

  return (
    <TooltipProvider delayDuration={250} disableHoverableContent>
      <nav aria-label="Hauptnavigation" className={cn("mission-sidebar", compact && "mission-sidebar-compact", isMobile && "mission-sidebar-mobile")}>
        <div className="mission-top">
          <WorkspaceHeader compact={compact} onNavigate={closeAfterNavigation} />
          <CommandSearchTrigger compact={compact} />
        </div>
        <div className="mission-scroll">
          {sections.filter(section => section.id === "focus").map(renderSection)}
          <QuickAccessSection compact={compact} pages={displayed} options={options} addPage={addPage} removePage={removePage}
            onNavigate={closeAfterNavigation} onVisitPage={visitSavedPage} pickerOpen={pickerOpen} setPickerOpen={setPickerOpen} category={category} setCategory={setCategory} data={data} />
          <RecentlyVisitedSection compact={compact} pages={recentlyVisited} favorites={displayed} onNavigate={closeAfterNavigation} onVisitPage={visitSavedPage}
            togglePin={page => {
              const pin = pages.find(pin => targetsSamePage(pin, page));
              if (pin) removePage(pin.id);
              else addPage(page);
            }} />
          <div className="mission-divider">{!compact && <span>Workspace</span>}</div>
          {sections.filter(section => section.id === "parliament" || section.id === "office").map(renderSection)}
          {compact ? (
            <Popover open={railResearchOpen} onOpenChange={setRailResearchOpen}>
              <PopoverTrigger className="mission-icon" aria-label="Recherche" title="Recherche" data-active={activeResearch}>
                <Compass aria-hidden="true" />
              </PopoverTrigger>
              <PopoverContent side="right" align="start" aria-label="Recherche" className="mission-popover w-56 p-2">
                <div className="mission-section-heading"><h2>Recherche</h2></div>
                {research.items.map(item => renderItem(item, false))}
              </PopoverContent>
            </Popover>
          ) : (
            <Collapsible open={researchOpen} onOpenChange={setResearchOpen}>
              <h2>
                <CollapsibleTrigger className="mission-section-heading mission-research" aria-controls={researchId}>
                  Recherche <ChevronRight aria-hidden="true" className="size-4" />
                </CollapsibleTrigger>
              </h2>
              <CollapsibleContent id={researchId} className="mission-research-content">
                {research.items.map(item => renderItem(item))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
        <SidebarFooter compact={compact} ghost={ghost} profile={data.userProfile} hasAdminAccess={access.hasAdminAccess}
          isAdminPage={activeSection === "administration"} onAdmin={() => { closeAfterNavigation(); navigateTo(adminDestination); }}
          onNavigate={closeAfterNavigation} onFollowHelpHint={onFollowHelpHint} onToggle={onToggle} />
      </nav>
    </TooltipProvider>
  );
}
