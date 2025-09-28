-- Matrix Bot Integration Database Schema (simplified - without notification types)

-- Matrix user subscriptions table for user->room mappings
CREATE TABLE IF NOT EXISTS public.matrix_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  matrix_username TEXT NOT NULL,
  room_id TEXT NOT NULL,
  room_name TEXT,
  notification_types TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, room_id)
);

-- Enable RLS on matrix_subscriptions
ALTER TABLE public.matrix_subscriptions ENABLE ROW LEVEL SECURITY;

-- Matrix subscriptions policies
CREATE POLICY "Users can view their own matrix subscriptions" 
ON public.matrix_subscriptions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own matrix subscriptions" 
ON public.matrix_subscriptions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own matrix subscriptions" 
ON public.matrix_subscriptions 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own matrix subscriptions" 
ON public.matrix_subscriptions 
FOR DELETE 
USING (auth.uid() = user_id);

-- Matrix bot logs table for monitoring
CREATE TABLE IF NOT EXISTS public.matrix_bot_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  room_id TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message_content TEXT,
  response_content TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on matrix_bot_logs (admin only)
ALTER TABLE public.matrix_bot_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view matrix bot logs" 
ON public.matrix_bot_logs 
FOR ALL
USING (public.is_admin(auth.uid()));

-- Add matrix_enabled to user_notification_settings
ALTER TABLE public.user_notification_settings 
ADD COLUMN IF NOT EXISTS matrix_enabled BOOLEAN DEFAULT false;

-- Add updated_at trigger for matrix_subscriptions
CREATE TRIGGER update_matrix_subscriptions_updated_at
BEFORE UPDATE ON public.matrix_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();