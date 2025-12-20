-- Add Matrix chat credentials to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS matrix_user_id TEXT,
ADD COLUMN IF NOT EXISTS matrix_access_token TEXT,
ADD COLUMN IF NOT EXISTS matrix_homeserver_url TEXT DEFAULT 'https://matrix.org';

-- Add comment for documentation
COMMENT ON COLUMN profiles.matrix_user_id IS 'Matrix user ID (e.g., @user:matrix.org)';
COMMENT ON COLUMN profiles.matrix_access_token IS 'Matrix access token for chat authentication';
COMMENT ON COLUMN profiles.matrix_homeserver_url IS 'Matrix homeserver URL';