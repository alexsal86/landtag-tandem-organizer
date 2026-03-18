// Permissive type augmentation for supabase-js auth client.
// The real @supabase/supabase-js types already define getUser, updateUser, mfa etc.
// This file only adds a fallback index signature to prevent TS errors
// when the installed types don't perfectly match usage patterns.

import '@supabase/supabase-js';

// We intentionally do NOT redeclare SupabaseAuthClient or User here,
// as that overrides the real types. Instead we rely on the actual
// @supabase/supabase-js type definitions.
