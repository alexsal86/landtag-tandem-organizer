-- Add favorite functionality to contacts table
ALTER TABLE public.contacts 
ADD COLUMN is_favorite boolean DEFAULT false;

-- Create contact usage statistics table for tracking frequent contacts
CREATE TABLE public.contact_usage_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  usage_count integer NOT NULL DEFAULT 1,
  last_used_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  tenant_id uuid NOT NULL,
  
  UNIQUE(user_id, contact_id, tenant_id)
);

-- Enable RLS on contact usage stats
ALTER TABLE public.contact_usage_stats ENABLE ROW LEVEL SECURITY;

-- Create policies for contact usage stats
CREATE POLICY "Users can manage their own contact usage stats" 
ON public.contact_usage_stats 
FOR ALL 
USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())))
WITH CHECK (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

-- Create function to update contact usage
CREATE OR REPLACE FUNCTION public.update_contact_usage(
  p_contact_id uuid,
  p_user_id uuid DEFAULT auth.uid(),
  p_tenant_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Get tenant_id if not provided
  IF p_tenant_id IS NULL THEN
    SELECT tenant_id INTO p_tenant_id FROM contacts WHERE id = p_contact_id LIMIT 1;
  END IF;
  
  -- Insert or update usage stats
  INSERT INTO public.contact_usage_stats (user_id, contact_id, tenant_id, usage_count, last_used_at)
  VALUES (p_user_id, p_contact_id, p_tenant_id, 1, now())
  ON CONFLICT (user_id, contact_id, tenant_id) 
  DO UPDATE SET 
    usage_count = contact_usage_stats.usage_count + 1,
    last_used_at = now(),
    updated_at = now();
END;
$function$;

-- Add trigger to update timestamps
CREATE TRIGGER update_contact_usage_stats_updated_at
  BEFORE UPDATE ON public.contact_usage_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_contact_usage_stats_user_tenant ON public.contact_usage_stats(user_id, tenant_id);
CREATE INDEX idx_contact_usage_stats_usage_count ON public.contact_usage_stats(usage_count DESC);
CREATE INDEX idx_contact_usage_stats_last_used ON public.contact_usage_stats(last_used_at DESC);