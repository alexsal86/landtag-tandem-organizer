// Type augmentation for @supabase/supabase-js
// Adds missing members to SupabaseAuthClient and ensures key types are exported.

declare module '@supabase/supabase-js' {
  export interface User {
    id: string;
    email?: string;
    app_metadata: Record<string, unknown>;
    user_metadata: Record<string, unknown>;
    aud: string;
    created_at: string;
    [key: string]: unknown;
  }

  export interface Session {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    expires_at?: number;
    token_type: string;
    user: User;
    [key: string]: unknown;
  }

  export type RealtimePostgresChangesPayload<T = Record<string, unknown>> = {
    schema: string;
    table: string;
    commit_timestamp: string;
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: T;
    old: T;
    errors: unknown[];
    [key: string]: unknown;
  };

  interface SupabaseAuthClient {
    getUser(): Promise<{ data: { user: User | null }; error: AuthError | null }>;
    getSession(): Promise<{ data: { session: Session | null }; error: AuthError | null }>;
    updateUser(attributes: Record<string, unknown>): Promise<{ data: { user: User | null }; error: AuthError | null }>;
    signInWithPassword(credentials: { email: string; password: string }): Promise<AuthTokenResponsePassword>;
    signUp(credentials: { email: string; password: string; options?: { emailRedirectTo?: string; data?: Record<string, unknown> } }): Promise<AuthResponse>;
    signOut(options?: { scope?: 'global' | 'local' | 'others' }): Promise<{ error: AuthError | null }>;
    onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void): {
      data: { subscription: Subscription };
    };
    resetPasswordForEmail(email: string, options?: { redirectTo?: string }): Promise<{ data: object; error: AuthError | null }>;
    mfa: {
      enroll(params: Record<string, unknown>): Promise<unknown>;
      challenge(params: Record<string, unknown>): Promise<unknown>;
      verify(params: Record<string, unknown>): Promise<unknown>;
      unenroll(params: Record<string, unknown>): Promise<unknown>;
      listFactors(): Promise<MFAListFactorsResponse>;
      getAuthenticatorAssuranceLevel(): Promise<unknown>;
      challengeAndVerify(params: { factorId: string; code: string }): Promise<{ data: object | null; error: AuthError | null }>;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  }
}
