-- Bestehende Nutzer behalten den bisherigen Digest-Standard.
--
-- Vor der persönlichen Zustellfrequenz wurden Entscheidungs-Meldungen für alle
-- Mitglieder gebündelt. Ohne diese Backfill-Zeilen würde der neue Standard "sofort"
-- den Digest für alle bestehenden Nutzer stillschweigend abschalten. Explizite
-- Einstellungen (falls bereits vorhanden) bleiben unangetastet.
INSERT INTO public.decision_notification_preferences (user_id, tenant_id, delivery_mode)
SELECT m.user_id, m.tenant_id, 'digest'
FROM public.user_tenant_memberships m
JOIN auth.users u ON u.id = m.user_id
JOIN public.tenants t ON t.id = m.tenant_id
WHERE m.is_active
  AND NOT EXISTS (
    SELECT 1 FROM public.decision_notification_preferences p
    WHERE p.user_id = m.user_id AND p.tenant_id = m.tenant_id
  );
