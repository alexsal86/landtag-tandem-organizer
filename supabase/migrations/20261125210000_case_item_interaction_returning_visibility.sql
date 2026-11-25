-- Vorgangs-Interaktionen: Autoren müssen ihre eigene Zeile auch bei INSERT ... RETURNING sehen.
--
-- Die SELECT-Policy "Users can view allowed case item interactions" prüft über
-- public.user_can_access_case_item_interaction(...). Diese Funktion ist STABLE und liest die
-- Interaktionszeile selbst nach. Im Statement-Snapshot eines INSERT ist die neue Zeile noch nicht
-- sichtbar, die Funktion liefert deshalb false. Der Insert selbst war über die WITH-CHECK-Policy
-- erlaubt, das von App und Selbsttest genutzte `insert(...).select()` (INSERT ... RETURNING)
-- scheiterte jedoch mit 42501 "new row violates row-level security policy for table
-- case_item_interactions" — auch für Büromitglieder mit Zugriff auf den Vorgang.
--
-- Die zusätzliche Policy ist zeilenlokal (liest die Tabelle nicht selbst) und verlangt dieselben
-- Bedingungen wie die Insert-Policy: aktive Büromitgliedschaft, Zugriff auf den Vorgang und die
-- Kanal-Rollenregel für phone/social. Sie erweitert die Sichtbarkeit daher nicht über den Kreis
-- hinaus, der die Zeile überhaupt anlegen durfte.

DROP POLICY IF EXISTS "Authors can view own case item interactions" ON public.case_item_interactions;

CREATE POLICY "Authors can view own case item interactions"
ON public.case_item_interactions FOR SELECT
USING (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.case_items ci
    WHERE ci.id = case_item_interactions.case_item_id
      AND ci.tenant_id = case_item_interactions.tenant_id
      AND public.user_can_access_case_item(auth.uid(), ci.id)
  )
  AND (
    case_item_interactions.interaction_type NOT IN ('phone', 'social')
    OR public.has_active_tenant_role(
      auth.uid(),
      case_item_interactions.tenant_id,
      ARRAY['abgeordneter', 'bueroleitung', 'mitarbeiter']
    )
  )
);
