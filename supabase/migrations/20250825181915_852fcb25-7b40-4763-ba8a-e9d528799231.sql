-- Phase 2: Update existing RLS policies for multi-tenant architecture

-- Drop existing RLS policies and create tenant-aware ones
-- Contacts table
DROP POLICY "Authenticated users can view all contacts" ON public.contacts;
DROP POLICY "Authenticated users can create all contacts" ON public.contacts;
DROP POLICY "Authenticated users can update all contacts" ON public.contacts;
DROP POLICY "Authenticated users can delete all contacts" ON public.contacts;

CREATE POLICY "Users can view contacts in their tenants" 
ON public.contacts 
FOR SELECT 
USING (tenant_id = ANY(public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can create contacts in their tenants" 
ON public.contacts 
FOR INSERT 
WITH CHECK (tenant_id = ANY(public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update contacts in their tenants" 
ON public.contacts 
FOR UPDATE 
USING (tenant_id = ANY(public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete contacts in their tenants" 
ON public.contacts 
FOR DELETE 
USING (tenant_id = ANY(public.get_user_tenant_ids(auth.uid())));

-- Tasks table
DROP POLICY "Authenticated users can view all tasks" ON public.tasks;
DROP POLICY "Authenticated users can create all tasks" ON public.tasks;
DROP POLICY "Authenticated users can update all tasks" ON public.tasks;
DROP POLICY "Authenticated users can delete all tasks" ON public.tasks;

CREATE POLICY "Users can view tasks in their tenants" 
ON public.tasks 
FOR SELECT 
USING (tenant_id = ANY(public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can create tasks in their tenants" 
ON public.tasks 
FOR INSERT 
WITH CHECK (tenant_id = ANY(public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update tasks in their tenants" 
ON public.tasks 
FOR UPDATE 
USING (tenant_id = ANY(public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete tasks in their tenants" 
ON public.tasks 
FOR DELETE 
USING (tenant_id = ANY(public.get_user_tenant_ids(auth.uid())));

-- Appointments table
DROP POLICY "Authenticated users can view all appointments" ON public.appointments;
DROP POLICY "Authenticated users can create all appointments" ON public.appointments;
DROP POLICY "Authenticated users can update all appointments" ON public.appointments;
DROP POLICY "Authenticated users can delete all appointments" ON public.appointments;

CREATE POLICY "Users can view appointments in their tenants" 
ON public.appointments 
FOR SELECT 
USING (tenant_id = ANY(public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can create appointments in their tenants" 
ON public.appointments 
FOR INSERT 
WITH CHECK (tenant_id = ANY(public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update appointments in their tenants" 
ON public.appointments 
FOR UPDATE 
USING (tenant_id = ANY(public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete appointments in their tenants" 
ON public.appointments 
FOR DELETE 
USING (tenant_id = ANY(public.get_user_tenant_ids(auth.uid())));

-- Documents table
DROP POLICY "Authenticated users can view all documents" ON public.documents;
DROP POLICY "Authenticated users can create all documents" ON public.documents;
DROP POLICY "Authenticated users can update all documents" ON public.documents;
DROP POLICY "Authenticated users can delete all documents" ON public.documents;

CREATE POLICY "Users can view documents in their tenants" 
ON public.documents 
FOR SELECT 
USING (tenant_id = ANY(public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can create documents in their tenants" 
ON public.documents 
FOR INSERT 
WITH CHECK (tenant_id = ANY(public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update documents in their tenants" 
ON public.documents 
FOR UPDATE 
USING (tenant_id = ANY(public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete documents in their tenants" 
ON public.documents 
FOR DELETE 
USING (tenant_id = ANY(public.get_user_tenant_ids(auth.uid())));

-- Todos table
DROP POLICY "Authenticated users can view all todos" ON public.todos;
DROP POLICY "Authenticated users can create all todos" ON public.todos;
DROP POLICY "Authenticated users can update all todos" ON public.todos;
DROP POLICY "Authenticated users can delete all todos" ON public.todos;

CREATE POLICY "Users can view todos in their tenants" 
ON public.todos 
FOR SELECT 
USING (tenant_id = ANY(public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can create todos in their tenants" 
ON public.todos 
FOR INSERT 
WITH CHECK (tenant_id = ANY(public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update todos in their tenants" 
ON public.todos 
FOR UPDATE 
USING (tenant_id = ANY(public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete todos in their tenants" 
ON public.todos 
FOR DELETE 
USING (tenant_id = ANY(public.get_user_tenant_ids(auth.uid())));

-- Update profiles table RLS
CREATE POLICY "Users can view profiles in their tenants" 
ON public.profiles 
FOR SELECT 
USING (tenant_id = ANY(public.get_user_tenant_ids(auth.uid())));

-- Team dashboards table
DROP POLICY "Users can manage their own dashboards" ON public.team_dashboards;
DROP POLICY "Users can view public dashboards" ON public.team_dashboards;

CREATE POLICY "Users can manage dashboards in their tenants" 
ON public.team_dashboards 
FOR ALL 
USING (tenant_id = ANY(public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can view dashboards in their tenants" 
ON public.team_dashboards 
FOR SELECT 
USING (tenant_id = ANY(public.get_user_tenant_ids(auth.uid())) OR is_public = true);

-- Make tenant_id NOT NULL for core tables (after migration)
ALTER TABLE public.profiles ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.contacts ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.tasks ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.appointments ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.documents ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.todos ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.team_dashboards ALTER COLUMN tenant_id SET NOT NULL;