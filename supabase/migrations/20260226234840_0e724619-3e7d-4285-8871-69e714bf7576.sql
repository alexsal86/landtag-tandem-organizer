
-- Fix RLS policies for letter_template_settings
DROP POLICY IF EXISTS "Users can view their tenant settings" ON public.letter_template_settings;
DROP POLICY IF EXISTS "Users can insert their tenant settings" ON public.letter_template_settings;
DROP POLICY IF EXISTS "Users can update their tenant settings" ON public.letter_template_settings;

CREATE POLICY "Users can view their tenant settings"
ON public.letter_template_settings FOR SELECT
USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their tenant settings"
ON public.letter_template_settings FOR INSERT
WITH CHECK (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their tenant settings"
ON public.letter_template_settings FOR UPDATE
USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
