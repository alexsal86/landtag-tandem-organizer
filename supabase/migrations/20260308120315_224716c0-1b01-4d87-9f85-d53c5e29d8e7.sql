
-- Insert case notification types for all 3 tenants
INSERT INTO notification_types (name, label, description, category, is_active, tenant_id)
SELECT name, label, description, 'cases', true, tenant_id
FROM (
  VALUES
    ('case_item_created', 'Neuer Vorgang', 'Benachrichtigung wenn ein neuer Vorgang erstellt wird'),
    ('case_item_assigned', 'Vorgang zugewiesen', 'Benachrichtigung wenn Ihnen ein Vorgang zugewiesen wird'),
    ('case_item_status_changed', 'Vorgang-Status geändert', 'Benachrichtigung bei Statusänderung eines Vorgangs'),
    ('case_item_comment', 'Vorgang-Kommentar', 'Benachrichtigung bei neuem Kommentar in einem Vorgang')
) AS v(name, label, description)
CROSS JOIN (
  SELECT DISTINCT tenant_id FROM notification_types WHERE tenant_id IS NOT NULL
) AS tenants
ON CONFLICT DO NOTHING;
