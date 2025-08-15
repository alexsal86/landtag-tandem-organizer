-- Create tables for planning item management system
-- Planning item comments
CREATE TABLE IF NOT EXISTS public.planning_item_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  planning_item_id UUID NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Planning item documents
CREATE TABLE IF NOT EXISTS public.planning_item_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  planning_item_id UUID NOT NULL,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Planning item subtasks (replacing the sub_items jsonb)
CREATE TABLE IF NOT EXISTS public.planning_item_subtasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  planning_item_id UUID NOT NULL,
  user_id UUID NOT NULL,
  description TEXT NOT NULL,
  assigned_to UUID,
  due_date TIMESTAMP WITH TIME ZONE,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  result_text TEXT
);

-- Enable RLS
ALTER TABLE public.planning_item_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_item_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_item_subtasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for planning_item_comments
CREATE POLICY "Users can view planning item comments for accessible plannings" ON public.planning_item_comments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.event_planning_checklist_items epci
    JOIN public.event_plannings ep ON ep.id = epci.event_planning_id
    WHERE epci.id = planning_item_comments.planning_item_id
    AND (ep.user_id = auth.uid() OR NOT ep.is_private OR EXISTS (
      SELECT 1 FROM public.event_planning_collaborators epc
      WHERE epc.event_planning_id = ep.id AND epc.user_id = auth.uid()
    ))
  )
);

CREATE POLICY "Users can create planning item comments for editable plannings" ON public.planning_item_comments
FOR INSERT WITH CHECK (
  user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.event_planning_checklist_items epci
    JOIN public.event_plannings ep ON ep.id = epci.event_planning_id
    WHERE epci.id = planning_item_comments.planning_item_id
    AND (ep.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.event_planning_collaborators epc
      WHERE epc.event_planning_id = ep.id AND epc.user_id = auth.uid() AND epc.can_edit = true
    ))
  )
);

CREATE POLICY "Users can update their own planning item comments" ON public.planning_item_comments
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own planning item comments" ON public.planning_item_comments
FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for planning_item_documents
CREATE POLICY "Users can view planning item documents for accessible plannings" ON public.planning_item_documents
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.event_planning_checklist_items epci
    JOIN public.event_plannings ep ON ep.id = epci.event_planning_id
    WHERE epci.id = planning_item_documents.planning_item_id
    AND (ep.user_id = auth.uid() OR NOT ep.is_private OR EXISTS (
      SELECT 1 FROM public.event_planning_collaborators epc
      WHERE epc.event_planning_id = ep.id AND epc.user_id = auth.uid()
    ))
  )
);

CREATE POLICY "Users can create planning item documents for editable plannings" ON public.planning_item_documents
FOR INSERT WITH CHECK (
  user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.event_planning_checklist_items epci
    JOIN public.event_plannings ep ON ep.id = epci.event_planning_id
    WHERE epci.id = planning_item_documents.planning_item_id
    AND (ep.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.event_planning_collaborators epc
      WHERE epc.event_planning_id = ep.id AND epc.user_id = auth.uid() AND epc.can_edit = true
    ))
  )
);

CREATE POLICY "Users can delete planning item documents for editable plannings" ON public.planning_item_documents
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.event_planning_checklist_items epci
    JOIN public.event_plannings ep ON ep.id = epci.event_planning_id
    WHERE epci.id = planning_item_documents.planning_item_id
    AND (ep.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.event_planning_collaborators epc
      WHERE epc.event_planning_id = ep.id AND epc.user_id = auth.uid() AND epc.can_edit = true
    ))
  )
);

-- RLS Policies for planning_item_subtasks
CREATE POLICY "Users can view planning item subtasks for accessible plannings" ON public.planning_item_subtasks
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.event_planning_checklist_items epci
    JOIN public.event_plannings ep ON ep.id = epci.event_planning_id
    WHERE epci.id = planning_item_subtasks.planning_item_id
    AND (ep.user_id = auth.uid() OR NOT ep.is_private OR EXISTS (
      SELECT 1 FROM public.event_planning_collaborators epc
      WHERE epc.event_planning_id = ep.id AND epc.user_id = auth.uid()
    ))
  )
);

CREATE POLICY "Users can manage planning item subtasks for editable plannings" ON public.planning_item_subtasks
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.event_planning_checklist_items epci
    JOIN public.event_plannings ep ON ep.id = epci.event_planning_id
    WHERE epci.id = planning_item_subtasks.planning_item_id
    AND (ep.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.event_planning_collaborators epc
      WHERE epc.event_planning_id = ep.id AND epc.user_id = auth.uid() AND epc.can_edit = true
    ))
  )
);

-- Add triggers for updated_at
CREATE TRIGGER update_planning_item_comments_updated_at
BEFORE UPDATE ON public.planning_item_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_planning_item_documents_updated_at
BEFORE UPDATE ON public.planning_item_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_planning_item_subtasks_updated_at
BEFORE UPDATE ON public.planning_item_subtasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();