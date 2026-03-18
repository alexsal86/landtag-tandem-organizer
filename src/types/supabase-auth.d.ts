// This file intentionally left minimal.
// The real @supabase/supabase-js v2 types already export User, Session,
// RealtimePostgresChangesPayload, and define auth methods (getUser, updateUser, mfa, etc.).
// Previous augmentations here were BREAKING type resolution by shadowing the real types.
//
// If you need to extend Supabase types, prefer creating local interfaces
// rather than using `declare module '@supabase/supabase-js'`.
