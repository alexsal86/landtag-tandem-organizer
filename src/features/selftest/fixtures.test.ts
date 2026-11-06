import { describe, expect, it, vi } from "vitest";
const insert = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ insert }) } }));
import { testDay } from "./fixtures";
import { daySlipLifecycleScenario } from "./scenarios/day-slip-lifecycle";
import type { TestContext } from "./types";

describe("Isolierte Tageszettel", () => {
  it("verwendet je Lauf andere gültige Tage und erhält deren Reihenfolge", () => {
    const first = "00000000-0000-4000-8000-000000000001";
    const second = "11111111-1111-4111-8111-111111111111";
    expect(testDay(first)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(testDay(first)).not.toBe(testDay(second));
    expect(testDay(first, 1) > testDay(first)).toBe(true);
    expect(testDay(first)).toBe(testDay(first));
  });
  it("lässt einen bestehenden Tageszettel bei einer Kollision unangetastet", async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { code: "23505", message: "unique violation" } });
    insert.mockReturnValue({ select: () => ({ single }) });
    const ctx: TestContext = { runId: crypto.randomUUID(), tenantId: "office", userId: "user", data: {}, created: [], storageObjects: [], trackRecord: vi.fn(), trackStorage: vi.fn() };
    const result = await daySlipLifecycleScenario.steps[0].run(ctx);
    expect(result.ok).toBe(false); expect(ctx.trackRecord).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ day_key: testDay(ctx.runId) }));
    // Der Adapter bietet absichtlich weder DELETE noch UPSERT an.
  });
});
