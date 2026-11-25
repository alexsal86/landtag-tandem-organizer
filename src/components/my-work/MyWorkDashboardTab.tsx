import { DeputyAppointmentFocus } from "./DeputyAppointmentFocus";
import { SignatureFolder } from "./SignatureFolder";
import { AppointmentChangeBanner, AppointmentChangeSentList, useAlerts as useChangeAlerts } from "@/features/appointments/change-alerts/AppointmentChangeAlerts";
import { applyReportedStart, summarizeReportedChanges } from "@/features/appointments/change-alerts/changeModel";
import { TeamRitualDashboardCard } from "@/features/team-rituals/TeamRitualDashboardCard";
import { DeputyWaitingCard } from "@/features/decisions/DeputyWaitingCard";
import { OfficeDebriefInboxCard } from "@/features/appointments/briefing/OfficeDebriefInboxCard";
import { OfficeFeedbackCard } from "@/features/appointments/briefing/OfficeFeedbackCard";
import { PendingBriefingNotice } from "@/features/appointments/briefing/PendingBriefingNotice";
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardTasksSection } from '@/components/dashboard/DashboardTasksSection';
import { DashboardAppointments } from '@/components/my-work/MyWorkDashboardAppointments';
import { useDashboardAppointmentsData } from '@/hooks/useDashboardAppointmentsData';
import { useDashboardDeadlines } from '@/hooks/useDashboardDeadlines';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, CalendarClock, CalendarDays, Check, ClipboardList, Vote, Users } from 'lucide-react';

import { hasAppointmentEnded } from '@/utils/dashboard/daySummary';
import { AppointmentRequestList } from '@/features/appointment-requests/AppointmentRequestList';
import { useNextJourFixeDate, useOpenAppointmentRequests } from '@/features/appointment-requests/useAppointmentRequests';
import { isUrgent } from '@/features/appointment-requests/logic';
import { useWorkspaceView } from '@/contexts/WorkspaceViewContext';
import { BriefingComposerCard, TodayBriefingPanel } from '@/features/briefings';
import { DashboardDecisionsWidget } from '@/components/dashboard/DashboardDecisionsWidget';
import { DashboardJourFixeWidget } from '@/components/dashboard/DashboardJourFixeWidget';
import { ErrorState, LoadingState, WidgetLoadWarning } from '@/components/ui-patterns';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

/** Shows "Kalender öffnen" briefly, then shrinks to icon + arrow; expands again on hover/focus. */
function CollapsingCalendarLink() {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setCollapsed(true), 3000);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <Link
      to="/calendar"
      aria-label="Kalender öffnen"
      className="group/cal inline-flex h-7 items-center gap-1 rounded-md px-2 text-sm text-foreground transition-colors duration-base ease-standard hover:bg-muted focus-visible:outline-foreground"
    >
      <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span
        className={cn(
          'dashboard-link-label overflow-hidden whitespace-nowrap',
          collapsed ? 'max-w-0 opacity-0 group-hover/cal:max-w-32 group-hover/cal:opacity-100 group-focus-visible/cal:max-w-32 group-focus-visible/cal:opacity-100' : 'max-w-32 opacity-100',
        )}
      >
        Kalender öffnen
      </span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    </Link>
  );
}

interface DashboardWidgetContainerProps {
  title: ReactNode;
  icon?: LucideIcon;
  iconClassName?: string;
  className?: string;
  animationDelay?: number;
  headerAction?: ReactNode;
  compactTitle?: boolean;
  isLoading?: boolean;
  hasError?: boolean;
  loadingVariant?: 'list' | 'card' | 'detail' | 'inline';
  errorMessage?: string;
  onRetry?: () => void;
  /** Schmale Warnzeile für Teilausfälle; entfällt im Totalausfall (dann greift `hasError`). */
  warning?: ReactNode;
  children: ReactNode;
}

function DashboardWidgetContainer({
  title,
  icon: Icon,
  iconClassName,
  className,
  animationDelay = 0,
  headerAction,
  isLoading = false,
  hasError = false,
  loadingVariant = 'list',
  errorMessage = 'Daten konnten nicht geladen werden.',
  onRetry,
  warning,
  children,
}: DashboardWidgetContainerProps) {
  let content: ReactNode = children;

  if (hasError) {
    content = <ErrorState description={errorMessage} onRetry={onRetry} />;
  } else if (isLoading) {
    content = <LoadingState variant={loadingVariant} rows={3} />;
  }

  return (
    <Card className={cn('dashboard-motion-card animate-rise rounded-dashboard-card shadow-dashboard-card hover:shadow-dashboard-card-hover border-border/60', className)} style={{ animationDelay: `${animationDelay}ms` }}>
      <CardHeader className="flex min-h-[52px] flex-row flex-wrap items-center justify-between gap-2 space-y-0 pt-5 pb-3 px-5">
        <h3 className="inline-flex items-center gap-2 text-card-title">
          {Icon && <Icon className={cn("h-4 w-4 shrink-0 text-muted-foreground", iconClassName)} aria-hidden="true" />}
          {title}
        </h3>
        {headerAction}
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-0">
        {!hasError && warning}
        {content}
      </CardContent>
    </Card>
  );
}

function DeadlinesWidget() {
  const { items, grouped, isLoading, isError, failedSources, refetch } = useDashboardDeadlines();

  return (
    <DashboardWidgetContainer
      icon={ClipboardList} title="Fristen" animationDelay={60}
      isLoading={isLoading}
      hasError={isError}
      onRetry={refetch}
      errorMessage="Fristen konnten nicht geladen werden. Das heißt nicht, dass nichts ansteht."
      warning={failedSources.length > 0
        ? <WidgetLoadWarning
            message={`${failedSources.join(' und ')} konnten nicht geladen werden. Die übrigen Fristen sind vollständig.`}
            onRetry={refetch}
          />
        : undefined}
    >
      <DashboardTasksSection items={items} grouped={grouped} />
    </DashboardWidgetContainer>
  );
}

/** Zähler der offenen Freigaben: hält die Redaktion auf dem Dashboard sichtbar. */
function AppointmentsWidget({ isDeputyView }: { isDeputyView: boolean }) {
  const dashboardData = useDashboardAppointmentsData(true);
  const { data: changeAlerts = [] } = useChangeAlerts();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const noAppointmentsToday = dashboardData.isShowingTomorrow || dashboardData.appointments.length === 0;
  const allDone = !noAppointmentsToday && !dashboardData.isLoading && !dashboardData.tenantLoading && !dashboardData.isError
    && dashboardData.hasTenant
    && (dashboardData.isShowingTomorrow || dashboardData.appointments.every((appointment) => {
      const reportedStart = summarizeReportedChanges(changeAlerts, appointment.id).newStartTime;
      return hasAppointmentEnded(applyReportedStart(appointment, reportedStart), now);
    }));
  const title = noAppointmentsToday && !dashboardData.isLoading && !dashboardData.tenantLoading && !dashboardData.isError
    ? 'Dein Tag · keine Termine' : allDone ? (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {isDeputyView ? 'Dein Tag · alles erledigt' : 'Resümee heute · alles erledigt'}
      <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
    </span>
  ) : isDeputyView ? 'Dein Tag' : 'Nächste Termine';

  return (
    <>
      {isDeputyView && !dashboardData.isLoading && !dashboardData.isError && (
        <DeputyAppointmentFocus data={dashboardData} now={now} alerts={changeAlerts} />
      )}
      <DashboardWidgetContainer
        icon={CalendarDays} title={title}
        headerAction={<CollapsingCalendarLink />}
        isLoading={dashboardData.isLoading || dashboardData.tenantLoading}
        hasError={dashboardData.isError}
        onRetry={() => { void dashboardData.refetch(); }}
        loadingVariant="card"
        errorMessage="Termine konnten nicht geladen werden. Das heißt nicht, dass nichts ansteht."
        warning={dashboardData.failedSources.length > 0
          ? <WidgetLoadWarning
              message={`${dashboardData.failedSources.join(' und ')} konnten nicht geladen werden. Die übrigen Termine sind vollständig.`}
              onRetry={() => { void dashboardData.refetch(); }}
            />
          : undefined}
      >
        <DashboardAppointments data={dashboardData} />
      </DashboardWidgetContainer>
    </>
  );
}

/** Only appears when a request cannot wait for the next Jour fixe. */
function UrgentRequestsWidget() {
  const requests = useOpenAppointmentRequests();
  const nextJourFixe = useNextJourFixeDate();
  const data = requests.data ?? [];
  const nextJf = nextJourFixe.data ?? null;
  const hasError = requests.isError || nextJourFixe.isError;
  if (!hasError && !data.some((r) => isUrgent(r, nextJf))) return null;
  return (
    <DashboardWidgetContainer
      icon={CalendarClock} title="Eilige Terminanfragen"
      hasError={hasError}
      onRetry={() => { void requests.refetch(); void nextJourFixe.refetch(); }}
      errorMessage="Anfragen konnten nicht geladen werden. Das heißt nicht, dass nichts eilig ist."
    >
      <p className="mb-1 text-meta text-muted-foreground">Vor dem nächsten Jour fixe zu entscheiden.</p>
      <AppointmentRequestList mode="urgent" hideWhenEmpty />
    </DashboardWidgetContainer>
  );
}

export function MyWorkDashboardTab() {
  const { isDeputyView, isEmployeeView, loading } = useWorkspaceView();
  const [isLargeScreen, setIsLargeScreen] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsLargeScreen(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  if (loading) return <LoadingState variant="card" rows={3} />;

  return (
    <div key={isDeputyView ? "deputy" : "employee"} className="dashboard-motion mx-auto w-full max-w-6xl space-y-4">
      <div className="animate-rise"><DashboardHeader showTeamRituals={isLargeScreen} /></div>
      {isDeputyView && <AppointmentChangeBanner />}
      {isEmployeeView && <AppointmentChangeSentList />}
      {isEmployeeView && <PendingBriefingNotice />}
      {isDeputyView && <TodayBriefingPanel />}
      <div className="grid grid-cols-1 gap-4 items-start lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          <UrgentRequestsWidget />
          <AppointmentsWidget isDeputyView={isDeputyView} />
          {!isLargeScreen && <div className="w-full max-w-xs"><TeamRitualDashboardCard /></div>}
          {isDeputyView && <OfficeFeedbackCard />}
          {isEmployeeView && <OfficeDebriefInboxCard />}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          {isEmployeeView && <BriefingComposerCard />}
          {!isDeputyView && <DeadlinesWidget />}
          <DashboardWidgetContainer
            icon={Vote} title={isDeputyView ? "Braucht deine Entscheidung" : "Entscheidungen"} animationDelay={60}
            errorMessage="Entscheidungen konnten nicht geladen werden."
          >
            <ErrorBoundary fallback={<ErrorState description="Entscheidungen konnten nicht geladen werden." />}>
              <DashboardDecisionsWidget />
            </ErrorBoundary>
          </DashboardWidgetContainer>
          {isDeputyView && (
            <ErrorBoundary fallback={<ErrorState description="Die Unterschriftenmappe konnte nicht geladen werden." />}>
              <SignatureFolder />
            </ErrorBoundary>
          )}
          {isEmployeeView && <ErrorBoundary fallback={<ErrorState description="Entscheidungen beim Abgeordneten konnten nicht geladen werden." />}><DeputyWaitingCard /></ErrorBoundary>}
          {!isDeputyView && (
            <DashboardWidgetContainer
              icon={Users} title="Jour fixe" animationDelay={120}
              errorMessage="Jour fixe konnte nicht geladen werden."
            >
              <ErrorBoundary fallback={<ErrorState description="Jour fixe konnte nicht geladen werden." />}>
                <DashboardJourFixeWidget />
              </ErrorBoundary>
            </DashboardWidgetContainer>
          )}
        </div>
      </div>
    </div>
  );
}
