// Type augmentation for @supabase/supabase-js
// Adds missing members while preserving all original exports (including createClient).

import '@supabase/supabase-js';

declare module '@supabase/supabase-js' {
  // Re-export createClient so the augmentation doesn't shadow it
  export function createClient<T = any>(url: string, key: string, options?: any): any;

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
}
