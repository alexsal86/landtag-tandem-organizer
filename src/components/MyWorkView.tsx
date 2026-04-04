import { useEffect, useState, Suspense } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CheckSquare, Vote, Briefcase, StickyNote, Calendar, Plus } from "lucide-react";
import { PageHelpButton } from "@/components/shared/PageHelpButton";
import { MYWORK_HELP_CONTENT } from "@/config/helpContent";
import { useMyWorkSettings } from "@/hooks/useMyWorkSettings";
import { useMyWorkNewCounts } from "@/hooks/useMyWorkNewCounts";
import { useAppSettings } from "@/hooks/useAppSettings";
import { MyWorkTabErrorState } from "@/components/my-work/MyWorkTabErrorState";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MY_WORK_TAB_VISIT_CONTEXTS } from "@/components/my-work/myWorkTabs";
import { useMyWorkActiveTab } from "@/components/my-work/hooks/useMyWorkActiveTab";
import { useMyWorkShellData } from "@/components/my-work/hooks/useMyWorkShellData";

const MyWorkQuickCapture = lazyWithRetry(() => import("./my-work/MyWorkQuickCapture").then(m => ({ default: m.MyWorkQuickCapture })));
const MyWorkNotesList = lazyWithRetry(() => import("./my-work/MyWorkNotesList").then(m => ({ default: m.MyWorkNotesList })));
const MyWorkTasksTab = lazyWithRetry(() => import("./my-work/MyWorkTasksTab").then(m => ({ default: m.MyWorkTasksTab })));
const MyWorkDecisionsTab = lazyWithRetry(() => import("./my-work/MyWorkDecisionsTab").then(m => ({ default: m.MyWorkDecisionsTab })));
const MyWorkCasesWorkspace = lazyWithRetry(() => import("./my-work/MyWorkCasesWorkspace").then(m => ({ default: m.MyWorkCasesWorkspace })));
const MyWorkTeamTab = lazyWithRetry(() => import("./my-work/MyWorkTeamTab").then(m => ({ default: m.MyWorkTeamTab })));
const MyWorkRedaktionTab = lazyWithRetry(() => import("./my-work/MyWorkRedaktionTab").then(m => ({ default: m.MyWorkRedaktionTab })));
const MyWorkTerminePlanungTab = lazyWithRetry(() => import("./my-work/MyWorkTerminePlanungTab").then(m => ({ default: m.MyWorkTerminePlanungTab })));
const MyWorkTimeTrackingTab = lazyWithRetry(() => import("./my-work/MyWorkTimeTrackingTab").then(m => ({ default: m.MyWorkTimeTrackingTab })));
const MyWorkAppointmentFeedbackTab = lazyWithRetry(() => import("./my-work/MyWorkAppointmentFeedbackTab").then(m => ({ default: m.MyWorkAppointmentFeedbackTab })));
const MyWorkFeedbackFeedTab = lazyWithRetry(() => import("./my-work/MyWorkFeedbackFeedTab").then(m => ({ default: m.MyWorkFeedbackFeedTab })));
const MyWorkDashboardTab = lazyWithRetry(() => import("./my-work/MyWorkDashboardTab").then(m => ({ default: m.MyWorkDashboardTab })));

export function MyWorkView() {
  const { app_logo_url } = useAppSettings();
  const navigate = useNavigate();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isTabLogoError, setIsTabLogoError] = useState(false);
  const {
    countLoadError,
    feedbackFeedCoreRolesOnly,
    isCountsLoading,
    loadCounts,
    role,
    roleFlags,
    shouldIncludeTeamCountRef,
    totalCounts,
  } = useMyWorkShellData();
  const { activeTab, setActiveTab, setSearchParams, visibleTabs } = useMyWorkActiveTab({
    role,
    feedbackFeedCoreRolesOnly,
  });

  const { badgeDisplayMode } = useMyWorkSettings();
  const { newCounts, markTabAsVisited, refreshCounts } = useMyWorkNewCounts();

  useEffect(() => {
    setIsTabLogoError(false);
  }, [app_logo_url]);

  const handleTabChange = (tab: keyof typeof MY_WORK_TAB_VISIT_CONTEXTS) => {
    setActiveTab(tab);

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
    <div className="min-h-[calc(100vh-8rem)] p-6">
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

      <div className="mb-6 flex items-center justify-between gap-3 border-b">
        <div className="flex min-w-0 flex-1 overflow-x-auto">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const count = (() => {
              if (tab.value === "feedbackfeed") return newCounts.feedbackFeed || 0;
              if (!tab.countKey) return 0;
              if (tab.countKey === "team") return newCounts.team || 0;
              if (badgeDisplayMode === "new") {
                const newCountsMap: Record<string, keyof typeof newCounts> = {
                  tasks: "tasks",
                  decisions: "decisions",
                  jourFixe: "jourFixe",
                  cases: "cases",
                  plannings: "plannings",
                };
                const key = newCountsMap[tab.countKey];
                return key ? newCounts[key] : 0;
              }
              return totalCounts[tab.countKey];
            })();
            const isActiveTab = activeTab === tab.value;
            const badgeVariant = tab.badgeVariant || (badgeDisplayMode === "new" ? "destructive" : "secondary");

            return (
              <button
                key={tab.value}
                onClick={() => handleTabChange(tab.value)}
                className={`flex items-center gap-1.5 ${tab.isLogo ? "px-2" : "px-4"} py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActiveTab
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.isLogo && app_logo_url && !isTabLogoError ? (
                  <img
                    src={app_logo_url}
                    alt="Logo"
                    className="h-8 w-8 object-contain rounded flex-shrink-0"
                    crossOrigin="anonymous"
                    onError={() => setIsTabLogoError(true)}
                  />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
                {tab.label}
                {count > 0 && (
                  <Badge variant={badgeVariant} className="ml-1 h-5 min-w-5 text-xs">
                    {count}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-2 pb-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1">
                <Plus className="h-4 w-4" />
                Neu
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => handleTabChange("capture")}>
                <StickyNote className="h-4 w-4 mr-2" />
                Quick Note
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSearchParams(new URLSearchParams([["tab", "tasks"], ["action", "create-task"]]))}>
                <CheckSquare className="h-4 w-4 mr-2" />
                Aufgabe
              </DropdownMenuItem>
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

          {MYWORK_HELP_CONTENT[activeTab] && (
            <PageHelpButton
              title={MYWORK_HELP_CONTENT[activeTab].title}
              description={MYWORK_HELP_CONTENT[activeTab].description}
              features={MYWORK_HELP_CONTENT[activeTab].features}
            />
          )}
        </div>
      </div>

      {activeTab === "dashboard" && (
        <ErrorBoundary fallback={tabError("Dashboard")}>
          <Suspense fallback={tabFallback}>
            <MyWorkDashboardTab />
          </Suspense>
        </ErrorBoundary>
      )}

      {activeTab === "capture" && (
        <Suspense fallback={tabFallback}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MyWorkQuickCapture onNoteSaved={handleNoteSaved} />
            <MyWorkNotesList refreshTrigger={refreshTrigger} />
          </div>
        </Suspense>
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
  );
}
