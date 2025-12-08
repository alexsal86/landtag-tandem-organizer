-- Junction-Tabelle für Entscheidungs-Themen
CREATE TABLE public.task_decision_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES public.task_decisions(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(decision_id, topic_id)
);

-- Enable RLS
ALTER TABLE public.task_decision_topics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authentifizierte Benutzer können Themen lesen"
ON public.task_decision_topics
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Ersteller können Themen hinzufügen"
ON public.task_decision_topics
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.task_decisions 
    WHERE id = decision_id AND created_by = auth.uid()
  )
);

CREATE POLICY "Ersteller können Themen entfernen"
ON public.task_decision_topics
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.task_decisions 
    WHERE id = decision_id AND created_by = auth.uid()
  )
);

-- Index für schnellere Abfragen
CREATE INDEX idx_task_decision_topics_decision_id ON public.task_decision_topics(decision_id);
CREATE INDEX idx_task_decision_topics_topic_id ON public.task_decision_topics(topic_id);