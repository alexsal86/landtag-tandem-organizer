-- rss_cache: only server (service role) uses it
DROP POLICY IF EXISTS "Authenticated users can read rss cache" ON public.rss_cache;

-- task_documents: scope to tenant of the task
DROP POLICY IF EXISTS "All users can view task documents" ON public.task_documents;
CREATE POLICY "Tenant members can view task documents" ON public.task_documents
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_documents.task_id AND t.tenant_id = ANY(public.get_user_tenant_ids(auth.uid()))));

-- decision comment reactions: only users who can access the decision
DROP POLICY IF EXISTS "Authenticated users can view decision comment reactions" ON public.task_decision_comment_reactions;
CREATE POLICY "Decision participants can view comment reactions" ON public.task_decision_comment_reactions
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.task_decision_comments c WHERE c.id = task_decision_comment_reactions.comment_id AND public.can_access_decision(c.decision_id, auth.uid())));

-- karlsruhe_districts / celebration_animations: signed-in users only
DROP POLICY IF EXISTS "Authenticated users can view karlsruhe districts" ON public.karlsruhe_districts;
CREATE POLICY "Signed-in users can view karlsruhe districts" ON public.karlsruhe_districts
FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Anyone can read celebration animations" ON public.celebration_animations;
CREATE POLICY "Signed-in users can read active celebration animations" ON public.celebration_animations
FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

-- login_customization: login page needs it before sign-in; restrict to existing tenant rows
DROP POLICY IF EXISTS "Anyone can view login customization" ON public.login_customization;
CREATE POLICY "Login customization readable for tenant branding" ON public.login_customization
FOR SELECT TO anon, authenticated USING (tenant_id IS NOT NULL);

-- ===== Storage =====
-- Public buckets: files stay reachable via public URLs; remove anonymous listing
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Dashboard covers are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public access to letter assets" ON storage.objects;

CREATE POLICY "Users list own avatar files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars' AND ((storage.foldername(name))[1] = (select auth.uid()::text) OR owner_id = (select auth.uid()::text)));
CREATE POLICY "Users list own dashboard covers" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'dashboard-covers' AND ((storage.foldername(name))[1] = (select auth.uid()::text) OR owner_id = (select auth.uid()::text)));

-- Avatars writes bound to owner
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects;
CREATE POLICY "Users upload own avatar files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND ((storage.foldername(name))[1] = (select auth.uid()::text) OR owner_id = (select auth.uid()::text)));
CREATE POLICY "Users update own avatar files" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND ((storage.foldername(name))[1] = (select auth.uid()::text) OR owner_id = (select auth.uid()::text)))
WITH CHECK (bucket_id = 'avatars' AND ((storage.foldername(name))[1] = (select auth.uid()::text) OR owner_id = (select auth.uid()::text)));
CREATE POLICY "Users delete own avatar files" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND ((storage.foldername(name))[1] = (select auth.uid()::text) OR owner_id = (select auth.uid()::text)));

-- Letter assets: tenant folder (<tenant>/... or signatures/<tenant>/...)
DROP POLICY IF EXISTS "Authenticated users can upload letter assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their uploaded letter assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their uploaded letter assets" ON storage.objects;
CREATE POLICY "Tenant members list letter assets" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'letter-assets' AND (
  (storage.foldername(name))[1] = ANY(SELECT t::text FROM unnest(public.get_user_tenant_ids((select auth.uid()))) t)
  OR ((storage.foldername(name))[1] = 'signatures' AND (storage.foldername(name))[2] = ANY(SELECT t::text FROM unnest(public.get_user_tenant_ids((select auth.uid()))) t))));
CREATE POLICY "Tenant members upload letter assets" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'letter-assets' AND (
  (storage.foldername(name))[1] = ANY(SELECT t::text FROM unnest(public.get_user_tenant_ids((select auth.uid()))) t)
  OR ((storage.foldername(name))[1] = 'signatures' AND (storage.foldername(name))[2] = ANY(SELECT t::text FROM unnest(public.get_user_tenant_ids((select auth.uid()))) t))));
CREATE POLICY "Tenant members update letter assets" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'letter-assets' AND (
  (storage.foldername(name))[1] = ANY(SELECT t::text FROM unnest(public.get_user_tenant_ids((select auth.uid()))) t)
  OR ((storage.foldername(name))[1] = 'signatures' AND (storage.foldername(name))[2] = ANY(SELECT t::text FROM unnest(public.get_user_tenant_ids((select auth.uid()))) t))));
CREATE POLICY "Tenant members delete letter assets" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'letter-assets' AND (
  (storage.foldername(name))[1] = ANY(SELECT t::text FROM unnest(public.get_user_tenant_ids((select auth.uid()))) t)
  OR ((storage.foldername(name))[1] = 'signatures' AND (storage.foldername(name))[2] = ANY(SELECT t::text FROM unnest(public.get_user_tenant_ids((select auth.uid()))) t))));

-- Planning documents: loose upload policy removed (tenant-folder policy remains)
DROP POLICY IF EXISTS "Users can upload planning documents in their tenant" ON storage.objects;

-- Service-role policies are unnecessary (service role bypasses RLS) and matched client JWTs
DROP POLICY IF EXISTS "Service role can manage archived letters" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage all parliament protocols" ON storage.objects;

-- Parliament protocols: tenant folder
DROP POLICY IF EXISTS "Users can upload protocol files in their tenant" ON storage.objects;
DROP POLICY IF EXISTS "Users can view protocol files in their tenant" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete protocol files in their tenant" ON storage.objects;
CREATE POLICY "Tenant members upload protocol files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'parliament-protocols' AND (storage.foldername(name))[1] = ANY(SELECT t::text FROM unnest(public.get_user_tenant_ids((select auth.uid()))) t));
CREATE POLICY "Tenant members view protocol files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'parliament-protocols' AND (storage.foldername(name))[1] = ANY(SELECT t::text FROM unnest(public.get_user_tenant_ids((select auth.uid()))) t));
CREATE POLICY "Tenant members delete protocol files" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'parliament-protocols' AND (storage.foldername(name))[1] = ANY(SELECT t::text FROM unnest(public.get_user_tenant_ids((select auth.uid()))) t));

-- Documents: own folder; archived letters only via a document row in the caller's tenant
DROP POLICY IF EXISTS "Users can view documents in their tenant" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete documents" ON storage.objects;
CREATE POLICY "Users view own or tenant archived documents" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents' AND (
  (storage.foldername(name))[1] = (select auth.uid()::text)
  OR ((storage.foldername(name))[1] = 'archived_letters' AND EXISTS (SELECT 1 FROM public.documents d WHERE d.file_path = storage.objects.name AND d.tenant_id = ANY(public.get_user_tenant_ids((select auth.uid())))))));
CREATE POLICY "Users upload own documents" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = (select auth.uid()::text));
CREATE POLICY "Users update own documents" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = (select auth.uid()::text))
WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = (select auth.uid()::text));
CREATE POLICY "Users delete own or tenant archived documents" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documents' AND (
  (storage.foldername(name))[1] = (select auth.uid()::text)
  OR ((storage.foldername(name))[1] = 'archived_letters' AND EXISTS (SELECT 1 FROM public.documents d WHERE d.file_path = storage.objects.name AND d.tenant_id = ANY(public.get_user_tenant_ids((select auth.uid())))))));