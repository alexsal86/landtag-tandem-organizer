-- Add notification type for decision-comment reactions per tenant
INSERT INTO public.notification_types (name, label, description, category, is_active, tenant_id)
SELECT
  'task_decision_comment_reaction_received',
  'Reaktion auf Entscheidungs-Kommentar',
  'Benachrichtigung wenn jemand auf einen Kommentar in einer Entscheidungsanfrage reagiert',
  'decisions',
  true,
  t.tenant_id
FROM (
  SELECT DISTINCT tenant_id
  FROM public.notification_types
  WHERE tenant_id IS NOT NULL
) AS t
WHERE NOT EXISTS (
  SELECT 1
  FROM public.notification_types nt
  WHERE nt.tenant_id = t.tenant_id
    AND nt.name = 'task_decision_comment_reaction_received'
);
