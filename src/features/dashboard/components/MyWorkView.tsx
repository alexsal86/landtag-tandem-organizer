import { DashboardDaylight } from "./DashboardDaylight";
import { useWorkspaceView } from "@/contexts/WorkspaceViewContext";
import { useLayoutEffect, useRef, useState, Suspense } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CheckSquare, Vote, Briefcase, StickyNote, Calendar, Plus, Search } from "lucide-react";

import { useMyWorkNewCounts } from "@/hooks/useMyWorkNewCounts";
import { useOpenApprovalCount } from "@/features/redaktion/hooks/useOpenApprovalCount";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { MyWorkTabErrorState } from "@/components/my-work/MyWorkTabErrorState";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { MY_WORK_TAB_VISIT_CONTEXTS } from "@/components/my-work/myWorkTabs";
import { useMyWorkActiveTab } from "@/components/my-work/hooks/useMyWorkActiveTab";
import { useMyWorkShellData } from "@/components/my-work/hooks/useMyWorkShellData";
import { trackPageVisit } from "@/hooks/useRecentlyVisited";
import { MY_WORK_TABS } from "@/components/my-work/myWorkTabs";
import { OnboardingChecklistCard } from "@/components/onboarding/OnboardingChecklistCard";

const MyWorkQuickCapture = lazyWithRetry(() => import("@/components/my-work/MyWorkQuickCapture").then(m => ({ default: m.MyWorkQuickCapture })));
const MyWorkNotesList = lazyWithRetry(() => import("@/components/my-work/MyWorkNotesList").then(m => ({ default: m.MyWorkNotesList })));
const MyWorkTasksTab = lazyWithRetry(() => import("@/components/my-work/MyWorkTasksTab").then(m => ({ default: m.MyWorkTasksTab })));
const MyWorkDecisionsTab = lazyWithRetry(() => import("@/components/my-work/MyWorkDecisionsTab").then(m => ({ default: m.MyWorkDecisionsTab })));
const MyWorkCasesWorkspace = lazyWithRetry(() => import("@/components/my-work/MyWorkCasesWorkspace").then(m => ({ default: m.MyWorkCasesWorkspace })));
const MyWorkTeamTab = lazyWithRetry(() => import("@/components/my-work/MyWorkTeamTab").then(m => ({ default: m.MyWorkTeamTab })));
const MyWorkRedaktionTab = lazyWithRetry(() => import("@/components/my-work/MyWorkRedaktionTab").then(m => ({ default: m.MyWorkRedaktionTab })));
const MyWorkTerminePlanungTab = lazyWithRetry(() => import("@/components/my-work/MyWorkTerminePlanungTab").then(m => ({ default: m.MyWorkTerminePlanungTab })));
const MyWorkTimeTrackingTab = lazyWithRetry(() => import("@/components/my-work/MyWorkTimeTrackingTab").then(m => ({ default: m.MyWorkTimeTrackingTab })));
const MyWorkAppointmentFeedbackTab = lazyWithRetry(() => import("@/components/my-work/MyWorkAppointmentFeedbackTab").then(m => ({ default: m.MyWorkAppointmentFeedbackTab })));
const MyWorkFeedbackFeedTab = lazyWithRetry(() => import("@/components/my-work/MyWorkFeedbackFeedTab").then(m => ({ default: m.MyWorkFeedbackFeedTab })));
const MyWorkDashboardTab = lazyWithRetry(() => import("@/components/my-work/MyWorkDashboardTab").then(m => ({ default: m.MyWorkDashboardTab })));

export function MyWorkView() {
  const { isDeputyView } = useWorkspaceView();
  const navigate = useNavigate();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const {
    countLoadError,
    feedbackFeedCoreRolesOnly,
    isCountsLoading,
    loadCounts,
    role,
    roleFlags,
    shouldIncludeTeamCountRef,
  } = useMyWorkShellData();
  const { activeTab, setActiveTab, setSearchParams, visibleTabs } = useMyWorkActiveTab({
    role,
    feedbackFeedCoreRolesOnly,
  });


  const navigationTabs = isDeputyView
    ? visibleTabs.filter(tab => tab.value !== "jourFixe" && tab.value !== "redaktion")
    : visibleTabs;

  const tabTrack = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const track = tabTrack.current;
    if (!track) return;
    const current = track.querySelector<HTMLButtonElement>('[aria-current="page"]');
    const positionIndicator = () => {
      track.style.setProperty("--active-tab-x", `${current?.offsetLeft ?? 0}px`);
      track.style.setProperty("--active-tab-width", `${current?.offsetWidth ?? 0}px`);
    };

    positionIndicator();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(positionIndicator);
    track.querySelectorAll("button").forEach(button => observer.observe(button));
    return () => observer.disconnect();
  }, [activeTab, visibleTabs, isDeputyView]);

  const { newCounts, markTabAsVisited, refreshCounts } = useMyWorkNewCounts();
  const { openApprovals, isEnabled: isRedaktionEnabled } = useOpenApprovalCount();

  const handleTabChange = (tab: keyof typeof MY_WORK_TAB_VISIT_CONTEXTS) => {
    setActiveTab(tab);

    // Track tab-specific recently visited entry
    if (tab !== "dashboard") {
      const tabConfig = MY_WORK_TABS.find(t => t.value === tab);
      if (tabConfig) {
        trackPageVisit(
          `mywork-${tab}`,
          `Meine Arbeit › ${tabConfig.label}`,
          tabConfig.icon.displayName || "NotebookTabs",
          `/mywork?tab=${tab}`
        );
      }
    }

    const contexts = MY_WORK_TAB_VISIT_CONTEXTS[tab] || [];
    if (contexts.length === 0) return;

    contexts.forEach((context) => {
      markTabAsVisited(context as Parameters<typeof markTabAsVisited>[0]);
    });
    refreshCounts(contexts as Parameters<typeof refreshCounts>[0]);
  };

  const handleNoteSaved = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const tabFallback = (
    <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
      {isCountsLoading ? "Bereich wird geladen…" : "Lade Daten…"}
    </div>
  );

  const tabError = (label: string) => (
    <MyWorkTabErrorState
      title={`${label} konnte nicht geladen werden`}
      description="Bitte erneut versuchen oder die Seite neu laden."
      onRetry={() => window.location.reload()}
    />
  );

  return (
    <div className={`min-h-[calc(100vh-8rem)] w-full ${activeTab === "dashboard" ? "relative isolate" : ""}`}>
      {activeTab === "dashboard" && <DashboardDaylight />}
      <div className="flex w-full flex-col items-end gap-3 px-4 pt-4 sm:flex-row sm:items-center sm:justify-between md:px-6 lg:px-8">
        <nav aria-label="Meine Arbeit" className="flex max-w-full min-w-0 self-stretch overflow-x-auto rounded-full border border-border/80 bg-card/90 shadow-lg shadow-black/8 backdrop-blur-sm [scrollbar-width:none]">
          <div ref={tabTrack} className="relative isolate flex w-max min-w-full items-center gap-1 p-1">
            <span aria-hidden="true" className="pointer-events-none absolute inset-y-1 left-0 -z-10 w-(--active-tab-width) translate-x-(--active-tab-x) rounded-full bg-slate-900 shadow-sm transition-[translate,width] duration-350 ease-in-out motion-reduce:transition-none dark:bg-slate-100" />
            {navigationTabs.map((tab) => {
              const hasNew = tab.countKey ? newCounts[tab.countKey] > 0 : false;
              const isActiveTab = activeTab === tab.value;

              return (
                <button
                  key={tab.value}
                  onClick={() => handleTabChange(tab.value)}
                  data-help-id={`mywork-tab-${tab.value}`}
                  type="button"
                  aria-current={isActiveTab ? "page" : undefined}
                  className={`flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring ${
                    isActiveTab
                      ? "text-white dark:text-slate-950"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {tab.value === "dashboard" ? "Heute" : tab.label}
                  {hasNew && !isActiveTab && (
                    <span className="size-2 rounded-full bg-[#397d16] dark:bg-[#83c84e]">
                      <span className="sr-only">Neue Einträge</span>
                    </span>
                  )}
                  {tab.value === "redaktion" && isRedaktionEnabled && openApprovals > 0 && (
                    <span
                      className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-primary"
                      aria-label={`${openApprovals} offene ${openApprovals === 1 ? "Freigabe" : "Freigaben"}`}
                    >
                      {openApprovals}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" aria-label="Global suchen" aria-keyshortcuts="Control+K Meta+K"
            className="size-11 rounded-full border-border/80 bg-card/90 p-0 text-muted-foreground shadow-sm hover:border-[#2e6018] hover:bg-card/90 hover:text-muted-foreground lg:w-auto lg:px-4"
            onClick={() => window.dispatchEvent(new CustomEvent("openGlobalSearch"))}>
            <Search aria-hidden="true" />
            <span className="hidden lg:inline">Suchen</span>
            <kbd aria-hidden="true" className="hidden rounded-md bg-muted px-1.5 text-xs xl:inline">⌘K</kbd>
          </Button>
          <NotificationBell variant="island" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                className="size-11 rounded-full bg-[#2e6018] p-0 text-white shadow-sm hover:bg-[#244b13]"
                aria-label="Neu erstellen"
                data-help-id="mywork-new-menu"
              >
                <Plus aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => handleTabChange("capture")}>
                <StickyNote className="h-4 w-4 mr-2" />
                Quick Note
              </DropdownMenuItem>
              {activeTab !== "tasks" && (
                <DropdownMenuItem onClick={() => setSearchParams(new URLSearchParams([["tab", "tasks"], ["action", "create-task"]]))}>
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Aufgabe
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setSearchParams(new URLSearchParams([["tab", "decisions"], ["action", "create-decision"]]))}>
                <Vote className="h-4 w-4 mr-2" />
                Entscheidung
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSearchParams(new URLSearchParams([["tab", "jourFixe"], ["action", "create-meeting"]]))}>
                <Calendar className="h-4 w-4 mr-2" />
                Jour Fixe
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSearchParams(new URLSearchParams([["tab", "cases"], ["action", "create-caseitem"]]))}>
                <Briefcase className="h-4 w-4 mr-2" />
                Anliegen erstellen
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSearchParams(new URLSearchParams([["tab", "cases"], ["action", "create-casefile"]]))}>
                <Briefcase className="h-4 w-4 mr-2" />
                Akte erstellen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className={activeTab === "dashboard" ? "mx-auto w-full max-w-6xl px-4 py-6 md:px-6 lg:px-8" : "p-6"}>
      <OnboardingChecklistCard className="mb-4" />
      {countLoadError && (
        <Alert className="mb-4" variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{countLoadError}</span>
            <Button size="sm" variant="outline" onClick={() => loadCounts(shouldIncludeTeamCountRef.current)}>
              Erneut laden
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {activeTab === "dashboard" && (
        <ErrorBoundary fallback={tabError("Dashboard")}>
          <Suspense fallback={tabFallback}>
            <MyWorkDashboardTab />
          </Suspense>
        </ErrorBoundary>
      )}

      {activeTab === "capture" && (
        <ErrorBoundary fallback={tabError("Quick Notes")}>
          <Suspense fallback={tabFallback}>
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
              <MyWorkQuickCapture onNoteSaved={handleNoteSaved} />
              <MyWorkNotesList refreshTrigger={refreshTrigger} />
            </div>
          </Suspense>
        </ErrorBoundary>
      )}

      {activeTab === "tasks" && <ErrorBoundary fallback={tabError("Aufgaben")}><Suspense fallback={tabFallback}><MyWorkTasksTab /></Suspense></ErrorBoundary>}
      {activeTab === "decisions" && <ErrorBoundary fallback={tabError("Entscheidungen")}><Suspense fallback={tabFallback}><MyWorkDecisionsTab /></Suspense></ErrorBoundary>}
      {activeTab === "jourFixe" && <ErrorBoundary fallback={tabError("Jour fixe & Planungen")}><Suspense fallback={tabFallback}><MyWorkTerminePlanungTab /></Suspense></ErrorBoundary>}
      {activeTab === "cases" && <ErrorBoundary fallback={tabError("Vorgänge")}><Suspense fallback={tabFallback}><MyWorkCasesWorkspace /></Suspense></ErrorBoundary>}
      {activeTab === "redaktion" && <ErrorBoundary fallback={tabError("Redaktion")}><Suspense fallback={tabFallback}><MyWorkRedaktionTab /></Suspense></ErrorBoundary>}
      {activeTab === "time" && <ErrorBoundary fallback={tabError("Meine Zeit")}><Suspense fallback={tabFallback}><MyWorkTimeTrackingTab /></Suspense></ErrorBoundary>}
      {activeTab === "team" && <ErrorBoundary fallback={tabError("Team")}><Suspense fallback={tabFallback}><MyWorkTeamTab /></Suspense></ErrorBoundary>}
      {activeTab === "feedbackfeed" && (
        <Suspense fallback={tabFallback}>
          {roleFlags.isAbgeordneter ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MyWorkAppointmentFeedbackTab />
              <MyWorkFeedbackFeedTab />
            </div>
          ) : (
            <MyWorkFeedbackFeedTab />
          )}
        </Suspense>
      )}
      </div>
    </div>
  );
}
