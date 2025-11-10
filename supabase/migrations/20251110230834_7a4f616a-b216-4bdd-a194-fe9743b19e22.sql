-- Create table for checklist item actions (email automation, etc.)
CREATE TABLE IF NOT EXISTS public.event_planning_item_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id UUID NOT NULL REFERENCES public.event_planning_checklist_items(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('email', 'text_editor', 'form', 'export')),
  action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_event_planning_item_actions_checklist_item 
  ON public.event_planning_item_actions(checklist_item_id);

-- Enable RLS
ALTER TABLE public.event_planning_item_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can manage actions for checklists in their tenant
CREATE POLICY "Users can view actions in their tenant"
  ON public.event_planning_item_actions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_planning_checklist_items eci
      JOIN public.event_plannings ep ON ep.id = eci.event_planning_id
      JOIN public.user_tenant_memberships utm ON utm.tenant_id = ep.tenant_id
      WHERE eci.id = event_planning_item_actions.checklist_item_id
      AND utm.user_id = auth.uid()
      AND utm.is_active = true
    )
  );

CREATE POLICY "Users can create actions in their tenant"
  ON public.event_planning_item_actions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.event_planning_checklist_items eci
      JOIN public.event_plannings ep ON ep.id = eci.event_planning_id
      JOIN public.user_tenant_memberships utm ON utm.tenant_id = ep.tenant_id
      WHERE eci.id = event_planning_item_actions.checklist_item_id
      AND utm.user_id = auth.uid()
      AND utm.is_active = true
    )
  );

CREATE POLICY "Users can update actions in their tenant"
  ON public.event_planning_item_actions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.event_planning_checklist_items eci
      JOIN public.event_plannings ep ON ep.id = eci.event_planning_id
      JOIN public.user_tenant_memberships utm ON utm.tenant_id = ep.tenant_id
      WHERE eci.id = event_planning_item_actions.checklist_item_id
      AND utm.user_id = auth.uid()
      AND utm.is_active = true
    )
  );

CREATE POLICY "Users can delete actions in their tenant"
  ON public.event_planning_item_actions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.event_planning_checklist_items eci
      JOIN public.event_plannings ep ON ep.id = eci.event_planning_id
      JOIN public.user_tenant_memberships utm ON utm.tenant_id = ep.tenant_id
      WHERE eci.id = event_planning_item_actions.checklist_item_id
      AND utm.user_id = auth.uid()
      AND utm.is_active = true
    )
  );

-- Create trigger for updated_at
CREATE TRIGGER update_event_planning_item_actions_updated_at
  BEFORE UPDATE ON public.event_planning_item_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for storing action execution logs
CREATE TABLE IF NOT EXISTS public.event_planning_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES public.event_planning_item_actions(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES public.event_planning_checklist_items(id) ON DELETE CASCADE,
  executed_by UUID REFERENCES auth.users(id),
  execution_status TEXT NOT NULL CHECK (execution_status IN ('success', 'failed', 'pending')),
  execution_details JSONB DEFAULT '{}'::jsonb,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for logs
CREATE INDEX IF NOT EXISTS idx_event_planning_action_logs_action 
  ON public.event_planning_action_logs(action_id);
CREATE INDEX IF NOT EXISTS idx_event_planning_action_logs_checklist_item 
  ON public.event_planning_action_logs(checklist_item_id);

-- Enable RLS on logs
ALTER TABLE public.event_planning_action_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for logs
CREATE POLICY "Users can view action logs in their tenant"
  ON public.event_planning_action_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_planning_checklist_items eci
      JOIN public.event_plannings ep ON ep.id = eci.event_planning_id
      JOIN public.user_tenant_memberships utm ON utm.tenant_id = ep.tenant_id
      WHERE eci.id = event_planning_action_logs.checklist_item_id
      AND utm.user_id = auth.uid()
      AND utm.is_active = true
    )
  );