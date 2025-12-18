-- Add response_options JSONB column to task_decisions
-- This allows flexible response options instead of hardcoded yes/no/question

ALTER TABLE public.task_decisions 
ADD COLUMN response_options jsonb DEFAULT '[
  {"key": "yes", "label": "Ja", "color": "green", "icon": "check"},
  {"key": "no", "label": "Nein", "color": "red", "icon": "x"},
  {"key": "question", "label": "Rückfrage", "color": "orange", "icon": "message-circle", "requires_comment": true}
]'::jsonb;

-- Add comment to explain the column
COMMENT ON COLUMN public.task_decisions.response_options IS 'JSON array of response options with keys: key (string), label (string), color (string), icon (string), requires_comment (boolean)';