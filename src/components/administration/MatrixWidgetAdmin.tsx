import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTenant } from '@/hooks/useTenant';
import { MatrixWebsiteWidget } from '@/features/matrix-widget/MatrixWebsiteWidget';
import { fetchOpenImprovementTriggers, fetchWidgetFeedbackStats } from '@/features/matrix-widget/api';

export default function MatrixWidgetAdmin() {
  const { currentTenant } = useTenant();
  const insights = useQuery({
    queryKey: ['matrix-widget-admin', currentTenant?.id],
    enabled: !!currentTenant?.id,
    queryFn: async () => {
      if (!currentTenant) throw new Error('Bitte ein Büro auswählen.');
      const [stats, triggers] = await Promise.all([
        fetchWidgetFeedbackStats(currentTenant.id),
        fetchOpenImprovementTriggers(currentTenant.id),
      ]);
      return { stats, triggers };
    },
  });
  const feedbackStats = insights.data?.stats;
  const improvementTriggers = insights.data?.triggers || [];
  return (
      <Card>
        <CardHeader>
          <CardTitle>Matrix Chat-Widget (interner Prototyp)</CardTitle>
          <CardDescription>
            Interner Prototyp zur Prüfung des Chat-Widgets mit Feedback-Auswertung
            und offenen FAQ-/Routing-Triggern.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <MatrixWebsiteWidget />
          {insights.isLoading && <p role="status">Feedback-Auswertung lädt …</p>}
          {insights.error && <p role="alert">Feedback-Auswertung konnte nicht geladen werden. <Button variant="link" onClick={() => void insights.refetch()}>Erneut laden</Button></p>}
          <div className="rounded-md border p-3 space-y-2">
            <p className="text-sm font-medium">Admin-Auswertung (Feedback)</p>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">
                Gesamt: {feedbackStats?.totalFeedback ?? 0}
              </Badge>
              <Badge variant="outline">
                Hilfreich: {feedbackStats?.helpfulCount ?? 0} (
                {feedbackStats?.helpfulRatio ?? 0}%)
              </Badge>
              <Badge variant="outline">
                Nicht hilfreich: {feedbackStats?.notHelpfulCount ?? 0} (
                {feedbackStats?.notHelpfulRatio ?? 0}%)
              </Badge>
              <Badge variant="secondary">
                Offene FAQ/Routing-Trigger: {feedbackStats?.openImprovementTriggers ?? 0}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              Letztes Feedback: {feedbackStats?.lastFeedbackAt
                ? new Date(feedbackStats.lastFeedbackAt).toLocaleString("de-DE")
                : "Noch kein Feedback"}
            </div>

            {improvementTriggers.length > 0 && (
              <div className="pt-2 space-y-1">
                <p className="text-xs font-medium">
                  Negative Feedback-Trigger zur Verbesserung
                </p>
                {improvementTriggers.map((trigger) => (
                  <div
                    key={trigger.id}
                    className="text-xs flex items-center justify-between rounded bg-muted/50 px-2 py-1"
                  >
                    <span>
                      Konversation {trigger.conversationId.slice(0, 8)}… · Msg {trigger.widgetMessageId.slice(0, 8)}…
                    </span>
                    <Badge variant="outline">{trigger.suggestedChannel}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

  );
}
