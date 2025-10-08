-- Add new notification types for poll auto-archiving
INSERT INTO notification_types (name, label, description, is_active)
VALUES 
  ('poll_auto_completed', 'Abstimmung automatisch abgeschlossen', 'Eine Terminabstimmung wurde automatisch abgeschlossen', true),
  ('poll_auto_cancelled', 'Abstimmung automatisch abgebrochen', 'Eine Terminabstimmung wurde automatisch abgebrochen', true),
  ('poll_restored', 'Abstimmung wiederhergestellt', 'Eine Terminabstimmung wurde wiederhergestellt', true)
ON CONFLICT (name) DO NOTHING;

-- Create function to automatically update poll status
CREATE OR REPLACE FUNCTION auto_update_poll_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Mark polls as completed when all participants have responded
  UPDATE appointment_polls
  SET status = 'completed', updated_at = now()
  WHERE status = 'active'
    AND id IN (
      SELECT pp.poll_id
      FROM poll_participants pp
      GROUP BY pp.poll_id
      HAVING COUNT(DISTINCT pp.id) = (
        SELECT COUNT(DISTINCT pr.participant_id)
        FROM poll_responses pr
        WHERE pr.poll_id = pp.poll_id
      )
      AND COUNT(DISTINCT pp.id) > 0
    );
  
  -- Mark polls as cancelled when deadline has passed and less than 50% responded
  UPDATE appointment_polls
  SET status = 'cancelled', updated_at = now()
  WHERE status = 'active'
    AND deadline < now()
    AND id IN (
      SELECT pp.poll_id
      FROM poll_participants pp
      GROUP BY pp.poll_id
      HAVING (
        SELECT COUNT(DISTINCT pr.participant_id)
        FROM poll_responses pr
        WHERE pr.poll_id = pp.poll_id
      ) < (COUNT(DISTINCT pp.id) * 0.5)
    );
END;
$$;