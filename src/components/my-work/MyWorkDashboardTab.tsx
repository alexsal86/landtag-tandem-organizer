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
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, CalendarClock, CalendarDays, ClipboardList, Newspaper, Vote, Users } from 'lucide-react';
import { AppointmentRequestList } from '@/features/appointment-requests/AppointmentRequestList';
import { useNextJourFixeDate, useOpenAppointmentRequests } from '@/features/appointment-requests/useAppointmentRequests';
import { isUrgent } from '@/features/appointment-requests/logic';
import { useResolvedUserRole } from '@/hooks/useResolvedUserRole';
import { BriefingComposerCard, TodayBriefingPanel } from '@/features/briefings';
import { DashboardDecisionsWidget } from '@/components/dashboard/DashboardDecisionsWidget';
import { DashboardJourFixeWidget } from '@/components/dashboard/DashboardJourFixeWidget';
import { ErrorState, LoadingState } from '@/components/ui-patterns';
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
      className="group/cal inline-flex h-7 items-center gap-1 rounded-md px-2 text-sm text-primary transition-colors duration-base ease-standard hover:bg-primary/10 focus-visible:outline-primary"
    >
      <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span
        className={cn(
          'overflow-hidden whitespace-nowrap transition-all duration-slow ease-emphasized',
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
  icon: Icon,
  iconClassName,
  className,
  headerAction,
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
        <CardTitle className="inline-flex items-center gap-2 text-base font-medium leading-6">
          {Icon && <Icon className={cn("h-5 w-5 shrink-0 text-muted-foreground", iconClassName)} aria-hidden="true" />}
          {title}
        </CardTitle>
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
      icon={ClipboardList} title="Fristen"
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
      icon={CalendarDays} title="Nächste Termine"
      headerAction={<CollapsingCalendarLink />}
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
      icon={CalendarClock} iconClassName="text-destructive" title="Eilige Terminanfragen"
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
      icon={Newspaper} title="News"
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
            icon={Vote} title="Entscheidungen"
            errorMessage="Entscheidungen konnten nicht geladen werden."
          >
            <ErrorBoundary fallback={<ErrorState description="Entscheidungen konnten nicht geladen werden." />}>
              <DashboardDecisionsWidget />
            </ErrorBoundary>
          </DashboardWidgetContainer>
        </div>
        <div className="flex flex-col gap-space-md min-w-0">
          <DashboardWidgetContainer
            icon={Users} title="Jour fixe"
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
