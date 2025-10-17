-- Erweitere item_type constraint für protocol_agenda_items
ALTER TABLE protocol_agenda_items 
  DROP CONSTRAINT IF EXISTS protocol_agenda_items_item_type_check;

ALTER TABLE protocol_agenda_items 
  ADD CONSTRAINT protocol_agenda_items_item_type_check 
  CHECK (item_type IN (
    'regular', 'question', 'motion', 'government_statement',
    'current_debate', 'second_reading', 'petition', 'question_hour',
    'other'
  ));

-- Füge index Spalte zu protocol_speeches hinzu falls nicht vorhanden
ALTER TABLE protocol_speeches 
  ADD COLUMN IF NOT EXISTS index integer;

-- Füge events Spalten zu protocol_speeches hinzu
ALTER TABLE protocol_speeches 
  ADD COLUMN IF NOT EXISTS events jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS events_flat jsonb DEFAULT '[]'::jsonb;

-- Erweitere protocol_agenda_items für zusätzliche TOC-Daten
ALTER TABLE protocol_agenda_items 
  ADD COLUMN IF NOT EXISTS speakers jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS drucksachen jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS subentries jsonb DEFAULT '[]'::jsonb;