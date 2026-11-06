import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ScenarioRunState, TestScenario, TestStep } from "./types";

const mock = vi.hoisted(() => ({
  role: "bueroleitung", session: true, membership: true, denyDelete: false,
  rows: new Set<string>(), deletes: [] as string[], storageError: false,
  getSession: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getSession: mock.getSession },
  from: (table: string) => {
    let id = "";
    let deleting = false;
    const query = {
      select: () => query,
      eq: (key: string, value: string) => { if (key === "id") id = value; return query; },
      delete: () => { deleting = true; return query; },
      maybeSingle: async () => ({ data: table === "user_tenant_memberships" ? mock.membership ? { id: "m1", role: mock.role } : null : mock.rows.has(id) ? { id } : null, error: null }),
      then: (resolve: (value: unknown) => void) => {
        if (deleting) { mock.deletes.push(`${table}/${id}`); if (!mock.denyDelete) mock.rows.delete(id); }
        return Promise.resolve({ error: null, data: null }).then(resolve);
      },
    };
    return query;
  },
  storage: { from: () => ({ remove: async () => ({ error: mock.storageError ? new Error("Datei gesperrt") : null }) }) },
} }));

import { cleanupCreated, runScenario, runSuite } from "./runner";

const scenario = (steps: TestStep[], extra: Partial<TestScenario> = {}): TestScenario => ({ id: "test", title: "Test", description: "Test", features: [], touches: ["tasks"], steps, ...extra });
const options = () => ({ tenantId: "tenant-1", userId: "user-1", onUpdate: vi.fn<(state: ScenarioRunState) => void>() });
const ok: TestStep = { id: "ok", label: "OK", run: async () => ({ ok: true, message: "OK" }) };

beforeEach(() => {
  mock.role = "bueroleitung"; mock.session = true; mock.membership = true; mock.denyDelete = false; mock.storageError = false;
  mock.rows.clear(); mock.deletes.length = 0;
  mock.getSession.mockImplementation(async () => ({ data: { session: mock.session ? { access_token: "test-only", user: { id: "user-1" } } : null }, error: null }));
});

describe("Selbsttest-Runner", () => {
  it("führt reine Regeln ohne Anmeldung und ohne Preflight aus", async () => {
    mock.session = false;
    const result = await runScenario(scenario([{ ...ok, kind: "logic" }]), options());
    expect(result.status).toBe("ok");
    expect(mock.getSession).not.toHaveBeenCalled();
  });
  it.each(["session", "membership", "role"])("kennzeichnet fehlende Voraussetzung %s als blockiert, ohne zu schreiben", async missing => {
    if (missing === "session") mock.session = false;
    if (missing === "membership") mock.membership = false;
    if (missing === "role") mock.role = "mitarbeiter";
    const run = vi.fn(ok.run);
    const result = await runScenario(scenario([{ ...ok, run }], { requiredRoles: ["bueroleitung"] }), options());
    expect(result.status).toBe("blocked"); expect(result.steps[0].status).toBe("skipped"); expect(run).not.toHaveBeenCalled();
  });
  it("räumt auch nach einer Exception auf und überspringt abhängige Schritte", async () => {
    const next = vi.fn(ok.run);
    const config = options();
    const result = await runScenario(scenario([{ id: "write", label: "Schreiben", run: async ctx => {
      mock.rows.add("created"); ctx.trackRecord({ table: "tasks", id: "created" }); throw new Error("Speichern abgebrochen");
    } }, { ...ok, run: next }]), config);
    expect(result.status).toBe("failed"); expect(result.cleanup.status).toBe("ok"); expect(mock.rows.size).toBe(0); expect(next).not.toHaveBeenCalled();
    expect(config.onUpdate.mock.calls.some(([s]) => s.records.some(r => r.id === "created") && s.steps[0].status === "running")).toBe(true);
    expect(config.onUpdate.mock.calls[0][0].cleanup.status).toBe("pending");
  });
  it("ignoriert den fehlgeschlagenen nichtkritischen Schritt nicht im Gesamtergebnis", async () => {
    const next = vi.fn(ok.run);
    const result = await runScenario(scenario([{ ...ok, id: "fail", critical: false, run: async () => ({ ok: false, message: "Fehler" }) }, { ...ok, run: next }]), options());
    expect(next).toHaveBeenCalled(); expect(result.status).toBe("failed");
  });
  it("wartet den laufenden Schreibschritt vor Abbruch und Cleanup ab", async () => {
    const controller = new AbortController();
    const next = vi.fn(ok.run);
    const result = await runScenario(scenario([{ ...ok, run: async ctx => {
      controller.abort(); await Promise.resolve(); mock.rows.add("late"); ctx.trackRecord({ table: "tasks", id: "late" }); return { ok: true, message: "Gespeichert" };
    } }, { ...ok, id: "next", run: next }]), { ...options(), signal: controller.signal, keepData: true });
    expect(result.status).toBe("cancelled"); expect(next).not.toHaveBeenCalled(); expect(mock.rows.size).toBe(0); expect(result.cleanup.status).toBe("ok");
  });
  it("meldet einen durch RLS wirkungslosen DELETE als Cleanup-Fehler", async () => {
    mock.rows.add("protected"); mock.denyDelete = true;
    const result = await cleanupCreated([{ table: "tasks", id: "protected" }]);
    expect(result.ok).toBe(false); expect(result.remaining).toHaveLength(1);
  });
  it("entfernt Antworten vor Teilnehmern und nur bekannte Tabellen", async () => {
    await cleanupCreated([{ table: "task_decision_participants", id: "p" }, { table: "task_decision_responses", id: "r" }]);
    expect(mock.deletes).toEqual(["task_decision_responses/r", "task_decision_participants/p"]);
    const result = await cleanupCreated([{ table: "user_roles", id: "unrelated" }]);
    expect(result.ok).toBe(false); expect(mock.deletes).not.toContain("user_roles/unrelated");
  });
  it("berücksichtigt fehlgeschlagenes Datei-Cleanup", async () => {
    mock.storageError = true;
    const result = await cleanupCreated([], [{ bucket: "documents", path: "test/file.txt" }]);
    expect(result.ok).toBe(false); expect(result.storageRemaining).toHaveLength(1);
  });
  it("führt unabhängige Szenarien trotz eines Fehlers weiter aus", async () => {
    const results = await runSuite([scenario([{ ...ok, run: async () => { throw new Error("defekt"); } }]), scenario([ok], { id: "second" })], options());
    expect(results.map(r => r.status)).toEqual(["failed", "ok"]);
    expect(results[0].runId).not.toBe(results[1].runId);
  });
  it("behält Demo-Daten nur bei vollständig erfolgreichem Lauf", async () => {
    const write: TestStep = { ...ok, run: async ctx => { mock.rows.add("demo"); ctx.trackRecord({ table: "tasks", id: "demo" }); return { ok: true, message: "OK" }; } };
    const result = await runScenario(scenario([write]), { ...options(), keepData: true });
    expect(result.cleanup.status).toBe("skipped"); expect(mock.rows.has("demo")).toBe(true);
    const failed = await runScenario(scenario([write, { ...ok, id: "fail", run: async () => ({ ok: false, message: "Fehler" }) }]), { ...options(), keepData: true });
    expect(failed.cleanup.status).toBe("ok"); expect(mock.rows.size).toBe(0);
  });
});
