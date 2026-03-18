// Global type overrides for @supabase/postgrest-js
// Fixes {} / unknown return types from Supabase queries when Database generic
// doesn't resolve properly with the installed supabase-js version.

declare module '@supabase/postgrest-js' {
  // Make all response data resolve to `any` instead of `{}` or `unknown`
  export class PostgrestBuilder<Result> {
    then<TResult1 = any, TResult2 = never>(
      onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
    ): Promise<TResult1 | TResult2>;
  }
  
  export class PostgrestTransformBuilder<Schema, Row, Result, RelationName = unknown, Relationships = unknown> extends PostgrestBuilder<Result> {
    single(): this;
    maybeSingle(): this;
    csv(): this;
    order(column: any, options?: any): this;
    limit(count: number, options?: any): this;
    range(from: number, to: number, options?: any): this;
    abortSignal(signal: AbortSignal): this;
    returns<NewResult>(): PostgrestTransformBuilder<Schema, Row, NewResult, RelationName, Relationships>;
  }

  export class PostgrestFilterBuilder<Schema, Row, Result, RelationName = unknown, Relationships = unknown> extends PostgrestTransformBuilder<Schema, Row, Result, RelationName, Relationships> {
    eq(column: string, value: any): this;
    neq(column: string, value: any): this;
    gt(column: string, value: any): this;
    gte(column: string, value: any): this;
    lt(column: string, value: any): this;
    lte(column: string, value: any): this;
    like(column: string, pattern: string): this;
    ilike(column: string, pattern: string): this;
    is(column: string, value: any): this;
    in(column: string, values: any[]): this;
    contains(column: string, value: any): this;
    containedBy(column: string, value: any): this;
    filter(column: string, operator: string, value: any): this;
    not(column: string, operator: string, value: any): this;
    or(filters: string, options?: any): this;
    match(query: Record<string, any>): this;
    textSearch(column: string, query: string, options?: any): this;
    select(columns?: string): this;
  }

  export class PostgrestQueryBuilder<Schema, Row, Result, RelationName = unknown, Relationships = unknown> {
    select(columns?: string, options?: any): PostgrestFilterBuilder<Schema, any, any, RelationName, Relationships>;
    insert(values: any, options?: any): PostgrestFilterBuilder<Schema, any, any, RelationName, Relationships>;
    update(values: any, options?: any): PostgrestFilterBuilder<Schema, any, any, RelationName, Relationships>;
    upsert(values: any, options?: any): PostgrestFilterBuilder<Schema, any, any, RelationName, Relationships>;
    delete(options?: any): PostgrestFilterBuilder<Schema, any, any, RelationName, Relationships>;
  }
}
