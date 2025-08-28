-- Fix critical security issue: Update RLS policies to enforce tenant isolation
-- Currently all authenticated users can see ALL data regardless of tenant

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can view all appointments" ON public.appointments;
DROP POLICY IF EXISTS "Authenticated users can create all appointments" ON public.appointments;
DROP POLICY IF EXISTS "Authenticated users can update all appointments" ON public.appointments;
DROP POLICY IF EXISTS "Authenticated users can delete all appointments" ON public.appointments;

DROP POLICY IF EXISTS "Authenticated users can view all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can create all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can update all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can delete all tasks" ON public.tasks;

DROP POLICY IF EXISTS "Authenticated users can view all contacts" ON public.contacts;
DROP POLICY IF EXISTS "Authenticated users can create all contacts" ON public.contacts;
DROP POLICY IF EXISTS "Authenticated users can update all contacts" ON public.contacts;
DROP POLICY IF EXISTS "Authenticated users can delete all contacts" ON public.contacts;

DROP POLICY IF EXISTS "Authenticated users can view all documents" ON public.documents;
DROP POLICY IF EXISTS "Authenticated users can create all documents" ON public.documents;
DROP POLICY IF EXISTS "Authenticated users can update all documents" ON public.documents;
DROP POLICY IF EXISTS "Authenticated users can delete all documents" ON public.documents;

DROP POLICY IF EXISTS "Authenticated users can view all todos" ON public.todos;
DROP POLICY IF EXISTS "Authenticated users can create all todos" ON public.todos;
DROP POLICY IF EXISTS "Authenticated users can update all todos" ON public.todos;
DROP POLICY IF EXISTS "Authenticated users can delete all todos" ON public.todos;

-- Create new tenant-aware policies for appointments
CREATE POLICY "Users can view appointments in their tenant" ON public.appointments
  FOR SELECT
  USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can create appointments in their tenant" ON public.appointments
  FOR INSERT
  WITH CHECK (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update appointments in their tenant" ON public.appointments
  FOR UPDATE
  USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete appointments in their tenant" ON public.appointments
  FOR DELETE
  USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

-- Create new tenant-aware policies for tasks
CREATE POLICY "Users can view tasks in their tenant" ON public.tasks
  FOR SELECT
  USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can create tasks in their tenant" ON public.tasks
  FOR INSERT
  WITH CHECK (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update tasks in their tenant" ON public.tasks
  FOR UPDATE
  USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete tasks in their tenant" ON public.tasks
  FOR DELETE
  USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

-- Create new tenant-aware policies for contacts
CREATE POLICY "Users can view contacts in their tenant" ON public.contacts
  FOR SELECT
  USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can create contacts in their tenant" ON public.contacts
  FOR INSERT
  WITH CHECK (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update contacts in their tenant" ON public.contacts
  FOR UPDATE
  USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete contacts in their tenant" ON public.contacts
  FOR DELETE
  USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

-- Create new tenant-aware policies for documents
CREATE POLICY "Users can view documents in their tenant" ON public.documents
  FOR SELECT
  USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can create documents in their tenant" ON public.documents
  FOR INSERT
  WITH CHECK (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update documents in their tenant" ON public.documents
  FOR UPDATE
  USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete documents in their tenant" ON public.documents
  FOR DELETE
  USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

-- Create new tenant-aware policies for todos
CREATE POLICY "Users can view todos in their tenant" ON public.todos
  FOR SELECT
  USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can create todos in their tenant" ON public.todos
  FOR INSERT
  WITH CHECK (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update todos in their tenant" ON public.todos
  FOR UPDATE
  USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete todos in their tenant" ON public.todos
  FOR DELETE
  USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));