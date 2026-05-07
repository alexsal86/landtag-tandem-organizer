import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardTasksSection } from '@/components/dashboard/DashboardTasksSection';
import { DashboardAppointments } from '@/components/my-work/MyWorkDashboardAppointments';
import { useDashboardAppointmentsData } from '@/hooks/useDashboardAppointmentsData';
import { useDashboardDeadlines } from '@/hooks/useDashboardDeadlines';
import { NewsWidget } from '@/components/widgets/NewsWidget';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { CalendarDays, ClipboardList, Newspaper, Vote, Users } from 'lucide-react';
import { useResolvedUserRole } from '@/hooks/useResolvedUserRole';
import { BriefingComposerCard, TodayBriefingPanel } from '@/features/briefings';
import { DashboardDecisionsWidget } from '@/components/dashboard/DashboardDecisionsWidget';
import { DashboardJourFixeWidget } from '@/components/dashboard/DashboardJourFixeWidget';
import { ErrorState, LoadingState } from '@/components/ui-patterns';
import { cn } from '@/lib/utils';

interface DashboardWidgetContainerProps {
  title: ReactNode;
  className?: string;
  isLoading?: boolean;
  hasError?: boolean;
  loadingVariant?: 'list' | 'card' | 'detail' | 'inline';
  errorMessage?: string;
  children: ReactNode;
}

function DashboardWidgetContainer({
  title,
  className,
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
      <CardHeader className="py-sm px-md">
        <CardTitle className="text-body-lg font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-md pb-md pt-0">{content}</CardContent>
    </Card>
  );
}

function DeadlinesWidget() {
  const { items, grouped, isLoading, isError } = useDashboardDeadlines();

  return (
    <DashboardWidgetContainer
      title={
        <span className="inline-flex items-center gap-xs">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
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
        <span className="inline-flex items-center gap-xs">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          {dashboardData.isShowingTomorrow ? 'Deine Termine morgen' : 'Deine Termine heute'}
        </span>
      }
      isLoading={dashboardData.isLoading || dashboardData.tenantLoading}
      hasError={dashboardData.isError}
      loadingVariant="card"
      errorMessage="Termine konnten nicht geladen werden."
    >
      <DashboardAppointments data={dashboardData} />
    </DashboardWidgetContainer>
  );
}

function NewsWidgetCard() {
  return (
    <DashboardWidgetContainer
      title={
        <span className="inline-flex items-center gap-xs">
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
    <div className="space-y-md animate-fade-in">
      <DashboardHeader />
      {isAbgeordneter && <TodayBriefingPanel />}
      {isEmployee && !isAbgeordneter && <BriefingComposerCard />}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,40fr)_minmax(0,35fr)_minmax(0,25fr)] gap-md items-start">
        <div className="flex flex-col gap-md min-w-0">
          <AppointmentsWidget />
        </div>
        <div className="flex flex-col gap-md min-w-0">
          <DeadlinesWidget />
          <DashboardWidgetContainer
            title={<span className="inline-flex items-center gap-xs"><Vote className="h-4 w-4 text-muted-foreground" />Entscheidungen</span>}
            errorMessage="Entscheidungen konnten nicht geladen werden."
          >
            <ErrorBoundary fallback={<ErrorState description="Entscheidungen konnten nicht geladen werden." />}>
              <DashboardDecisionsWidget />
            </ErrorBoundary>
          </DashboardWidgetContainer>
        </div>
        <div className="flex flex-col gap-md min-w-0">
          <DashboardWidgetContainer
            title={<span className="inline-flex items-center gap-xs"><Users className="h-4 w-4 text-muted-foreground" />Jour fixe</span>}
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
