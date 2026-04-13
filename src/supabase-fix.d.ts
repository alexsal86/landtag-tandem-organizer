// Workaround for bun symlink resolution issue with @supabase/supabase-js types.
// tsc cannot resolve re-exports through bun's .bun/ symlink structure.
declare module '@supabase/supabase-js' {
  export function createClient<
    Database = any,
    SchemaName extends string & keyof Database = 'public' extends keyof Database
      ? 'public'
      : string & keyof Database,
  >(
    supabaseUrl: string,
    supabaseKey: string,
    options?: any,
  ): any;

  export class SupabaseClient<Database = any, SchemaName extends string = string> {}
  export type SupabaseClientOptions<SchemaName extends string = string> = Record<string, any>;
  export type QueryResult<T> = T extends PromiseLike<infer U> ? U : never;
  export type QueryData<T> = T extends PromiseLike<{ data: infer U }> ? NonNullable<U> : never;
  export type QueryError = any;

  // Types imported throughout the project:
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

  export type RealtimeChannel = {
    on(event: string, opts: Record<string, unknown>, callback: (payload: unknown) => void): RealtimeChannel;
    subscribe(callback?: (status: string) => void): RealtimeChannel;
    unsubscribe(): void;
    [key: string]: unknown;
  };

  export type AuthChangeEvent =
    | 'SIGNED_IN'
    | 'SIGNED_OUT'
    | 'TOKEN_REFRESHED'
    | 'USER_UPDATED'
    | 'PASSWORD_RECOVERY'
    | 'INITIAL_SESSION';

  export type AuthError = { message: string; status?: number; [key: string]: unknown };
  export type AuthResponse = { data: { user: User | null; session: Session | null }; error: AuthError | null };
  export type AuthTokenResponsePassword = { data: { user: User; session: Session }; error: null } | { data: { user: null; session: null }; error: AuthError };
  export type Subscription = { id: string; unsubscribe(): void; [key: string]: unknown };
  export type MFAListFactorsResponse = { data: { totp: unknown[]; phone: unknown[]; all: unknown[] }; error: AuthError | null };
}
