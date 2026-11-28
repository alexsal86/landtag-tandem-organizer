import { useCallback, useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';
import { AlertTriangle, BarChart3, CheckCircle2, Info, Mail, Send, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { debugConsole } from '@/utils/debugConsole';
import {
  buildNotificationEffectInsights,
  formatMetricsMinutes,
  formatMetricsPercent,
  metricsShare,
  rankOptOutTypes,
  type EffectInsight,
  type EffectTone,
  type NotificationMetrics,
} from './decisionNotificationEffect';

interface TenantOption {
  id: string;
  name: string | null;
}

const DAYS_OPTIONS = [30, 90, 365] as const;

const TONE_META: Record<EffectTone, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: JSX.Element }> = {
  alert: { label: 'Handeln', variant: 'destructive', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  warn: { label: 'Beobachten', variant: 'default', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  neutral: { label: 'Hinweis', variant: 'outline', icon: <Info className="h-3.5 w-3.5" /> },
  ok: { label: 'In Ordnung', variant: 'secondary', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
};

const MetricTile = ({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: JSX.Element }): JSX.Element => (
  <div className="rounded-lg border p-4">
    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {icon}
      {label}
    </div>
    <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
  </div>
);

/** Super-Admin-Ansicht der vorhandenen Kennzahlen aus `notification_metrics`. */
export const DecisionNotificationMetricsPanel = (): JSX.Element => {
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [days, setDays] = useState<number>(30);
  const [metrics, setMetrics] = useState<NotificationMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void supabase
      .from('tenants')
      .select('id, name')
      .order('name')
      .then(({ data, error: tenantError }) => {
        if (cancelled) return;
        if (tenantError) {
          debugConsole.error('Tenants für Wirkungsansicht nicht ladbar', tenantError);
          setError('Arbeitsbereiche konnten nicht geladen werden.');
          return;
        }
        const rows = (data ?? []) as TenantOption[];
        setTenants(rows);
        setTenantId((current) => current ?? rows[0]?.id ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMetrics = useCallback(async (): Promise<void> => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    const { data, error: metricsError } = await supabase.rpc('notification_metrics', {
      _tenant_id: tenantId,
      _days: days,
    });
    setLoading(false);
    if (metricsError) {
      debugConsole.error('Kennzahlen nicht ladbar', metricsError);
      setMetrics(null);
      setError('Keine Kennzahlen für diesen Arbeitsbereich. Die Ansicht ist auf Mitglieder des Arbeitsbereichs beschränkt.');
      return;
    }
    setMetrics((data ?? null) as NotificationMetrics | null);
  }, [days, tenantId]);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  const insights = useMemo(() => (metrics ? buildNotificationEffectInsights(metrics) : []), [metrics]);
  const optOutTypes = useMemo(
    () => (metrics ? rankOptOutTypes(metrics.opt_out_by_type, metrics.opt_out_by_type[0]?.members ?? 1).slice(0, 8) : []),
    [metrics],
  );
  const pushReach = metrics ? metricsShare(metrics.deliveries.push, metrics.deliveries.in_app) : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Wirkung der Entscheidungs-Meldungen
          </CardTitle>
          <CardDescription>
            Aggregierte Kennzahlen je Arbeitsbereich: Zustellungen, Abschaltungen, erste Antwortzeit,
            Anstupser-Wirkung und Trigger-Fehler. Nur Super-Admins sehen diese Auswertung.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="min-w-56 space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="notification-metrics-tenant">
              Arbeitsbereich
            </label>
            <Select
              value={tenantId ?? ''}
              onValueChange={(value: string): void => setTenantId(value)}
              disabled={tenants.length === 0}
            >
              <SelectTrigger id="notification-metrics-tenant">
                <SelectValue placeholder="Arbeitsbereich wählen" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name ?? tenant.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-40 space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="notification-metrics-days">
              Zeitraum
            </label>
            <Select
              value={String(days)}
              onValueChange={(value: string): void => setDays(Number(value))}
            >
              <SelectTrigger id="notification-metrics-days">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option} Tage
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="status">
          {error}
        </p>
      )}

      {loading && <p className="text-sm text-muted-foreground" role="status">Kennzahlen werden geladen…</p>}

      {metrics && !loading && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile
              label="Zustellungen"
              value={String(metrics.deliveries.in_app)}
              hint={`davon ${metrics.deliveries.push} gepusht (${formatMetricsPercent(pushReach)})`}
              icon={<Send className="h-3.5 w-3.5" />}
            />
            <MetricTile
              label="E-Mail"
              value={`${metrics.deliveries.email_notifications_sent ?? 0} / ${metrics.deliveries.email_sent}`}
              hint={`Meldungen / Einladungen versendet; ${(metrics.deliveries.email_notifications_failed ?? 0) + metrics.deliveries.email_failed} fehlgeschlagen`}
              icon={<Mail className="h-3.5 w-3.5" />}
            />
            <MetricTile
              label="Erste Antwort"
              value={formatMetricsMinutes(metrics.first_response.median_minutes)}
              hint={`Median bei ${metrics.first_response.decisions} Entscheidungen; Durchschnitt ${formatMetricsMinutes(metrics.first_response.avg_minutes)}`}
              icon={<Users className="h-3.5 w-3.5" />}
            />
            <MetricTile
              label="Trigger-Fehler"
              value={`${metrics.trigger_errors.total} (${metrics.trigger_errors.last_24h} in 24 h)`}
              hint={`Fehlerquote ${formatMetricsPercent(metrics.trigger_errors.rate)}${metrics.trigger_errors.alarm ? ' · Alarm aktiv' : ''}`}
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Wo wir Menschen verlieren</CardTitle>
                <CardDescription>Automatisch abgeleitete Hinweise, Probleme zuerst.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {insights.map((insight: EffectInsight) => (
                  <div key={insight.id} className="flex items-start gap-3 rounded-lg border p-3">
                    <Badge variant={TONE_META[insight.tone].variant} className="mt-0.5 shrink-0 gap-1">
                      {TONE_META[insight.tone].icon}
                      {TONE_META[insight.tone].label}
                    </Badge>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{insight.title}</p>
                      <p className="text-xs text-muted-foreground">{insight.detail}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Abschaltungen je Typ</CardTitle>
                <CardDescription>
                  Anteil der Mitglieder, die den Meldungstyp in ihren Einstellungen abgeschaltet haben.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {optOutTypes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine Abschaltungen im gewählten Zeitraum.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Typ</TableHead>
                        <TableHead className="text-right">Abgeschaltet</TableHead>
                        <TableHead className="text-right">Quote</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {optOutTypes.map((entry) => (
                        <TableRow key={entry.name}>
                          <TableCell className="max-w-56 truncate" title={entry.label}>{entry.label}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {entry.disabled} / {entry.members}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatMetricsPercent(entry.rate)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <p className="text-xs text-muted-foreground">
            Abschaltquote zählt Personen ohne Berücksichtigung des Zeitraums (aktueller Stand). Anstupser-Wirkung:{' '}
            {formatMetricsPercent(metrics.nudges.rate)} von {metrics.nudges.total} Anstupsern binnen 24 Stunden
            beantwortet. Zeitraum ab {new Date(metrics.since).toLocaleDateString('de-DE')}.
          </p>
        </>
      )}
    </div>
  );
};
