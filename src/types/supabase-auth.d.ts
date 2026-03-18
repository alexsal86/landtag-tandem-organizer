// Type augmentation for @supabase/supabase-js
// Adds missing members to SupabaseAuthClient and ensures key types are exported.

declare module '@supabase/supabase-js' {
  // Re-export types that components import directly
  export interface User {
    id: string;
    email?: string;
    app_metadata: Record<string, any>;
    user_metadata: Record<string, any>;
    aud: string;
    created_at: string;
    [key: string]: any;
  }

  export interface Session {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    expires_at?: number;
    token_type: string;
    user: User;
    [key: string]: any;
  }

  export type RealtimePostgresChangesPayload<T = any> = {
    schema: string;
    table: string;
    commit_timestamp: string;
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: T;
    old: T;
    errors: any[];
    [key: string]: any;
  };

  // Augment the auth client with methods used throughout the codebase
  interface SupabaseAuthClient {
    getUser(): Promise<{ data: { user: User | null }; error: any }>;
    getSession(): Promise<{ data: { session: Session | null }; error: any }>;
    updateUser(attributes: Record<string, any>): Promise<{ data: { user: User | null }; error: any }>;
    signInWithPassword(credentials: { email: string; password: string }): Promise<any>;
    signUp(credentials: { email: string; password: string; options?: any }): Promise<any>;
    signOut(): Promise<any>;
    onAuthStateChange(callback: (event: string, session: any) => void): { data: { subscription: any } };
    resetPasswordForEmail(email: string, options?: any): Promise<any>;
    mfa: {
      enroll(params: any): Promise<any>;
      challenge(params: any): Promise<any>;
      verify(params: any): Promise<any>;
      unenroll(params: any): Promise<any>;
      listFactors(): Promise<any>;
      getAuthenticatorAssuranceLevel(): Promise<any>;
      [key: string]: any;
    };
    [key: string]: any;
  }
}
