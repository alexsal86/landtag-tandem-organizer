

## Plan: Fix Entscheidungen nicht geladen — supabase-fix.d.ts bricht Typen

### Root Cause

Die Datei `src/supabase-fix.d.ts` deklariert das gesamte `@supabase/supabase-js` Modul neu — aber enthält nur `createClient`, `SupabaseClient` und ein paar Utility-Typen. **Alle anderen Exports werden dadurch unsichtbar**: `User`, `Session`, `RealtimePostgresChangesPayload`, `RealtimeChannel`.

Diese werden in 15+ Dateien importiert (`useAuth.tsx`, `useNotifications.tsx`, `useNavigationNotifications.tsx`, etc.). Das führt zu Build-Fehlern, die den gesamten App-Build brechen — einschließlich der Entscheidungen.

### Fix

**Datei: `src/supabase-fix.d.ts`** — Alle fehlenden Typen hinzufügen, die im Projekt verwendet werden:

```typescript
declare module '@supabase/supabase-js' {
  export function createClient<Database = any, SchemaName extends string & keyof Database = 'public' extends keyof Database ? 'public' : string & keyof Database>(
    supabaseUrl: string,
    supabaseKey: string,
    options?: any,
  ): any;

  export class SupabaseClient<Database = any, SchemaName extends string = string> {}
  export type SupabaseClientOptions<SchemaName extends string = string> = Record<string, any>;
  export type QueryResult<T> = T extends PromiseLike<infer U> ? U : never;
  export type QueryData<T> = T extends PromiseLike<{ data: infer U }> ? NonNullable<U> : never;
  export type QueryError = any;

  // Missing types that are imported throughout the project:
  export interface User { id: string; email?: string; [key: string]: any; }
  export interface Session { access_token: string; user: User; [key: string]: any; }
  export type RealtimePostgresChangesPayload<T = any> = any;
  export type RealtimeChannel = any;
  export type AuthChangeEvent = string;
}
```

This single change should unblock the build and restore the Entscheidungen view.

### Technical Notes
- The root issue is that TypeScript `declare module` **replaces** the entire module's type surface — it doesn't augment it
- A proper long-term fix would be to resolve the Bun symlink issue instead of shimming types, but this shim is the quickest path forward
- All 18 files importing from `@supabase/supabase-js` will work again after this fix

