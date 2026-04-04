import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardTasksSection } from '@/components/dashboard/DashboardTasksSection';
import { DashboardAppointments } from '@/components/my-work/MyWorkDashboardAppointments';
import { useDashboardAppointmentsData } from '@/hooks/useDashboardAppointmentsData';
import { useDashboardDeadlines } from '@/hooks/useDashboardDeadlines';
import { NewsWidget } from '@/components/widgets/NewsWidget';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CalendarDays, ClipboardList, Newspaper } from 'lucide-react';

interface DashboardWidgetContainerProps {
  title: ReactNode;
  className?: string;
  isLoading?: boolean;
  hasError?: boolean;
  loadingFallback: ReactNode;
  errorFallback: ReactNode;
  children: ReactNode;
}

function DashboardWidgetContainer({
  title,
  className,
  isLoading = false,
  hasError = false,
  loadingFallback,
  errorFallback,
  children,
}: DashboardWidgetContainerProps) {
  let content = children;

  if (hasError) {
    content = errorFallback;
  } else if (isLoading) {
    content = loadingFallback;
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

function DeadlinesWidget() {
  const { items, grouped, isLoading, isError } = useDashboardDeadlines();

  return (
    <DashboardWidgetContainer
      title={
        <span className="inline-flex items-center gap-2">
          <ClipboardList className="h-4 w-4" />
          Fristen
        </span>
      }
      isLoading={isLoading}
      hasError={isError}
      loadingFallback={<div className="animate-pulse h-32 bg-muted rounded-lg" />}
      errorFallback={<p className="text-sm text-muted-foreground">Fristen konnten nicht geladen werden.</p>}
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
        <span className="inline-flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          {dashboardData.isShowingTomorrow ? 'Deine Termine morgen' : 'Deine Termine heute'}
        </span>
      }
      isLoading={dashboardData.isLoading || dashboardData.tenantLoading}
      hasError={dashboardData.isError}
      loadingFallback={<div className="animate-pulse h-40 bg-muted rounded-lg" />}
      errorFallback={<p className="text-sm text-muted-foreground">Termine konnten nicht geladen werden.</p>}
    >
      <DashboardAppointments data={dashboardData} />
    </DashboardWidgetContainer>
  );
}

function NewsWidgetCard() {
  return (
    <DashboardWidgetContainer
      title={
        <span className="inline-flex items-center gap-2">
          <Newspaper className="h-4 w-4" />
          News
        </span>
      }
      className="min-w-0"
      loadingFallback={null}
      errorFallback={<p className="text-sm text-muted-foreground">News konnten nicht geladen werden.</p>}
    >
      <ErrorBoundary fallback={<p className="text-sm text-muted-foreground">News konnten nicht geladen werden.</p>}>
        <NewsWidget compact />
      </ErrorBoundary>
    </DashboardWidgetContainer>
  );
}

export function MyWorkDashboardTab() {
  return (
    <div className="space-y-6">
      <DashboardHeader />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,35fr)_minmax(0,35fr)_minmax(0,30fr)] gap-6 items-start">
        <DeadlinesWidget />
        <AppointmentsWidget />
        <NewsWidgetCard />
      </div>
    </div>
  );
}
