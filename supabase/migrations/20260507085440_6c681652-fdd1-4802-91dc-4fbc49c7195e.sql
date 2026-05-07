
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-recordings', 'audio-recordings', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users read own audio recordings"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'audio-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users insert own audio recordings"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'audio-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own audio recordings"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'audio-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);
