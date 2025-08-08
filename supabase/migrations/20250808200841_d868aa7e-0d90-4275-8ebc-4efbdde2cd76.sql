-- Drop existing restrictive policies for contacts
DROP POLICY IF EXISTS "Users can view their own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can create their own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can update their own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can delete their own contacts" ON public.contacts;

-- Create new public policies for contacts
CREATE POLICY "Authenticated users can view all contacts" 
ON public.contacts FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create all contacts" 
ON public.contacts FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update all contacts" 
ON public.contacts FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete all contacts" 
ON public.contacts FOR DELETE 
USING (auth.role() = 'authenticated');

-- Drop existing restrictive policies for appointments
DROP POLICY IF EXISTS "Users can view their own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can create their own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can update their own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can delete their own appointments" ON public.appointments;

-- Create new public policies for appointments
CREATE POLICY "Authenticated users can view all appointments" 
ON public.appointments FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create all appointments" 
ON public.appointments FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update all appointments" 
ON public.appointments FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete all appointments" 
ON public.appointments FOR DELETE 
USING (auth.role() = 'authenticated');

-- Drop existing restrictive policies for tasks
DROP POLICY IF EXISTS "Users can view their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can create their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks" ON public.tasks;

-- Create new public policies for tasks
CREATE POLICY "Authenticated users can view all tasks" 
ON public.tasks FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create all tasks" 
ON public.tasks FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update all tasks" 
ON public.tasks FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete all tasks" 
ON public.tasks FOR DELETE 
USING (auth.role() = 'authenticated');

-- Drop existing restrictive policies for meetings
DROP POLICY IF EXISTS "Users can view their own meetings" ON public.meetings;
DROP POLICY IF EXISTS "Users can create their own meetings" ON public.meetings;
DROP POLICY IF EXISTS "Users can update their own meetings" ON public.meetings;
DROP POLICY IF EXISTS "Users can delete their own meetings" ON public.meetings;

-- Create new public policies for meetings
CREATE POLICY "Authenticated users can view all meetings" 
ON public.meetings FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create all meetings" 
ON public.meetings FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update all meetings" 
ON public.meetings FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete all meetings" 
ON public.meetings FOR DELETE 
USING (auth.role() = 'authenticated');

-- Drop existing restrictive policies for documents
DROP POLICY IF EXISTS "Users can view their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can create their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON public.documents;

-- Create new public policies for documents
CREATE POLICY "Authenticated users can view all documents" 
ON public.documents FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create all documents" 
ON public.documents FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update all documents" 
ON public.documents FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete all documents" 
ON public.documents FOR DELETE 
USING (auth.role() = 'authenticated');

-- Drop existing restrictive policies for meeting_templates
DROP POLICY IF EXISTS "Users can view their own meeting templates" ON public.meeting_templates;
DROP POLICY IF EXISTS "Users can create their own meeting templates" ON public.meeting_templates;
DROP POLICY IF EXISTS "Users can update their own meeting templates" ON public.meeting_templates;
DROP POLICY IF EXISTS "Users can delete their own meeting templates" ON public.meeting_templates;

-- Create new public policies for meeting_templates
CREATE POLICY "Authenticated users can view all meeting templates" 
ON public.meeting_templates FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create all meeting templates" 
ON public.meeting_templates FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update all meeting templates" 
ON public.meeting_templates FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete all meeting templates" 
ON public.meeting_templates FOR DELETE 
USING (auth.role() = 'authenticated');

-- Drop existing restrictive policies for meeting_agenda_items
DROP POLICY IF EXISTS "Users can view agenda items for their meetings" ON public.meeting_agenda_items;
DROP POLICY IF EXISTS "Users can create agenda items for their meetings" ON public.meeting_agenda_items;
DROP POLICY IF EXISTS "Users can update agenda items for their meetings" ON public.meeting_agenda_items;
DROP POLICY IF EXISTS "Users can delete agenda items for their meetings" ON public.meeting_agenda_items;

-- Create new public policies for meeting_agenda_items
CREATE POLICY "Authenticated users can view all meeting agenda items" 
ON public.meeting_agenda_items FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create all meeting agenda items" 
ON public.meeting_agenda_items FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update all meeting agenda items" 
ON public.meeting_agenda_items FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete all meeting agenda items" 
ON public.meeting_agenda_items FOR DELETE 
USING (auth.role() = 'authenticated');

-- Drop existing restrictive policies for appointment_contacts
DROP POLICY IF EXISTS "Users can view appointment contacts for their appointments" ON public.appointment_contacts;
DROP POLICY IF EXISTS "Users can create appointment contacts for their appointments" ON public.appointment_contacts;
DROP POLICY IF EXISTS "Users can update appointment contacts for their appointments" ON public.appointment_contacts;
DROP POLICY IF EXISTS "Users can delete appointment contacts for their appointments" ON public.appointment_contacts;

-- Create new public policies for appointment_contacts
CREATE POLICY "Authenticated users can view all appointment contacts" 
ON public.appointment_contacts FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create all appointment contacts" 
ON public.appointment_contacts FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update all appointment contacts" 
ON public.appointment_contacts FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete all appointment contacts" 
ON public.appointment_contacts FOR DELETE 
USING (auth.role() = 'authenticated');