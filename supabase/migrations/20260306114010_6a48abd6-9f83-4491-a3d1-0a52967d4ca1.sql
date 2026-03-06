ALTER TABLE task_decisions
  ADD COLUMN IF NOT EXISTS case_item_id uuid REFERENCES case_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_task_decisions_case_item_id ON task_decisions(case_item_id);