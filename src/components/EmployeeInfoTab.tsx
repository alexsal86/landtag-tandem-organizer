import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

interface EmployeeSettingsRow {
  user_id: string;
  hours_per_month: number;
  days_per_month: number;
  hours_per_week: number;
  days_per_week: number;
  annual_vacation_days: number;
  employment_start_date: string | null;
}

interface HistoryRow {
  id: string;
  user_id: string;
  hours_per_week: number;
  days_per_week: number;
  hours_per_month: number;
  days_per_month: number;
  annual_vacation_days: number;
  valid_from: string;
  valid_until: string | null;
  change_reason: string | null;
  created_at: string;
}

interface EmployeeInfoTabProps {
  employeeSettings: EmployeeSettingsRow | null;
}

export function EmployeeInfoTab({ employeeSettings }: EmployeeInfoTabProps) {
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (employeeSettings?.user_id) {
      loadHistory();
    }
  }, [employeeSettings?.user_id]);

  const loadHistory = async () => {
    if (!employeeSettings?.user_id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('employee_settings_history')
        .select('*')
        .eq('user_id', employeeSettings.user_id)
        .order('valid_from', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentPercentage = employeeSettings 
    ? Math.round((employeeSettings.hours_per_week / 39.5) * 100) 
    : 0;

  if (!employeeSettings) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Keine Mitarbeiter-Einstellungen verfügbar</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistik-Karten */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Stunden/Woche
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {employeeSettings.hours_per_week}h
            </div>
            <div className="text-sm text-muted-foreground">
              {currentPercentage}% von Vollzeit
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Tage/Woche
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {employeeSettings.days_per_week}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Stunden/Monat (Soll)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {employeeSettings.hours_per_month}h
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Urlaubstage/Jahr
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {employeeSettings.annual_vacation_days}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Änderungshistorie */}
      <Card>
        <CardHeader>
          <CardTitle>Änderungshistorie Arbeitsverhältnis</CardTitle>
          <CardDescription>
            Übersicht über alle Änderungen der Arbeitszeit
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Lade Historie...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Keine Änderungen vorhanden
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gültig von</TableHead>
                  <TableHead>Gültig bis</TableHead>
                  <TableHead>Stunden/Woche</TableHead>
                  <TableHead>Prozent</TableHead>
                  <TableHead>Tage/Woche</TableHead>
                  <TableHead>Stunden/Monat</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map(h => {
                  const percentage = Math.round((h.hours_per_week / 39.5) * 100);
                  const isCurrent = !h.valid_until;

                  return (
                    <TableRow key={h.id} className={isCurrent ? "bg-accent/50" : ""}>
                      <TableCell>
                        {format(new Date(h.valid_from), "dd.MM.yyyy")}
                      </TableCell>
                      <TableCell>
                        {h.valid_until 
                          ? format(new Date(h.valid_until), "dd.MM.yyyy") 
                          : "-"}
                      </TableCell>
                      <TableCell className="font-mono">{h.hours_per_week}h</TableCell>
                      <TableCell>
                        <Badge variant={isCurrent ? "default" : "secondary"}>
                          {percentage}%
                        </Badge>
                      </TableCell>
                      <TableCell>{h.days_per_week}</TableCell>
                      <TableCell className="font-mono">{h.hours_per_month}h</TableCell>
                      <TableCell>
                        <Badge variant={isCurrent ? "default" : "outline"}>
                          {isCurrent ? "Aktuell" : "Historisch"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Beschäftigungsdetails */}
      <Card>
        <CardHeader>
          <CardTitle>Beschäftigungsdetails</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Beschäftigungsbeginn:</span>
              <span className="font-medium">
                {employeeSettings.employment_start_date
                  ? format(new Date(employeeSettings.employment_start_date), "dd.MM.yyyy", { locale: de })
                  : "Nicht hinterlegt"}
              </span>
            </div>
            {employeeSettings.employment_start_date && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Beschäftigt seit:</span>
                <span className="font-medium">
                  {formatDistanceToNow(
                    new Date(employeeSettings.employment_start_date), 
                    { addSuffix: true, locale: de }
                  )}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
