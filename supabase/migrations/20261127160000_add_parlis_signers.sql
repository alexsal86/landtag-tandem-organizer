-- Unterzeichner einer Initiative (Kleine/Große Anfrage, Antrag) am Vorgang.
-- Die Quelle nennt nur Nachnamen; die Auflösung zu Vollnamen erfolgt im
-- Extraktor gegen die Abgeordneten der laufenden Wahlperiode. Namen bleiben
-- semikolongetrennt in Anzeigereihenfolge, der Haupteinbringer aus urheber ist
-- nicht enthalten (er steht bereits in der Spalte urheber).
ALTER TABLE public.parlis_proceedings
  ADD COLUMN IF NOT EXISTS signers text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS signer_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS signer_party text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS signers_raw text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS faction_co_signed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.parlis_proceedings.signers IS
  'Mitunterzeichner als Vollnamen, semikolongetrennt in der Reihenfolge des Dokuments; ohne Haupteinbringer.';
COMMENT ON COLUMN public.parlis_proceedings.signer_count IS
  'Anzahl der Mitunterzeichner in signers.';
COMMENT ON COLUMN public.parlis_proceedings.signer_party IS
  'Fraktion/Gruppierung aus der Unterzeichnerzeile, Kürzel wie im Dokument (z. B. AfD, SPD).';
COMMENT ON COLUMN public.parlis_proceedings.signers_raw IS
  'Unveränderte Unterzeichnerzeile aus dem PDF, damit die Zuordnung nachvollziehbar bleibt.';
COMMENT ON COLUMN public.parlis_proceedings.faction_co_signed IS
  'Wahr, wenn zusätzlich "und Fraktion" unterzeichnet wurde: die gesamte Fraktion steht hinter der Initiative.';

ALTER TABLE public.parlis_proceedings
  DROP CONSTRAINT IF EXISTS parlis_proceedings_signer_count_check;
ALTER TABLE public.parlis_proceedings
  ADD CONSTRAINT parlis_proceedings_signer_count_check CHECK (signer_count >= 0);

-- Die Foren-/Detailansicht filtert nach Initiativen mit vielen Unterzeichnern.
CREATE INDEX IF NOT EXISTS parlis_proceedings_signer_count_idx
  ON public.parlis_proceedings (legislature, signer_count DESC);
