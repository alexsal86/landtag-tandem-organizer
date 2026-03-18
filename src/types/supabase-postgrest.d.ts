// Global type overrides for @supabase/postgrest-js
// Fixes {} return type from .select() queries when Database generic
// doesn't resolve properly with the installed supabase-js version.

declare module '@supabase/postgrest-js' {
  interface PostgrestFilterBuilder<Schema, Row, Result, RelationName, Relationships> {
    then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any): Promise<any>;
  }
  interface PostgrestTransformBuilder<Schema, Row, Result, RelationName, Relationships> {
    then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any): Promise<any>;
  }
  interface PostgrestQueryBuilder<Schema, Row, Result, RelationName, Relationships> {
    select(columns?: string, options?: any): any;
    insert(values: any, options?: any): any;
    update(values: any, options?: any): any;
    upsert(values: any, options?: any): any;
    delete(options?: any): any;
  }
  interface PostgrestBuilder<Result> {
    then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any): Promise<any>;
  }
}
