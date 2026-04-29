import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { EmployeeMeetingRequestDialog } from "@/features/employees/components/EmployeeMeetingRequestDialog";
import { EmployeeMeetingHistory } from "@/features/employees/components/EmployeeMeetingHistory";
import { Loader2 } from "lucide-react";
import { EmployeeSettingsRow, LeaveAgg, Profile } from "./types";

interface EmployeeSelfViewProps {
  loading: boolean;
  selfSettings: EmployeeSettingsRow | null;
  selfLeaveAgg: LeaveAgg | null;
  selfProfile: Profile | null;
}

export function EmployeeSelfView({ loading, selfSettings, selfLeaveAgg, selfProfile }: EmployeeSelfViewProps) {
  const { user } = useAuth();

  const pendingCount =
    (selfLeaveAgg?.pending.sick ?? 0) +
    (selfLeaveAgg?.pending.vacation ?? 0) +
    (selfLeaveAgg?.pending.other ?? 0);

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
      <header>
        <h1 className="text-2xl font-semibold">Mitarbeiter</h1>
        <p className="text-muted-foreground">Ihre Einstellungen & Abwesenheiten</p>
        {loading && (
          <div className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Lade Ihre Mitarbeiterdaten ...
          </div>
        )}
      </header>

      <section className="px-4 sm:px-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Stunden/Woche</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : (
              <div className="space-y-1">
                <div className="text-2xl font-semibold">{selfSettings?.hours_per_week ?? '–'}h</div>
                <div className="text-sm text-muted-foreground">
                  {selfSettings ? `${Math.round((selfSettings.hours_per_week / 39.5) * 100)}% von Vollzeit (39,5h)` : '–'}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Offene Anträge</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-semibold">{pendingCount}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Krank (Anträge / genehmigt)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-2xl font-semibold">
                {selfLeaveAgg?.counts.sick ?? 0} <span className="text-sm text-muted-foreground">/ {selfLeaveAgg?.approved.sick ?? 0}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Urlaub (Anträge / genehmigt)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-2xl font-semibold">
                {selfLeaveAgg?.counts.vacation ?? 0} <span className="text-sm text-muted-foreground">/ {selfLeaveAgg?.approved.vacation ?? 0}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Meine Einstellungen</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-5 w-32" /></div>
            ) : (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Stunden/Woche</span><span>{selfSettings?.hours_per_week ?? '–'}</span></div>
                <div className="flex justify-between"><span>Arbeitstage/Woche</span><span>{selfSettings?.days_per_week ?? '–'}</span></div>
                <div className="flex justify-between"><span>Urlaubstage/Jahr</span><span>{selfSettings?.annual_vacation_days ?? '–'}</span></div>
                {selfSettings?.employment_start_date ? (
                  <div className="flex justify-between"><span>Beginn Arbeitsverhältnis</span><span>{new Date(selfSettings.employment_start_date).toLocaleDateString('de-DE')}</span></div>
                ) : (
                  <div className="flex justify-between"><span>Beginn Arbeitsverhältnis</span><span className="text-orange-600">Noch nicht eingetragen</span></div>
                )}
                {!selfSettings ? (
                  <div className="text-center text-blue-600 text-sm mt-2 p-3 bg-blue-50 rounded border border-blue-200">
                    <strong>Hinweis:</strong> Ihre Einstellungen werden geladen...<br/>
                    Falls Sie soeben vom Administrator eingetragen wurden, laden Sie die Seite neu (F5).
                    <br/>
                    <Button variant="outline" size="sm" className="mt-2" onClick={() => window.location.reload()}>Seite neu laden</Button>
                  </div>
                ) : (
                  <div className="text-center text-green-600 text-sm mt-1 p-2 bg-green-50 rounded">✓ Einstellungen erfolgreich geladen</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Letzte Abwesenheiten</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2"><Skeleton className="h-5 w-48" /><Skeleton className="h-5 w-48" /><Skeleton className="h-5 w-48" /></div>
            ) : (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Krank</span><span>{selfLeaveAgg?.lastDates.sick ? new Date(selfLeaveAgg.lastDates.sick).toLocaleDateString('de-DE') : '–'}</span></div>
                <div className="flex justify-between"><span>Urlaub</span><span>{selfLeaveAgg?.lastDates.vacation ? new Date(selfLeaveAgg.lastDates.vacation).toLocaleDateString('de-DE') : '–'}</span></div>
                <div className="flex justify-between"><span>Sonstiges</span><span>{selfLeaveAgg?.lastDates.other ? new Date(selfLeaveAgg.lastDates.other).toLocaleDateString('de-DE') : '–'}</span></div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Mitarbeitergespräche</CardTitle>
              <EmployeeMeetingRequestDialog />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {selfSettings?.last_meeting_date && (
              <div className="text-sm">
                <span className="text-muted-foreground">Letztes Gespräch: </span>
                <span className="font-medium">{formatDistanceToNow(new Date(selfSettings.last_meeting_date), { addSuffix: true, locale: de })}</span>
              </div>
            )}
            <EmployeeMeetingHistory employeeId={user?.id} showFilters={false} />
            <p className="text-xs text-muted-foreground">Sie können jederzeit ein Gespräch mit Ihrem Vorgesetzten beantragen.</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
