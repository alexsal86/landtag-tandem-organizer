CREATE TABLE IF NOT EXISTS public.matrix_widget_callback_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  matrix_room_id TEXT NOT NULL,
  matrix_event_id TEXT,
  source TEXT NOT NULL DEFAULT 'website_widget',
  requester_name TEXT NOT NULL,
  requester_phone TEXT NOT NULL,
  preferred_time TEXT NOT NULL,
  concern TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.matrix_widget_callback_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage matrix widget callback requests"
ON public.matrix_widget_callback_requests
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_matrix_widget_callback_requests_task_id
  ON public.matrix_widget_callback_requests(task_id);

CREATE INDEX IF NOT EXISTS idx_matrix_widget_callback_requests_room_event
  ON public.matrix_widget_callback_requests(matrix_room_id, matrix_event_id);
