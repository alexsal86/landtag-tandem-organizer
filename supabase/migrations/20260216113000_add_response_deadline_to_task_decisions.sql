ALTER TABLE public.task_decisions
ADD COLUMN IF NOT EXISTS response_deadline TIMESTAMPTZ;

COMMENT ON COLUMN public.task_decisions.response_deadline IS 'Optional deadline for participants to answer the decision request.';

CREATE INDEX IF NOT EXISTS idx_task_decisions_response_deadline
  ON public.task_decisions(response_deadline)
  WHERE response_deadline IS NOT NULL;
