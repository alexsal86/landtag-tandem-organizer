-- Create user planning preferences table for default collaborators
CREATE TABLE public.user_planning_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  default_collaborators JSONB DEFAULT '[]'::jsonb,
  -- Format: [{"user_id": "uuid", "can_edit": true}]
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

-- Enable RLS
ALTER TABLE public.user_planning_preferences ENABLE ROW LEVEL SECURITY;

-- User can manage own preferences
CREATE POLICY "Users manage own planning preferences"
ON public.user_planning_preferences
FOR ALL USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Add trigger for updated_at
CREATE TRIGGER update_user_planning_preferences_updated_at
BEFORE UPDATE ON public.user_planning_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();