/**
 * Reine Auswertung der Kennzahlen aus `notification_metrics` für die
 * Super-Admin-Wirkungsansicht. Die Regeln (Sortierung, Schwellen, Formate) liegen
 * hier, damit Oberfläche und Selbsttest dieselben Aussagen prüfen.
 */

export interface NotificationMetricsOptOut {
  name: string;
  label: string;
  disabled: number;
  members: number;
  rate: number;
}

export interface NotificationMetrics {
  tenant_id: string;
  days: number;
  since: string;
  deliveries: {
    in_app: number;
    push: number;
    email_sent: number;
    email_failed: number;
    email_notifications_sent?: number;
    email_notifications_failed?: number;
  };
  opt_out_by_type: NotificationMetricsOptOut[];
  first_response: {
    decisions: number;
    avg_minutes: number | null;
    median_minutes: number | null;
  };
  nudges: {
    total: number;
    answered_within_24h: number;
    rate: number;
  };
  trigger_errors: {
    total: number;
    last_24h: number;
    rate: number;
    alarm: boolean;
  };
}

export type EffectTone = 'alert' | 'warn' | 'neutral' | 'ok';

export interface EffectInsight {
  id: string;
  tone: EffectTone;
  title: string;
  detail: string;
}

const TONE_ORDER: Record<EffectTone, number> = { alert: 0, warn: 1, neutral: 2, ok: 3 };
const HOUR_MINUTES = 60;
const DAY_MINUTES = 24 * HOUR_MINUTES;

/** Anteil 0…1 oder null, wenn es keine Bezugsgröße gibt. */
export const metricsShare = (part: number, total: number): number | null => {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return null;
  return Math.min(1, Math.max(0, part / total));
};

/** Prozentdarstellung; kleine, aber vorhandene Werte bleiben sichtbar. */
export const formatMetricsPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const percent = value * 100;
  if (percent > 0 && percent < 1) return '<1 %';
  return `${Math.round(percent)} %`;
};

export const formatMetricsMinutes = (minutes: number | null | undefined): string => {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return '—';
  if (minutes < HOUR_MINUTES) return `${Math.max(0, Math.round(minutes))} Min.`;
  const hours = minutes / HOUR_MINUTES;
  if (hours < 24) return `${hours.toFixed(1).replace('.', ',')} Std.`;
  return `${(hours / 24).toFixed(1).replace('.', ',')} Tage`;
};

/**
 * Typen mit den meisten Abschaltungen. Kleine Büros (unter drei Mitgliedern)
 * bleiben außen vor, damit einzelne Personen keine Quote dominieren.
 */
export const rankOptOutTypes = (
  entries: readonly NotificationMetricsOptOut[],
  minMembers = 3,
): NotificationMetricsOptOut[] =>
  entries
    .filter((entry) => entry.disabled > 0 && entry.members >= minMembers)
    .slice()
    .sort((a, b) => b.rate - a.rate || b.disabled - a.disabled || a.label.localeCompare(b.label, 'de'));

const worstOptOut = (metrics: NotificationMetrics): NotificationMetricsOptOut | null =>
  rankOptOutTypes(metrics.opt_out_by_type)[0] ?? null;

/** Erst ab dieser Quote lohnt der Hinweis; darunter bleibt die Ansicht ruhig. */
export const OPT_OUT_WARN_THRESHOLD = 0.2;

/** Kernaussagen für die Ansicht, Probleme zuerst. */
export const buildNotificationEffectInsights = (metrics: NotificationMetrics): EffectInsight[] => {
  const insights: EffectInsight[] = [];
  const { deliveries, trigger_errors: triggerErrors, first_response: firstResponse, nudges } = metrics;
  const pushReach = metricsShare(deliveries.push, deliveries.in_app);
  const notificationEmailsFailed = deliveries.email_notifications_failed ?? 0;
  const invitationEmailsFailed = deliveries.email_failed ?? 0;
  const rankedOptOut = worstOptOut(metrics);
  const topOptOut = rankedOptOut && rankedOptOut.rate >= OPT_OUT_WARN_THRESHOLD ? rankedOptOut : null;

  if (triggerErrors.alarm) {
    insights.push({
      id: 'trigger-errors',
      tone: 'alert',
      title: 'Trigger meldet Fehler',
      detail: `${triggerErrors.last_24h} Ausnahmen in den letzten 24 Stunden, Fehlerquote ${formatMetricsPercent(triggerErrors.rate)}. Die Änderungen selbst bleiben erhalten, aber Meldungen fehlen.`,
    });
  } else {
    insights.push({
      id: 'trigger-errors',
      tone: 'ok',
      title: 'Keine Trigger-Ausnahmen in 24 Stunden',
      detail: `Im Zeitraum ${triggerErrors.total} protokollierte Ausnahmen bei ${formatMetricsPercent(triggerErrors.rate)} Fehlerquote.`,
    });
  }

  if (topOptOut) {
    insights.push({
      id: 'opt-out',
      tone: topOptOut.rate >= 0.5 ? 'alert' : 'warn',
      title: `Meiste Abschaltungen: ${topOptOut.label}`,
      detail: `${topOptOut.disabled} von ${topOptOut.members} Mitgliedern haben diesen Typ abgeschaltet (${formatMetricsPercent(topOptOut.rate)}).`,
    });
  } else {
    insights.push({
      id: 'opt-out',
      tone: 'ok',
      title: 'Keine auffälligen Abschaltungen',
      detail: 'Kein Entscheidungstyp ist in nennenswertem Umfang abgeschaltet.',
    });
  }

  if (pushReach === null) {
    insights.push({
      id: 'push-reach',
      tone: 'neutral',
      title: 'Noch keine Zustellungen im Zeitraum',
      detail: 'Ohne Meldungen lässt sich die Push-Reichweite nicht bewerten.',
    });
  } else if (pushReach < 0.5) {
    insights.push({
      id: 'push-reach',
      tone: 'warn',
      title: 'Push erreicht nur einen Teil',
      detail: `${formatMetricsPercent(pushReach)} der ${deliveries.in_app} In-App-Meldungen wurden gepusht. Fehlende Geräte, Ruhezeiten oder „gebündelt“ erklären den Rest.`,
    });
  } else {
    insights.push({
      id: 'push-reach',
      tone: 'ok',
      title: 'Push erreicht die meisten Meldungen',
      detail: `${formatMetricsPercent(pushReach)} der In-App-Meldungen wurden gepusht.`,
    });
  }

  if (firstResponse.decisions === 0) {
    insights.push({
      id: 'first-response',
      tone: 'neutral',
      title: 'Noch keine Antwortzeit messbar',
      detail: 'Im Zeitraum wurde keine Entscheidung mit Teilnehmenden und Antwort gefunden.',
    });
  } else if ((firstResponse.median_minutes ?? 0) > DAY_MINUTES) {
    insights.push({
      id: 'first-response',
      tone: 'warn',
      title: 'Erste Antwort dauert über einen Tag',
      detail: `Median ${formatMetricsMinutes(firstResponse.median_minutes)} bei ${firstResponse.decisions} Entscheidungen (Durchschnitt ${formatMetricsMinutes(firstResponse.avg_minutes)}).`,
    });
  } else {
    insights.push({
      id: 'first-response',
      tone: 'ok',
      title: 'Erste Antwort kommt zügig',
      detail: `Median ${formatMetricsMinutes(firstResponse.median_minutes)} bei ${firstResponse.decisions} Entscheidungen.`,
    });
  }

  if (nudges.total === 0) {
    insights.push({
      id: 'nudges',
      tone: 'neutral',
      title: 'Noch keine Anstupser',
      detail: 'Ohne Anstupser lässt sich ihre Wirkung nicht bewerten.',
    });
  } else if (nudges.rate < 0.3) {
    insights.push({
      id: 'nudges',
      tone: 'warn',
      title: 'Anstupser wirken selten',
      detail: `Nur ${formatMetricsPercent(nudges.rate)} der ${nudges.total} Anstupser führten binnen 24 Stunden zu einer Antwort.`,
    });
  } else {
    insights.push({
      id: 'nudges',
      tone: 'ok',
      title: 'Anstupser beschleunigen Antworten',
      detail: `${formatMetricsPercent(nudges.rate)} der ${nudges.total} Anstupser wurden binnen 24 Stunden beantwortet.`,
    });
  }

  if (notificationEmailsFailed > 0 || invitationEmailsFailed > 0) {
    insights.push({
      id: 'email',
      tone: 'warn',
      title: 'E-Mail-Versand mit Fehlern',
      detail: `${notificationEmailsFailed} fehlgeschlagene Meldungs-Mails, ${invitationEmailsFailed} fehlgeschlagene Einladungen. Erfolgreich: ${deliveries.email_notifications_sent ?? 0} Meldungen, ${deliveries.email_sent} Einladungen.`,
    });
  } else {
    insights.push({
      id: 'email',
      tone: 'ok',
      title: 'E-Mail-Versand ohne Fehler',
      detail: `${deliveries.email_notifications_sent ?? 0} Meldungs-Mails und ${deliveries.email_sent} Einladungen versendet.`,
    });
  }

  return insights.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
};
