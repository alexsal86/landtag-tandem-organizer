INSERT INTO storage.buckets (id, name, public)
VALUES ('letter-assets', 'letter-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;