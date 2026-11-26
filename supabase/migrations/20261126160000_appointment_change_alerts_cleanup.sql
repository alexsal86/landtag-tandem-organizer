-- Der Schritt „Eil-Änderung mit neuer Zeit und Hinweis speichern“ legt eine
-- Zeile in appointment_change_alerts an und meldet sie dem Aufräumen. Für
-- authenticated gab es bisher nur SELECT, INSERT und UPDATE, deshalb konnte
-- der Lauf die Meldung nicht entfernen: Der Selbsttest galt trotz grüner
-- Schritte als fehlgeschlagen ("Kein Cleanup für appointment_change_alerts
-- definiert“ bzw. „Datensatz nach DELETE noch vorhanden“).
--
-- Löschen darf nur, wer die Meldung selbst erstellt hat und aktives Mitglied
-- des Büros ist. Fremde Meldungen bleiben unverändert; die gesendete
-- Terminänderung ist damit nur für ihren Absender zurücknehmbar.
GRANT DELETE ON public.appointment_change_alerts TO authenticated;

DROP POLICY IF EXISTS "office members delete own alerts" ON public.appointment_change_alerts;
CREATE POLICY "office members delete own alerts"
ON public.appointment_change_alerts FOR DELETE TO authenticated
USING (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.user_tenant_memberships m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = appointment_change_alerts.tenant_id
      AND m.is_active
  )
);
