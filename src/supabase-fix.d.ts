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
}
