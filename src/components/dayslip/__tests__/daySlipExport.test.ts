import { webcrypto } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { CORE_TASK_STATUS_KEYS } from "@/components/tasks/types";
import { createExportTarget } from "../daySlipExport";
import type { createBackend } from "./backend";

vi.mock("@/integrations/supabase/client", async () => {
  const { createBackend } = await import("./backend");
  return { supabase: createBackend() };
});
const db = supabase as unknown as ReturnType<typeof createBackend>;

beforeEach(() => {
  db.reset();
  Object.defineProperty(crypto, "subtle", { configurable: true, value: webcrypto.subtle });
});

describe("Tageszettel-Export in eine Aufgabe", () => {
  it("schreibt einen registrierten Kernstatus, den enforce_task_status akzeptiert", async () => {
    await createExportTarget({
      userId: "user-a",
      tenantId: "tenant",
      dayKey: "2026-11-27",
      lineId: "line-1",
      text: "! Rückruf Klärung",
      target: "task",
      taskOptions: { assignedTo: "user-a" },
    });

    const write = db.writes.find(entry => entry.table === "tasks");
    expect(write).toBeTruthy();
    expect(CORE_TASK_STATUS_KEYS).toContain(write?.rows[0]?.status);
    expect(write?.rows[0]?.status).toBe("todo");
  });
});
