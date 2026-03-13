import { vi } from "vitest";

type MockSession = { user: { id: string; email?: string | null } } | null;

type QueryResult = {
  data: unknown;
  error: unknown;
};

const state = {
  session: null as MockSession,
  tenantMemberships: [] as unknown[],
  tableResults: new Map<string, QueryResult>(),
  functionResults: new Map<string, { data?: unknown; error?: unknown }>(),
  storageUploadResult: { data: null as unknown, error: null as unknown },
};

const subscription = { unsubscribe: vi.fn() };

class MockQueryBuilder {
  private filters: Record<string, unknown> = {};

  constructor(
    private readonly table: string,
    private operation: "select" | "update" | "delete" | "insert" | null = null,
  ) {}

  select = vi.fn((_query?: string) => {
    this.operation = "select";
    return this;
  });

  update = vi.fn((_values?: unknown) => {
    this.operation = "update";
    return this;
  });

  delete = vi.fn(() => {
    this.operation = "delete";
    return this;
  });

  insert = vi.fn((_rows?: unknown) => {
    this.operation = "insert";
    return this;
  });

  order = vi.fn((_column: string, _options?: unknown) => this);

  single = vi.fn(() => Promise.resolve(this.resolve()));

  in = vi.fn((_column: string, _values: unknown[]) => Promise.resolve(this.resolve()));

  eq = vi.fn((column: string, value: unknown) => {
    this.filters[column] = value;
    return this;
  });

  limit = vi.fn((_count: number) => Promise.resolve(this.resolve()));

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.resolve()).then(onfulfilled, onrejected);
  }

  private resolve(): QueryResult {
    if (this.table === "user_tenant_memberships" && this.operation === "select") {
      return { data: state.tenantMemberships, error: null };
    }

    return state.tableResults.get(this.table) ?? { data: [], error: null };
  }
}

export const mockSupabaseClient = {
  supabase: {
    from: vi.fn((table: string) => new MockQueryBuilder(table)),
    functions: {
      invoke: vi.fn((name: string) => Promise.resolve(state.functionResults.get(name) ?? { data: {}, error: null })),
    },
    storage: {
      from: vi.fn((_bucket: string) => ({
        upload: vi.fn(() => Promise.resolve(state.storageUploadResult)),
      })),
    },
    auth: {
      onAuthStateChange: vi.fn(
        (_callback: (_event: string, _session: MockSession) => void) => ({
          data: { subscription },
        }),
      ),
      getSession: vi.fn(() => Promise.resolve({ data: { session: state.session }, error: null })),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
    },
  },
  setSession(session: MockSession) {
    state.session = session;
  },
  setTenantMemberships(memberships: unknown[]) {
    state.tenantMemberships = memberships;
  },
  setTableResult(table: string, result: QueryResult) {
    state.tableResults.set(table, result);
  },
  setFunctionResult(name: string, result: { data?: unknown; error?: unknown }) {
    state.functionResults.set(name, result);
  },
  setStorageUploadResult(result: { data?: unknown; error?: unknown }) {
    state.storageUploadResult = { data: null, error: null, ...result };
  },
  reset() {
    state.session = null;
    state.tenantMemberships = [];
    state.tableResults.clear();
    state.functionResults.clear();
    state.storageUploadResult = { data: null, error: null };

    subscription.unsubscribe.mockClear();
    this.supabase.from.mockClear();
    this.supabase.functions.invoke.mockClear();
    this.supabase.storage.from.mockClear();
    this.supabase.auth.onAuthStateChange.mockClear();
    this.supabase.auth.getSession.mockClear();
    this.supabase.auth.signOut.mockClear();
  },
};
