-- Anfragende dürfen ihre eigene, noch ausstehende DSGVO-Anfrage zurückziehen.
-- Das betrifft ausschließlich Zeilen mit requested_by = auth.uid() und
-- status = 'pending'. Freigabe und Verarbeitung bleiben unverändert: die
-- Vier-Augen-Prüfung (gdpr_check_four_eyes) und approve_gdpr_delete gelten
-- weiterhin, freigegebene, laufende oder fremde Anträge sind nicht löschbar.
DROP POLICY IF EXISTS "Requesters can withdraw their own pending requests" ON public.gdpr_requests;
CREATE POLICY "Requesters can withdraw their own pending requests"
  ON public.gdpr_requests FOR DELETE
  TO authenticated
  USING (requested_by = auth.uid() AND status = 'pending');

GRANT DELETE ON public.gdpr_requests TO authenticated;
