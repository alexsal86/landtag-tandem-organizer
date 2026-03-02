ALTER TABLE public.decision_email_templates
ADD COLUMN IF NOT EXISTS details_block_template TEXT NOT NULL DEFAULT E'Aufgabe: {task_title}\nEntscheidung: {decision_title}';
