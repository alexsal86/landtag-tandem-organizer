import { expect, it, vi } from "vitest";
import type { TestContext } from "../types";
import { responsibilitiesScenario } from "./responsibilities";
import { topicLinkingScenario } from "./topic-linking";

/**
 * Wie der echte Supabase-Client: `rpc` ist eine Methode und liest `this.rest`.
 * Ein losgelöster Aufruf (`const rpc = supabase.rpc; rpc(...)`) scheitert hier
 * genauso mit „Cannot read properties of undefined (reading 'rest')“.
 */
const client = vi.hoisted(() => {
  const restRpc = vi.fn<(fn: string, args?: Record<string, unknown>) => Promise<unknown>>();
  return {
    rest: { rpc: restRpc },
    from: vi.fn(),
    rpc(fn: string, args?: Record<string, unknown>) {
      return this.rest.rpc(fn, args);
    },
  };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: client }));

it("ruft die Server-Selbsttests der Themen und Zuständigkeiten gebunden auf", async () => {
  client.rest.rpc.mockImplementation(async (fn) => {
    if (fn.startsWith("dispatch_")) return { error: { code: "42501" } };
    return { data: { ok: true, checks: {} }, error: null };
  });

  const ctx: TestContext = {
    runId: "test-run", tenantId: "office", userId: "user", created: [], storageObjects: [],
    trackRecord: vi.fn(), trackStorage: vi.fn(), data: {},
  };
  const steps = [
    ["ministry-topic-cloud", topicLinkingScenario],
    ["module-rules-seed", topicLinkingScenario],
    ["topic-mention-server-only", responsibilitiesScenario],
    ["topic-mention-delivery", responsibilitiesScenario],
  ] as const;

  for (const [id, scenario] of steps) {
    const step = scenario.steps.find((candidate) => candidate.id === id);
    expect(step, `Schritt ${id} fehlt`).toBeDefined();
    await expect(step!.run(ctx)).resolves.toMatchObject({ ok: true });
  }
});
