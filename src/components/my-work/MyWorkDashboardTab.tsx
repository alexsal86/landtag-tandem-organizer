import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardTasksSection } from '@/components/dashboard/DashboardTasksSection';
import { DashboardAppointments } from '@/components/my-work/MyWorkDashboardAppointments';
import { useDashboardAppointmentsData } from '@/hooks/useDashboardAppointmentsData';
import { useDashboardDeadlines } from '@/hooks/useDashboardDeadlines';
import { NewsWidget } from '@/components/widgets/NewsWidget';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { CalendarClock, CalendarDays, ClipboardList, Newspaper, Vote, Users } from 'lucide-react';
import { AppointmentRequestList } from '@/features/appointment-requests/AppointmentRequestList';
import { useNextJourFixeDate, useOpenAppointmentRequests } from '@/features/appointment-requests/useAppointmentRequests';
import { isUrgent } from '@/features/appointment-requests/logic';
import { useResolvedUserRole } from '@/hooks/useResolvedUserRole';
import { BriefingComposerCard, TodayBriefingPanel } from '@/features/briefings';
import { DashboardDecisionsWidget } from '@/components/dashboard/DashboardDecisionsWidget';
import { DashboardJourFixeWidget } from '@/components/dashboard/DashboardJourFixeWidget';
import { ErrorState, LoadingState } from '@/components/ui-patterns';
import { cn } from '@/lib/utils';

interface DashboardWidgetContainerProps {
  title: ReactNode;
  className?: string;
  headerAction?: ReactNode;
  compactTitle?: boolean;
  isLoading?: boolean;
  hasError?: boolean;
  loadingVariant?: 'list' | 'card' | 'detail' | 'inline';
  errorMessage?: string;
  children: ReactNode;
}

function DashboardWidgetContainer({
  title,
  className,
  headerAction,
  compactTitle = false,
  isLoading = false,
  hasError = false,
  loadingVariant = 'list',
  errorMessage = 'Daten konnten nicht geladen werden.',
  children,
}: DashboardWidgetContainerProps) {
  let content: ReactNode = children;

  if (hasError) {
    content = <ErrorState description={errorMessage} />;
  } else if (isLoading) {
    content = <LoadingState variant={loadingVariant} rows={3} />;
  }

  return (
    <Card className={cn('shadow-sm border-border/60 animate-fade-in', className)}>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 py-space-sm px-space-md">
        <CardTitle className={cn("font-medium", compactTitle ? "text-base" : "text-body-lg")}>{title}</CardTitle>
        {headerAction}
      </CardHeader>
      <CardContent className="px-space-md pb-space-md pt-0">{content}</CardContent>
    </Card>
  );
}

function DeadlinesWidget() {
  const { items, grouped, isLoading, isError } = useDashboardDeadlines();

  return (
    <DashboardWidgetContainer
      compactTitle
      title={
        <span className="inline-flex items-center gap-space-xs">
          <ClipboardList className="h-5 w-5 text-muted-foreground" />
          Fristen
        </span>
      }
      isLoading={isLoading}
      hasError={isError}
      errorMessage="Fristen konnten nicht geladen werden."
    >
      <DashboardTasksSection items={items} grouped={grouped} />
    </DashboardWidgetContainer>
  );
}

function AppointmentsWidget() {
  const dashboardData = useDashboardAppointmentsData();

  return (
    <DashboardWidgetContainer
      title={
        <span className="inline-flex items-center gap-space-xs">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          Nächste Termine
        </span>
      }
      compactTitle
      headerAction={<Link to="/calendar" className="text-sm text-primary hover:underline focus-visible:outline-primary">Kalender öffnen</Link>}
      isLoading={dashboardData.isLoading || dashboardData.tenantLoading}
      hasError={dashboardData.isError}
      loadingVariant="card"
      errorMessage="Termine konnten nicht geladen werden."
    >
      <DashboardAppointments data={dashboardData} />
    </DashboardWidgetContainer>
  );
}

/** Only appears when a request cannot wait for the next Jour fixe. */
function UrgentRequestsWidget() {
  const { data = [] } = useOpenAppointmentRequests();
  const { data: nextJf = null } = useNextJourFixeDate();
  if (!data.some((r) => isUrgent(r, nextJf))) return null;
  return (
    <DashboardWidgetContainer
      title={
        <span className="inline-flex items-center gap-space-xs">
          <CalendarClock className="h-4 w-4 text-destructive" />
          Eilige Terminanfragen
        </span>
      }
      compactTitle
      errorMessage="Anfragen konnten nicht geladen werden."
    >
      <p className="mb-1 text-xs text-muted-foreground">Vor dem nächsten Jour fixe zu entscheiden.</p>
      <AppointmentRequestList mode="urgent" hideWhenEmpty />
    </DashboardWidgetContainer>
  );
}

function NewsWidgetCard() {
  return (
    <DashboardWidgetContainer
      title={
        <span className="inline-flex items-center gap-space-xs">
          <Newspaper className="h-4 w-4 text-muted-foreground" />
          News
        </span>
      }
      className="min-w-0"
      errorMessage="News konnten nicht geladen werden."
    >
      <ErrorBoundary fallback={<ErrorState description="News konnten nicht geladen werden." />}>
        <NewsWidget compact />
      </ErrorBoundary>
    </DashboardWidgetContainer>
  );
}

export function MyWorkDashboardTab() {
  const { isAbgeordneter, isEmployee } = useResolvedUserRole();

  return (
    <div className="space-y-space-md animate-fade-in">
      <DashboardHeader />
      {isAbgeordneter && <TodayBriefingPanel />}
      {isEmployee && !isAbgeordneter && <BriefingComposerCard />}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,40fr)_minmax(0,35fr)_minmax(0,25fr)] gap-space-md items-start">
        <div className="flex flex-col gap-space-md min-w-0">
          <UrgentRequestsWidget />
          <AppointmentsWidget />
        </div>
        <div className="flex flex-col gap-space-md min-w-0">
          <DeadlinesWidget />
          <DashboardWidgetContainer
            title={<span className="inline-flex items-center gap-space-xs"><Vote className="h-4 w-4 text-muted-foreground" />Entscheidungen</span>}
            errorMessage="Entscheidungen konnten nicht geladen werden."
          >
            <ErrorBoundary fallback={<ErrorState description="Entscheidungen konnten nicht geladen werden." />}>
              <DashboardDecisionsWidget />
            </ErrorBoundary>
          </DashboardWidgetContainer>
        </div>
        <div className="flex flex-col gap-space-md min-w-0">
          <DashboardWidgetContainer
            title={<span className="inline-flex items-center gap-space-xs"><Users className="h-4 w-4 text-muted-foreground" />Jour fixe</span>}
            errorMessage="Jour fixe konnte nicht geladen werden."
          >
            <ErrorBoundary fallback={<ErrorState description="Jour fixe konnte nicht geladen werden." />}>
              <DashboardJourFixeWidget />
            </ErrorBoundary>
          </DashboardWidgetContainer>
          <NewsWidgetCard />
        </div>
      </div>
    </div>
  );
}
