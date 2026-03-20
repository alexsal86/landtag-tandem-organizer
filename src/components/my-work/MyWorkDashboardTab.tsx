import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardTasksSection } from "@/components/dashboard/DashboardTasksSection";
import { DashboardAppointments } from "@/components/my-work/MyWorkDashboardAppointments";
import { useDashboardData } from "@/hooks/useDashboardData";
import { NewsWidget } from "@/components/widgets/NewsWidget";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export function MyWorkDashboardTab() {
  const dashboardData = useDashboardData();

  return (
    <div className="space-y-6">
      <DashboardHeader />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,35fr)_minmax(0,35fr)_minmax(0,30fr)] gap-6 items-start">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">📋 Fristen</CardTitle>
          </CardHeader>
          <CardContent>
            <DashboardTasksSection />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              📅 {dashboardData.isShowingTomorrow ? 'Deine Termine morgen' : 'Deine Termine heute'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DashboardAppointments data={dashboardData} />
          </CardContent>
        </Card>
        <div className="min-w-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">📰 News</CardTitle>
            </CardHeader>
            <CardContent>
              <ErrorBoundary fallback={<p className="text-sm text-muted-foreground">News konnten nicht geladen werden.</p>}>
                <NewsWidget compact />
              </ErrorBoundary>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
