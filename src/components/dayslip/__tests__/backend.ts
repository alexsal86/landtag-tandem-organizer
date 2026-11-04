// In-memory Supabase boundary for the persistence and lifecycle regression tests.
export function createBackend() {
  const tables = new Map<string, Record<string, unknown>[]>();
  const writes: Array<{ table: string; rows: Record<string, unknown>[] }> = [];
  const failures = new Map<string, { message: string; code?: string }>();
  const lostResponses = new Set<string>();
  const listeners: Array<{ table: string; callback: (payload: { new: Record<string, unknown> }) => void }> = [];
  let gate: Promise<void> | undefined;
  return {
    tables, writes, failures, lostResponses,
    pauseNextWrite: (promise: Promise<void>) => { gate = promise; },
    from(table: string) {
      let operation = "select";
      let payload: Record<string, unknown>[] = [];
      let single = false;
      const filters: Array<[string, unknown]> = [];
      const execute = async () => {
        if (operation !== "select" && gate) { const wait = gate; gate = undefined; await wait; }
        const fail = failures.get(`${table}:${operation}`);
        if (fail) return { data: null, error: fail };
        const existing = tables.get(table) ?? [];
        if (operation === "select") {
          const rows = existing.filter(row => filters.every(([key, value]) => row[key] === value));
          return { data: single ? rows[0] ?? null : rows, error: null };
        }
        writes.push({ table, rows: structuredClone(payload) });
        for (const row of payload) {
          const index = existing.findIndex(old => table === "day_slips" ? old.user_id === row.user_id && old.day_key === row.day_key : table === "user_preferences" ? old.user_id === row.user_id && old.tenant_id === row.tenant_id && old.key === row.key : old.id === row.id);
          if (operation === "insert" && index >= 0) return { data: null, error: { code: "23505", message: "duplicate" } };
          if (index >= 0) existing[index] = structuredClone(row); else existing.push(structuredClone(row));
        }
        tables.set(table, existing);
        if (lostResponses.delete(table)) return { data: null, error: { message: "response lost" } };
        return { data: null, error: null };
      };
      const builder = {
        select: () => builder,
        eq: (key: string, value: unknown) => { filters.push([key, value]); return builder; },
        in: () => builder, or: () => builder, is: () => builder, neq: () => builder, gte: () => builder, lt: () => builder,
        upsert: (rows: Record<string, unknown> | Record<string, unknown>[]) => { operation = "upsert"; payload = Array.isArray(rows) ? rows : [rows]; return builder; },
        insert: (rows: Record<string, unknown> | Record<string, unknown>[]) => { operation = "insert"; payload = Array.isArray(rows) ? rows : [rows]; return builder; },
        maybeSingle: () => { single = true; return execute(); },
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => execute().then(resolve, reject),
      };
      return builder;
    },
    emit: (table: string, row: Record<string, unknown>) => listeners.filter(listener => listener.table === table).forEach(listener => listener.callback({ new: row })),
    channel: () => {
      const channel = {
        on: (_event: string, filter: { table: string }, callback: (payload: { new: Record<string, unknown> }) => void) => { listeners.push({ table: filter.table, callback }); return channel; },
        subscribe: () => channel,
      };
      return channel;
    },
    removeChannel: async () => {},
    reset() { tables.clear(); writes.length = 0; failures.clear(); lostResponses.clear(); listeners.length = 0; gate = undefined; },
  };
}
